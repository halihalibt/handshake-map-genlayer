# Handshake Map — turn two sealed requirement sets into shared state

**A complete static GenLayer product using ClauseMesh · CLAUSEMESH-V1**

Two people can think they agreed while describing different delivery requirements. Handshake Map lets each person seal their own clauses, run GenLayer reconciliation and inspect a persistent Relation Matrix, Agreement Core and Conflict Set. It is a wallet-to-finalized-result product, with no backend or database.

Canonical Development / Validation / Submission Network: Stable GenLayer Studionet. Chain ID: 61999. Contract: `0x0Dcb5F452412aB73b32149ad1e082533D929Ed73`. Final authoritative evidence is the accepted Phase 5 Studionet evidence.

## The user journey

1. **Party A — Create & Seal:** connect an injected EVM wallet on Studionet, optionally enter a label, designate B's wallet and write 1–4 clauses. Creation seals A's clauses and returns a Workspace link.
2. **Party B — Respond & Seal:** switch to the named B wallet and open that link. Only B receives the editable response form. Submit 1–4 clauses once; the Workspace becomes READY. Other wallets see waiting/read-only state.
3. **Permissionless Reconcile:** any wallet may run reconciliation once B is sealed. Both sides' inputs remain read-only.
4. **GenLayer lifecycle:** follow submission, decision, consensus and finalization in the Consensus panel with the original transaction ID visible. After finalized success the application reads actual Contract state.
5. **Result:** A clauses are rows, B clauses columns; each persisted cell is Equivalent, Compatible, Conflict or Unrelated. Agreement Core lists codes 1/2; Conflict Set lists code 3. Counts and Unrelated pairs come from exact stored codes; no new AI summary is generated.
6. **Return later:** reload or open `/?w=<workspace_id>` to recover the finalized result from chain. Home's My Workspaces uses one aggregate read and locally reverses ascending Contract summaries to newest ID first.

Labels may be empty or up to 80 characters; each trimmed clause must be 3–240 characters. Exact/semantic duplicates are allowed. All submitted clauses become public onchain data. Do not submit private, confidential or sensitive information.

## Wallet, network and errors

Injected EIP-1193 `window.ethereum` only, including compatible MetaMask/OKX injection. Connect/disconnect is local UI state. A wrong-network banner blocks writes; Switch Network is an explicit action, not an automatic repeated prompt. Rejected wallet/switch requests produce friendly text. Account/network events update permissions. No WalletConnect/account service exists.

Expected production network: **Studionet**, chain **61999**, RPC `https://studio.genlayer.com/api`. Contract **`0x0Dcb5F452412aB73b32149ad1e082533D929Ed73`**. Protocol **CLAUSEMESH-V1**. Original historical pre-fix address is not active integration metadata.

Errors distinguish wallet rejection, input/permission/state errors, failed execution, undetermined consensus, temporary status/RPC/rate-limit/read failures and not-found Workspace. Raw stack traces and validator/server secrets do not appear in production UI.

## Transaction safety

Once create/respond/reconcile returns a tx ID, the write is submitted. The app retains that original ID through timeout, RPC failure, 429, final-read failure and reload; manual Resume queries/waits the same lifecycle, never automatically repeats the write. Creation particularly must not be resent: another legal call would create another Workspace. There is a single active waiter per ID and a signing/submission guard.

Read/status retry allows at most one sequential automatic retry per operation; Retry-After is preserved. After the bound, manual Retry/Resume is offered. No parallel, recursive or infinite retry; no global timer or custom high-frequency chain poller. The pinned SDK's bounded official ACCEPTED/FINALIZED waiter is used. Reads request latest-final state. Pending public transaction metadata is not a wallet secret or critical result cache.

## Why GenLayer is central

The product's result is shared semantic state, not an AI chat answer. ClauseMesh freezes two parties' inputs; a Leader and independent Validators classify the same whole matrix under a frozen prompt, and deterministic cell-family comparison decides whether their outputs agree materially. Only an accepted Leader result persists. Replacing this with one OpenAI call plus a database loses independent validators, contract-governed acceptance and chain-owned shared state.

