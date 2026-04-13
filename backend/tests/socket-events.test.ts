import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';
import { io, type Socket } from 'socket.io-client';
import prisma from '../src/services/db.js';

const BASE_URL = process.env.TEST_BASE_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
const TEST_WALLET = (process.env.TEST_WALLET_ADDRESS ?? '0x1111111111111111111111111111111111111111').toLowerCase();

type SeatLockedPayload = {
  seatId: string;
  sectionId: string;
  walletAddress: string | null;
  lockedUntil: string | null;
  status: string;
};

function waitForEvent<T>(
  socket: Socket,
  eventName: string,
  timeoutMs = 6000
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error(`Timed out waiting for socket event "${eventName}"`));
    }, timeoutMs);

    const onEvent = (payload: T) => {
      clearTimeout(timeout);
      socket.off(eventName, onEvent);
      resolve(payload);
    };

    socket.on(eventName, onEvent);
  });
}

test('emits lock events when a seat is locked', { timeout: 20000 }, async () => {
  const healthResponse = await fetch(`${BASE_URL}/api/tickets`);
  assert.equal(healthResponse.ok, true, `Backend is not reachable at ${BASE_URL}`);

  let section = await prisma.section.findFirst({
    select: { id: true, stadiumId: true },
  });

  let createdStadiumId: string | null = null;
  let createdSectionId: string | null = null;

  if (!section) {
    const stadium = await prisma.stadium.create({
      data: {
        name: 'Socket Test Stadium',
        location: 'Test Location',
      },
      select: { id: true },
    });
    createdStadiumId = stadium.id;

    const newSection = await prisma.section.create({
      data: {
        name: 'Socket Test Section',
        stadiumId: stadium.id,
      },
      select: { id: true, stadiumId: true },
    });
    createdSectionId = newSection.id;
    section = newSection;
  }

  const seat = await prisma.seat.create({
    data: {
      sectionId: section.id,
      rowNumber: 'TEST',
      seatNumber: Date.now() % 1_000_000,
      price: 0.1234,
      status: 'AVAILABLE',
      walletAddress: null,
      lockedUntil: null,
    },
    select: { id: true, sectionId: true },
  });

  const socket = io(BASE_URL, {
    transports: ['websocket'],
    timeout: 5000,
  });

  try {
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', (error) => reject(error));
    });

    socket.emit('join_section', seat.sectionId);

    const globalEventPromise = waitForEvent<SeatLockedPayload>(socket, 'seat.locked');
    const sectionEventPromise = waitForEvent<SeatLockedPayload>(socket, 'section.seat.locked');

    const lockResponse = await fetch(`${BASE_URL}/api/tickets/lock`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        seatId: seat.id,
        walletAddress: TEST_WALLET,
      }),
    });

    const lockBody = await lockResponse.json();
    assert.equal(lockResponse.status, 200, `Lock API failed: ${JSON.stringify(lockBody)}`);

    const [globalEvent, sectionEvent] = await Promise.all([globalEventPromise, sectionEventPromise]);

    assert.equal(globalEvent.seatId, seat.id);
    assert.equal(globalEvent.sectionId, seat.sectionId);
    assert.equal(globalEvent.status, 'LOCKED');
    assert.equal(globalEvent.walletAddress, TEST_WALLET);

    assert.equal(sectionEvent.seatId, seat.id);
    assert.equal(sectionEvent.sectionId, seat.sectionId);
    assert.equal(sectionEvent.status, 'LOCKED');
  } finally {
    await prisma.seat.delete({
      where: { id: seat.id },
    });

    if (createdSectionId) {
      await prisma.section.delete({
        where: { id: createdSectionId },
      });
    }

    if (createdStadiumId) {
      await prisma.stadium.delete({
        where: { id: createdStadiumId },
      });
    }

    socket.close();
  }
});
