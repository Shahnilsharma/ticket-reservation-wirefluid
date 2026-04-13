"use client";

import { useMemo, useState } from "react";
import { parseEventLogs } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { ENABLE_METADATA_MINT, STADIUM_CONTRACT, STATIC_MINT_METADATA_URI } from "../lib/contract-config";
import { normalizeEvmError } from "../lib/evm-errors";

export type SeatSelection = {
  eventId: number;
  section: number;
  row: number;
  seatNumber: number;
};

export function useSeatWrites() {
  const { writeContractAsync, isPending, error, reset } = useWriteContract();
  const [hash, setHash] = useState<`0x${string}` | undefined>();

  const receiptQuery = useWaitForTransactionReceipt({ hash, query: { enabled: !!hash } });

  const tokenIds = useMemo(() => {
    if (!receiptQuery.data) return [] as bigint[];
    const logs = parseEventLogs({ abi: STADIUM_CONTRACT.abi, logs: receiptQuery.data.logs, eventName: "SeatReserved" });
    return logs.map((l) => (l as any).args.tokenId as bigint);
  }, [receiptQuery.data]);

  async function reserveSingle(seat: SeatSelection, value: bigint) {
    const tx = ENABLE_METADATA_MINT
      ? await writeContractAsync({
          ...STADIUM_CONTRACT,
          functionName: "reserveSeat",
          args: [BigInt(seat.eventId), BigInt(seat.section), BigInt(seat.row), BigInt(seat.seatNumber), STATIC_MINT_METADATA_URI],
          value,
        })
      : await writeContractAsync({
          ...STADIUM_CONTRACT,
          functionName: "reserveSeat",
          args: [BigInt(seat.eventId), BigInt(seat.section), BigInt(seat.row), BigInt(seat.seatNumber)],
          value,
        });
    setHash(tx);
    return tx;
  }

  async function reserveBatch(seats: SeatSelection[], value: bigint) {
    const requests = seats.map((seat) => ({
      eventId: BigInt(seat.eventId),
      section: BigInt(seat.section),
      row: BigInt(seat.row),
      seatNumber: BigInt(seat.seatNumber),
    }));

    const tx = ENABLE_METADATA_MINT
      ? await writeContractAsync({
          ...STADIUM_CONTRACT,
          functionName: "reserveSeatsBatch",
          args: [requests, Array.from({ length: requests.length }, () => STATIC_MINT_METADATA_URI)],
          value,
        })
      : await writeContractAsync({
          ...STADIUM_CONTRACT,
          functionName: "reserveSeatsBatch",
          args: [requests],
          value,
        });
    setHash(tx);
    return tx;
  }

  return {
    reserveSingle,
    reserveBatch,
    isWriting: isPending,
    writeError: error,
    receiptQuery,
    tokenIds,
    clearHash: () => setHash(undefined),
    resetWrite: reset,
  };
}
