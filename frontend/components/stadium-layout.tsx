"use client";

import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  CheckCircle2,
  Wallet,
  Ticket,
  LayoutGrid,
  Info,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { useConnection, useConnect, useConnectors, useDisconnect } from "wagmi";
import { io, type Socket } from "socket.io-client";
import { useSelectedSeats } from "@/contexts/seat-context";
import { SeatRow } from "./seat-row";
import { OrderSummary } from "./order-summary";
import {
  fetchSections,
  fetchSectionSeats,
  lockSeat as lockSeatApi,
  unlockSeat as unlockSeatApi,
  confirmPurchase as confirmPurchaseApi,
  getBackendBaseUrl,
  type ApiSection,
  type ApiSeat,
} from "@/lib/tickets-api";
import { useBasePrices } from "@/hooks/use-seat-reads";
import { useSeatWrites } from "@/hooks/use-seat-writes";
import { normalizeEvmError } from "@/lib/evm-errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type SectionId =
  | "north"
  | "north-east"
  | "south-east"
  | "south"
  | "south-west"
  | "north-west";

type SeatSocketPayload = {
  seatId: string;
  sectionId: string;
  walletAddress?: string | null;
  lockedUntil?: string | null;
  status: "AVAILABLE" | "LOCKED" | "SOLD";
};

const SECTION_CONFIGS: {
  id: SectionId;
  name: string;
  shortName: string;
  start: number;
  end: number;
  fillClass: string;
  hoverClass: string;
  labelOffsetX?: number;
  labelOffsetY?: number;
}[] = [
  {
    id: "north",
    name: "North Stand",
    shortName: "NORTH",
    start: 300,
    end: 60,
    fillClass: "fill-slate-100",
    hoverClass: "hover:fill-emerald-200",
  },
  {
    id: "north-east",
    name: "North-East Stand",
    shortName: "N-E",
    start: 60,
    end: 120,
    fillClass: "fill-slate-100",
    hoverClass: "hover:fill-emerald-200",
  },
  {
    id: "south-east",
    name: "South-East Stand",
    shortName: "S-E",
    start: 120,
    end: 180,
    fillClass: "fill-slate-100",
    hoverClass: "hover:fill-emerald-200",
  },
  {
    id: "south",
    name: "South Stand",
    shortName: "SOUTH",
    start: 180,
    end: 240,
    fillClass: "fill-slate-100",
    hoverClass: "hover:fill-emerald-200",
  },
  {
    id: "south-west",
    name: "South-West Stand",
    shortName: "S-W",
    start: 240,
    end: 300,
    fillClass: "fill-slate-100",
    hoverClass: "hover:fill-emerald-200",
  },
  {
    id: "north-west",
    name: "North-West Stand",
    shortName: "N-W",
    start: 300,
    end: 360,
    fillClass: "fill-slate-50",
    hoverClass: "hover:fill-emerald-50",
  },
];

function getRingSegmentPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  irx: number,
  iry: number,
  startAngle: number,
  endAngle: number,
) {
  const startRad = ((startAngle - 90) * Math.PI) / 180;
  const endRad = ((endAngle - 90) * Math.PI) / 180;
  const x1 = cx + rx * Math.cos(startRad);
  const y1 = cy + ry * Math.sin(startRad);
  const x2 = cx + rx * Math.cos(endRad);
  const y2 = cy + ry * Math.sin(endRad);
  const x3 = cx + irx * Math.cos(endRad);
  const y3 = cy + iry * Math.sin(endRad);
  const x4 = cx + irx * Math.cos(startRad);
  const y4 = cy + iry * Math.sin(startRad);
  const largeArc = (endAngle - startAngle + 360) % 360 > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${rx} ${ry} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${irx} ${iry} 0 ${largeArc} 0 ${x4} ${y4} Z`;
}

export default function StadiumLayout() {
  const { isConnected, address } = useConnection();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const { selectedSeats, addSeat, removeSeat, clearCart } = useSelectedSeats();
  const selectedSeatIds = useMemo(
    () => selectedSeats.map((s) => s.id),
    [selectedSeats],
  );
  const selectedSeatIdSet = useMemo(
    () => new Set(selectedSeatIds),
    [selectedSeatIds],
  );

  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [sections, setSections] = useState<ApiSection[]>([]);
  const [sectionSeats, setSectionSeats] = useState<ApiSeat[]>([]);
  const [loadingSectionSeats, setLoadingSectionSeats] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [lastProcessedHash, setLastProcessedHash] = useState<string | null>(
    null,
  );
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrIssuedAt, setQrIssuedAt] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  const normalizeSeatStatus = useCallback(
    (status: string): ApiSeat["status"] =>
      status.toLowerCase() as ApiSeat["status"],
    [],
  );

  const refreshSections = useCallback(async () => {
    const response = await fetchSections();
    setSections(response.sections);
  }, []);

  const activeSection = useMemo(
    () =>
      sections.find(
        (s) => s.id === activeSectionId || s.clientId === activeSectionId,
      ),
    [sections, activeSectionId],
  );

  const applySeatStatusUpdate = useCallback(
    (payload: SeatSocketPayload) => {
      setSectionSeats((prev) =>
        prev.map((seat) =>
          seat.id === payload.seatId
            ? {
                ...seat,
                status: normalizeSeatStatus(payload.status),
                walletAddress: payload.walletAddress ?? null,
                lockedUntil: payload.lockedUntil ?? null,
              }
            : seat,
        ),
      );
    },
    [normalizeSeatStatus],
  );

  const writes = useSeatWrites();
  const pricesQ = useBasePrices(1);
  const walletAddress = address ?? "";

  useEffect(() => {
    setHydrated(true);
    const loadData = async () => {
      try {
        await refreshSections();
      } catch (err) {
        console.error("Failed to load sections:", err);
      }
    };
    void loadData();

    socketRef.current = io(getBackendBaseUrl(), {
      transports: ["websocket"],
    });
    return () => {
      socketRef.current?.disconnect();
    };
  }, [refreshSections]);

  useEffect(() => {
    if (activeSectionId) {
      const loadSeats = async () => {
        setLoadingSectionSeats(true);
        try {
          const section = sections.find(
            (s) => s.id === activeSectionId || s.clientId === activeSectionId,
          );
          if (section) {
            const response = await fetchSectionSeats(section.clientId);
            setSectionSeats(response.seats);
          }
        } catch (err) {
          console.error(err);
        } finally {
          setLoadingSectionSeats(false);
        }
      };
      void loadSeats();
    }
  }, [activeSectionId, sections]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const currentSectionId = activeSection?.id;
    if (currentSectionId) {
      socket.emit("join_section", currentSectionId);
    }

    const handleSeatLocked = (payload: SeatSocketPayload) => {
      if (payload.sectionId !== currentSectionId) return;
      applySeatStatusUpdate(payload);
      void refreshSections();
    };

    const handleSeatUnlocked = (payload: SeatSocketPayload) => {
      if (payload.sectionId !== currentSectionId) return;
      applySeatStatusUpdate(payload);
      if (
        selectedSeatIdSet.has(payload.seatId) &&
        (payload.walletAddress == null ||
          payload.walletAddress.toLowerCase() !== walletAddress.toLowerCase())
      ) {
        removeSeat(payload.seatId);
      }
      void refreshSections();
    };

    const handleSeatSold = (payload: SeatSocketPayload) => {
      if (payload.sectionId !== currentSectionId) return;
      applySeatStatusUpdate(payload);
      if (selectedSeatIdSet.has(payload.seatId)) {
        removeSeat(payload.seatId);
      }
      void refreshSections();
    };

    socket.on("section.seat.locked", handleSeatLocked);
    socket.on("section.seat.unlocked", handleSeatUnlocked);
    socket.on("section.seat.sold", handleSeatSold);

    return () => {
      socket.off("section.seat.locked", handleSeatLocked);
      socket.off("section.seat.unlocked", handleSeatUnlocked);
      socket.off("section.seat.sold", handleSeatSold);
      if (currentSectionId) {
        socket.emit("leave_section", currentSectionId);
      }
    };
  }, [
    activeSection?.id,
    applySeatStatusUpdate,
    refreshSections,
    removeSeat,
    selectedSeatIdSet,
    walletAddress,
  ]);

  useEffect(() => {
    const hash = writes.receiptQuery.data?.transactionHash;
    if (
      writes.receiptQuery.isSuccess &&
      walletAddress &&
      selectedSeats.length > 0 &&
      hash &&
      hash !== lastProcessedHash
    ) {
      const finalizePurchase = async () => {
        setLastProcessedHash(hash);
        const processingToast = toast.loading("Finalizing your reservation...");
        try {
          await confirmPurchaseApi({
            seatIds: selectedSeats.map((s) => s.id),
            txHash: hash,
            walletAddress: walletAddress,
          });
          toast.success("Ticket purchased successfully!", {
            id: processingToast,
          });
          clearCart();
          await refreshSections();
          if (activeSectionId) {
            const section = sections.find(
              (s) => s.id === activeSectionId || s.clientId === activeSectionId,
            );
            if (section) {
              const response = await fetchSectionSeats(section.clientId);
              setSectionSeats(response.seats);
            }
          }
        } catch (error) {
          toast.error("Sync failed. Check bookings.", { id: processingToast });
        }
      };
      void finalizePurchase();
    }
  }, [
    writes.receiptQuery.isSuccess,
    writes.receiptQuery.data?.transactionHash,
    walletAddress,
    selectedSeats,
    clearCart,
    refreshSections,
    activeSectionId,
    lastProcessedHash,
    sections,
  ]);

  const unlockSeatAndRemove = useCallback(
    async (seatId: string) => {
      if (!walletAddress) {
        toast.error("Connect wallet before changing seat reservation.");
        return;
      }
      try {
        await unlockSeatApi({ seatId, walletAddress });
        removeSeat(seatId);
        setSectionSeats((prev) =>
          prev.map((seat) =>
            seat.id === seatId
              ? {
                  ...seat,
                  status: "available",
                  walletAddress: null,
                  lockedUntil: null,
                }
              : seat,
          ),
        );
        void refreshSections();
      } catch (err) {
        console.error("Failed to unlock seat:", err);
        toast.error("Failed to unlock seat. Please try again.");
      }
    },
    [walletAddress, removeSeat, refreshSections],
  );

  const handleSeatClick = async (seat: any) => {
    if (!walletAddress) {
      toast.error("Connect wallet before selecting seats.");
      return;
    }

    const seatOwnedByWallet =
      (seat.walletAddress ?? "").toLowerCase() === walletAddress.toLowerCase();
    const canToggle =
      seat.status === "available" ||
      selectedSeatIdSet.has(seat.id) ||
      (seat.status === "locked" && seatOwnedByWallet);

    if (!canToggle) return;

    if (selectedSeatIdSet.has(seat.id)) {
      await unlockSeatAndRemove(seat.id);
    } else {
      try {
        const lockResponse = await lockSeatApi({ seatId: seat.id, walletAddress });
        setSectionSeats((prev) =>
          prev.map((existingSeat) =>
            existingSeat.id === seat.id
              ? {
                  ...existingSeat,
                  status: "locked",
                  walletAddress,
                  lockedUntil: lockResponse.seat?.lockedUntil ?? null,
                }
              : existingSeat,
          ),
        );
        addSeat({
          id: seat.id,
          number: seat.seatNumber,
          rowLabel: seat.rowNumber.toString(),
          status: "locked",
          priceEth: seat.price,
          sectionId: activeSection?.id ?? "",
          sectionName: activeSection?.name ?? "",
        });
        void refreshSections();
      } catch (err) {
        toast.error("Seat is already locked or unavailable");
      }
    }
  };

  const handleWalletConnect = () =>
    isConnected ? disconnect() : connect({ connector: connectors[0] });

  const confirmPurchase = async () => {
    if (!isConnected) {
      handleWalletConnect();
      return;
    }
    setTxError(null);
    try {
      const sectionMapping: Record<string, number> = {
        north: 1,
        "north-east": 2,
        "south-east": 3,
        south: 4,
        "south-west": 5,
        "north-west": 6,
        NORTH: 1,
        "N-E": 2,
        "S-E": 3,
        SOUTH: 4,
        "S-W": 5,
        "N-W": 6,
      };

      const totalValue = selectedSeats.reduce((acc, s) => {
        const val = Math.floor((s.priceEth || 0) * 1e18);
        return acc + BigInt(isNaN(val) ? 0 : val);
      }, BigInt(0));

      const params = selectedSeats.map((s) => {
        const sectionId =
          sectionMapping[s.sectionId] || sectionMapping[s.sectionName] || 1;
        const rowNum = parseInt(s.rowLabel);
        return {
          eventId: 1,
          section: sectionId,
          row: isNaN(rowNum) ? 1 : rowNum,
          seatNumber: s.number || 0,
        };
      });

      if (selectedSeats.length === 1)
        await writes.reserveSingle(params[0], totalValue);
      else await writes.reserveBatch(params, totalValue);
      setQrIssuedAt(Date.now());
      setShowQRModal(true);
    } catch (err) {
      setTxError(normalizeEvmError(err));
    }
  };

  const availableCount = activeSection?.counts?.available ?? 0;
  const activeRows = useMemo(() => {
    const rowsMap = new Map<number, any[]>();
    sectionSeats.forEach((seat) => {
      const row = seat.rowNumber;
      if (!rowsMap.has(row)) rowsMap.set(row, []);
      rowsMap
        .get(row)
        ?.push({
          id: seat.id,
          seatNumber: seat.seatNumber,
          rowNumber: seat.rowNumber,
          status: selectedSeatIdSet.has(seat.id)
            ? "available"
            : seat.status.toLowerCase(),
          price: seat.price,
        });
    });
    return Array.from(rowsMap.entries())
      .map(([rowLabel, seats]) => ({ rowLabel: rowLabel.toString(), seats }))
      .sort((a, b) => parseInt(a.rowLabel) - parseInt(b.rowLabel));
  }, [sectionSeats, selectedSeatIdSet]);

  return (
    <div className="w-full min-h-screen bg-white flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900 overflow-x-hidden">
      <motion.header className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-[1400px] items-center justify-between px-6 lg:px-8 text-slate-900">
          <Link href="/" className="group flex items-center gap-2">
            <div className="bg-emerald-600 p-2 rounded-lg group-hover:scale-110 transition-transform shadow-md shadow-emerald-200">
              <LayoutGrid className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">
              Stadium Portal
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/my-bookings">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="hidden md:inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-slate-300 transition shadow-sm"
              >
                <Ticket className="h-4 w-4 text-emerald-600" /> My Bookings
              </motion.button>
            </Link>
            <Badge
              variant="outline"
              className="hidden sm:flex border-emerald-200 bg-emerald-50 text-emerald-700 rounded-xl px-4 py-2 font-bold cursor-pointer hover:bg-emerald-100 transition-colors"
              onClick={handleWalletConnect}
            >
              <Wallet className="h-3.5 w-3.5 mr-2" />
              {hydrated && isConnected
                ? `${address?.substring(0, 6)}...${address?.slice(-4)}`
                : "Connect"}
            </Badge>
          </div>
        </div>
      </motion.header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-12 lg:px-8 text-slate-900">
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            {activeSection && (
              <button
                onClick={() => setActiveSectionId(null)}
                className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-emerald-600 transition-all group"
              >
                <div className="bg-slate-50 p-1.5 rounded-full group-hover:bg-emerald-50 transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </div>{" "}
                Back to Overview
              </button>
            )}
            <div className="flex flex-col">
              <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100/50 w-fit mb-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />{" "}
                Live Status
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900">
                {activeSection ? activeSection.name : "Select Your Stand"}
              </h1>
              <p className="text-slate-500 text-lg font-medium mt-2">
                {activeSection
                  ? "Pick your preferred seat from the floor plan"
                  : "Explore the stadium sections for real-time availability"}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            {[
              {
                label: "Available",
                color: "bg-emerald-500",
                val: availableCount,
              },
              { label: "Locked", color: "bg-slate-200", val: 0 },
              { label: "Sold", color: "bg-rose-500", val: 1 },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 bg-white border border-slate-100 px-4 py-2.5 rounded-2xl shadow-sm"
              >
                <span className={`h-2 w-2 rounded-full ${item.color}`} />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {item.label}
                </span>
                {item.val !== undefined && (
                  <span className="ml-1 font-black text-slate-900">
                    {item.val}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {activeSection ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[40px] border border-slate-100 bg-slate-50/30 p-12 shadow-inner overflow-auto"
            >
              <div className="mx-auto w-fit">
                {loadingSectionSeats ? (
                  <div className="py-20 text-center text-slate-400 animate-pulse font-bold">
                    Loading Section Map...
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeRows.map((row) => (
                      <SeatRow
                        key={row.rowLabel}
                        rowLabel={row.rowLabel}
                        seats={row.seats}
                        onSeatClick={handleSeatClick}
                        selectedSeatIds={selectedSeatIdSet}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-12 flex items-start gap-4 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm max-w-2xl mx-auto">
                <div className="bg-emerald-100 p-3 rounded-2xl text-slate-900">
                  <Info className="h-6 w-6 text-emerald-600 shrink-0" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">
                    Seating Information
                  </h4>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed mt-1">
                    Select seats to reserve them. Greenhouse icons are
                    available. Your selections are automatically locked for 5
                    minutes.
                  </p>
                </div>
              </div>
            </motion.div>
            <div className="lg:sticky lg:top-28 self-start">
              <OrderSummary
                selectedSeats={selectedSeats}
                availableCount={availableCount}
                prices={pricesQ.prices}
                isBusy={writes.isWriting || writes.receiptQuery.isLoading}
                onConfirm={confirmPurchase}
                onRemoveSeat={unlockSeatAndRemove}
              />
              {txError && (
                <div className="mt-6 p-4 rounded-2xl border border-rose-100 bg-rose-50/50 text-xs font-bold text-rose-600">
                  {txError}
                </div>
              )}
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-12"
          >
             <div className="w-full relative max-w-[1000px] bg-slate-50/50 rounded-[60px] p-8 md:p-16 border border-slate-100 shadow-2xl">
               <svg viewBox="0 0 1000 760" className="mx-auto h-auto w-full drop-shadow-2xl">
                  {/* Outer Stadium Body */}
                  <rect x="50" y="20" width="900" height="720" rx="60" className="fill-slate-50 stroke-slate-200 stroke-[2px]" />
                  <rect x="70" y="40" width="860" height="680" rx="50" className="fill-white stroke-slate-100 stroke-[1px]" />
                  
                  {/* Field Area with Grass Stripes */}
                  <g className="field">
                    <ellipse cx="500" cy="380" rx="220" ry="165" className="fill-emerald-800/10 stroke-emerald-900/20 stroke-[4px]" />
                    <mask id="fieldMask">
                      <ellipse cx="500" cy="380" rx="200" ry="145" fill="white" />
                    </mask>
                    <g mask="url(#fieldMask)">
                      {Array.from({ length: 15 }).map((_, i) => (
                        <rect 
                          key={i}
                          x={i * (1000 / 15)} 
                          y="0" 
                          width={(1000 / 30)} 
                          height="1000" 
                          className="fill-emerald-600/5"
                        />
                      ))}
                    </g>
                    {/* Inner Field Detail */}
                    <ellipse cx="500" cy="380" rx="200" ry="145" className="fill-transparent stroke-white/40 stroke-[1px] stroke-dasharray-[10,5]" />
                    <circle cx="500" cy="380" r="40" className="fill-transparent stroke-white/40 stroke-[1px]" />
                    <line x1="500" y1="235" x2="500" y2="525" className="stroke-white/40 stroke-[1px]" />
                  </g>
                  
                  {/* Intersecting Section Lines */}
                  <line x1="500" y1="40" x2="500" y2="235" className="stroke-slate-200 stroke-[4px]" />
                  <line x1="500" y1="525" x2="500" y2="720" className="stroke-slate-200 stroke-[4px]" />

                  {/* Sections */}
                  {SECTION_CONFIGS.map((section) => (
                    <g key={section.id} onClick={() => setActiveSectionId(section.id)} className="group cursor-pointer">
                      <path 
                        d={getRingSegmentPath(500, 380, 420, 310, 240, 185, section.start, section.end)} 
                        className={`${section.fillClass} ${section.hoverClass} stroke-white stroke-[8px] transition-all duration-300 drop-shadow-sm`} 
                      />
                      <g className="pointer-events-none">
                        <text 
                          x={(500 + Math.cos(((section.start + section.end) / 2 - 90) * (Math.PI / 180)) * 335).toFixed(4)} 
                          y={(380 + Math.sin(((section.start + section.end) / 2 - 90) * (Math.PI / 180)) * 245).toFixed(4)} 
                          textAnchor="middle" 
                          alignmentBaseline="middle" 
                          className="fill-slate-500 text-[16px] font-black uppercase tracking-widest group-hover:fill-emerald-800 transition-colors"
                        >
                          {section.shortName}
                        </text>
                      </g>
                    </g>
                  ))}
               </svg>
             </div>
          </motion.div>
        )}
      </main>

      <AnimatePresence>
        {showQRModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md rounded-[40px] bg-white shadow-2xl overflow-hidden ring-1 ring-slate-100"
            >
              <div className="bg-linear-to-br from-emerald-600 to-emerald-700 p-10 text-white relative">
                <Ticket className="h-24 w-24 absolute -top-4 -right-4 opacity-10 rotate-12" />
                <h3 className="text-3xl font-black tracking-tighter">
                  Verified!
                </h3>
                <p className="text-emerald-100 font-medium mt-2 leading-relaxed">
                  Your digital assets have been verified and secured on-chain.
                </p>
              </div>
              <div className="p-10 space-y-8 bg-white">
                <div className="flex flex-col items-center">
                  <div className="bg-white p-6 rounded-[32px] shadow-xl border-2 border-slate-50 relative group">
                    <QRCodeSVG
                      value={JSON.stringify({
                        txHash: writes.receiptQuery.data?.transactionHash,
                        walletAddress,
                        timestamp: qrIssuedAt,
                      })}
                      size={200}
                    />
                    <div className="absolute -bottom-2 -right-2 bg-emerald-600 p-2.5 rounded-xl border-4 border-white shadow-lg">
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 flex justify-between items-center text-slate-900">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Total Booked
                    </span>
                    <span className="text-xl font-black">
                      {selectedSeats.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                    {selectedSeats.map((seat) => (
                      <div
                        key={seat.id}
                        className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-emerald-600 p-2 rounded-lg">
                            <Ticket className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/60 leading-none mb-1">
                              {seat.sectionName}
                            </p>
                            <p className="text-sm font-bold text-slate-900">
                              Row {seat.rowLabel}, Seat {seat.number}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="border-emerald-200 bg-white text-emerald-700 font-black"
                        >
                          CONFIRMED
                        </Badge>
                        
                      </div>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={() => setShowQRModal(false)}
                  className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                >
                  Confirm & Close <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <Toaster position="top-center" richColors />
    </div>
  );
}
