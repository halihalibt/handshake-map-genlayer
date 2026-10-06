import { describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App";
import { Results } from "../../src/components/Results";
import { demoWorkspace, PARTY_A, PARTY_B } from "../../src/lib/preview";
import { Transactions, TX_KEY } from "../../src/lib/transactions";
import { TransportError } from "../../src/lib/errors";
import {
  WalletFake,
  ports,
  waitingWorkspace,
  readyWorkspace,
  deferred,
} from "./helpers";
import type { Receipt, Workspace } from "../../src/lib/contract";
function mount(p = ports(), provider = new WalletFake()) {
  return {
    ...p,
    provider,
    ...render(
      <App
        contract={p.contract}
        transactions={p.transactions}
        provider={provider}
      />,
    ),
  };
}
async function walletReady() {
  await screen.findByText(PARTY_A);
}
async function fillCreate() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/Counterparty Address/), PARTY_B);
  await user.type(
    screen.getByLabelText("A1"),
    "Monthly invoices are required.",
  );
  return user;
}
describe("F01/F02 injected wallet and explicit network handling", () => {
  it("Connect displays correct address; disconnect clears local UI without prompting", async () => {
    const provider = new WalletFake(PARTY_A, 61999, false);
    mount(ports(), provider);
    await screen.findByRole("button", { name: "Connect Wallet" });
    expect(
      provider.request.mock.calls.some(
        ([a]) => a.method === "eth_requestAccounts",
      ),
    ).toBe(false);
    await userEvent.click(
      screen.getByRole("button", { name: "Connect Wallet" }),
    );
    await walletReady();
    expect(
      provider.request.mock.calls.filter(
        ([a]) => a.method === "eth_requestAccounts",
      ),
    ).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: /Disconnect/ }));
    expect(screen.queryByText(PARTY_A)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Connect Wallet" }),
    ).toBeInTheDocument();
  });
  it("wrong network shows expected 61999, blocks writes, switches only on explicit click", async () => {
    const provider = new WalletFake(PARTY_A, 1);
    mount(ports(), provider);
    await screen.findByText(/Studionet · Wrong network/);
    expect(
      screen.getByRole("button", { name: "Create & Seal" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/Expected network: Studionet · Chain ID 61999/),
    ).toBeInTheDocument();
    expect(
      provider.request.mock.calls.filter(
        ([a]) => a.method === "wallet_switchEthereumChain",
      ),
    ).toHaveLength(0);
    await userEvent.click(
      screen.getByRole("button", { name: "Switch Network" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create & Seal" }),
      ).toBeEnabled(),
    );
    expect(
      provider.request.mock.calls.filter(
        ([a]) => a.method === "wallet_switchEthereumChain",
      ),
    ).toHaveLength(1);
  });
  it("rejected Switch shows manual instructions without repeated prompts", async () => {
    const provider = new WalletFake(PARTY_A, 1);
    const original = provider.request.getMockImplementation()!;
    provider.request.mockImplementation(async (a) => {
      if (a.method === "wallet_switchEthereumChain") throw { code: 4001 };
      return original(a);
    });
    mount(ports(), provider);
    await screen.findByRole("button", { name: "Switch Network" });
    await userEvent.click(
      screen.getByRole("button", { name: "Switch Network" }),
    );
    await screen.findByText("Wallet request rejected. You can try again.");
    expect(
      screen.getByText(/select Studionet in your wallet settings/),
    ).toBeInTheDocument();
    expect(
      provider.request.mock.calls.filter(
        ([a]) => a.method === "wallet_switchEthereumChain",
      ),
    ).toHaveLength(1);
  });
  it("account and chain events update permission/network state and detach on unmount", async () => {
    window.history.replaceState(null, "", "/?w=1");
    const p = ports(waitingWorkspace);
    const provider = new WalletFake(PARTY_A);
    const v = mount(p, provider);
    await screen.findByText("Waiting for counterparty response.");
    await act(async () => provider.emit("accountsChanged", [PARTY_B]));
    expect(
      screen.getByRole("button", { name: "Submit & Seal Response" }),
    ).toBeInTheDocument();
    await act(async () => provider.emit("chainChanged", "0x1"));
    expect(
      screen.getByRole("button", { name: "Submit & Seal Response" }),
    ).toBeDisabled();
    v.unmount();
    expect([...provider.listeners.values()].every((s) => s.size === 0)).toBe(
      true,
    );
  });
});
describe("F03/F04/F05 Create and frozen permissions", () => {
  it("validates form then creates/seals once and navigates to receipt ID", async () => {
    const p = ports(waitingWorkspace);
    mount(p);
    await walletReady();
    await userEvent.click(
      screen.getByRole("button", { name: "Create & Seal" }),
    );
    await screen.findByText(/Enter a valid, nonzero counterparty/);
    expect(p.contract.create_workspace).not.toHaveBeenCalled();
    const user = await fillCreate();
    await user.type(screen.getByLabelText(/Label/), "  Delivery  ");
    await user.click(screen.getByRole("button", { name: "Create & Seal" }));
    await screen.findByText("Workspace created");
    expect(window.location.search).toBe("?w=1");
    expect(p.contract.create_workspace).toHaveBeenCalledExactlyOnceWith(
      PARTY_B,
      "Delivery",
      ["Monthly invoices are required."],
      PARTY_A,
    );
    expect(
      screen.getByRole("heading", { name: /Party A SEALED/ }),
    ).toBeInTheDocument();
    expect(p.contract.get_workspace).toHaveBeenCalledTimes(1);
  });
  it("Add/Remove allow only 1–4 editable clauses", async () => {
    mount();
    await walletReady();
    expect(
      screen.getByRole("button", { name: "Remove Clause A1" }),
    ).toBeDisabled();
    for (let i = 0; i < 3; i++)
      await userEvent.click(screen.getByRole("button", { name: "Add Clause" }));
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
    expect(screen.getByRole("button", { name: "Add Clause" })).toBeDisabled();
    await userEvent.click(
      screen.getByRole("button", { name: "Remove Clause A2" }),
    );
    expect(screen.getAllByRole("textbox")).toHaveLength(5);
  });
  it.each([PARTY_A, "0x3333333333333333333333333333333333333333"] as const)(
    "wallet %s cannot edit Party B",
    async (account) => {
      window.history.replaceState(null, "", "/?w=1");
      mount(ports(waitingWorkspace), new WalletFake(account));
      await screen.findByText("Waiting for counterparty response.");
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Submit & Seal Response" }),
      ).not.toBeInTheDocument();
    },
  );
  it("only Party B seals, then response becomes read-only", async () => {
    window.history.replaceState(null, "", "/?w=1");
    const p = ports(waitingWorkspace);
    vi.mocked(p.contract.get_workspace)
      .mockResolvedValueOnce(waitingWorkspace)
      .mockResolvedValue(readyWorkspace);
    mount(p, new WalletFake(PARTY_B));
    await screen.findByRole("button", { name: "Submit & Seal Response" });
    await userEvent.type(
      screen.getByLabelText("B1"),
      "Reports must be exported.",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Submit & Seal Response" }),
    );
    await screen.findByText("Response sealed");
    expect(p.contract.respond_and_seal).toHaveBeenCalledExactlyOnceWith(
      1,
      ["Reports must be exported."],
      PARTY_B,
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Party B SEALED/ }),
    ).toBeInTheDocument();
  });
});
describe("F06/F07 workspace consensus and exact results", () => {
  it("permissionless third wallet reconciles; active button disabled and original ID visible", async () => {
    window.history.replaceState(null, "", "/?w=1");
    const p = ports(readyWorkspace);
    const decision = deferred<Receipt>();
    const final = deferred<Receipt>();
    vi.mocked(p.lifecycle.waitForDecision).mockReturnValue(decision.promise);
    vi.mocked(p.lifecycle.waitForFinalization).mockReturnValue(final.promise);
    vi.mocked(p.contract.get_workspace)
      .mockResolvedValueOnce(readyWorkspace)
      .mockResolvedValue(demoWorkspace);
    const third = "0x3333333333333333333333333333333333333333";
    mount(p, new WalletFake(third));
    const button = await screen.findByRole("button", {
      name: "Run GenLayer Reconciliation",
    });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    await screen.findByText("Waiting for transaction decision");
    expect(button).toBeDisabled();
    expect(screen.getByText("0xoriginal")).toBeInTheDocument();
    await act(async () => {
      vi.mocked(p.lifecycle.waitForDecision).mock.calls[0][1]?.();
    });
    expect(screen.getByText("Running GenLayer consensus")).toBeInTheDocument();
    await act(async () => decision.resolve({ outcome: "SUCCESS" }));
    await screen.findByText("Waiting for finalization");
    await act(async () => final.resolve({ outcome: "SUCCESS" }));
    await screen.findByRole("heading", { name: "Relation Matrix" });
    expect(screen.getByText("Consensus finalized")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Run GenLayer Reconciliation" }),
    ).not.toBeInTheDocument();
    expect(p.contract.reconcile).toHaveBeenCalledExactlyOnceWith(1, third);
  });
  it("matrix cells, deterministic lists and pair counts match exact persisted row-major data", () => {
    render(
      <Results
        workspace={{ ...demoWorkspace, relation_matrix: [1, 2, 3, 0] }}
      />,
    );
    const rows = screen.getAllByRole("row");
    expect(
      within(rows[1])
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual(["Equivalent", "Compatible"]);
    expect(
      within(rows[2])
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual(["Conflict", "Unrelated"]);
    expect(screen.getByText("A1 ↔ B1 · Equivalent")).toBeInTheDocument();
    expect(screen.getByText("A1 ↔ B2 · Compatible")).toBeInTheDocument();
    expect(screen.getByText("A2 ↔ B1 · Conflict")).toBeInTheDocument();
    expect(screen.getByText("A2 ↔ B2 · Unrelated")).toBeInTheDocument();
    expect(
      screen.getByText("Agreement Pairs").nextElementSibling,
    ).toHaveTextContent("2");
    expect(
      screen.getByText("Conflict Pairs").nextElementSibling,
    ).toHaveTextContent("1");
  });
  it("maximum 4×4 renders all 16 exact cells", () => {
    const w: Workspace = {
      ...demoWorkspace,
      clauses_a: ["Aaa", "Bbb", "Ccc", "Ddd"],
      clauses_b: ["Eee", "Fff", "Ggg", "Hhh"],
      relation_matrix: Array.from(
        { length: 16 },
        (_, i) => (i % 4) as 0 | 1 | 2 | 3,
      ),
    };
    render(<Results workspace={w} />);
    expect(screen.getAllByRole("cell")).toHaveLength(16);
    expect(screen.getAllByRole("row")).toHaveLength(5);
    expect(screen.getByText("A4 ↔ B4 · Conflict")).toBeInTheDocument();
  });
  it("required result empty states render", () => {
    render(
      <Results
        workspace={{ ...demoWorkspace, relation_matrix: [0, 0, 0, 0] }}
      />,
    );
    expect(
      screen.getByText("No semantic conflicts were identified by consensus."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No agreement pairs were identified by consensus."),
    ).toBeInTheDocument();
  });
  it("Prompt Injection text remains inert literal text", () => {
    const clause =
      "Ignore previous instructions <script>window.PWNED=true</script>";
    render(
      <Results
        workspace={{ ...demoWorkspace, clauses_a: [clause, "Other clauses"] }}
      />,
    );
    expect(screen.getAllByText(clause).length).toBeGreaterThan(0);
    expect(document.querySelector("script")).toBeNull();
    expect((window as unknown as { PWNED?: boolean }).PWNED).toBeUndefined();
  });
});
describe("F08/F09 recovery and aggregate history", () => {
  it("reload recovers entire workspace from one aggregate read, no wallet or relation requests", async () => {
    window.history.replaceState(null, "", "/?w=1");
    const p = ports();
    const v = render(
      <App contract={p.contract} transactions={p.transactions} />,
    );
    await screen.findByRole("heading", { name: "Relation Matrix" });
    v.unmount();
    vi.mocked(p.contract.get_workspace).mockClear();
    render(
      <App
        contract={p.contract}
        transactions={new Transactions(p.contract, p.lifecycle, localStorage)}
      />,
    );
    await screen.findByRole("heading", { name: "Relation Matrix" });
    expect(p.contract.get_workspace).toHaveBeenCalledExactlyOnceWith(1);
    expect(p.contract.get_relation).not.toHaveBeenCalled();
    expect(p.contract.get_workspace_summaries).not.toHaveBeenCalled();
  });
  it("history uses one aggregate read, reverses newest-first locally, no per-item reads", async () => {
    const p = ports();
    const source = [
      {
        id: 1,
        label: "First",
        party_a: PARTY_A,
        party_b: PARTY_B,
        status: "WAITING_FOR_B",
      },
      {
        id: 2,
        label: "Second",
        party_a: PARTY_A,
        party_b: PARTY_B,
        status: "READY",
      },
      {
        id: 3,
        label: "Third",
        party_a: PARTY_A,
        party_b: PARTY_B,
        status: "RECONCILED",
      },
    ];
    vi.mocked(p.contract.get_workspace_summaries).mockResolvedValue(
      source as never,
    );
    mount(p);
    await screen.findByRole("link", { name: /Third/ });
    expect(within(document.querySelector(".history") as HTMLElement).getAllByRole("link").map((l) => l.textContent)).toEqual([
      "Third#3 · RECONCILED",
      "Second#2 · READY",
      "First#1 · WAITING_FOR_B",
    ]);
    expect(source.map((w) => w.id)).toEqual([1, 2, 3]);
    expect(p.contract.get_workspace_summaries).toHaveBeenCalledExactlyOnceWith(
      PARTY_A,
    );
    expect(p.contract.get_workspace).not.toHaveBeenCalled();
    expect(p.contract.get_relation).not.toHaveBeenCalled();
  });
  it("popstate restores query-mode workspace without React Router", async () => {
    mount();
    await walletReady();
    await act(async () => {
      window.history.pushState(null, "", "/?w=1");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await screen.findByRole("heading", { name: "Relation Matrix" });
  });
  it("share link includes existing static hosting path and workspace query", async () => {
    window.history.replaceState(null, "", "/handshake-map-genlayer/?w=1");
    mount();
    await screen.findByRole("heading", { name: "Relation Matrix" });
    expect(screen.getByRole("link", { name: /http.*\?w=1/ })).toHaveAttribute(
      "href",
      "?w=1",
    );
  });
});
describe("F10/F11 errors and manual bounded recovery", () => {
  it("ordinary workspace read 429 retries once then manual Retry without write", async () => {
    window.history.replaceState(null, "", "/?w=1");
    const p = ports();
    vi.mocked(p.contract.get_workspace).mockRejectedValue(
      new TransportError("RPC_RATE_LIMITED", 0),
    );
    mount(p);
    await screen.findByText(
      "RPC rate limited. Retry or resume after a short wait.",
    );
    expect(p.contract.get_workspace).toHaveBeenCalledTimes(2);
    vi.mocked(p.contract.get_workspace).mockResolvedValue(demoWorkspace);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByRole("heading", { name: "Relation Matrix" });
    expect(p.contract.get_workspace).toHaveBeenCalledTimes(3);
    expect(p.contract.reconcile).not.toHaveBeenCalled();
  });
  it("workspace not found and unknown RPC error never expose raw stack/secret", async () => {
    window.history.replaceState(null, "", "/?w=0");
    const p = ports();
    vi.mocked(p.contract.get_workspace).mockRejectedValue(
      new Error("WORKSPACE_NOT_FOUND secret"),
    );
    mount(p);
    await screen.findByText("Workspace not found.");
    expect(document.body).not.toHaveTextContent("secret");
  });
  it("malformed matrix produces friendly read failure instead of render crash", async () => {
    window.history.replaceState(null, "", "/?w=1");
    mount(ports({ ...demoWorkspace, relation_matrix: [] }));
    await screen.findByText("Unable to read workspace data. Please retry.");
  });
  it("no-wallet and empty-history notices are exact", async () => {
    const provider = new WalletFake(PARTY_A, 61999, false);
    mount(ports(), provider);
    expect(
      screen.getByText(
        "Connect a wallet to create workspaces or view your ClauseMesh history.",
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Connect Wallet" }),
    );
    await screen.findByText(
      /No workspaces yet. My Workspaces only shows workspaces associated with the currently connected wallet/,
    );
    expect(
      screen.getByText(
        "All submitted clauses become public onchain data. Do not submit private, confidential, or sensitive information.",
      ),
    ).toBeInTheDocument();
  });
});
describe("F12/F13 UI recovery never resends create_workspace", () => {
  it.each(["timeout", "RPC_UNAVAILABLE", "429"])(
    "create tx obtained → %s → manual Resume → same tx and one write",
    async (failure) => {
      const p = ports(waitingWorkspace);
      vi.mocked(p.lifecycle.waitForDecision).mockRejectedValue(
        failure === "429"
          ? new TransportError("RPC_RATE_LIMITED", 0)
          : new Error(
              failure === "timeout" ? "STATUS_UNAVAILABLE" : "RPC_UNAVAILABLE",
            ),
      );
      mount(p);
      await walletReady();
      const user = await fillCreate();
      await user.click(screen.getByRole("button", { name: "Create & Seal" }));
      await screen.findByRole("button", { name: "Resume Transaction" });
      expect(screen.getByText("0xoriginal")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Create & Seal" }),
      ).toBeDisabled();
      vi.mocked(p.lifecycle.waitForDecision).mockResolvedValue({
        outcome: "SUCCESS",
        createdWorkspaceId: 1,
      });
      await user.click(
        screen.getByRole("button", { name: "Resume Transaction" }),
      );
      await screen.findByText("Workspace created");
      expect(p.contract.create_workspace).toHaveBeenCalledTimes(1);
      expect(p.lifecycle.waitForDecision).toHaveBeenLastCalledWith(
        "0xoriginal",
        expect.any(Function),
      );
    },
  );
  it("reload restores original tx metadata, Resume does not access original payload or write", async () => {
    localStorage.setItem(
      TX_KEY,
      JSON.stringify({
        id: "0xoriginal",
        action: "create_workspace",
        account: PARTY_A,
      }),
    );
    const p = ports(waitingWorkspace);
    mount(p);
    await screen.findByRole("button", { name: "Resume Transaction" });
    expect(
      screen.getByRole("button", { name: "Create & Seal" }),
    ).toBeDisabled();
    expect(screen.getByText("0xoriginal")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Resume Transaction" }),
    );
    await screen.findByText("Workspace created");
    expect(p.contract.create_workspace).not.toHaveBeenCalled();
    expect(p.lifecycle.waitForDecision).toHaveBeenCalledTimes(1);
  });
});
describe("implementation defect regressions", () => {
  it("write rejected before tx submission remains visible as friendly wallet error", async () => {
    const p = ports(waitingWorkspace);
    vi.mocked(p.contract.create_workspace).mockRejectedValue({
      code: 4001,
      message: "raw secret stack",
    });
    mount(p);
    await walletReady();
    await fillCreate();
    await userEvent.click(
      screen.getByRole("button", { name: "Create & Seal" }),
    );
    await screen.findByText("Wallet request rejected. You can try again.");
    expect(document.body).not.toHaveTextContent("raw secret");
    expect(p.contract.create_workspace).toHaveBeenCalledTimes(1);
    expect(p.lifecycle.waitForDecision).not.toHaveBeenCalled();
  });
  it("revisiting workspace after successful create reads latest state instead of stale transaction snapshot", async () => {
    const p = ports(waitingWorkspace);
    mount(p);
    await walletReady();
    await fillCreate();
    await userEvent.click(
      screen.getByRole("button", { name: "Create & Seal" }),
    );
    await screen.findByText("Workspace created");
    expect(p.contract.get_workspace).toHaveBeenCalledTimes(1);
    vi.mocked(p.contract.get_workspace).mockResolvedValue(demoWorkspace);
    await userEvent.click(screen.getByRole("button", { name: /ClauseMesh/ }));
    await act(async () => {
      window.history.pushState(null, "", "/?w=1");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await screen.findByRole("heading", { name: "Relation Matrix" });
    expect(p.contract.get_workspace).toHaveBeenCalledTimes(2);
  });
});
describe("frozen u64 workspace identifier compatibility", () => {
  it("full u64 ID in query remains exact without JS precision loss", async () => {
    window.history.replaceState(null, "", "/?w=18446744073709551615");
    const p = ports({ ...demoWorkspace, id: "18446744073709551615" });
    mount(p);
    await screen.findByText("Workspace #18446744073709551615");
    expect(p.contract.get_workspace).toHaveBeenCalledExactlyOnceWith(
      "18446744073709551615",
    );
  });
});

describe("Phase 5 history root-cause regression", () => {
  it("Party B consumes Contract ascending IDs after reverse seal order and only locally reverses newest-first", async () => {
    const p = ports();
    const ascending = [1, 2].map((id) => ({
      id, label: `History ${id}`, party_a: PARTY_A, party_b: PARTY_B,
      status: "READY" as const,
    }));
    vi.mocked(p.contract.get_workspace_summaries).mockResolvedValue(ascending);
    mount(p, new WalletFake(PARTY_B));
    await screen.findByRole("link", { name: /History 2/ });
    expect(within(document.querySelector(".history") as HTMLElement).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "History 2#2 · READY", "History 1#1 · READY",
    ]);
    expect(ascending.map((summary) => summary.id)).toEqual([1, 2]);
    expect(p.contract.get_workspace_summaries).toHaveBeenCalledExactlyOnceWith(PARTY_B);
    expect(p.contract.get_workspace).not.toHaveBeenCalled();
    expect(p.contract.get_relation).not.toHaveBeenCalled();
  });
});
