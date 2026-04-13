'use client';

import React, { memo } from 'react';
import { motion } from 'framer-motion';

type SeatStatus = 'available' | 'locked' | 'sold';

type SeatData = {
  id: string;
  rowLabel: string;
  number: number;
  status: SeatStatus;
  priceEth: number;
  walletAddress?: string | null;
};

type SeatButtonProps = {
  seat: SeatData;
  isSelected: boolean;
  needsAisleGap: boolean;
  onSeatClick: (seat: SeatData) => void;
};

function getSeatClasses(status: SeatStatus, isSelected: boolean): string {
  if (isSelected) {
    return 'bg-gradient-to-br from-emerald-500 to-emerald-600 border-emerald-600 text-white ring-2 ring-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.3)] dark:ring-emerald-500/20';
  }
  if (status === 'available') {
    return 'bg-white border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:shadow-md cursor-pointer transition-all duration-200 dark:border-slate-600 dark:bg-slate-800/80 dark:text-emerald-300 dark:hover:bg-slate-700';
  }
  if (status === 'locked') {
    return 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed opacity-60 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-500';
  }
  return 'bg-rose-100 border-rose-300 text-rose-500 cursor-not-allowed opacity-70 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300';
}

function SeatGlyph({ status, isSelected }: { status: SeatStatus; isSelected: boolean }) {
  const isDisabled = status !== 'available';
  const stroke = isSelected
    ? '#ffffff'
    : status === 'sold'
      ? '#ef4444'
      : isDisabled
        ? '#94a3b8'
        : '#10b981';

  return (
    <motion.svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      aria-hidden
      animate={{ scale: isSelected ? 1.15 : 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <rect x="6.5" y="9" width="11" height="6.5" rx="1.4" fill="none" stroke={stroke} strokeWidth="1.8" />
      <line x1="6.5" y1="12.2" x2="17.5" y2="12.2" stroke={stroke} strokeWidth="1.6" />
      <line x1="4.5" y1="9.2" x2="4.5" y2="16.2" stroke={stroke} strokeWidth="1.8" />
      <line x1="19.5" y1="9.2" x2="19.5" y2="16.2" stroke={stroke} strokeWidth="1.8" />
      <line x1="7" y1="16.8" x2="7" y2="19.5" stroke={stroke} strokeWidth="1.8" />
      <line x1="17" y1="16.8" x2="17" y2="19.5" stroke={stroke} strokeWidth="1.8" />
    </motion.svg>
  );
}

export const SeatButton = memo(function SeatButton({
  seat,
  isSelected,
  needsAisleGap,
  onSeatClick,
}: SeatButtonProps) {
  const isDisabled = seat.status !== 'available';

  return (
    <motion.button
      type="button"
      disabled={isDisabled}
      onClick={() => onSeatClick(seat)}
      whileHover={!isDisabled ? { scale: 1.1, y: -2 } : {}}
      whileTap={!isDisabled ? { scale: 0.95 } : {}}
      className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-full border transition ${needsAisleGap ? 'ml-2' : ''} ${getSeatClasses(seat.status, isSelected)}`}
      title={`Row ${seat.rowLabel}, Seat ${seat.number}`}
    >
      <SeatGlyph status={seat.status} isSelected={isSelected} />
    </motion.button>
  );
});

SeatButton.displayName = 'SeatButton';
