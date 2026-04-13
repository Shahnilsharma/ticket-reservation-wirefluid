'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Ticket, TrendingUp } from 'lucide-react';
import { useSelectedSeats } from '@/contexts/seat-context';

const NATIVE_TOKEN_SYMBOL = 'WIRE';

export function OrderSummary({
  selectedSeats,
  availableCount,
  prices,
  isBusy,
  onConfirm,
  onRemoveSeat,
}: {
  selectedSeats: any[];
  availableCount: number;
  prices: Record<number, bigint | undefined>;
  isBusy: boolean;
  onConfirm: () => void;
  onRemoveSeat?: (seatId: string) => void | Promise<void>;
}) {
  const { removeSeat } = useSelectedSeats();
  
  const displayTotalPrice = selectedSeats.reduce((acc, seat) => {
    // Seat prices are stored in native-token units for display.
    return acc + (seat.priceEth || 0);
  }, 0);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex max-h-[calc(100vh-7.5rem)] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-700 dark:bg-slate-950/70 dark:shadow-emerald-900/10"
    >
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-emerald-50 to-emerald-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700 border border-emerald-200 mb-4 dark:border-emerald-500/10 dark:from-emerald-500/10 dark:to-emerald-500/5 dark:text-emerald-300">
          <Ticket className="h-3.5 w-3.5" />
          Order Summary
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Stadium Tickets
        </h3>
      </div>

      {/* Section Info */}
      <div className="mb-6 space-y-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600 dark:text-slate-400">Total Seats</span>
          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold dark:bg-emerald-500/15 dark:text-emerald-300">
            {selectedSeats.length}
          </span>
        </div>
      </div>

      {/* Selected Seats */}
      <div className="mb-4 min-h-0 flex-1 overflow-y-auto pr-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-3 dark:text-slate-400">
          Your Seats
        </p>
        <AnimatePresence mode="popLayout">
          {selectedSeats.length > 0 ? (
            selectedSeats.map((seat) => (
              <motion.div
                key={seat.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="flex items-center justify-between rounded-lg bg-slate-50 p-3 mb-2 border border-slate-200 hover:bg-slate-100 transition group dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-900"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Row {seat.rowLabel}, Seat {seat.number}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{seat.priceEth} {NATIVE_TOKEN_SYMBOL}</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    if (onRemoveSeat) {
                      void onRemoveSeat(seat.id);
                      return;
                    }
                    removeSeat(seat.id);
                  }}
                  className="flex items-center justify-center h-6 w-6 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition opacity-0 group-hover:opacity-100 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
                  title="Remove seat"
                >
                  <X className="h-3 w-3" />
                </motion.button>
              </motion.div>
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-8 text-center"
            >
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3 dark:bg-slate-900">
                <Ticket className="h-6 w-6 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">No seats selected yet</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pricing Section */}
      {selectedSeats.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 space-y-3 pb-6 border-t border-slate-200 pt-6 dark:border-slate-800"
        >
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600 dark:text-slate-400">Subtotal</span>
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {displayTotalPrice.toFixed(4)} {NATIVE_TOKEN_SYMBOL}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600 dark:text-slate-400">Gas Fee</span>
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">~0.0010 {NATIVE_TOKEN_SYMBOL}</span>
          </div>
          <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800">
            <span className="font-semibold text-slate-900 dark:text-slate-100">Total Price</span>
            <span className="text-lg font-bold bg-linear-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
              {(displayTotalPrice + 0.001).toFixed(4)} {NATIVE_TOKEN_SYMBOL}
            </span>
          </div>
        </motion.div>
      )}

      <div className="sticky bottom-0 mt-2 border-t border-slate-200 bg-white pt-4 dark:border-slate-800 dark:bg-slate-950/70">
        <motion.button
          type="button"
          disabled={selectedSeats.length === 0 || isBusy}
          onClick={onConfirm}
          whileHover={selectedSeats.length === 0 || isBusy ? {} : { scale: 1.02 }}
          whileTap={selectedSeats.length === 0 || isBusy ? {} : { scale: 0.98 }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-emerald-500 to-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:shadow-xl enabled:hover:from-emerald-600 enabled:hover:to-emerald-700 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-400 disabled:text-slate-500 disabled:shadow-none dark:shadow-emerald-900/20"
        >
          <TrendingUp className="h-4 w-4" />
          {isBusy ? 'Processing...' : 'Confirm Purchase'}
        </motion.button>
      </div>
    </motion.div>
  );
}