The standalone `clausemesh-genlayer` repository explains the reusable primitive, schema and equivalence rule. This repository focuses on the complete user flow, real integration and persistence; its README is not a copy of the Contract README.

## Run and build

Node **24.19.0**, npm **11.9.0**. Exact lockfile retained: React/ReactDOM **19.3.0**, Vite **8.3.2**, TypeScript **7.0.2**, genlayer-js **1.1.8**, Vitest **5.0.3**, React Testing Library **16.3.3**. Plain CSS and local React hooks/state only.

```bash
npm install
npm test
npm run build
```

For a locked reproducible installation use `npm ci`. Production output is static `dist/`; no server runtime, backend, database, serverless business logic, paid API or external AI API is needed. The frontend SDK calls GenLayer directly. `src/main.tsx` creates the real integration; fakes under tests/verification and preview fixtures are not production imports.

Current final suite: **113 PASS / 0 FAIL / 0 skipped** (96 frontend, 16 SDK integration, one root-cause history UI regression). Build **PASS**; TypeScript reports no errors. This fresh build emits Vite's non-blocking >500 kB main-chunk advisory; no npm/http-proxy warning occurred in the fresh run (older logs retain historical warnings). Fresh Phase 6 outputs are under `docs/phase6/`.

## Canonical Contract and observed real E2E

Canonical Contract source lives in the companion **clausemesh-genlayer** repository at `contracts/clause_mesh.py`. This repository carries a byte-equivalent copy, SHA-256 **`5489c4c66471af9c5bfc5607d8f4640e22ebac0cfca36ce63ee762c038444830`**. See [docs/CONTRACT-SOURCE.md](docs/CONTRACT-SOURCE.md) for source provenance.

Studionet final-source deployment tx `0xbb4e6c59c6b997eb81e8123178c4e437f6316c9c134241a796b1a838ebb16eeb`. Real production UI created #1/#2, B sealed #2 then #1; Contract A/B histories `[1,2]`, UI `[2,1]`. One 2×2 reconciliation tx **`0x73468ab79503a1151eddd3ec0c31af5c4836b5eb4b902325dbdbb71d97a53d0c`** reached FINALIZED / MAJORITY_AGREE / SUCCESS, five initial validators, 3 agree / 2 idle, persisted `[3,0,0,1]`. Original reconciliation ID survived reload/manual Resume without another write. A later reload restored the same finalized matrix.

Canonical Development / Validation / Submission Network: Stable GenLayer Studionet. Chain ID: 61999. Contract: `0x0Dcb5F452412aB73b32149ad1e082533D929Ed73`. Final authoritative evidence is the accepted Phase 5 Studionet evidence.

## Demo and static publication preparation

[docs/DEMO.md](docs/DEMO.md) is the frozen 2–3 minute reviewer script, with precise A/B switching, sample clauses, buttons, state/hash/finalization and refresh steps. Use the already finalized Studionet `?w=1` as a recorded-state tour; create a fresh demonstration only when explicitly authorized, not just to recapture evidence.

The included manual GitHub Pages workflow builds/uploads only `dist`. Existing Vite relative base `./` supports `/handshake-map-genlayer/` and `/handshake-map-genlayer/?w=1`; no React Router or server rewrite is needed. [docs/GITHUB-PAGES.md](docs/GITHUB-PAGES.md) explains activation and verification; record the actual public URL after deployment.

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/SUBMISSION-PROJECTS.md](docs/SUBMISSION-PROJECTS.md) and [docs/TESTING.md](docs/TESTING.md). License: MIT.


Phase 6 COMPLETE. READY FOR PROJECTS SUBMISSION. Public repository: https://github.com/halihalibt/handshake-map-genlayer. GitHub Pages publication and GenLayer form submission remain pending.
