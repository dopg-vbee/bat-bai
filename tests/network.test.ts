import type { NetworkInterfaceInfo } from 'node:os';
import { describe, expect, it } from 'vitest';
import { pickLanAddresses } from '../src/server/network.ts';

const v4 = (address: string, internal = false) => [{ address, family: 'IPv4', internal } as NetworkInterfaceInfo];

// The host machine where phones got a black screen: the Hyper-V switch came first.
const windowsWithHyperV = {
  'vEthernet (Default Switch)': v4('172.26.224.1'),
  'Wi-Fi': v4('192.168.1.147'),
  'Loopback Pseudo-Interface 1': v4('127.0.0.1', true),
  'vEthernet (WSL)': v4('172.27.144.1'),
};

describe('pickLanAddresses', () => {
  it('puts the Wi-Fi address first, not the virtual switch', () => {
    expect(pickLanAddresses(windowsWithHyperV, '192.168.1.147')[0]).toBe('192.168.1.147');
  });

  it('works offline too (no outbound route): skips virtual adapters', () => {
    expect(pickLanAddresses(windowsWithHyperV, null)).toEqual(['192.168.1.147', '172.26.224.1', '172.27.144.1']);
  });

  it('ignores an outbound address that belongs to a VPN', () => {
    const withVpn = { ...windowsWithHyperV, 'WireGuard Tunnel': v4('10.8.0.2') };
    expect(pickLanAddresses(withVpn, '10.8.0.2')[0]).toBe('192.168.1.147');
  });

  it('prefers 192.168 over 10.x over 172.x among real adapters', () => {
    const mixed = { eth1: v4('172.20.0.5'), eth0: v4('10.0.4.153'), wlan0: v4('192.168.0.9') };
    expect(pickLanAddresses(mixed, null)).toEqual(['192.168.0.9', '10.0.4.153', '172.20.0.5']);
  });
});
