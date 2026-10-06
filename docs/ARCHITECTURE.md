# Static product architecture and transaction boundary

One Vite/React/TypeScript SPA, Plain CSS, local React hooks/state. No backend, database, server/serverless business logic, external AI service, paid API, analytics service, Router or state/UI/animation framework. Production runtime directly uses genlayer-js 1.1.8 and the real deployed ClauseMesh Contract on Studionet chain 61999 (`0x0Dcb5F452412aB73b32149ad1e082533D929Ed73`).

## Modules

- `src/main.tsx` creates `createIntegration(window.ethereum)` and Transactions; no preview/fake import.
- `src/lib/integration.ts` binds exactly six Contract methods, injected writes and wallet-independent finalized reads; normalizes calldata addresses, exact u64 IDs and row-major codes.
- `src/lib/wallet.ts` handles EIP-1193 connect/local disconnect, account/network events, wrong-network blocking and explicit switching.
- `src/lib/transactions.ts` retains original tx ID/public recovery metadata, guards signing/submission, coalesces active Resume calls and loads finalized state.
- `src/lib/rpc.ts` sanitizes server/node configuration before SDK diagnostics, preserves Retry-After, aborts stalled per-request transport and observes SDK consensus states without extra RPC polling.
- `src/App.tsx` Home or query Workspace mode, forms/permissions/history/lifecycle/error states. Components render exact persisted codes and deterministic pair reductions.

## Original-ID submission boundary

All three writes: one explicit submission → returned ID retained → at most one active lifecycle waiter → decision/finalization → latest-final read. Timeout/RPC/429/read/reload failure never automatically repeats the write. Create particularly cannot be resent: the Contract intentionally permits a second valid create. Recovery only uses the same ID; finalized create return determines the ID, with the frozen single aggregate-history fallback only after finalization and exact matching metadata if necessary.

Pending localStorage stores only public tx ID/action/account/workspace or create-match metadata, not a signer, private key or full clause payload. If storage is unavailable, in-memory original ID is still preserved during that session; critical durable state always comes from finalized Contract.

Official SDK waiter is bounded: 15-second interval, 20 attempts for ACCEPTED/FINALIZED, full transaction return retained. Retry wraps status/read only: one sequential retry maximum; Retry-After respected, then manual Retry/Resume. No recursive/parallel retry, global setInterval or background refresh loop.

## Read efficiency and order

Workspace render uses one aggregate `get_workspace`, not one read per matrix cell. Home history uses one `get_workspace_summaries(address)`; the Contract guarantees numeric ID ascending, and App displays `[...summaries].reverse()`. No frontend substitute sort, per-item get_workspace history loop or N+1 indexer. Exact persisted taxonomy: 0 Unrelated, 1 Equivalent, 2 Compatible, 3 Conflict.

## Static paths

URL modes are `/` and `/?w=<id>` within the hosting prefix. Vite `base: './'` produces relative assets and works under `/handshake-map-genlayer/`; share links preserve that pathname. A query does not require a distinct server route; reload fetches the same HTML then latest-final Contract. Pages builds/serves only dist; verification scripts/fixtures are not published as runtime assets.

## Test/real boundary

Vitest/RTL use injected fake ports/wallet and HTTP fixtures; integration tests exercise real SDK encoding/decoding offline. `src/lib/preview.ts` is test-only by import graph. Verification tools and ephemeral test wallets are separate from production. Historical controlled query-only 429 tests do not substitute consensus; synthetic viewport fixtures are explicitly synthetic. Actual canonical Studionet receipts/state/screenshots and reload/Resume evidence are in `docs/phase5-network/`.

Canonical Development / Validation / Submission Network: Stable GenLayer Studionet. Chain ID: 61999. Contract: `0x0Dcb5F452412aB73b32149ad1e082533D929Ed73`. Final authoritative evidence is the accepted Phase 5 Studionet evidence.