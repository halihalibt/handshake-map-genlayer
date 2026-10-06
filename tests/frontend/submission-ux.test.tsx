import { describe, it, expect, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import App from "../../src/App";
import { ports, WalletFake } from "./helpers";
const mount = (connected = false) => { const p = ports(); render(<App contract={p.contract} transactions={p.transactions} provider={new WalletFake(undefined, 61999, connected)} />); return p; };
describe("Submission evidence navigation", () => {
 it("shows the finalized public example before Create without a connected wallet", () => {
  const p = mount(); const card = screen.getByRole("region", {name:"Workspace #1"});
  for (const text of ["Verified Onchain Example","RECONCILED","1 Agreement","1 Conflict","2 Unrelated","FINALIZED / MAJORITY_AGREE / SUCCESS","5 Initial Validators · 3 AGREE / 2 IDLE","Studionet · Chain ID 61999"]) expect(within(card).getByText(text)).toBeInTheDocument();
  expect(card.compareDocumentPosition(screen.getByRole("heading", {name:"Create Workspace"})) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(p.contract.get_workspace).not.toHaveBeenCalled();
  expect(p.contract.get_workspace_summaries).not.toHaveBeenCalled();
 });
 it("relative example navigation calls the existing read and sends no writes", async () => {
  const p=mount(); const link=screen.getByRole("link",{name:"View Verified Result →"});expect(link).toHaveAttribute("href","?w=1");
  await userEvent.click(link); await waitFor(()=>expect(p.contract.get_workspace).toHaveBeenCalledWith(1));expect(window.location.search).toBe("?w=1");
  for(const fn of [p.contract.create_workspace,p.contract.respond_and_seal,p.contract.reconcile])expect(fn).not.toHaveBeenCalled();
 });
 it("explains exactly the four existing workflow steps",()=>{
  mount(); const steps=within(screen.getByRole("region",{name:"How it works"})).getAllByRole("listitem");
  expect(steps.map(x=>x.textContent)).toEqual(["Party A seals requirements","Party B seals response","GenLayer validators reconcile every clause pair","The accepted Relation Matrix persists onchain"]);
 });
 it("empty history remains wallet-filtered and offers a separate read-only link",async()=>{
  const p=ports();const wallet=new WalletFake();render(<App contract={p.contract} transactions={p.transactions} provider={wallet}/>);
  expect(await screen.findByText(/My Workspaces only shows workspaces associated with the currently connected wallet/)).toBeInTheDocument();
  expect(p.contract.get_workspace_summaries).toHaveBeenCalledWith(wallet.account);expect(screen.queryByRole("list",{name:"My Workspaces"})).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("link",{name:"Open Workspace #1"}));await waitFor(()=>expect(p.contract.get_workspace).toHaveBeenCalledWith(1));
  for(const fn of [p.contract.create_workspace,p.contract.respond_and_seal,p.contract.reconcile])expect(fn).not.toHaveBeenCalled();
 });
 it("production entry retains real integration and the card introduces no result state",()=>{
  const main=readFileSync("src/main.tsx","utf8");expect(main).toContain('createIntegration(window.ethereum)');expect(main).not.toMatch(/preview|mock|fake/i);
  const app=readFileSync("src/App.tsx","utf8");expect(app).toContain('contract.get_workspace(id)');expect(app).not.toMatch(/import.*(?:preview|mock|fake)/i);
  expect(app).not.toContain('relation_matrix:');
 });
});
