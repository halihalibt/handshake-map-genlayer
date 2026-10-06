import type {
  Action,
  Address,
  ContractPort,
  LifecyclePort,
  PendingTx,
  Receipt,
  TxId,
  Workspace,
  WorkspaceId,
} from "./contract";
import { derivePairs, validWorkspaceId, sameAddress } from "./contract";
import { boundedRead, errorCode } from "./errors";
export const TX_KEY = "clausemesh-v1:pending-transaction";
export type Stage =
  | "Idle"
  | "Submitting transaction"
  | "Transaction submitted"
  | "Waiting for transaction decision"
  | "Running GenLayer consensus"
  | "Waiting for finalization"
  | "Resuming transaction lifecycle"
  | "Reading finalized result"
  | "Workspace created"
  | "Response sealed"
  | "Workspace reconciled";
export interface TxSnapshot {
  stage: Stage;
  pending?: PendingTx;
  lastId?: TxId;
  error?: string;
  workspaceId?: WorkspaceId;
  workspace?: Workspace;
  active: boolean;
}
export class Transactions {
  private snapshot: TxSnapshot = { stage: "Idle", active: false };
  private listeners = new Set<() => void>();
  private waiter?: Promise<void>;
  constructor(
    private contract: ContractPort,
    private lifecycle: LifecyclePort,
    private storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
    private sleep?: (ms: number) => Promise<void>,
  ) {
    try {
      const raw = storage.getItem(TX_KEY);
      if (raw) {
        const p = JSON.parse(raw) as PendingTx;
        if (
          typeof p.id === "string" &&
          p.id.length > 0 &&
          ["create_workspace", "respond_and_seal", "reconcile"].includes(
            p.action,
          ) &&
          /^0x[0-9a-fA-F]{40}$/.test(p.account) &&
          (p.action === "create_workspace" || validWorkspaceId(p.workspaceId))
        )
          this.snapshot = {
            stage: "Transaction submitted",
            pending: p,
            lastId: p.id,
            active: false,
          };
      }
    } catch {
      /* Storage unavailable: live in-memory tx remains safe. */
    }
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(changes: Partial<TxSnapshot>) {
    this.snapshot = { ...this.snapshot, ...changes };
    this.listeners.forEach((l) => l());
  }
  async submit(
    action: Action,
    account: Address,
    write: () => Promise<TxId>,
    workspaceId?: WorkspaceId,
    create?: PendingTx["create"],
  ): Promise<void> {
    if (this.snapshot.pending || this.snapshot.active)
      throw new Error("TX_PENDING");
    this.update({
      stage: "Submitting transaction",
      active: true,
      error: undefined,
      workspaceId: undefined,
      lastId: undefined,
    });
    let id: TxId;
    try {
      id = await write();
    } catch (e) {
      this.update({
        active: false,
        error: errorCode(e, "EXECUTION_FAILED"),
        stage: "Idle",
      });
      return;
    }
    const pending: PendingTx = {
      id,
      action,
      account,
      ...(workspaceId ? { workspaceId } : {}),
      ...(create ? { create } : {}),
    };
    this.update({ pending, lastId: id, stage: "Transaction submitted" });
    try {
      this.storage.setItem(TX_KEY, JSON.stringify(pending));
    } catch {
      /* Never resend if persistence fails. */
    }
    return this.resume();
  }
  resume(): Promise<void> {
    if (this.waiter) return this.waiter;
    if (!this.snapshot.pending) return Promise.resolve();
    // Deferred start lets the waiter lock exist before a subscriber can request another resume.
    this.waiter = Promise.resolve()
      .then(() => this.run())
      .finally(() => {
        this.waiter = undefined;
        this.update({ active: false });
      });
    this.update({
      active: true,
      error: undefined,
      stage: "Resuming transaction lifecycle",
    });
    return this.waiter;
  }
  private async run() {
    const pending = this.snapshot.pending!;
    try {
      this.update({ stage: "Waiting for transaction decision" });
      const decision = await boundedRead(
        () =>
          this.lifecycle.waitForDecision(pending.id, () => {
            if (pending.action === "reconcile")
              this.update({ stage: "Running GenLayer consensus" });
          }),
        this.sleep,
      );
      this.check(decision);
      this.update({ stage: "Waiting for finalization" });
      const final = await boundedRead(
        () => this.lifecycle.waitForFinalization(pending.id),
        this.sleep,
      );
      this.check(final);
      this.update({ stage: "Reading finalized result" });
      // A create result must identify the workspace exactly; never guess by latest history/label.
      let id =
        pending.workspaceId ??
        final.createdWorkspaceId ??
        decision.createdWorkspaceId;
      if (!validWorkspaceId(id) && pending.action === 'create_workspace' && pending.create) {
        const summaries = await boundedRead(() => this.contract.get_workspace_summaries(pending.account), this.sleep);
        const matches = summaries.filter(w => sameAddress(w.party_a,pending.account) && sameAddress(w.party_b,pending.create!.counterparty) && w.label===pending.create!.label);
        id = matches.reduce<WorkspaceId|undefined>((highest,w) => !highest || BigInt(w.id)>BigInt(highest) ? w.id : highest, undefined);
      }
      if (!validWorkspaceId(id)) throw new Error("STATUS_UNAVAILABLE");
      const workspace = await boundedRead(
        () => this.contract.get_workspace(id),
        this.sleep,
      );
      if (String(workspace.id) !== String(id)) throw new Error("READ_FAILED");
      derivePairs(workspace);
      if (
        (pending.action === "respond_and_seal" &&
          !workspace.party_b_submitted) ||
        (pending.action === "reconcile" && !workspace.reconciled)
      )
        throw new Error("STATUS_UNAVAILABLE");
      try {
        this.storage.removeItem(TX_KEY);
      } catch {
        /* In-memory boundary remains authoritative. */
      }
      this.update({
        pending: undefined,
        workspaceId: id,
        workspace,
        stage:
          pending.action === "create_workspace"
            ? "Workspace created"
            : pending.action === "respond_and_seal"
              ? "Response sealed"
              : "Workspace reconciled",
      });
    } catch (e) {
      this.update({ error: errorCode(e, "STATUS_UNAVAILABLE") });
    }
  }
  private check(receipt: Receipt) {
    if (receipt.outcome === "SUCCESS") return;
    // Actual terminal outcome is known. User may initiate a new action; no automatic resubmission.
    try {
      this.storage.removeItem(TX_KEY);
    } catch {
      /* In-memory boundary remains authoritative. */
    }
    this.update({ pending: undefined });
    throw new Error(
      receipt.error ?? (receipt.outcome === "UNDETERMINED"
        ? "CONSENSUS_UNDETERMINED"
        : "EXECUTION_FAILED"),
    );
  }
}
