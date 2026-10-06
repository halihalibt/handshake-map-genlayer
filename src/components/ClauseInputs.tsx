export function ClauseInputs({
  party,
  clauses,
  setClauses,
  disabled = false,
}: {
  party: "A" | "B";
  clauses: string[];
  setClauses: (c: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend>
        Party {party} Clauses <small>1–4 clauses · 3–240 characters each</small>
      </legend>
      {clauses.map((clause, i) => (
        <div className="clause-input" key={i}>
          <label htmlFor={`clause-${party}-${i}`}>
            {party}
            {i + 1}
          </label>
          <textarea
            id={`clause-${party}-${i}`}
            value={clause}
            onChange={(e) =>
              setClauses(clauses.map((c, j) => (j === i ? e.target.value : c)))
            }
            rows={2}
          />
          <button
            type="button"
            className="text-button"
            disabled={clauses.length === 1}
            onClick={() => setClauses(clauses.filter((_, j) => j !== i))}
          >
            Remove Clause {party}
            {i + 1}
          </button>
        </div>
      ))}
      <button
        type="button"
        className="secondary"
        disabled={clauses.length === 4}
        onClick={() => setClauses([...clauses, ""])}
      >
        Add Clause
      </button>
    </fieldset>
  );
}
export const PublicNotice = () => (
  <p className="notice">
    All submitted clauses become public onchain data. Do not submit private,
    confidential, or sensitive information.
  </p>
);
export function SealedClauses({
  party,
  clauses,
}: {
  party: string;
  clauses: string[];
}) {
  return (
    <ol className="clauses">
      {clauses.map((c, i) => (
        <li key={i}>
          <span className="clause-key">
            {party}
            {i + 1}
          </span>
          <span>{c}</span>
        </li>
      ))}
    </ol>
  );
}
