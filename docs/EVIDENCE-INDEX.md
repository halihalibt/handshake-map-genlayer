# Final Submission Evidence Index

## Fastest reviewer verification: read-only Workspace #1

Live Demo: https://halihalibt.github.io/handshake-map-genlayer/

Verified Onchain Example: https://halihalibt.github.io/handshake-map-genlayer/?w=1

Workspace #1 is an existing finalized Studionet example, not seeded frontend demo data. No wallet is required to inspect it. The Home evidence card is recorded public navigation metadata; opening the result runs the existing `get_workspace(1)` read.

Open Home → View Verified Result. Verify RECONCILED, CSV conflict A1/B1, monthly-invoice agreement A2/B2 and matrix `[3,0,0,1]`. Reload the same URL. This path submits no transaction; Create → Respond → Reconcile remains unchanged.

Canonical Development / Validation / Submission Network: Stable GenLayer Studionet. Chain ID: 61999. Contract: `0x0Dcb5F452412aB73b32149ad1e082533D929Ed73`. Final authoritative evidence is the accepted Phase 5 Studionet evidence.

## Projects

1. Canonical Studionet Contract: `0x0Dcb5F452412aB73b32149ad1e082533D929Ed73`.
2. Real reconciliation: `0x73468ab79503a1151eddd3ec0c31af5c4836b5eb4b902325dbdbb71d97a53d0c`; FINALIZED / MAJORITY_AGREE / SUCCESS; 5 initial Validators, 3 AGREE / 2 IDLE.
3. Persisted Matrix `[3,0,0,1]`; Agreement Core A2/B2, Conflict Set A1/B1; other pairs unrelated.
4. Complete production frontend workflow; 113 frontend tests and production build PASS.
5. docs/phase5-network/real-browser-evidence.json; finalized-result-dom.txt; history-A.txt; history-B.txt; static-runtime.json.
6. History Contract [1,2] / frontend [2,1]; reload/manual Resume restores original transaction and persistent Matrix.

Public repository: https://github.com/halihalibt/handshake-map-genlayer. Live GitHub Pages demo: https://halihalibt.github.io/handshake-map-genlayer/. Pages deployment succeeded through the repository's manual GitHub Actions workflow. Historical evidence is excluded from this core index.

