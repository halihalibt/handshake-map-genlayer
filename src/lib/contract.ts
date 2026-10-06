export type Address = `0x${string}`;
export type TxId = string;
// Decimal strings preserve the full frozen u64 domain beyond JS safe integers.
export type WorkspaceId = number | string;
export const validWorkspaceId = (id: unknown): id is WorkspaceId => {
  if (typeof id === "number") return Number.isSafeInteger(id) && id > 0;
  if (typeof id !== "string" || !/^[1-9]\d*$/.test(id)) return false;
  return BigInt(id) <= 18446744073709551615n;
};
// Match Python 3.12 str.strip exactly, including NEL and excluding U+FEFF.
export const trimInput = (value: string) =>
  value.replace(
    /^[\u0009-\u000D\u001C-\u0020\u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+|[\u0009-\u000D\u001C-\u0020\u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+$/gu,
    "",
  );
export type Relation = 0 | 1 | 2 | 3;
export type Status = "WAITING_FOR_B" | "READY" | "RECONCILED";
export interface Workspace {
  id: WorkspaceId;
  label: string;
  party_a: Address;
  party_b: Address;
  clauses_a: string[];
  clauses_b: string[];
  party_b_submitted: boolean;
  reconciled: boolean;
  relation_matrix: Relation[];
  derived_status: Status;
}
export interface WorkspaceSummary {
  id: WorkspaceId;
  label: string;
  party_a: Address;
  party_b: Address;
  status: Status;
}
// The frozen six methods. Phase 4 supplies wallet-backed writes and wallet-independent reads.
export interface ContractPort {
  create_workspace(
    counterparty: Address,
    label: string,
    clauses_a: string[],
    sender: Address,
  ): Promise<TxId>;
  respond_and_seal(
    id: WorkspaceId,
    clauses_b: string[],
    sender: Address,
  ): Promise<TxId>;
  reconcile(id: WorkspaceId, sender: Address): Promise<TxId>;
  get_workspace(id: WorkspaceId): Promise<Workspace>;
  get_workspace_summaries(address: Address): Promise<WorkspaceSummary[]>;
  get_relation(
    id: WorkspaceId,
    a_index: number,
    b_index: number,
  ): Promise<Relation>;
}
export type Action = "create_workspace" | "respond_and_seal" | "reconcile";
export interface PendingTx {
  id: TxId;
  action: Action;
  account: Address;
  workspaceId?: WorkspaceId;
  create?: { counterparty: Address; label: string };
}
export interface Receipt {
  error?: string;
  outcome: "SUCCESS" | "FAILED" | "REJECTED" | "UNDETERMINED";
  createdWorkspaceId?: WorkspaceId;
}
export interface LifecyclePort {
  waitForDecision(id: TxId, onConsensus?: () => void): Promise<Receipt>;
  waitForFinalization(id: TxId): Promise<Receipt>;
}
export const relationLabels = [
  "Unrelated",
  "Equivalent",
  "Compatible",
  "Conflict",
] as const;
export const sameAddress = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();
export const deriveStatus = (
  w: Pick<Workspace, "reconciled" | "party_b_submitted">,
): Status =>
  w.reconciled ? "RECONCILED" : w.party_b_submitted ? "READY" : "WAITING_FOR_B";
export const charCount = (text: string) => [...text].length;
export function validateClauses(clauses: string[]): string[] {
  if (clauses.length < 1 || clauses.length > 4)
    throw new Error("INVALID_CLAUSE_COUNT");
  const trimmed = clauses.map(trimInput);
  if (trimmed.some((c) => charCount(c) < 3 || charCount(c) > 240))
    throw new Error("INVALID_CLAUSE");
  return trimmed;
}
export function validateCreate(
  sender: Address,
  counterparty: string,
  label: string,
  clauses: string[],
) {
  if (
    !/^0x[0-9a-fA-F]{40}$/.test(counterparty) ||
    /^0x0{40}$/i.test(counterparty) ||
    sameAddress(sender, counterparty)
  )
    throw new Error("INVALID_COUNTERPARTY");
  if (charCount(trimInput(label)) > 80) throw new Error("INVALID_LABEL");
  return {
    counterparty: counterparty as Address,
    label: trimInput(label),
    clauses: validateClauses(clauses),
  };
}
export function derivePairs(w: Workspace) {
  const agreement: { a: number; b: number; code: Relation }[] = [],
    conflict: typeof agreement = [],
    unrelated: typeof agreement = [];
  if (!w.reconciled) return { agreement, conflict, unrelated };
  if (
    w.relation_matrix.length !== w.clauses_a.length * w.clauses_b.length ||
    w.relation_matrix.some((c) => !Number.isInteger(c) || c < 0 || c > 3)
  )
    throw new Error("READ_FAILED");
  w.relation_matrix.forEach((code, i) => {
    const pair = {
      a: Math.floor(i / w.clauses_b.length),
      b: i % w.clauses_b.length,
      code,
    };
    (code === 1 || code === 2
      ? agreement
      : code === 3
        ? conflict
        : unrelated
    ).push(pair);
  });
  return { agreement, conflict, unrelated };
}
