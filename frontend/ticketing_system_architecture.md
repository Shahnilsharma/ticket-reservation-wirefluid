# Web3 Decentralized Ticketing System Architect Plan

This document provides the complete foundational code and architectural flow for building your blockchain-based stadium ticketing system. It ensures high performance, database atomicity, type safety, and real-time state feedback for a seamless user experience.

## 1. Directory Organization

To maintain a clean, scaling architecture, adhere strictly to the following directory rules.

```text
/backend
  ├── prisma/
  │   └── schema.prisma               # Database schema map
  ├── src/
  │   ├── controllers/
  │   │   ├── seat.controller.ts      # Soft-lock and webhook logic
  │   │   ├── metadata.controller.ts  # NFT metadata standard endpoint
  │   │   └── verify.controller.ts    # Secure QR code validation
  │   ├── routes/
  │   └── index.ts

/frontend
  ├── src/
  │   ├── app/                      # Next.js 14/15 App Router pages
  │   ├── components/
  │   │   ├── StadiumMap.tsx        # SVG/Framer map engine
  │   │   └── TicketStatus.tsx      # Real-time transaction feedback UI
  │   ├── hooks/
  │   │   └── useTicketingFlow.ts   # Core Web3 coordination hook
  │   └── utils/
  │       └── contracts.ts          # Contract ABIs and Addresses
```

## 2. Database Schema (Prisma)
Located in `/backend/prisma/schema.prisma`

Your database sits between the user and the blockchain, tracking stadium inventory and providing a critical 10-minute "Soft-Lock" window.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum SeatStatus {
  AVAILABLE
  LOCKED
  SOLD
}

model Stadium {
  id       String    @id @default(uuid())
  name     String
  location String
  sections Section[]
}

model Section {
  id        String   @id @default(uuid())
  name      String
  stadiumId String
  stadium   Stadium  @relation(fields: [stadiumId], references: [id])
  seats     Seat[]
}

model Seat {
  id             String     @id @default(uuid())
  row            String
  number         Int
  status         SeatStatus @default(AVAILABLE)
  lockedUntil    DateTime?  // 10-minute lock window limit
  lockedByWallet String?    // Wallet attempting purchase
  ownerWallet    String?    // Final owner wallet after successful mint
  nftTokenId     String?    @unique // Assigned post-minting from webhook
  sectionId      String
  section        Section    @relation(fields: [sectionId], references: [id])
  
  // Enforce physical constraints
  @@unique([sectionId, row, number])
}
```

## 3. Backend Logic (Soft-Locking Controller)
Located in `/backend/src/controllers/seat.controller.ts`

This controller handles the race conditions. Two users clicking the same seat simultaneously will not result in an error; the database handles concurrency by atomically checking the `status` constraints during the update.

```typescript
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma-client/prisma-client';

const prisma = new PrismaClient();
const LOCK_DURATION_MINUTES = 10;

export const lockSeat = async (req: Request, res: Response) => {
  const { seatId, walletAddress } = req.body;

  try {
    const now = new Date();
    
    // updateMany is used here instead of update to leverage OR conditions atomically
    // If it finds 0 records matching the criteria, we know someone else locked it.
    const updatedSeat = await prisma.seat.updateMany({
      where: {
        id: seatId,
        OR: [
          { status: 'AVAILABLE' },
          { 
            status: 'LOCKED', 
            lockedUntil: { lt: now } // Expired lock
          }
        ]
      },
      data: {
        status: 'LOCKED',
        lockedUntil: new Date(now.getTime() + LOCK_DURATION_MINUTES * 60000),
        lockedByWallet: walletAddress.toLowerCase()
      }
    });

    if (updatedSeat.count === 0) {
      return res.status(409).json({ success: false, message: "Seat is unavailable or has just been locked by another user." });
    }

    const lockedRecord = await prisma.seat.findUnique({ where: { id: seatId } });
    return res.status(200).json({ success: true, seat: lockedRecord });

  } catch (error: any) {
    return res.status(500).json({ success: false, message: "Internal server error during locking." });
  }
};

// Called via a webhook when the blockchain transaction confirms
export const finalizePurchase = async (req: Request, res: Response) => {
  const { seatId, walletAddress, tokenId } = req.body;

  try {
    const updatedSeat = await prisma.seat.update({
      where: {
        id: seatId,
        lockedByWallet: walletAddress.toLowerCase(),
        status: 'LOCKED' // Ensure it was actually locked by them
      },
      data: {
        status: 'SOLD',
        ownerWallet: walletAddress.toLowerCase(),
        nftTokenId: tokenId,
        lockedUntil: null
      }
    });

    return res.status(200).json({ success: true, seat: updatedSeat });
  } catch (error) {
    return res.status(400).json({ success: false, message: "Failed to finalize seat purchase. The lock may have expired." });
  }
}
```

## 4. Metadata API Endpoint
Located in `/backend/src/controllers/metadata.controller.ts`

When a wallet receives the NFT, it will query your smart contract's `tokenURI`, which should point to this REST endpoint (e.g., `https://api.domain.com/metadata/{id}`).

