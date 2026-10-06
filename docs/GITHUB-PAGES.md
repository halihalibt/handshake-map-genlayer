# GitHub Pages — prepared, not published

No external repository creation/push/settings change or public deployment has been executed. Activate only after owner authorization. Repo name: `handshake-map-genlayer`; no owner or live URL is invented.

The prepared workflow is manual (`workflow_dispatch`) and publishes only built `dist`. It does not automatically deploy when source is pushed. It uses official checkout/setup-node/configure-pages/upload-pages-artifact/deploy-pages actions, pinned Node 24.19.0 and npm 11.9.0, `npm ci`, `npm test`, `npm run build`. No personal API token, wallet credential or backend configuration is needed.

Existing Vite `base: './'` is deliberately unchanged. Relative assets resolve from `/handshake-map-genlayer/`; both that Home path and `/?w=<id>` within it use the same HTML. Share links preserve the prefix. No React Router, server rewrite, backend or serverless runtime is introduced. The workflow uploads only dist, not source/tests/reports/verification signers.

## Owner-authorized activation

Canonical Development / Validation / Submission Network: Stable GenLayer Studionet. Chain ID: 61999. Contract: `0x0Dcb5F452412aB73b32149ad1e082533D929Ed73`. Final authoritative evidence is the accepted Phase 5 Studionet evidence.

Local final npm test/build and relative asset/query checks passed at package preparation time. After publication, run the manual Pages workflow and verify the resulting public URL. Documentation sources: [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [setup-node](https://github.com/actions/setup-node). A live URL should only be claimed after the Pages workflow completes successfully.
