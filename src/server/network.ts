import dgram from 'node:dgram';
import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os';

/** Adapters a phone on the same Wi-Fi can never reach (VMs, WSL, containers, VPNs...). */
const VIRTUAL_ADAPTER = /vethernet|wsl|hyper-v|virtualbox|vbox|vmware|docker|\bbr-|veth|bluetooth|tailscale|zerotier|wireguard|\butun|\btun|\btap/i;

/** 192.168.x is almost always the home/office Wi-Fi; 172.16–31 is often a virtual switch. */
function privateRank(ip: string): number {
  if (ip.startsWith('192.168.')) return 0;
  if (ip.startsWith('10.')) return 1;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 2;
  return 3;
}

/**
 * Orders this machine's IPv4 addresses by how likely a phone on the same network can reach them.
 * `outbound` (the address the OS uses for internet traffic) wins when it is a real adapter.
 */
export function pickLanAddresses(
  interfaces: Record<string, NetworkInterfaceInfo[] | undefined>,
  outbound: string | null,
): string[] {
  const all = Object.entries(interfaces).flatMap(([name, list]) =>
    (list ?? []).filter((n) => n.family === 'IPv4' && !n.internal).map((n) => ({ name, ip: n.address })),
  );
  const real = all.filter((a) => !VIRTUAL_ADAPTER.test(a.name)).sort((a, b) => privateRank(a.ip) - privateRank(b.ip));
  const virtual = all.filter((a) => VIRTUAL_ADAPTER.test(a.name));
  const preferred = outbound && real.some((a) => a.ip === outbound) ? [outbound] : [];
  return [...new Set([...preferred, ...real.map((a) => a.ip), ...virtual.map((a) => a.ip)])];
}

/** Address of the adapter the OS would route internet traffic through. No packet is sent. */
function outboundAddress(): Promise<string | null> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const done = (ip: string | null) => {
      socket.close();
      resolve(ip);
    };
    socket.on('error', () => done(null)); // offline LAN: no route out
    socket.connect(53, '8.8.8.8', () => {
      try {
        done(socket.address().address);
      } catch {
        done(null);
      }
    });
  });
}

/** Best address first: what goes into the join QR code when the host screen runs on localhost. */
export async function lanAddresses(): Promise<string[]> {
  return pickLanAddresses(networkInterfaces(), await outboundAddress());
}
