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
  blockExplorers: {
    default: {
      name: "WireFluidScan",
      url: process.env.NEXT_PUBLIC_TX_EXPLORER_BASE_URL?.replace(/\/tx\/?$/, "") ?? "https://wirefluidscan.com",
    },
  },
  testnet: true,
});

export const wireFluidChainIdHex = `0x${wireFluid.id.toString(16)}`;

export const wireFluidWalletAddParams = {
  chainId: wireFluidChainIdHex,
  chainName: wireFluid.name,
  nativeCurrency: wireFluid.nativeCurrency,
  rpcUrls: wireFluid.rpcUrls.default.http,
  blockExplorerUrls: [wireFluid.blockExplorers.default.url],
} as const;

export const wireFluidManualNetworkFields = [
  `Network Name: ${wireFluid.name}`,
  `RPC URL: ${wireFluid.rpcUrls.default.http[0]}`,
  `Chain ID: ${wireFluid.id}`,
  `Currency Symbol: ${wireFluid.nativeCurrency.symbol}`,
  `Block Explorer URL: ${wireFluid.blockExplorers.default.url}`,
].join("\n");
