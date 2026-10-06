const messages: Record<string, string> = {
  WALLET_REJECTED: "Wallet request rejected. You can try again.",
  WALLET_UNAVAILABLE: "An injected EVM wallet is required.",
  WRONG_NETWORK: "Switch your wallet to Studionet to continue.",
  INVALID_COUNTERPARTY:
    "Enter a valid, nonzero counterparty address different from your wallet.",
  INVALID_LABEL: "Label must contain at most 80 characters.",
  INVALID_CLAUSE_COUNT: "Provide 1–4 clauses.",
  INVALID_CLAUSE: "Each clause must contain 3–240 characters after trimming.",
  UNAUTHORIZED: "This wallet is not authorized to seal the response.",
  ALREADY_SEALED: "This response is already sealed.",
  NOT_READY: "The workspace is not ready to reconcile.",
  ALREADY_RECONCILED: "This workspace has already been reconciled.",
  EXECUTION_FAILED: "Transaction execution failed.",
  CONSENSUS_UNDETERMINED:
    "Consensus is undetermined. The workspace remains unchanged.",
  STATUS_UNAVAILABLE:
    "Transaction status is temporarily unavailable. Resume the original transaction.",
  RPC_RATE_LIMITED: "RPC rate limited. Retry or resume after a short wait.",
  RPC_UNAVAILABLE: "RPC is unavailable. Please retry or resume.",
  READ_FAILED: "Unable to read workspace data. Please retry.",
  WORKSPACE_NOT_FOUND: "Workspace not found.",
  NOT_RECONCILED: "This workspace has not been reconciled.",
  INVALID_RELATION_INDEX: "Invalid relation index.",
  INVALID_CONSENSUS_OUTPUT:
    "Consensus output was invalid. The workspace remains unchanged.",
  TX_PENDING:
    "An existing transaction is unresolved. Resume it before another write.",
};
export class TransportError extends Error {
  constructor(
    public code: string,
    public retryAfterMs = 0,
  ) {
    super(code);
  }
}
export function errorCode(error: unknown, fallback = "READ_FAILED"): string {
  if (error && typeof error === "object") {
    const e = error as { code?: unknown; status?: unknown; message?: unknown };
    if (e.code === 4001) return "WALLET_REJECTED";
    if (e.status === 429 || e.code === 429) return "RPC_RATE_LIMITED";
    if (typeof e.code === "string" && messages[e.code]) return e.code;
    if (typeof e.message === "string")
      for (const code of Object.keys(messages))
        if (new RegExp(`\\b${code}\\b`).test(e.message)) return code;
  }
  return fallback;
}
export const friendlyError = (error: unknown, fallback?: string) =>
  messages[errorCode(error, fallback)];
export const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
// One operation, at most one sequential retry. Never wrap contract writes with this helper.
export async function boundedRead<T>(
  read: () => Promise<T>,
  sleep = delay,
): Promise<T> {
  try {
    return await read();
  } catch (e) {
    if (!["RPC_RATE_LIMITED", "RPC_UNAVAILABLE"].includes(errorCode(e)))
      throw e;
    await sleep(
      e instanceof TransportError ? Math.max(0, e.retryAfterMs) : 1000,
    );
    return read();
  }
}

// Viem may wrap transport/provider failures; preserve the safe code and Retry-After.
export function transportError(error:unknown, fallback='RPC_UNAVAILABLE'):TransportError {
 let current=error;let detected:string|undefined;
 for(let depth=0;depth<8&&current&&typeof current==='object';depth++) {
  if(current instanceof TransportError)return current;
  const code=errorCode(current,fallback);if(code!==fallback)detected??=code;
  current=(current as {cause?:unknown}).cause;
 }
 return new TransportError(detected??errorCode(error,fallback));
}
