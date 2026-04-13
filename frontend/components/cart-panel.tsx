'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart } from 'lucide-react';
import { useSelectedSeats } from '@/contexts/seat-context';

export function CartPanel() {
  const { selectedSeats, removeSeat, clearCart, totalPrice, totalSeats } = useSelectedSeats();

  if (totalSeats === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed bottom-6 right-6 z-40 w-full max-w-sm rounded-2xl border border-emerald-200/30 bg-gradient-to-br from-white/95 to-emerald-50/50 p-5 shadow-2xl backdrop-blur-xl"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600">
            <ShoppingCart className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Your Cart</h3>
            <p className="text-xs text-slate-500">{totalSeats} seat{totalSeats !== 1 ? 's' : ''} selected</p>
          </div>
        </div>
        <button
          type="button"
          onClick={clearCart}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-red-100 text-slate-400 hover:text-red-600"
          title="Clear cart"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-4 max-h-48 space-y-2 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {selectedSeats.map((seat) => (
            <motion.div
              key={seat.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="flex items-center justify-between rounded-lg bg-gradient-to-r from-emerald-50 to-emerald-100/50 p-3 text-sm border border-emerald-100/50"
            >
              <div className="flex-1">
                <p className="font-medium text-slate-900">
                  {seat.sectionName}
                </p>
                <p className="text-xs text-slate-500">
                  Row {seat.rowLabel} • Seat {seat.number}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-emerald-600">{seat.priceEth} ETH</span>
                <button
                  type="button"
                  onClick={() => removeSeat(seat.id)}
                  className="text-slate-400 transition hover:text-red-600"
                  title="Remove from cart"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="space-y-3 border-t border-emerald-100/30 pt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Total Price:</span>
          <span className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">{totalPrice.toFixed(4)} ETH</span>
        </div>
        <button
          type="button"
          className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-emerald-600 hover:to-emerald-700 shadow-lg hover:shadow-xl"
        >
          Checkout
        </button>
      </div>
    </motion.div>
  );
}
