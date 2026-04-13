'use client';

import React, { memo } from 'react';
import { SeatButton } from './seat-button';

type SeatData = {
  id: string;
  rowLabel: string;
  number: number;
  status: 'available' | 'locked' | 'sold';
  priceEth: number;
  walletAddress?: string | null;
};

type SeatRowProps = {
  rowLabel: string;
  seats: SeatData[];
  selectedSeatIds: Set<string>;
  onSeatClick: (seat: SeatData) => void;
};

export const SeatRow = memo(function SeatRow({
  rowLabel,
  seats,
  selectedSeatIds,
  onSeatClick,
}: SeatRowProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">{rowLabel}</span>
      <div className="flex flex-1 items-center justify-center gap-1.5">
        {seats.map((seat) => {
          const isSelected = selectedSeatIds.has(seat.id);
          const splitIndex = Math.ceil(seats.length / 2);
          const needsAisleGap = seat.number === splitIndex + 1;

          return (
            <SeatButton
              key={seat.id}
              seat={seat}
              isSelected={isSelected}
              needsAisleGap={needsAisleGap}
              onSeatClick={onSeatClick}
            />
          );
        })}
      </div>
      <span className="w-6 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">{rowLabel}</span>
    </div>
  );
});

SeatRow.displayName = 'SeatRow';
