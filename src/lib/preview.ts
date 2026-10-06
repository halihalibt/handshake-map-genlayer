// Phase 3 in-memory fake. Never sends RPC or wallet transactions. No fixture persistence.
import type {
  Address,
  ContractPort,
  LifecyclePort,
  Receipt,
  Relation,
  TxId,
  Workspace,
  WorkspaceId,
} from "./contract";
import {
  deriveStatus,
  sameAddress,
  validateClauses,
  validateCreate,
} from "./contract";
export const PARTY_A: Address = "0x1111111111111111111111111111111111111111";
export const PARTY_B: Address = "0x2222222222222222222222222222222222222222";
export const demoWorkspace: Workspace = {
  id: 1,
  label: "Website delivery",
  party_a: PARTY_A,
  party_b: PARTY_B,
  clauses_a: [
    "Reports must be exported as CSV.",
    "Invoices must be paid monthly.",
  ],
  clauses_b: [
    "Reports must never be exported as CSV.",
    "Invoices must be paid monthly.",
  ],
  party_b_submitted: true,
  reconciled: true,
  relation_matrix: [3, 0, 0, 1],
  derived_status: "RECONCILED",
};
export function createPreview(): {
  contract: ContractPort;
  lifecycle: LifecyclePort;
} {
  const workspaces: Workspace[] = [structuredClone(demoWorkspace)];
  const receipts = new Map<TxId, Receipt>();
  let nonce = 0;
  function workspace(id: WorkspaceId) {
    const w = workspaces.find((w) => String(w.id) === String(id));
    if (!w) throw new Error("WORKSPACE_NOT_FOUND");
    return w;
  }
  function submitted(receipt: Receipt = { outcome: "SUCCESS" }) {
    const tx = `preview:${++nonce}`;
    receipts.set(tx, receipt);
    return Promise.resolve(tx);
  }
  const contract: ContractPort = {
    async create_workspace(counterparty, label, clauses, sender) {
      const v = validateCreate(sender, counterparty, label, clauses);
      const id = workspaces.length + 1;
      workspaces.push({
        id,
        label: v.label,
        party_a: sender,
        party_b: counterparty,
        clauses_a: v.clauses,
        clauses_b: [],
        party_b_submitted: false,
        reconciled: false,
        relation_matrix: [],
        derived_status: "WAITING_FOR_B",
      });
      return submitted({ outcome: "SUCCESS", createdWorkspaceId: id });
    },
    async respond_and_seal(id, clauses, sender) {
      const w = workspace(id);
      if (!sameAddress(sender, w.party_b)) throw new Error("UNAUTHORIZED");
      if (w.party_b_submitted) throw new Error("ALREADY_SEALED");
      w.clauses_b = validateClauses(clauses);
      w.party_b_submitted = true;
      w.derived_status = deriveStatus(w);
      return submitted();
    },
    async reconcile(id) {
      const w = workspace(id);
      if (w.reconciled) throw new Error("ALREADY_RECONCILED");
      if (!w.party_b_submitted) throw new Error("NOT_READY");
      w.reconciled = true;
      w.relation_matrix = w.clauses_a.flatMap((a) =>
        w.clauses_b.map((b) => (a === b ? 1 : 0)),
      ) as Relation[];
      w.derived_status = deriveStatus(w);
      return submitted();
    },
    async get_workspace(id) {
      return structuredClone(workspace(id));
    },
    async get_workspace_summaries(address) {
      return workspaces
        .filter(
          (w) =>
            sameAddress(address, w.party_a) ||
            (w.party_b_submitted && sameAddress(address, w.party_b)),
        )
        .map((w) => ({
          id: w.id,
          label: w.label,
          party_a: w.party_a,
          party_b: w.party_b,
          status: deriveStatus(w),
        }));
    },
    async get_relation(id, a, b) {
      const w = workspace(id);
      if (!w.reconciled) throw new Error("NOT_RECONCILED");
      if (a < 0 || b < 0 || a >= w.clauses_a.length || b >= w.clauses_b.length)
        throw new Error("INVALID_RELATION_INDEX");
      return w.relation_matrix[a * w.clauses_b.length + b];
    },
  };
  const lifecycle: LifecyclePort = {
    async waitForDecision(id, onConsensus) {
      onConsensus?.();
      const r = receipts.get(id);
      if (!r) throw new Error("STATUS_UNAVAILABLE");
      return r;
    },
    async waitForFinalization(id) {
      const r = receipts.get(id);
      if (!r) throw new Error("STATUS_UNAVAILABLE");
      return r;
    },
  };
  return { contract, lifecycle };
}
