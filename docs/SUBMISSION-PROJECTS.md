# Projects submission material

## Fastest reviewer verification: read-only Workspace #1

Live Demo: https://halihalibt.github.io/handshake-map-genlayer/

Verified Onchain Example: https://halihalibt.github.io/handshake-map-genlayer/?w=1

Workspace #1 is an existing finalized Studionet example, not seeded frontend demo data. No wallet is required to inspect it. The Home evidence card is recorded public navigation metadata; opening the result runs the existing `get_workspace(1)` read.

Open Home → View Verified Result. Verify RECONCILED, CSV conflict A1/B1, monthly-invoice agreement A2/B2 and matrix `[3,0,0,1]`. Reload the same URL. This path submits no transaction; Create → Respond → Reconcile remains unchanged.

**READY FOR PROJECTS SUBMISSION.** Public repository: https://github.com/halihalibt/handshake-map-genlayer. Live demo: https://halihalibt.github.io/handshake-map-genlayer/. GenLayer form submission remains pending.

Canonical Development / Validation / Submission Network: Stable GenLayer Studionet. Chain ID: 61999. Contract: `0x0Dcb5F452412aB73b32149ad1e082533D929Ed73`. Final authoritative evidence is the accepted Phase 5 Studionet evidence.

## Title
Handshake Map — See what both sides actually agreed to

## One-line summary
A zero-backend GenLayer app where two people seal requirements and see a finalized onchain map of agreement, conflict and unrelated clauses.

## Detailed description / problem solved
Requirements exchanged as prose can hide disagreement until delivery. Handshake Map makes the two parties' original commitments visible side by side, then turns their overlap and conflict into a matrix with traceable clause pairs. Users keep their original language; the app does not rewrite an agreement, invent a confidence score or claim legal truth.

## User workflow
Party A connects an injected EVM wallet on Studionet, names B and uses Create & Seal. The share link opens /?w=<id>. A's clauses are immutable; only B's connected address receives the response form. B uses Submit & Seal Response. When READY, either party or another connected signer may run GenLayer reconciliation once. Public-data notices explain that clauses become public. Home includes My Workspaces with a single aggregate history read displayed newest first.

## Why GenLayer is central / real Contract integration
All workspace state, permissions, sealed input and finalized matrix live in the deployed ClauseMesh Contract. The production client calls exactly its three writes and three views through genlayer-js; there is no application server, database or external AI endpoint. GenLayer independently validates the semantic transition. Removing it would remove the product's common state authority and independent semantic validation, not merely change an AI provider.

## Consensus flow
The UI distinguishes submitting, submitted, decision wait, running consensus, finalization wait, resuming an existing transaction, finalized read and reconciled. The Leader and independent Validators classify the same complete matrix; deterministic Material Family agreement is required. One original tx ID is retained after submission. Timeout, RPC failure or 429 can resume status querying but never automatically resend the write, especially create_workspace. At most one lifecycle waiter per ID and one sequential automatic retry per read/query operation prevent accidental duplicates and request storms.

## Persistence / results
After finalized success, the Matrix shows Equivalent, Compatible, Conflict and Unrelated. Agreement Pairs/Core, Conflict Pairs/Set and Unrelated Pairs are deterministic views of the exact persisted codes. Reload reconstructs the same sealed input and finalized result from the Contract. A reconciled Workspace has no new reconciliation action. Empty results show explicit notices.

## Frontend architecture
Vite + React + TypeScript + genlayer-js + plain CSS. Local React state/hooks, injected EIP-1193 wallet, explicit network switching and friendly errors. No backend, database, serverless business logic, router, WalletConnect, global state framework or paid AI API. Static relative assets and /?w links work at a repository prefix. Fakes are used in tests and development preview only, outside the production import graph.

## Demo
Follow docs/DEMO.md: 00:00 introduction; 00:20 A Create & Seal; 00:50 B Respond & Seal; 01:20 Reconcile; 02:10 Matrix/Core/Conflict; 02:40 Reload. It specifies accounts, inputs, buttons and expected lifecycle observations using the frozen 3×3 Website Delivery reviewer script. No new 3×3 live result is claimed. A compact already-verified 2×2 replay is available at canonical Studionet Workspace #1 with persisted [3,0,0,1]. Public demo URL: https://halihalibt.github.io/handshake-map-genlayer/

## Testing
Fresh final-package frontend regression: 113 PASS / 0 FAIL / 0 skipped; production build PASS. Wallet, wrong network, permission/form/seal, lifecycle/result, history, reload, original tx resume/no resend, create duplicate prevention, one waiter, 429 bounds and errors are covered. Accepted real production Studionet E2E includes A/B history ordering, reconciliation reload/resume, finalized matrix and desktop/mobile screenshots. Fixture-only viewport states are labeled. Contract suite: 139 PASS / 0 FAIL. No new network success is claimed during local packaging.

Canonical Development / Validation / Submission Network: Stable GenLayer Studionet, Chain ID 61999, Contract `0x0Dcb5F452412aB73b32149ad1e082533D929Ed73`. Phase 5 finalized consensus and persistent state are authoritative. See docs/EVIDENCE-INDEX.md.

## Repository
Repository: https://github.com/halihalibt/handshake-map-genlayer. Live demo: https://halihalibt.github.io/handshake-map-genlayer/. `docs/CONTRACT-SOURCE.md` records canonical source provenance and byte-equivalence.

Canonical Development / Validation / Submission Network: Stable GenLayer Studionet, Chain ID 61999, Contract `0x0Dcb5F452412aB73b32149ad1e082533D929Ed73`. Phase 5 finalized consensus and persistent state are authoritative. See docs/EVIDENCE-INDEX.md.


