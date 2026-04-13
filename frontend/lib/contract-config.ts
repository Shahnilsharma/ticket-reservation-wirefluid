import type { Address } from "viem";
import { stadiumReservationAbi } from "../lib/abi/stadiumReservationAbi";

export const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "0x5D21dA3Fd25Af95f6b26E8b8784C431E06D5A940") as Address;

export const STATIC_MINT_METADATA_URI =
  process.env.NEXT_PUBLIC_STATIC_MINT_METADATA_URI ??
  "";

export const ENABLE_METADATA_MINT = process.env.NEXT_PUBLIC_ENABLE_METADATA_MINT === "true";

export const STADIUM_CONTRACT = {
  address: CONTRACT_ADDRESS,
  abi: stadiumReservationAbi,
} as const;

export function hasContractConfig() {
  return /^0x[a-fA-F0-9]{40}$/.test(CONTRACT_ADDRESS);
}