```typescript
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma-client/prisma-client';

const prisma = new PrismaClient();

export const getTicketMetadata = async (req: Request, res: Response) => {
  const { tokenId } = req.params;

  try {
    const seat = await prisma.seat.findUnique({
      where: { nftTokenId: tokenId },
      include: { section: { include: { stadium: true } } }
    });

    if (!seat) return res.status(404).json({ error: "Ticket not found" });

    // Returns standard ERC721 Metadata JSON
    return res.json({
      name: `Ticket #${tokenId} - ${seat.section.stadium.name}`,
      description: `Entry ticket for Section ${seat.section.name}, Row ${seat.row}, Seat ${seat.number}.`,
      image: `https://api.yourproject.com/assets/tickets/${seat.section.stadium.id}.png`,
      attributes: [
        { trait_type: "Stadium", value: seat.section.stadium.name },
        { trait_type: "Section", value: seat.section.name },
        { trait_type: "Row", value: seat.row },
        { trait_type: "Seat", value: seat.number.toString() },
        { trait_type: "Status", value: seat.status }
      ]
    });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
};
```

## 5. Web3 React Hook (`useTicketingFlow`)
Located in `/frontend/src/hooks/useTicketingFlow.ts`

This is the nervous system of your frontend. It manages the complex interplay between the database state and the blockchain state.

```typescript
import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { TICKET_CONTRACT_ADDRESS, TICKET_ABI } from '../utils/contracts';

export type FlowState = 'IDLE' | 'LOCKING' | 'AWAITING_WALLET' | 'MINTING' | 'SUCCESS' | 'ERROR';

export const useTicketingFlow = () => {
  const [flowState, setFlowState] = useState<FlowState>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Assuming a state that needs to track the active seat throughout the flow
  const [activeSeatId, setActiveSeatId] = useState<string | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);

  const { writeContractAsync, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const purchaseSeat = async (seatId: string, walletAddress: string, priceInEth: string) => {
    try {
      setFlowState('LOCKING');
      setErrorMessage('');
      setActiveSeatId(seatId);
      setWallet(walletAddress);

      // 1. Soft-Lock on Backend
      const lockRes = await fetch('http://api.yourdomain.com/seats/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatId, walletAddress })
      });
      const lockData = await lockRes.json();
      if (!lockData.success) throw new Error(lockData.message);

      // 2. Trigger Blockchain Transaction
      setFlowState('AWAITING_WALLET');
      await writeContractAsync({
        address: TICKET_CONTRACT_ADDRESS,
        abi: TICKET_ABI,
        functionName: 'mintTicket',
        args: [seatId], // Assuming your contract needs seat ID for mint mapping
        value: parseEther(priceInEth),
      });

      // Wallet signed, transaction is now on-chain
      setFlowState('MINTING');

    } catch (error: any) {
      setFlowState('ERROR');
      setErrorMessage(error.shortMessage || error.message || 'Transaction failed');
    }
  };

  // 3. Listen for confirmation & ping backend webhook
  useEffect(() => {
    if (isConfirmed && activeSeatId && wallet) {
      const finalize = async () => {
        try {
          const finishRes = await fetch('http://api.yourdomain.com/seats/finalize', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             // You'd typically extract tokenId from tx logs. Hardcoding '1' for example.
             body: JSON.stringify({ seatId: activeSeatId, walletAddress: wallet, tokenId: '1' })
          });
          
          if (finishRes.ok) setFlowState('SUCCESS');
          else throw new Error("Failed backend confirmation");
        } catch (err: any) {
          setFlowState('ERROR');
          setErrorMessage(err.message);
        }
      };
      
      finalize();
    }
  }, [isConfirmed, activeSeatId, wallet]);

  return { flowState, errorMessage, runFlow: purchaseSeat, hash };
};
```

## 6. Interactive Map Component 
Located in `/frontend/src/components/StadiumMap.tsx`

This component maps out the UI relying on `Framer Motion` for smooth zooming. Color coding reflects backend status.

```tsx
'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type SeatData = { id: string, status: 'AVAILABLE' | 'LOCKED' | 'SOLD' };

// Mocked data for demonstration
const MOCK_SEATS: SeatData[] = Array.from({ length: 40 }).map((_, i) => ({
  id: String(i + 1),
  status: i % 7 === 0 ? 'SOLD' : i % 5 === 0 ? 'LOCKED' : 'AVAILABLE'
}));

