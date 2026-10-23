import type { CreateRoomInput } from '../../shared/types.ts';
import { getAdminPassword } from './api.ts';
import { navigate } from './router.tsx';
import { socket } from './socket.ts';
import { storageKeys, writeStorage } from './storage.ts';

/** Creates a room and opens its host screen. Resolves an error message on failure. */
export async function createRoom(input: Omit<CreateRoomInput, 'password'>): Promise<string | null> {
  try {
    const res = await socket.timeout(5000).emitWithAck('host:create', { ...input, password: getAdminPassword() });
    if (!res.ok) return res.error;
    writeStorage(storageKeys.host(res.code), res.hostToken);
    navigate(`/host/${res.code}`);
    return null;
  } catch {
    return 'Không kết nối được server, thử lại nhé';
  }
}

export function openPlayerWindow(code: string) {
  window.open(`/play/${code}`, `batbai-player-${code}`, 'width=400,height=820');
}
