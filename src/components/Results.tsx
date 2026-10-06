import { derivePairs, relationLabels, type Workspace } from "../lib/contract";
export function Results({ workspace: w }: { workspace: Workspace }) {
  const pairs = derivePairs(w);
  return (
    <section className="results">
      <h2>Relation Matrix</h2>
      <p className="muted">
        Exact accepted relations from the persisted matrix.
      </p>
      <div
        className="matrix-scroll"
        tabIndex={0}
        role="region"
        aria-label="Relation Matrix"
      >
        <table>
          <caption>Party A rows × Party B columns</caption>
          <thead>
            <tr>
              <th scope="col">Party A / Party B</th>
              {w.clauses_b.map((c, i) => (
                <th scope="col" key={i}>
                  <strong>B{i + 1}</strong>
                  <span>{c}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {w.clauses_a.map((c, a) => (
              <tr key={a}>
                <th scope="row">
                  <strong>A{a + 1}</strong>
                  <span>{c}</span>
                </th>
                {w.clauses_b.map((_, b) => {
                  const code = w.relation_matrix[a * w.clauses_b.length + b];
                  return (
                    <td key={b}>
                      <span className={`relation relation-${code}`}>
                        {relationLabels[code]}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="counts">
        <div>
          <dt>Agreement Pairs</dt>
          <dd>{pairs.agreement.length}</dd>
        </div>
        <div>
          <dt>Conflict Pairs</dt>
          <dd>{pairs.conflict.length}</dd>
        </div>
        <div>
          <dt>Unrelated Pairs</dt>
          <dd>{pairs.unrelated.length}</dd>
        </div>
      </dl>
      <div className="pair-columns">
        {(["agreement", "conflict", "unrelated"] as const).map((kind) => (
          <section className="panel" key={kind}>
            <h3>
              {kind === "agreement"
                ? "Agreement Core"
                : kind === "conflict"
                  ? "Conflict Set"
                  : "Unrelated Pairs"}
            </h3>
            {pairs[kind].length ? (
              <ul className="pairs">
                {pairs[kind].map((p) => (
                  <li key={`${p.a}-${p.b}`}>
                    <strong>
                      A{p.a + 1} ↔ B{p.b + 1} · {relationLabels[p.code]}
                    </strong>
                    <p>{w.clauses_a[p.a]}</p>
                    <p>{w.clauses_b[p.b]}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                {kind === "conflict"
                  ? "No semantic conflicts were identified by consensus."
                  : kind === "agreement"
                    ? "No agreement pairs were identified by consensus."
                    : "No unrelated pairs were identified by consensus."}
              </p>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
