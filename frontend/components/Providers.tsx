'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, WagmiProvider, createConfig } from 'wagmi';
import { mainnet, sepolia, hardhat } from 'wagmi/chains';
import { metaMask } from 'wagmi/connectors';

const config = createConfig({
  chains: [mainnet, sepolia, hardhat],
  connectors: [
    metaMask({
      dapp: {
        name: 'Ticket System',
        url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
      },
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [hardhat.id]: http(),
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
