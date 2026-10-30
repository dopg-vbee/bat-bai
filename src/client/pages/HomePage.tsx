import { ArrowRight, CircleHelp, Download, ExternalLink, LogIn, ScanQrCode } from 'lucide-react';
import { lazy, Suspense, useState, type ChangeEvent, type FormEvent } from 'react';
import { ROOM_NOT_FOUND } from '../../shared/types.ts';
import { Logo } from '../components/Brand.tsx';
import { Overlay } from '../components/Overlay.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';
import { needsIosInstallHint, promptInstall, useCanInstall } from '../lib/install.ts';
import { Link, navigate } from '../lib/router.tsx';
import { HowToPlay } from './HowToPlay.tsx';

// The QR decoder only loads for the phones that open the scanner.
const QrScanner = lazy(() => import('./QrScanner.tsx').then((m) => ({ default: m.QrScanner })));

export function HomePage() {
  const [code, setCode] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const canInstall = useCanInstall();
  const [iosHint] = useState(needsIosInstallHint);

  function handleCodeChange(event: ChangeEvent<HTMLInputElement>) {
    setCode(event.target.value.replace(/\D/g, '').slice(0, 4));
    setError('');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (code.length !== 4 || checking) return;
    setChecking(true);
    try {
      const res = await fetch(`/api/rooms/${code}`);
      if (res.status === 404) return setError(ROOM_NOT_FOUND);
    } catch {
      // Network trouble: let the room page try (and explain) instead.
    } finally {
      setChecking(false);
    }
    navigate(`/play/${code}`);
  }

  function handleShowScanner() {
    setShowScanner(true);
  }

  function handleHideScanner() {
    setShowScanner(false);
  }

  function handleShowGuide() {
    setShowGuide(true);
  }

  function handleHideGuide() {
    setShowGuide(false);
  }

  return (
    <main className="screen center">
      <div className="home-corner">
        {canInstall && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={promptInstall}>
            <Download /> Cài app
          </button>
        )}
        <ThemeToggle />
      </div>
      <Logo />
      <p className="tagline">Nghe lời – đoán tên bài hát!</p>
      <form className="card stack" onSubmit={handleSubmit}>
        <label className="label" htmlFor="room-code">
          Mã phòng
        </label>
        <input
          id="room-code"
          className="input input-code"
          inputMode="numeric"
          autoComplete="off"
          placeholder="1234"
          value={code}
          onChange={handleCodeChange}
          autoFocus
        />
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary btn-lg" disabled={code.length !== 4 || checking}>
          <LogIn /> Vào phòng
        </button>
        <button type="button" className="btn btn-ghost-dark" onClick={handleShowScanner}>
          <ScanQrCode /> Quét mã QR
        </button>
      </form>
      <button type="button" className="btn btn-ghost" onClick={handleShowGuide}>
        <CircleHelp /> Hướng dẫn chơi
      </button>
      <Link to="/admin" className="link-subtle">
        Tôi là host <ArrowRight />
      </Link>
      <p className="credit">
        Các giọng đọc trong game được tạo tại{' '}
        <a href="https://vbee.vn" target="_blank" rel="noreferrer">
          vbee.vn <ExternalLink />
        </a>
      </p>
      {iosHint && <p className="install-hint">Cài app: bấm nút Chia sẻ rồi chọn “Thêm vào MH chính”</p>}
      {showScanner && (
        <Overlay onClose={handleHideScanner}>
          <Suspense fallback={<div className="card qr-scanner"><div className="spinner" /></div>}>
            <QrScanner />
          </Suspense>
        </Overlay>
      )}
      {showGuide && (
        <Overlay onClose={handleHideGuide}>
          <HowToPlay />
        </Overlay>
      )}
    </main>
  );
}
