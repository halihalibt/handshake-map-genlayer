import { useEffect, useState } from "react";
import type { Address } from "./contract";
import { deployment } from "./genlayer";
import { errorCode } from "./errors";
export interface EIP1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, listener: (value: unknown) => void): void;
  removeListener?(event: string, listener: (value: unknown) => void): void;
}
declare global {
  interface Window {
    ethereum?: EIP1193;
  }
}
export function useWallet(provider?: EIP1193) {
  const [account, setAccount] = useState<Address>();
  const [chain, setChain] = useState<number>();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<string>();
  const [disconnected, setDisconnected] = useState(false);
  useEffect(() => {
    if (!provider || disconnected) return;
    let live = true;
    const accounts = (v: unknown) => {
      if (live)
        setAccount(
          (Array.isArray(v) ? v[0] : undefined) as Address | undefined,
        );
    };
    const chains = (v: unknown) => {
      if (live) setChain(Number(v));
    };
    void Promise.all([
      provider.request({ method: "eth_accounts" }),
      provider.request({ method: "eth_chainId" }),
    ])
      .then(([a, c]) => {
        accounts(a);
        chains(c);
      })
      .catch(() => {
        if (live) setError("RPC_UNAVAILABLE");
      });
    provider.on?.("accountsChanged", accounts);
    provider.on?.("chainChanged", chains);
    return () => {
      live = false;
      provider.removeListener?.("accountsChanged", accounts);
      provider.removeListener?.("chainChanged", chains);
    };
  }, [provider, disconnected]);
  const connect = async () => {
    if (busy) return;
    if (!provider) {
      setError("WALLET_UNAVAILABLE");
      return;
    }
    setBusy("Connecting wallet");
    setError(undefined);
    try {
      const a = (await provider.request({
        method: "eth_requestAccounts",
      })) as Address[];
      const c = await provider.request({ method: "eth_chainId" });
      setAccount(a[0]);
      setChain(Number(c));
      setDisconnected(false);
    } catch (e) {
      setError(errorCode(e, "RPC_UNAVAILABLE"));
    } finally {
      setBusy("");
    }
  };
  const switchNetwork = async () => {
    if (busy || !provider) return;
    setBusy("Switching network");
    setError(undefined);
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${deployment.chainId.toString(16)}` }],
      });
      setChain(Number(await provider.request({ method: "eth_chainId" })));
    } catch (e) {
      setError(errorCode(e, "WRONG_NETWORK"));
    } finally {
      setBusy("");
    }
  };
  return {
    account,
    chain,
    busy,
    error,
    wrongNetwork: !!account && chain !== deployment.chainId,
    connect,
    switchNetwork,
    disconnect: () => {
      setDisconnected(true);
      setAccount(undefined);
      setError(undefined);
    },
  };
}
