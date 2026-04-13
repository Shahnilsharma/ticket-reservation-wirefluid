import { defineChain } from "viem";

export const wireFluid = defineChain({
  id: 92533,
  name: "WireFluid Testnet",
  nativeCurrency: {
    name: "WIRE",
    symbol: "WIRE",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_WIREFLUID_RPC_URL ?? "https://evm.wirefluid.com"],
    },
    public: {
      http: [process.env.NEXT_PUBLIC_WIREFLUID_RPC_URL ?? "https://evm.wirefluid.com"],
    },
  },
  testnet: true,
});
