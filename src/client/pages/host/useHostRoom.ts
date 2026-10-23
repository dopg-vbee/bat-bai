import { useEffect, useState } from 'react';
import type { HostState } from '../../../shared/types.ts';
import { socket } from '../../lib/socket.ts';
import { readStorage, storageKeys } from '../../lib/storage.ts';

/** Joins room `code` as its host (big screen or phone remote, holding its host token) and follows its state. */
export function useHostRoom(code: string) {
  const [state, setState] = useState<HostState | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const hostToken = readStorage(storageKeys.host(code));
    if (!hostToken) {
      setError('Thiết bị này không phải host của phòng ' + code);
      return;
    }
    const join = () =>
      socket.emit('host:join', { code, hostToken }, (res) => {
        if (!res.ok) setError(res.error);
      });
    // Only this room: the socket is shared across pages and may still hear an earlier room.
    const onState = (next: HostState) => {
      if (next.code === code) setState(next);
    };
    socket.on('hostState', onState);
    if (socket.connected) join();
    socket.on('connect', join);
    return () => {
      socket.off('hostState', onState);
      socket.off('connect', join);
      socket.emit('host:leave');
    };
  }, [code]);

  return { state, error };
}
