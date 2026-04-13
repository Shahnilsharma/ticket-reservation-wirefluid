"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

export type Seat = {
  id: string;
  rowLabel: string;
  number: number;
  status: "available" | "locked" | "sold";
  priceEth: number;
  sectionId: string;
  sectionName: string;
};

type SeatContextType = {
  selectedSeats: Seat[];
  addSeat: (seat: Seat) => void;
  removeSeat: (seatId: string) => void;
  clearCart: () => void;
  totalPrice: number;
  totalSeats: number;
};

const SeatContext = createContext<SeatContextType | undefined>(undefined);

export function SeatProvider({ children }: { children: React.ReactNode }) {
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);

  const addSeat = useCallback((seat: Seat) => {
    setSelectedSeats((prev) => {
      // Prevent duplicate selections
      if (prev.some((s) => s.id === seat.id)) {
        return prev;
      }
      return [...prev, seat];
    });
  }, []);

  const removeSeat = useCallback((seatId: string) => {
    setSelectedSeats((prev) => prev.filter((seat) => seat.id !== seatId));
  }, []);

  const clearCart = useCallback(() => {
    setSelectedSeats([]);
  }, []);

  const totalPrice = selectedSeats.reduce(
    (sum, seat) => sum + seat.priceEth,
    0,
  );
  const totalSeats = selectedSeats.length;

  const value: SeatContextType = {
    selectedSeats,
    addSeat,
    removeSeat,
    clearCart,
    totalPrice,
    totalSeats,
  };

  return <SeatContext.Provider value={value}>{children}</SeatContext.Provider>;
}

export function useSelectedSeats() {
  const context = useContext(SeatContext);
  if (context === undefined) {
    throw new Error("useSelectedSeats must be used within a SeatProvider");
  }
  return context;
}
