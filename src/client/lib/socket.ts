import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/types.ts';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();

let clockOffset = 0;

/** Keeps the lowest-latency sample, so every device counts down to the same server instant. */
async function syncClock() {
  let bestRtt = Infinity;
  for (let i = 0; i < 4; i++) {
    const sentAt = Date.now();
    const serverNow = await socket.timeout(3000).emitWithAck('time');
    const receivedAt = Date.now();
    if (receivedAt - sentAt < bestRtt) {
      bestRtt = receivedAt - sentAt;
      clockOffset = serverNow - (sentAt + receivedAt) / 2;
    }
  }
}

socket.on('connect', () => {
  syncClock().catch(() => undefined);
});

export const serverNow = () => Date.now() + clockOffset;

export function useServerNow(active: boolean, intervalMs = 200) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(serverNow()), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs]);
  return active ? now : serverNow();
}

export function useConnected() {
  const [connected, setConnected] = useState(socket.connected);
  useEffect(() => {
    const update = () => setConnected(socket.connected);
    socket.on('connect', update);
    socket.on('disconnect', update);
    return () => {
      socket.off('connect', update);
      socket.off('disconnect', update);
    };
  }, []);
  return connected;
}
