import { ScanQrCode, Smartphone } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { readStorage, storageKeys } from '../../lib/storage.ts';

const isLocalhost = () => ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

/**
 * Where phones should go. PUBLIC_URL (server config) wins; on localhost (unreachable from a phone)
 * the server's best LAN address is used; otherwise whatever address the host screen is on.
 */
function usePhoneBaseUrl() {
  const [base, setBase] = useState(location.origin);
  useEffect(() => {
    fetch('/api/info')
      .then((res) => res.json())
      .then((info: { publicUrl: string | null; lanAddresses: string[] }) => {
        if (info.publicUrl) return setBase(info.publicUrl);
        const ip = info.lanAddresses[0];
        if (ip && isLocalhost()) setBase(`${location.protocol}//${ip}${location.port ? `:${location.port}` : ''}`);
      })
      .catch(() => undefined);
  }, []);
  return base;
}

interface QrCardProps {
  url: string;
  title: ReactNode;
  alt: string;
  className?: string;
  children: ReactNode;
}

/** A QR code for `url` under a title, with whatever else the card needs below. */
function QrCard({ url, title, alt, className = '', children }: QrCardProps) {
  const [qr, setQr] = useState('');

  useEffect(() => {
    QRCode.toDataURL(url, { width: 900, margin: 1 })
      .then(setQr)
      .catch(() => setQr(''));
  }, [url]);

  return (
    <div className={`card join-card ${className}`}>
      <p className="join-step">{title}</p>
      {qr ? <img className="qr" src={qr} alt={alt} /> : <div className="qr" />}
      {children}
    </div>
  );
}

/** QR code, address and room code for phones to join. */
export function JoinCard({ code }: { code: string }) {
  const base = usePhoneBaseUrl();
  return (
    <QrCard
      url={`${base}/play/${code}`}
      alt={`QR vào phòng ${code}`}
      title={
        <>
          <ScanQrCode /> Quét mã để vào chơi
        </>
      }
    >
      <p className="join-or">
        hoặc vào <strong>{base}</strong> và nhập mã
      </p>
      <div className="room-code">{code}</div>
    </QrCard>
  );
}

/** QR code opening the phone remote; it carries the host token, so whoever scans it controls the room. */
export function RemoteCard({ code }: { code: string }) {
  const base = usePhoneBaseUrl();
  const hostToken = readStorage(storageKeys.host(code)) ?? '';
  return (
    <QrCard
      url={`${base}/host/${code}/remote#${hostToken}`}
      className="remote-card"
      alt={`QR điều khiển phòng ${code}`}
      title={
        <>
          <Smartphone /> Quét để điều khiển
        </>
      }
    >
      <p className="join-or">Ai quét mã này cũng điều khiển được phòng: đừng để người chơi thấy.</p>
    </QrCard>
  );
}
