'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, WagmiProvider, createConfig } from 'wagmi';
import { metaMask } from 'wagmi/connectors';
import { SeatProvider } from '@/contexts/seat-context';
import { ThemeProvider } from '@/components/theme-provider';

import { wireFluid } from '@/lib/chain';

const config = createConfig({
  chains: [wireFluid],
  connectors: [
    metaMask({
      dapp: {
        name: 'Ticket System',
        url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
      },
    }),
  ],
  transports: {
    [wireFluid.id]: http(wireFluid.rpcUrls.default.http[0]),
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <SeatProvider>
            {children}
          </SeatProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}