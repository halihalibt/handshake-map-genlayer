// Frozen deployment metadata and SDK type bridge. Real transport binding lives in integration.ts.
import type { createClient } from "genlayer-js";
export type StableGenLayerClient = ReturnType<typeof createClient>;
export const deployment = Object.freeze({
  protocol: "CLAUSEMESH-V1",
  address: "0x0Dcb5F452412aB73b32149ad1e082533D929Ed73",
  network: "Studionet",
  chainId: 61999,
  rpc: "https://studio.genlayer.com/api",
  sdkVersion: "1.1.8",
});
