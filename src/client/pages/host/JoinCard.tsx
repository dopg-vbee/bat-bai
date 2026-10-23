import { ScanQrCode, X } from 'lucide-react';
import { useEffect, useState, type MouseEvent } from 'react';
import QRCode from 'qrcode';

const isLocalhost = () => ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

/**
 * Where phones should go. PUBLIC_URL (server config) wins; on localhost (unreachable from a phone)
 * the server's best LAN address is used; otherwise whatever address the host screen is on.
 */
function useJoinUrl(code: string) {
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
  return `${base}/play/${code}`;
}

/** QR code, address and room code for phones to join. */
export function JoinCard({ code }: { code: string }) {
  const joinUrl = useJoinUrl(code);
  const [qr, setQr] = useState('');

  useEffect(() => {
    QRCode.toDataURL(joinUrl, { width: 900, margin: 1 })
      .then(setQr)
      .catch(() => setQr(''));
  }, [joinUrl]);

  return (
    <div className="card join-card">
      <p className="join-step">
        <ScanQrCode /> Quét mã để vào chơi
      </p>
      {qr ? <img className="qr" src={qr} alt={`QR vào phòng ${code}`} /> : <div className="qr" />}
      <p className="join-or">
        hoặc vào <strong>{joinUrl.replace(/\/play\/\d+$/, '')}</strong> và nhập mã
      </p>
      <div className="room-code">{code}</div>
    </div>
  );
}

/** The join card over the game, for latecomers; the round keeps running underneath. */
export function QrOverlay({ code, onClose }: { code: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div className="qr-overlay" role="dialog" aria-label="Mã QR vào phòng" onClick={handleBackdrop}>
      <div className="qr-overlay-body">
        <button className="btn btn-ghost icon-btn qr-overlay-close" onClick={onClose} aria-label="Đóng" title="Đóng">
          <X />
        </button>
        <JoinCard code={code} />
      </div>
    </div>
  );
}
