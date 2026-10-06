import { useEffect, useRef, useState } from "react";
import {
  ClauseInputs,
  PublicNotice,
  SealedClauses,
} from "./components/ClauseInputs";
import { Results } from "./components/Results";
import {
  derivePairs,
  deriveStatus,
  sameAddress,
  validateClauses,
  validateCreate,
  type Address,
  type ContractPort,
  type Workspace,
  type WorkspaceId,
  validWorkspaceId,
  type WorkspaceSummary,
} from "./lib/contract";
import { boundedRead, errorCode, friendlyError } from "./lib/errors";
import { Transactions } from "./lib/transactions";
import { useWallet, type EIP1193 } from "./lib/wallet";
export interface AppProps {
  contract: ContractPort;
  transactions: Transactions;
  provider?: EIP1193;
  preview?: boolean;
}
const routeId = (): WorkspaceId | undefined => {
  const w = new URLSearchParams(window.location.search).get("w");
  return w === null
    ? undefined
    : validWorkspaceId(w)
      ? BigInt(w) <= BigInt(Number.MAX_SAFE_INTEGER)
        ? Number(w)
        : w
      : 0;
};
export default function App({
  contract,
  transactions,
  provider,
  preview = false,
}: AppProps) {
  const finalizedForNavigation = useRef<Workspace | undefined>(undefined);
  const wallet = useWallet(provider);
  const [id, setId] = useState(routeId);
  const [workspace, setWorkspace] = useState<Workspace>();
  const [readError, setReadError] = useState<string>();
  const [reading, setReading] = useState(false);
  const [readVersion, setReadVersion] = useState(0);
  const [tx, setTx] = useState(transactions.getSnapshot);
  const [label, setLabel] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [clausesA, setClausesA] = useState([""]);
  const [clausesB, setClausesB] = useState([""]);
  const [formError, setFormError] = useState<string>();
  const [history, setHistory] = useState<WorkspaceSummary[]>();
  const [historyError, setHistoryError] = useState<string>();
  const [historyVersion, setHistoryVersion] = useState(0);
  const [copied, setCopied] = useState(false);
  useEffect(
    () => transactions.subscribe(() => setTx(transactions.getSnapshot())),
    [transactions],
  );
  useEffect(() => {
    const pop = () => setId(routeId());
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  function navigate(next?: WorkspaceId) {
    window.history.pushState(
      null,
      "",
      `${window.location.pathname}${next ? `?w=${next}` : ""}`,
    );
    setId(next);
    setFormError(undefined);
    setCopied(false);
  }
  useEffect(() => {
    if (tx.workspace && tx.workspaceId) {
      setWorkspace(tx.workspace);
      if (id !== tx.workspaceId) {
        finalizedForNavigation.current = tx.workspace;
        navigate(tx.workspaceId);
      }
      setHistoryVersion((v) => v + 1);
    }
  }, [tx.workspace]);
  useEffect(() => {
    if (id === undefined) {
      setWorkspace(undefined);
      return;
    }
    if (finalizedForNavigation.current?.id === id) {
      setWorkspace(finalizedForNavigation.current);
      finalizedForNavigation.current = undefined;
      return;
    }
    let live = true;
    setWorkspace(undefined);
    setReadError(undefined);
    setReading(true);
    void boundedRead(() => contract.get_workspace(id))
      .then((w) => {
        derivePairs(w);
        if (live) setWorkspace(w);
      })
      .catch((e) => {
        if (live) setReadError(errorCode(e));
      })
      .finally(() => {
        if (live) setReading(false);
      });
    return () => {
      live = false;
    };
  }, [id, contract, readVersion]);
  useEffect(() => {
    setHistory(undefined);
    setHistoryError(undefined);
    if (!wallet.account || id !== undefined) return;
    let live = true;
    void boundedRead(() => contract.get_workspace_summaries(wallet.account!))
      .then((h) => {
        if (live) setHistory([...h].reverse());
      })
      .catch((e) => {
        if (live) setHistoryError(errorCode(e));
      });
    return () => {
      live = false;
    };
  }, [contract, wallet.account, historyVersion, id]);
  const blocked = tx.active || !!tx.pending;
  const canWrite = !!wallet.account && !wallet.wrongNetwork && !blocked;
  function requireWallet(): Address {
    if (!wallet.account) throw new Error("UNAUTHORIZED");
    if (wallet.wrongNetwork) throw new Error("WRONG_NETWORK");
    return wallet.account;
  }
  async function create() {
    setFormError(undefined);
    try {
      const sender = requireWallet();
      const v = validateCreate(sender, counterparty, label, clausesA);
      await transactions.submit("create_workspace", sender, () =>
        contract.create_workspace(v.counterparty, v.label, v.clauses, sender),
        undefined, { counterparty: v.counterparty, label: v.label },
      );
    } catch (e) {
      setFormError(errorCode(e));
    }
  }
  async function seal() {
    setFormError(undefined);
    try {
      const sender = requireWallet();
      const clauses = validateClauses(clausesB);
      await transactions.submit(
        "respond_and_seal",
        sender,
        () => contract.respond_and_seal(id!, clauses, sender),
        id,
      );
    } catch (e) {
      setFormError(errorCode(e));
    }
  }
  async function reconcile() {
    setFormError(undefined);
    try {
      const sender = requireWallet();
      await transactions.submit(
        "reconcile",
        sender,
        () => contract.reconcile(id!, sender),
        id,
      );
    } catch (e) {
      setFormError(errorCode(e));
    }
  }
  const status = workspace ? deriveStatus(workspace) : undefined;
  return (
    <>
      <header className="global-header">
        <button className="brand" onClick={() => navigate()}>
          ClauseMesh <span>/ Handshake Map</span>
        </button>
        <span className="network-badge">
          Studionet{wallet.wrongNetwork ? " · Wrong network" : ""}
        </span>
        <button
          className="secondary wallet-button"
          disabled={!!wallet.busy}
          onClick={wallet.account ? wallet.disconnect : wallet.connect}
        >
          {wallet.busy ||
            (wallet.account
              ? `${wallet.account.slice(0, 6)}…${wallet.account.slice(-4)} · Disconnect`
              : "Connect Wallet")}
        </button>
      </header>
      <main>
        {preview && (
          <p className="preview-notice">
            Phase 3 frontend preview · Transactions and workspace data are
            simulated. No onchain writes.
          </p>
        )}
        {wallet.account && (
          <p className="wallet-address">
            Connected wallet: <span>{wallet.account}</span>
          </p>
        )}
        {wallet.error && (
          <p role="alert" className="error">
            {friendlyError(new Error(wallet.error))}
          </p>
        )}
        {wallet.wrongNetwork && (
          <div className="network-warning">
            <p>
              {friendlyError(new Error("WRONG_NETWORK"))} Expected network:
              Studionet · Chain ID 61999.
            </p>
            <p className="muted">
              If switching is rejected or unsupported, select Studionet in your
              wallet settings. RPC: https://studio.genlayer.com/api · Chain ID:
              61999.
            </p>
            <button disabled={!!wallet.busy} onClick={wallet.switchNetwork}>
              {wallet.busy || "Switch Network"}
            </button>
          </div>
        )}
        {formError && (
          <p role="alert" className="error">
            {friendlyError(new Error(formError))}
          </p>
        )}
        {(tx.stage !== "Idle" || tx.error) && (
          <section
            className="panel transaction"
            aria-label="Transaction lifecycle"
          >
            <h2>Transaction lifecycle</h2>
            {tx.stage !== "Idle" && <p role="status">{tx.stage}</p>}
            {tx.stage === "Workspace reconciled" && <p>Consensus finalized</p>}
            {tx.lastId && (
              <p className="tx-id">
                Transaction ID: <code>{tx.lastId}</code>
              </p>
            )}
            {tx.error && (
              <p role="alert" className="error">
                {friendlyError(new Error(tx.error))}
              </p>
            )}
            {tx.pending && !tx.active && (
              <button onClick={() => void transactions.resume()}>
                Resume Transaction
              </button>
            )}
          </section>
        )}
        {id === undefined ? (
          <>
            <section className="intro">
              <p className="eyebrow">Bilateral semantic reconciliation</p>
              <h1>Make your agreement visible.</h1>
              <p>
                Seal each side’s requirements. GenLayer validators reconcile
                every clause pair into a shared Handshake Map.
              </p>
            </section>
            <section className="panel">
              <h2>Create Workspace</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void create();
                }}
              >
                <label htmlFor="label">
                  Label <small>Optional · 80 characters maximum</small>
                </label>
                <input
                  id="label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  disabled={blocked}
                />
                <label htmlFor="counterparty">Counterparty Address</label>
                <input
                  id="counterparty"
                  placeholder="0x…"
                  value={counterparty}
                  onChange={(e) => setCounterparty(e.target.value)}
                  disabled={blocked}
                />
                <ClauseInputs
                  party="A"
                  clauses={clausesA}
                  setClauses={setClausesA}
                  disabled={blocked}
                />
                <PublicNotice />
                <button disabled={!canWrite}>Create &amp; Seal</button>
              </form>
            </section>
            <section className="panel">
              <h2>My Workspaces</h2>
              {!wallet.account ? (
                <p className="muted">
                  Connect a wallet to create workspaces or view your ClauseMesh
                  history.
                </p>
              ) : historyError ? (
                <>
                  <p role="alert" className="error">
                    {friendlyError(new Error(historyError))}
                  </p>
                  <button onClick={() => setHistoryVersion((v) => v + 1)}>
                    Retry History
                  </button>
                </>
              ) : !history ? (
                <p role="status">Reading workspace history</p>
              ) : !history.length ? (
                <p className="muted">
                  No workspaces yet. Create your first semantic handshake.
                </p>
              ) : (
                <ul className="history">
                  {history.map((w) => (
                    <li key={w.id}>
                      <a
                        href={`?w=${w.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(w.id);
                        }}
                      >
                        <strong>{w.label || `Workspace ${w.id}`}</strong>
                        <span>
                          #{w.id} · {w.status}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : (
          <>
            {reading && <p role="status">Reading workspace</p>}
            {readError && (
              <section className="panel">
                <p role="alert" className="error">
                  {friendlyError(new Error(readError))}
                </p>
                <button onClick={() => setReadVersion((v) => v + 1)}>
                  Retry
                </button>
              </section>
            )}
            {workspace && (
              <>
                <section className="workspace-heading">
                  <a
                    href={window.location.pathname}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate();
                    }}
                  >
                    ← All Workspaces
                  </a>
                  <p className="eyebrow">Workspace #{workspace.id}</p>
                  <h1>{workspace.label || `Workspace ${workspace.id}`}</h1>
                  <span className="status-badge">{status}</span>
                  <dl className="parties">
                    <div>
                      <dt>Party A</dt>
                      <dd>{workspace.party_a}</dd>
                    </div>
                    <div>
                      <dt>Party B</dt>
                      <dd>{workspace.party_b}</dd>
                    </div>
                  </dl>
                  <button
                    className="secondary"
                    onClick={() => {
                      const url = new URL(window.location.href);
                      url.search = `?w=${workspace.id}`;
                      void navigator.clipboard
                        ?.writeText(url.href)
                        .then(() => setCopied(true))
                        .catch(() => setCopied(false));
                    }}
                  >
                    Share Link
                  </button>
                  {copied && <span role="status"> Link copied</span>}
                  <a className="share-url" href={`?w=${workspace.id}`}>
                    {new URL(`?w=${workspace.id}`, window.location.href).href}
                  </a>
                </section>
                <div className="clause-columns">
                  <section className="panel">
                    <h2>
                      Party A <span className="sealed">SEALED</span>
                    </h2>
                    <SealedClauses party="A" clauses={workspace.clauses_a} />
                  </section>
                  <section className="panel">
                    <h2>
                      Party B{" "}
                      {workspace.party_b_submitted && (
                        <span className="sealed">SEALED</span>
                      )}
                    </h2>
                    {workspace.party_b_submitted ? (
                      <SealedClauses party="B" clauses={workspace.clauses_b} />
                    ) : sameAddress(wallet.account, workspace.party_b) ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void seal();
                        }}
                      >
                        <ClauseInputs
                          party="B"
                          clauses={clausesB}
                          setClauses={setClausesB}
                          disabled={blocked}
                        />
                        <PublicNotice />
                        <button disabled={!canWrite}>
                          Submit &amp; Seal Response
                        </button>
                      </form>
                    ) : (
                      <p className="muted">
                        Waiting for counterparty response.
                      </p>
                    )}
                  </section>
                </div>
                <section className="panel consensus">
                  <h2>Consensus</h2>
                  <p role="status">
                    {status === "WAITING_FOR_B"
                      ? "Waiting for Party B"
                      : status === "READY"
                        ? "Ready to Reconcile"
                        : "Reconciled"}
                  </p>
                  {status === "READY" && (
                    <button
                      disabled={!canWrite}
                      onClick={() => void reconcile()}
                    >
                      Run GenLayer Reconciliation
                    </button>
                  )}
                  {status === "READY" && !wallet.account && (
                    <p className="muted">
                      Connect a wallet to reconcile this workspace.
                    </p>
                  )}
                </section>
                {workspace.reconciled && <Results workspace={workspace} />}
              </>
            )}
          </>
        )}
      </main>
      <footer>
        CLAUSEMESH-V1 · Immutable inputs. Independent validators. Persistent
        relations.
      </footer>
    </>
  );
}
