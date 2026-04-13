'use client';

import React, { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Ticket, 
  QrCode, 
  MapPin, 
  Calendar as CalendarIcon, 
  ChevronLeft,
  Loader2,
  Inbox,
  Clock,
  LayoutGrid
} from 'lucide-react';
import { fetchBookings, type ApiBooking } from '@/lib/tickets-api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function MyBookingsPage() {
  const { address, isConnected } = useAccount();
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<ApiBooking | null>(null);

  useEffect(() => {
    if (isConnected && address) {
      const loadBookings = async () => {
        try {
          setLoading(true);
          const response = await fetchBookings(address);
          setBookings(response.bookings);
        } catch (error) {
          console.error('Failed to fetch bookings:', error);
        } finally {
          setLoading(false);
        }
      };
      void loadBookings();
    } else {
      setLoading(false);
    }
  }, [isConnected, address]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center text-slate-900 bg-slate-50/30 dark:bg-[#07110f]/30 dark:text-slate-100">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-10 rounded-3xl border border-slate-200 shadow-xl shadow-emerald-500/5 max-w-lg dark:border-slate-700 dark:bg-slate-950/70 dark:shadow-emerald-500/10"
        >
          <div className="bg-emerald-500 h-20 w-20 rounded-2xl rotate-3 flex items-center justify-center mx-auto mb-8 shadow-lg shadow-emerald-200">
            <Ticket className="h-10 w-10 text-white -rotate-3" />
          </div>
          <h2 className="text-3xl font-bold mb-4 tracking-tight">Access Your Digital Vault</h2>
          <p className="text-slate-500 mb-8 text-lg font-medium leading-relaxed">
            Please connect your wallet to view your secure stadium reservations and retrieve your entry QR codes.
          </p>
          <Link href="/">
             <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl h-14 text-lg font-bold shadow-lg shadow-emerald-200 transition-all hover:scale-[1.02] active:scale-95">
               Back to Stadium
             </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900 dark:text-slate-100">
      {/* Dynamic Header */}
      <div className="border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-40 dark:border-emerald-500/10 dark:bg-[#07110f]/80">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-8 h-20 flex items-center justify-between text-slate-900 dark:text-slate-100">
          <Link href="/" className="group flex items-center gap-2">
            <div className="bg-emerald-600 p-2 rounded-lg group-hover:scale-110 transition-transform shadow-md shadow-emerald-200">
              <LayoutGrid className="h-5 w-5 text-white" />
            </div>
             <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-linear-to-r from-slate-900 to-slate-600 dark:from-slate-50 dark:to-slate-300">
              Stadium Portal
            </span>
          </Link>
          <div className="flex items-center gap-4">
             <Badge variant="outline" className="hidden sm:flex border-emerald-200 bg-emerald-50 text-emerald-700 rounded-full px-4 py-1.5 font-bold">
               {address?.substring(0, 6)}...{address?.slice(-4)}
             </Badge>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1400px] px-6 py-12 lg:px-8 text-slate-900 dark:text-slate-100">
        {/* Navigation & Header Section */}
        <div className="mb-12">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-emerald-600 transition-all mb-8 group dark:text-slate-500"
          >
             <div className="bg-slate-50 p-1.5 rounded-full group-hover:bg-emerald-50 transition-colors dark:bg-slate-900/60 dark:group-hover:bg-emerald-500/10">
               <ChevronLeft className="h-4 w-4" />
             </div>
             Back to Stadium Map
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border border-emerald-100/50 dark:border-emerald-500/10 dark:bg-emerald-500/10 dark:text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Bookings
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter dark:text-white">My Tickets</h1>
              <p className="text-slate-500 text-lg max-w-xl font-medium dark:text-slate-400">
                Manage your on-chain reservations and find your dynamic entry passes for the Cricket World Cup.
              </p>
            </motion.div>
            
            <div className="flex gap-4">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 min-w-[160px] shadow-sm dark:border-slate-700 dark:bg-slate-950/60">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 dark:text-slate-500">Total Booked</p>
                <p className="text-3xl font-black text-slate-900 dark:text-slate-100">{bookings.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-slate-100 border-t-emerald-600 animate-spin dark:border-slate-800 dark:border-t-emerald-400" />
              <Loader2 className="h-6 w-6 text-emerald-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            </div>
            <p className="text-slate-500 font-bold animate-pulse text-lg">Synchronizing your digital assets...</p>
          </div>
        ) : bookings.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-16 text-center border-2 border-dashed border-slate-200 bg-slate-50/40 rounded-[32px] dark:border-slate-700 dark:bg-slate-950/40">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-6 dark:border-slate-700 dark:bg-slate-950/70">
              <Inbox className="h-12 w-12 text-slate-200 dark:text-slate-700" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight dark:text-white">Inventory Empty</h3>
            <p className="text-slate-500 max-w-md mx-auto mb-8 font-medium leading-relaxed dark:text-slate-400">
              You don't have any tickets in your current wallet. Explore the National Cricket Stadium and secure your seats before they sell out!
            </p>
            <Link href="/">
              <Button className="bg-slate-900 hover:bg-black text-white rounded-2xl px-10 h-14 font-bold transition-all hover:scale-105 active:scale-95 shadow-xl shadow-slate-200 dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:shadow-emerald-900/20">
                Pick Your Seat
              </Button>
            </Link>
          </Card>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border border-slate-200 bg-white shadow-2xl shadow-emerald-900/5 overflow-hidden ring-1 ring-slate-100 dark:border-slate-700 dark:bg-slate-950/70 dark:ring-emerald-500/10"
          >
            <Table>
              <TableHeader className="bg-slate-50/50 backdrop-blur-xs dark:bg-slate-900/60">
                <TableRow className="hover:bg-transparent border-slate-100 h-16">
                  <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[10px] pl-8 dark:text-slate-500">Event & Stadium</TableHead>
                  <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[10px] dark:text-slate-500">Your Selection</TableHead>
                  <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[10px] dark:text-slate-500">Booking Date</TableHead>
                  <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[10px] text-right pr-8 dark:text-slate-500">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => (
                  <TableRow key={booking.id} className="hover:bg-emerald-50/20 transition-all border-slate-100 group h-24 dark:border-slate-800 dark:hover:bg-emerald-500/5">
                    <TableCell className="pl-8">
                      <div className="flex flex-col space-y-1">
                        <span className="font-black text-slate-900 text-lg tracking-tight dark:text-slate-100">{booking.section.stadium}</span>
                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                          <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-sm font-semibold">{booking.section.name}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col bg-slate-50 border border-slate-100 px-4 py-2 rounded-2xl group-hover:bg-white group-hover:border-emerald-100 transition-colors dark:border-slate-700 dark:bg-slate-900/60 dark:group-hover:border-emerald-500/20">
                          <span className="text-[10px] font-black text-slate-400 uppercase dark:text-slate-500">Position</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">Row {booking.rowNumber}, Seat {booking.seatNumber}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900 flex items-center gap-2 dark:text-slate-100">
                           <Clock className="h-4 w-4 text-emerald-500" />
                           {new Date(booking.bookedAt).toLocaleDateString(undefined, {
                             year: 'numeric',
                             month: 'short',
                             day: 'numeric'
                           })}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 ml-6">
                          Confirmed On-Chain
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <Button
                        variant="ghost"
                        className="rounded-2xl border border-slate-200 bg-white hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all active:scale-90 shadow-sm h-12 px-6 gap-2 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
                        onClick={() => setSelectedBooking(booking)}
                      >
                        <QrCode className="h-5 w-5" />
                        <span className="font-bold">Entry Pass</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </motion.div>
        )}
      </main>

      {/* QR Code Modal - Rich Redesign */}
      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="sm:max-w-md rounded-[40px] border-none p-0 overflow-hidden shadow-2xl bg-white dark:bg-[#07110f]">
          <div className="bg-linear-to-b from-emerald-600 to-emerald-700 p-8 text-white relative">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Ticket className="h-32 w-32 rotate-12" />
            </div>
            <DialogHeader className="relative z-10 text-left">
              <div className="bg-white/20 backdrop-blur-md w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
                <Ticket className="h-6 w-6 text-white" />
              </div>
              <DialogTitle className="text-3xl font-black tracking-tighter text-white">
                Digital Pass
              </DialogTitle>
              <DialogDescription className="text-emerald-100/80 font-medium pt-1">
                Scan this cryptographically signed code at the gate.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-8 bg-white dark:bg-[#07110f]">
            {selectedBooking && (
              <div className="flex flex-col items-center space-y-8">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white p-8 rounded-[32px] shadow-2xl shadow-emerald-900/10 border-2 border-slate-50 relative group dark:border-slate-700 dark:bg-slate-950/70"
                >
                  <QRCodeSVG 
                    value={JSON.stringify({
                      seatId: selectedBooking.id,
                      wallet: address,
                      timestamp: Date.now()
                    })}
                    size={220}
                    level="H"
                    includeMargin={false}
                    className="p-1"
                  />
                  <div className="absolute -bottom-2 -right-2 bg-emerald-600 p-3 rounded-2xl shadow-lg border-4 border-white">
                    <QrCode className="h-6 w-6 text-white" />
                  </div>
                </motion.div>
                
                <div className="w-full space-y-3">
                  <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 flex items-center justify-between dark:border-slate-700 dark:bg-slate-900/60">
                    <div>
                      <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Stadium / Stand</p>
                      <p className="font-black text-slate-900 leading-none dark:text-slate-100">{selectedBooking.section.stadium}</p>
                      <p className="text-sm font-bold text-emerald-600 mt-1">{selectedBooking.section.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Row / Seat</p>
                      <div className="flex gap-1 justify-end">
                        <Badge variant="outline" className="rounded-lg border-emerald-200 bg-emerald-50 text-emerald-800 font-black dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">{selectedBooking.rowNumber}</Badge>
                        <Badge variant="outline" className="rounded-lg border-emerald-200 bg-emerald-50 text-emerald-800 font-black dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">{selectedBooking.seatNumber}</Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 w-full">
                  <Button 
                    variant="outline"
                    className="flex-1 border-slate-200 text-slate-600 rounded-2xl h-14 font-bold hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-slate-900"
                    onClick={() => setSelectedBooking(null)}
                  >
                    Close
                  </Button>
                  <Button 
                    className="flex-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl h-14 font-bold shadow-lg shadow-emerald-200 transition-all hover:scale-[1.02] active:scale-95 px-8 dark:shadow-emerald-900/20"
                    onClick={() => window.print()}
                  >
                    Print PDF
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
