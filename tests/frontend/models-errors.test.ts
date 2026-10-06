import { describe, it, expect, vi } from "vitest";
import {
  charCount,
  validateCreate,
  validateClauses,
  derivePairs,
  deriveStatus,
} from "../../src/lib/contract";
import {
  friendlyError,
  boundedRead,
  TransportError,
} from "../../src/lib/errors";
import { demoWorkspace, PARTY_A, PARTY_B } from "../../src/lib/preview";
describe("F03 validation mirrors frozen bounds", () => {
  it.each([
    "",
    "0x0",
    "0x0000000000000000000000000000000000000000",
    PARTY_A,
    PARTY_A.toUpperCase(),
  ])("rejects counterparty %s", (b) => {
    expect(() => validateCreate(PARTY_A, b, "", ["abc"])).toThrow(
      "INVALID_COUNTERPARTY",
    );
  });
  it("trims edges but preserves Unicode, duplicates, internal whitespace, case and punctuation", () => {
    const clauses = ["  α😀  ABC!?  ", "  α😀  ABC!?  "];
    expect(validateCreate(PARTY_A, PARTY_B, " x ", clauses)).toEqual({
      counterparty: PARTY_B,
      label: "x",
      clauses: ["α😀  ABC!?", "α😀  ABC!?"],
    });
    expect(charCount("😀😀😀")).toBe(3);
    expect(validateClauses(["😀".repeat(240)])).toEqual(["😀".repeat(240)]);
  });
  it.each([{ clauses: [] }, { clauses: ["abc", "abc", "abc", "abc", "abc"] }])(
    "rejects clause count $clauses",
    ({ clauses }) =>
      expect(() => validateClauses(clauses)).toThrow("INVALID_CLAUSE_COUNT"),
  );
  it.each(["  ", "ab", "😀".repeat(241)])("rejects invalid clause", (clause) =>
    expect(() => validateClauses([clause])).toThrow("INVALID_CLAUSE"),
  );
  it("accepts empty/80-character labels and rejects 81 after trim", () => {
    expect(validateCreate(PARTY_A, PARTY_B, "", ["abc"]).label).toBe("");
    expect(
      validateCreate(PARTY_A, PARTY_B, "😀".repeat(80), ["abc"]).label,
    ).toHaveLength(160);
    expect(() =>
      validateCreate(PARTY_A, PARTY_B, "x".repeat(81), ["abc"]),
    ).toThrow("INVALID_LABEL");
  });
});
describe("F07 exact deterministic result reduction", () => {
  it("uses exact codes, row-major zero-based indexes and preserves Compatible distinct from Equivalent", () => {
    const w = {
      ...demoWorkspace,
      relation_matrix: [1, 2, 3, 0] as (0 | 1 | 2 | 3)[],
    };
    expect(derivePairs(w)).toEqual({
      agreement: [
        { a: 0, b: 0, code: 1 },
        { a: 0, b: 1, code: 2 },
      ],
      conflict: [{ a: 1, b: 0, code: 3 }],
      unrelated: [{ a: 1, b: 1, code: 0 }],
    });
  });
  it("covers maximum 4×4 without changing taxonomy", () => {
    const w = {
      ...demoWorkspace,
      clauses_a: ["aaa", "bbb", "ccc", "ddd"],
      clauses_b: ["eee", "fff", "ggg", "hhh"],
      relation_matrix: Array.from(
        { length: 16 },
        (_, i) => (i % 4) as 0 | 1 | 2 | 3,
      ),
    };
    const p = derivePairs(w);
    expect(p.agreement).toHaveLength(8);
    expect(p.conflict).toHaveLength(4);
    expect(p.unrelated).toHaveLength(4);
  });
  it("status derives from flags and failed consensus remains READY", () => {
    expect(
      deriveStatus({
        ...demoWorkspace,
        reconciled: false,
        party_b_submitted: false,
      }),
    ).toBe("WAITING_FOR_B");
    expect(deriveStatus({ ...demoWorkspace, reconciled: false })).toBe("READY");
    expect(deriveStatus(demoWorkspace)).toBe("RECONCILED");
  });
  it("invalid persisted matrix is read failure", () =>
    expect(() =>
      derivePairs({ ...demoWorkspace, relation_matrix: [] }),
    ).toThrow("READ_FAILED"));
});
describe("F10 friendly errors, never raw exceptions", () => {
  it.each([
    "WALLET_REJECTED",
    "WRONG_NETWORK",
    "INVALID_COUNTERPARTY",
    "INVALID_LABEL",
    "INVALID_CLAUSE_COUNT",
    "INVALID_CLAUSE",
    "UNAUTHORIZED",
    "ALREADY_SEALED",
    "NOT_READY",
    "ALREADY_RECONCILED",
    "EXECUTION_FAILED",
    "CONSENSUS_UNDETERMINED",
    "STATUS_UNAVAILABLE",
    "RPC_RATE_LIMITED",
    "RPC_UNAVAILABLE",
    "READ_FAILED",
    "WORKSPACE_NOT_FOUND",
    "NOT_RECONCILED",
    "INVALID_RELATION_INDEX",
    "INVALID_CONSENSUS_OUTPUT",
  ])("%s maps to a friendly message", (code) => {
    const message = friendlyError(
      new Error(`wrapped ${code} sensitive-secret stack trace`),
    );
    expect(message).toBeTruthy();
    expect(message).not.toContain("sensitive-secret");
    expect(message).not.toContain(code);
  });
  it("wallet 4001, HTTP 429 and unknown errors are sanitized", () => {
    expect(friendlyError({ code: 4001 })).toMatch(/rejected/);
    expect(friendlyError({ status: 429 })).toMatch(/rate limited/);
    expect(
      friendlyError(new Error("private_key=do-not-display\nstacktrace")),
    ).toBe("Unable to read workspace data. Please retry.");
  });
});
describe("F11 one bounded sequential retry per read/status operation", () => {
  it("respects Retry-After delay, at most two calls, no parallel retry", async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(new TransportError("RPC_RATE_LIMITED", 1234));
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(boundedRead(operation, sleep)).rejects.toThrow(
      "RPC_RATE_LIMITED",
    );
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledExactlyOnceWith(1234);
    expect(operation.mock.invocationCallOrder[1]).toBeGreaterThan(
      sleep.mock.invocationCallOrder[0],
    );
  });
  it("one transient RPC retry may succeed", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new TransportError("RPC_UNAVAILABLE", 0))
      .mockResolvedValue("ok");
    expect(await boundedRead(operation, async () => {})).toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });
  it("nontransient read errors are not automatically retried", async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(new Error("WORKSPACE_NOT_FOUND"));
    await expect(boundedRead(operation)).rejects.toThrow("WORKSPACE_NOT_FOUND");
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
describe("frozen storage compatibility regressions", () => {
  it("frontend trimming matches Python strip, preserves BOM and strips NEL", () => {
    expect(validateClauses(["\u0085abc\u0085"])).toEqual(["abc"]);
    expect(validateClauses(["\uFEFFabc\uFEFF"])).toEqual(["\uFEFFabc\uFEFF"]);
  });
});
describe('pinned SDK and six-method boundary',()=>{
 it('stable genlayer-js Studionet metadata matches frozen chain and RPC without connecting',async()=>{const {studionet}=await import('genlayer-js/chains');expect(studionet.id).toBe(61999);expect(studionet.rpcUrls.default.http).toContain('https://studio.genlayer.com/api');});
 it('Phase 3 fake exposes exactly the frozen six methods',async()=>{const {createPreview}=await import('../../src/lib/preview');expect(Object.keys(createPreview().contract).sort()).toEqual(['create_workspace','respond_and_seal','reconcile','get_workspace','get_workspace_summaries','get_relation'].sort());});
});
