import { vi } from "vitest";
import type {
  Address,
  ContractPort,
  LifecyclePort,
  Workspace,
} from "../../src/lib/contract";
import type { EIP1193 } from "../../src/lib/wallet";
import { demoWorkspace, PARTY_A } from "../../src/lib/preview";
import { Transactions } from "../../src/lib/transactions";
export function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (v: unknown) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
export class WalletFake implements EIP1193 {
  listeners = new Map<string, Set<(v: unknown) => void>>();
  constructor(
    public account: Address | undefined = PARTY_A,
    public chain = 61999,
    public connected = true,
  ) {}
  request = vi.fn(
    async ({ method, params }: { method: string; params?: unknown[] }) => {
      if (method === "eth_accounts")
        return this.connected && this.account ? [this.account] : [];
      if (method === "eth_requestAccounts") {
        this.connected = true;
        return this.account ? [this.account] : [];
      }
      if (method === "eth_chainId") return `0x${this.chain.toString(16)}`;
      if (method === "wallet_switchEthereumChain") {
        this.chain = Number((params![0] as { chainId: string }).chainId);
        this.emit("chainChanged", `0x${this.chain.toString(16)}`);
        return null;
      }
      throw new Error("unsupported");
    },
  );
  on(event: string, listener: (v: unknown) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
  }
  removeListener(event: string, listener: (v: unknown) => void) {
    this.listeners.get(event)?.delete(listener);
  }
  emit(event: string, value: unknown) {
    this.listeners.get(event)?.forEach((l) => l(value));
  }
}
export function ports(workspace: Workspace = demoWorkspace) {
  const contract: ContractPort = {
    create_workspace: vi.fn().mockResolvedValue("0xoriginal"),
    respond_and_seal: vi.fn().mockResolvedValue("0xoriginal"),
    reconcile: vi.fn().mockResolvedValue("0xoriginal"),
    get_workspace: vi.fn().mockResolvedValue(structuredClone(workspace)),
    get_workspace_summaries: vi.fn().mockResolvedValue([]),
    get_relation: vi.fn().mockResolvedValue(1),
  };
  const lifecycle: LifecyclePort = {
    waitForDecision: vi.fn().mockResolvedValue({
      outcome: "SUCCESS",
      createdWorkspaceId: workspace.id,
    }),
    waitForFinalization: vi.fn().mockResolvedValue({
      outcome: "SUCCESS",
      createdWorkspaceId: workspace.id,
    }),
  };
  const transactions = new Transactions(
    contract,
    lifecycle,
    localStorage,
    async () => {},
  );
  return { contract, lifecycle, transactions };
}
export const readyWorkspace: Workspace = {
  ...demoWorkspace,
  reconciled: false,
  relation_matrix: [],
  derived_status: "READY",
};
export const waitingWorkspace: Workspace = {
  ...readyWorkspace,
  party_b_submitted: false,
  clauses_b: [],
  derived_status: "WAITING_FOR_B",
};
