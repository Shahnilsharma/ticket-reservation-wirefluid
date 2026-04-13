"use client";

import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { STADIUM_CONTRACT } from "../lib/contract-config";

export function useBasePrices(eventId: number = 1) {
  const contracts = [1, 2, 3].map((section) => ({
    ...STADIUM_CONTRACT,
    functionName: "basePrices" as const,
    args: [BigInt(eventId || 1), BigInt(section)],
  }));

  const query = useReadContracts({ contracts, allowFailure: true });
  const prices = useMemo(() => {
    return {
      1: query.data?.[0]?.result as bigint | undefined,
      2: query.data?.[1]?.result as bigint | undefined,
      3: query.data?.[2]?.result as bigint | undefined,
      4: query.data?.[3]?.result as bigint | undefined,
      5: query.data?.[4]?.result as bigint | undefined,
      6: query.data?.[5]?.result as bigint | undefined,
    };
  }, [query.data]);

  return { ...query, prices };
}

export function useSeatStatuses(eventId: number, section: number, rowStart: number, rowEnd: number, seatsPerRow: number) {
  const contracts = useMemo(() => {
    const out: Array<{ key: string; args: readonly [bigint, bigint, bigint, bigint] }> = [];
    for (let row = rowStart; row <= rowEnd; row += 1) {
      for (let seat = 0; seat < seatsPerRow; seat += 1) {
        out.push({
          key: `${eventId}-${section}-${row}-${seat}`,
          args: [BigInt(eventId), BigInt(section), BigInt(row), BigInt(seat)] as const,
        });
      }
    }
    return out;
  }, [eventId, rowEnd, rowStart, seatsPerRow, section]);

  const query = useReadContracts({
    contracts: contracts.map((c) => ({ ...STADIUM_CONTRACT, functionName: "seatTokenId" as const, args: c.args })),
    allowFailure: true,
  });

  const map = useMemo(() => {
    const result = new Map<string, boolean>();
    contracts.forEach((item, idx) => {
      const tokenId = query.data?.[idx]?.result as bigint | undefined;
      result.set(item.key, !!tokenId && tokenId > BigInt(0));
    });
    return result;
  }, [contracts, query.data]);

  return { ...query, reservedByKey: map };
}