export const StadiumMap = ({ onSeatClick }: { onSeatClick: (id: string) => void }) => {
  const [zoomedSection, setZoomedSection] = useState<string | null>(null);

  const getSeatColor = (status: string) => {
    if (status === 'AVAILABLE') return 'bg-emerald-500 hover:bg-emerald-400 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)]';
    if (status === 'LOCKED') return 'bg-amber-400 cursor-not-allowed animate-pulse';
    return 'bg-slate-700 cursor-not-allowed opacity-50'; // Red is aggressive. Slate looks cleaner for sold seats.
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto h-[600px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 p-8 flex items-center justify-center font-sans shadow-2xl">
      <AnimatePresence mode="wait">
        {!zoomedSection ? (
          <motion.div 
            key="stadium"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="flex flex-col items-center gap-12"
          >
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Select a Section</h2>
            <div className="flex justify-center items-center gap-16 relative">
              <button onClick={() => setZoomedSection('A')} className="relative z-10 bg-slate-800/80 hover:bg-slate-700 backdrop-blur-sm text-slate-200 p-16 rounded-xl border border-slate-600 transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                <span className="text-xl font-bold">Section A</span>
              </button>
              
              <div className="w-80 h-[28rem] bg-[#1a472a] border-4 border-emerald-500/20 rounded-[100px] flex items-center justify-center shadow-inner relative overflow-hidden">
                {/* Field markings */}
                <div className="absolute w-full h-[2px] bg-emerald-500/30 top-1/2 transform -translate-y-1/2" />
                <div className="absolute w-32 h-32 border-2 border-emerald-500/30 rounded-full" />
                <span className="text-emerald-500/60 uppercase tracking-[0.3em] font-bold z-10">Pitch</span>
              </div>

              <button onClick={() => setZoomedSection('B')} className="relative z-10 bg-slate-800/80 hover:bg-slate-700 backdrop-blur-sm text-slate-200 p-16 rounded-xl border border-slate-600 transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                <span className="text-xl font-bold">Section B</span>
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="section"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex flex-col w-full h-full max-w-2xl"
          >
            <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
              <h2 className="text-2xl font-bold text-white">Section {zoomedSection} <span className="text-slate-500 font-normal ml-2">Front Row</span></h2>
              <button 
                onClick={() => setZoomedSection(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm font-medium border border-slate-700"
              >
                ← Back to Overview
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
              <div className="grid grid-cols-10 gap-x-3 gap-y-6 flex-wrap">
                {MOCK_SEATS.map(seat => (
                  <div key={seat.id} className="flex flex-col items-center gap-1 group">
                    <motion.button
                      whileHover={seat.status === 'AVAILABLE' ? { scale: 1.15, y: -2 } : {}}
                      whileTap={seat.status === 'AVAILABLE' ? { scale: 0.95 } : {}}
                      onClick={() => seat.status === 'AVAILABLE' && onSeatClick(seat.id)}
                      disabled={seat.status !== 'AVAILABLE'}
                      className={`w-10 h-12 rounded-t-lg rounded-b-sm border-t border-white/10 ${getSeatColor(seat.status)} transition-colors duration-200`}
                    />
                    <span className="text-[10px] text-slate-500 font-medium group-hover:text-slate-300 transition-colors">{seat.id}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Legend Map */}
            <div className="mt-8 flex gap-6 justify-center bg-slate-900/50 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-sm text-slate-400">Available</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-400" /><span className="text-sm text-slate-400">Pending / Locked</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-700" /><span className="text-sm text-slate-400">Sold</span></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
```

## 7. Secure QR Flow (Proof of Ownership)
**Do not** store the QR on the blockchain. Generate a transient, secure QR locally from your backend gatekeeper to verify physical entry without paying gas fees.

**The Architecture:**
1. **User Action:** The fan walks up to the stadium gate and opens your Web3 app.
2. **The Prompt:** The website triggers `personal_sign` on their wallet (via viem/wagmi `useSignMessage`). They sign a message string containing a unique nonce/timestamp like:
   `"I authorize entry for Ticket #123 at timestamp [1697203492]"`
3. **Backend Validation:**
   - The frontend POSTs the `tokenId`, the unsigned message, and the resulting `signature` to your backend (`/api/verify`).
   - The backend runs `ethers.utils.verifyMessage()` or `viem/verifyMessage` to recover the wallet address that created the signature.
   - The backend checks its database (or queries the RPC contract directly: `contract.ownerOf(tokenId)`) to verify that the recovered wallet address is the true owner of the NFT.
   - The backend validates the timestamp to ensure the signature is fresh (e.g., `< 5 minutes old`) to defeat replay attacks (a screenshot of the signature can't be used hours later).
4. **QR Generation:**
   - If valid, the backend creates a verifiable payload, like a JWT token containing `{ "ticket": 123, "exp": 1697204092 }`, signed by the Backend's private key.
   - The frontend turns that JWT token string into a physical 2D QR Code.
5. **Gate Scan:** The stadium employee scans the QR. Their offline (or connected) scanner simply decodes the JWT and validates the signature against the Backend Server's public key to verify that the entry code is mathematically legitimate and hasn't expired. Entry granted.
