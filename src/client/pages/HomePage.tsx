import { CircleHelp, Compass, Download, LogIn, Music, Presentation, ScanQrCode, VolumeX } from 'lucide-react';
import { lazy, Suspense, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { ROOM_NOT_FOUND, type PublicSetDto } from '../../shared/types.ts';
import { Logo } from '../components/Brand.tsx';
import { Overlay } from '../components/Overlay.tsx';
import { RoomCodeInput } from '../components/RoomCodeInput.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';
import { needsIosInstallHint, promptInstall, useCanInstall } from '../lib/install.ts';
import { Link, navigate } from '../lib/router.tsx';
import { useMusic } from '../lib/useMusic.ts';
import { HowToPlay } from './HowToPlay.tsx';
import { SetBrowser } from './SetBrowser.tsx';

// The QR decoder only loads for the phones that open the scanner.
const QrScanner = lazy(() => import('./QrScanner.tsx').then((m) => ({ default: m.QrScanner })));

export function HomePage() {
  const [code, setCode] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [sets, setSets] = useState<PublicSetDto[]>([]);
  const [showSets, setShowSets] = useState(false);
  const { musicOn, toggleMusic } = useMusic(true);
  const canInstall = useCanInstall();
  const [iosHint] = useState(needsIosInstallHint);

  // Public sets sit on the home page: tap one to open a room with it.
  useEffect(() => {
    fetch('/api/public-sets')
      .then((res) => res.json() as Promise<PublicSetDto[]>)
      .then(setSets)
      .catch(() => undefined);
  }, []);

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

  function handleShowSets() {
    setShowSets(true);
  }

  function handleHideSets() {
    setShowSets(false);
  }

  function handleShowGuide() {
    setShowGuide(true);
  }

  function handleHideGuide() {
    setShowGuide(false);
  }

  return (
    <main className="screen center home">
      <div className="home-corner">
        {canInstall && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={promptInstall}>
            <Download /> Cài app
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={handleShowGuide}>
          <CircleHelp /> Hướng dẫn
        </button>
        <Link to="/admin" className="btn btn-ghost btn-sm">
          <Presentation /> Tôi là host
        </Link>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={toggleMusic}
          aria-label={musicOn ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
          title={musicOn ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
        >
          {musicOn ? <Music /> : <VolumeX />}
        </button>
        <ThemeToggle />
      </div>
      <Logo />
      <p className="tagline">Nghe lời – đoán tên bài hát!</p>
      <form className="home-form" onSubmit={handleSubmit}>
        <label className="code-title" htmlFor="room-code">
          Nhập mã phòng
        </label>
        <RoomCodeInput value={code} onChange={handleCodeChange} invalid={Boolean(error)} />
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="join-row">
          <button className="btn btn-primary btn-lg" disabled={code.length !== 4 || checking}>
            <LogIn /> Vào phòng
          </button>
          <button type="button" className="btn btn-ghost-dark" onClick={handleShowScanner}>
            <ScanQrCode /> Quét QR
          </button>
        </div>
      </form>
      {sets.length > 0 && (
        <button type="button" className="btn btn-ghost" onClick={handleShowSets}>
          <Compass /> Khám phá bộ đề
        </button>
      )}
      <a className="credit" href="https://vbee.vn" target="_blank" rel="noreferrer">
        <img src="/vbee-logo.svg" alt="" />
        <span>
          Các giọng đọc trong game được tạo tại <strong>vbee.vn</strong>
        </span>
      </a>
      {iosHint && <p className="install-hint">Cài app: bấm nút Chia sẻ rồi chọn “Thêm vào MH chính”</p>}
      {showSets && (
        <Overlay onClose={handleHideSets}>
          <SetBrowser sets={sets} />
        </Overlay>
      )}
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
