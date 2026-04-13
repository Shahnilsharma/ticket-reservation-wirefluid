const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${BACKEND_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: { 'content-type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error ?? 'Request failed');
  }

  return payload as T;
}

export type ApiSeatStatus = 'available' | 'locked' | 'sold';

export type ApiSection = {
  id: string;
  clientId: 'north' | 'north-east' | 'south-east' | 'south' | 'south-west' | 'north-west';
  name: string;
  counts: {
    available: number;
    locked: number;
    sold: number;
  };
  totalSeats: number;
};

export type ApiSeat = {
  id: string;
  rowNumber: string;
  seatNumber: number;
  price: number;
  status: ApiSeatStatus;
  lockedUntil: string | null;
  walletAddress: string | null;
  sectionId: string;
};

export type ApiBooking = {
  id: string;
  rowNumber: string;
  seatNumber: number;
  price: number;
  section: {
    id: string;
    name: string;
    stadium: string;
  };
  bookedAt: string;
};

export async function fetchSections() {
  return request<{ sections: ApiSection[] }>('/api/tickets/sections');
}

export async function fetchSectionSeats(clientId: ApiSection['clientId']) {
  return request<{
    section: { id: string; clientId: ApiSection['clientId']; name: string };
    seats: ApiSeat[];
  }>(`/api/tickets/sections/${clientId}/seats`);
}

export async function lockSeat(payload: { seatId: string; walletAddress: string }) {
  return request<{
    message: string;
    seat: {
      id: string;
      sectionId: string;
      status: 'AVAILABLE' | 'LOCKED' | 'SOLD';
      walletAddress: string | null;
      lockedUntil: string | null;
    } | null;
  }>(`/api/tickets/lock`, {
    method: 'POST',
    body: payload,
  });
}

export async function unlockSeat(payload: { seatId: string; walletAddress: string }) {
  return request<{
    message: string;
  }>(`/api/tickets/unlock`, {
    method: 'POST',
    body: payload,
  });
}

export async function confirmPurchase(payload: { seatIds: string[]; txHash: string; walletAddress: string }) {
  return request<{ message: string; confirmedCount: number }>(`/api/tickets/confirm-purchase`, {
    method: 'POST',
    body: payload,
  });
}

export async function fetchBookings(walletAddress: string) {
  return request<{ bookings: ApiBooking[] }>(`/api/tickets/bookings?walletAddress=${walletAddress}`);
}

export function getBackendBaseUrl() {
  return BACKEND_BASE_URL;
}
