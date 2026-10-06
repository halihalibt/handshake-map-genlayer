# Frozen reviewer demo — 2–3 minutes

This is the frozen 2–3 minute reviewer demo script. It does not add product features. Live consensus latency may exceed the suggested speaking timeline; wait for actual finalization, or label edited waiting time in a recording. Do not claim a predetermined matrix or repeat reconciliation for preferred labels.

## Before recording

Canonical Development / Validation / Submission Network: Stable GenLayer Studionet. Chain ID: 61999. Contract: `0x0Dcb5F452412aB73b32149ad1e082533D929Ed73`. Final authoritative evidence is the accepted Phase 5 Studionet evidence.

Only publicly shareable example clauses; never show wallet recovery words, private keys, credential-bearing tabs or raw console/server logs. For a read-only replay of verified evidence, open the existing canonical Workspace `?w=1` and show the accepted 2×2 result; that is a replay, not a new live write.

## 00:00–00:20 — Product explanation

Open Home. Explain: “Two people may think they agreed while actually describing different requirements. ClauseMesh lets both sides freeze their requirements and asks independent GenLayer validators to reconcile their meaning.” Show the Studionet badge, wallet button, Create form and mandatory public-data notice; this is a zero-backend product.

## 00:20–00:50 — Party A Create & Seal

Select Account A in the injected wallet; click Connect Wallet if needed. If wrong network is shown, explicitly click Switch Network once and approve only the expected Studionet chain. Never repeatedly trigger wallet prompts.

Label: **Website Delivery**. Counterparty Address: **Account B's public address**. Add to three clauses using Add Clause:

```text
A1: Users must be able to export reports as CSV.
A2: The product must support mobile viewing.
A3: Payment is released after public deployment.
```

Enter the clause sentence without the `A1:` label into each corresponding input. Click **Create & Seal**, approve that one write. Once a tx ID exists, show the original ID and submitting/submitted/decision/finalization states; do not create again on waiting failure. Wait for actual finalized creation and exact returned Workspace ID. Show A's **SEALED** read-only inputs and waiting-for-B state. Click **Share Link** and copy the Workspace `?w=<id>` URL.

## 00:50–01:20 — Party B Respond & Seal

Switch the injected wallet to **Account B** and open the shared Workspace link. Verify displayed connected address equals named B; only B has the editable response form. Enter three clauses:

```text
B1: Report data must only be downloadable through the API.
B2: Mobile users only need read-only access.
B3: Payment is released after the deployed app is publicly accessible.
```

Again enter sentences without the `B1:` labels. Click **Submit & Seal Response**, approve once. Show original response tx ID. After finalized read, show both sealed arrays and **READY**. These payment clauses are semantic data, not an escrow or transfer feature.

## 01:20–02:10 — Reconcile and observe consensus

Remain on B or switch to A; reconcile is permissionless once READY. Click **Run GenLayer Reconciliation**, approve once. Explain: “The Leader independently classifies the full matrix, Validators independently run the same prompt and clauses, and deterministic logic compares every cell's Agreement, Conflict or None family.”

Show **Transaction submitted**, original tx ID, **Waiting for transaction decision**, **Running GenLayer consensus**, **Waiting for finalization**, and **Reading finalized result** as actual SDK observations occur. Do not imply every intermediate stage lasts long enough to be recorded. If RPC/429/wait interruption occurs, show friendly error and **Resume transaction**; resume the same tx ID. Never click a fresh write to replace a submitted one. After final success show **Reconciled** and record Explorer/receipt evidence separately if available.

## 02:10–02:40 — Result

Show A rows/B columns in **Relation Matrix**, **Agreement Pairs**, **Conflict Pairs**, **Unrelated Pairs**, **Agreement Core** and **Conflict Set**. Highlight these diagonal examples only when actually produced:

- CSV report export versus API-only download → Conflict.
- Mobile viewing versus mobile read-only access → Compatible.
- Public-deployment payment condition versus publicly accessible deployed app → Equivalent.

If a label differs but consensus finalized, report the actual label; do not resend. Empty sets have explicit notices. Matrix values are exact accepted persisted codes, not a new summary.

## 02:40–03:00 — Persistent state

Reload the same Workspace URL. Show sealed inputs, RECONCILED status and the identical finalized Matrix/derived pair lists restored from Contract. Optionally click All Workspaces to show one-read onchain history, newest ID first.

Close: “GenLayer maintains shared semantic state between parties who do not need to trust a single AI provider or application server.”

## Existing 2×2 proof versus future live demo

Canonical Development / Validation / Submission Network: Stable GenLayer Studionet. Chain ID: 61999. Contract: `0x0Dcb5F452412aB73b32149ad1e082533D929Ed73`. Final authoritative evidence is the accepted Phase 5 Studionet evidence.