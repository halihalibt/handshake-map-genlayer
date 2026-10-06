import { describe, it, expect, vi } from "vitest";
import { Transactions, TX_KEY } from "../../src/lib/transactions";
import { TransportError } from "../../src/lib/errors";
import type { Action, Receipt } from "../../src/lib/contract";
import { PARTY_A } from "../../src/lib/preview";
import { ports, deferred } from "./helpers";
const actions: Action[] = ["create_workspace", "respond_and_seal", "reconcile"];
describe("F12/F13 original transaction boundary and page recovery", () => {
  for (const action of actions)
    for (const failure of [
      "timeout",
      "RPC_UNAVAILABLE",
      "429",
      "finalization timeout",
      "finalized read failure",
    ])
      it(`${action}: ${failure} → same tx after recovery, write once`, async () => {
        const p = ports();
        const write = vi.fn().mockResolvedValue("0xoriginal");
        const fail =
          failure === "429"
            ? new TransportError("RPC_RATE_LIMITED", 0)
            : new Error(
                failure === "RPC_UNAVAILABLE"
                  ? "RPC_UNAVAILABLE"
                  : "STATUS_UNAVAILABLE",
              );
        if (failure === "finalization timeout")
          vi.mocked(p.lifecycle.waitForFinalization).mockRejectedValue(fail);
        else if (failure === "finalized read failure")
          vi.mocked(p.contract.get_workspace).mockRejectedValue(
            new TransportError("RPC_UNAVAILABLE", 0),
          );
        else vi.mocked(p.lifecycle.waitForDecision).mockRejectedValue(fail);
        await p.transactions.submit(
          action,
          PARTY_A,
          write,
          action === "create_workspace" ? undefined : 1,
        );
        expect(write).toHaveBeenCalledTimes(1);
        expect(p.transactions.getSnapshot().pending?.id).toBe("0xoriginal");
        expect(JSON.parse(localStorage.getItem(TX_KEY)!).id).toBe("0xoriginal");
        if (failure === "429" || failure === "RPC_UNAVAILABLE")
          expect(p.lifecycle.waitForDecision).toHaveBeenCalledTimes(2);
        if (failure === "finalized read failure")
          expect(p.contract.get_workspace).toHaveBeenCalledTimes(2);
        const recovered = new Transactions(
          p.contract,
          p.lifecycle,
          localStorage,
          async () => {},
        );
        expect(recovered.getSnapshot().pending?.id).toBe("0xoriginal");
        await expect(
          recovered.submit(action, PARTY_A, write, 1),
        ).rejects.toThrow("TX_PENDING");
        vi.mocked(p.lifecycle.waitForDecision).mockResolvedValue({
          outcome: "SUCCESS",
          createdWorkspaceId: 1,
        });
        vi.mocked(p.lifecycle.waitForFinalization).mockResolvedValue({
          outcome: "SUCCESS",
          createdWorkspaceId: 1,
        });
        vi.mocked(p.contract.get_workspace).mockResolvedValue(
          (await import("../../src/lib/preview")).demoWorkspace,
        );
        await recovered.resume();
        expect(write).toHaveBeenCalledTimes(1);
        expect(recovered.getSnapshot().pending).toBeUndefined();
        for (const call of vi.mocked(p.lifecycle.waitForDecision).mock.calls)
          expect(call[0]).toBe("0xoriginal");
        for (const call of vi.mocked(p.lifecycle.waitForFinalization).mock
          .calls)
          expect(call[0]).toBe("0xoriginal");
      });
  it("F13 double submit while signing cannot create duplicates", async () => {
    const p = ports();
    const sign = deferred<string>();
    const write = vi.fn(() => sign.promise);
    const first = p.transactions.submit("create_workspace", PARTY_A, write);
    await expect(
      p.transactions.submit("create_workspace", PARTY_A, write),
    ).rejects.toThrow("TX_PENDING");
    sign.resolve("0xoriginal");
    await first;
    expect(write).toHaveBeenCalledTimes(1);
  });
  it("F13 create with unavailable exact result never guesses latest history or resends", async () => {
    const p = ports();
    vi.mocked(p.lifecycle.waitForDecision).mockResolvedValue({
      outcome: "SUCCESS",
    });
    vi.mocked(p.lifecycle.waitForFinalization).mockResolvedValue({
      outcome: "SUCCESS",
    });
    const write = vi.fn().mockResolvedValue("0xoriginal");
    await p.transactions.submit("create_workspace", PARTY_A, write);
    await p.transactions.resume();
    expect(p.transactions.getSnapshot().pending?.id).toBe("0xoriginal");
    expect(p.contract.get_workspace_summaries).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalledTimes(1);
  });
});
describe("F14 one active lifecycle waiter", () => {
  it("coalesces parallel Resume, including subscription reentry", async () => {
    const p = ports();
    const gate = deferred<Receipt>();
    vi.mocked(p.lifecycle.waitForDecision).mockReturnValue(gate.promise);
    let reentered = false;
    let nested: Promise<void> | undefined;
    p.transactions.subscribe(() => {
      if (
        p.transactions.getSnapshot().stage ===
          "Resuming transaction lifecycle" &&
        !reentered
      ) {
        reentered = true;
        nested = p.transactions.resume();
      }
    });
    const submitted = p.transactions.submit(
      "reconcile",
      PARTY_A,
      async () => "0xoriginal",
      1,
    );
    await vi.waitFor(() =>
      expect(p.lifecycle.waitForDecision).toHaveBeenCalledTimes(1),
    );
    const a = p.transactions.resume(),
      b = p.transactions.resume();
    expect(a).toBe(b);
    expect(nested).toBe(a);
    gate.resolve({ outcome: "SUCCESS" });
    await Promise.all([submitted, a, b]);
    expect(p.lifecycle.waitForDecision).toHaveBeenCalledTimes(1);
    expect(p.lifecycle.waitForFinalization).toHaveBeenCalledTimes(1);
  });
});
describe("F06 lifecycle and finalized snapshot", () => {
  it("emits all submission/decision/consensus/finalization/read/success stages with tx visible", async () => {
    const p = ports();
    const states: string[] = [];
    p.transactions.subscribe(() =>
      states.push(p.transactions.getSnapshot().stage),
    );
    vi.mocked(p.lifecycle.waitForDecision).mockImplementation(
      async (_id, onConsensus) => {
        onConsensus?.();
        return { outcome: "SUCCESS" };
      },
    );
    await p.transactions.submit(
      "reconcile",
      PARTY_A,
      async () => "0xoriginal",
      1,
    );
    expect(states).toEqual(
      expect.arrayContaining([
        "Submitting transaction",
        "Transaction submitted",
        "Resuming transaction lifecycle",
        "Waiting for transaction decision",
        "Running GenLayer consensus",
        "Waiting for finalization",
        "Reading finalized result",
        "Workspace reconciled",
      ]),
    );
    expect(p.transactions.getSnapshot().lastId).toBe("0xoriginal");
    expect(p.contract.get_workspace).toHaveBeenCalledTimes(1);
  });
  it.each(["FAILED", "REJECTED", "UNDETERMINED"] as const)(
    "known %s does not resend, mutate workspace, or read a successful result",
    async (outcome) => {
      const p = ports();
      vi.mocked(p.lifecycle.waitForDecision).mockResolvedValue({ outcome });
      const write = vi.fn().mockResolvedValue("0xoriginal");
      await p.transactions.submit("reconcile", PARTY_A, write, 1);
      expect(p.transactions.getSnapshot().pending).toBeUndefined();
      expect(p.transactions.getSnapshot().error).toBe(
        outcome === "UNDETERMINED"
          ? "CONSENSUS_UNDETERMINED"
          : "EXECUTION_FAILED",
      );
      expect(write).toHaveBeenCalledTimes(1);
      expect(p.contract.get_workspace).not.toHaveBeenCalled();
    },
  );
  it("write rejection is never retried by read retry policy", async () => {
    const p = ports();
    const write = vi.fn().mockRejectedValue({ code: 4001 });
    await p.transactions.submit("create_workspace", PARTY_A, write);
    expect(write).toHaveBeenCalledTimes(1);
    expect(p.transactions.getSnapshot().error).toBe("WALLET_REJECTED");
    expect(p.lifecycle.waitForDecision).not.toHaveBeenCalled();
  });
  it("submitted tx remains in memory if metadata storage is unavailable", async () => {
    const p = ports();
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    const t = new Transactions(
      p.contract,
      p.lifecycle,
      storage,
      async () => {},
    );
    vi.mocked(p.lifecycle.waitForDecision).mockRejectedValue(
      new Error("STATUS_UNAVAILABLE"),
    );
    const write = vi.fn().mockResolvedValue("0xoriginal");
    await t.submit("create_workspace", PARTY_A, write);
    await t.resume();
    expect(t.getSnapshot().pending?.id).toBe("0xoriginal");
    expect(write).toHaveBeenCalledTimes(1);
  });
});
