import jsQR from 'jsqr';
import { useEffect, useRef, useState } from 'react';
import { navigate } from '../lib/router.tsx';

type Problem = 'denied' | 'unavailable' | 'foreign' | null;

const SCAN_EVERY_MS = 150;
/** Frames are scaled down to this width before decoding: plenty for a QR code, light on the phone. */
const SCAN_WIDTH = 480;
const FOREIGN_HINT_MS = 2500;

const MESSAGES: Record<Exclude<Problem, null>, string> = {
  denied: 'Chưa được phép dùng camera. Hãy cho phép camera trong cài đặt trình duyệt rồi thử lại.',
  unavailable: 'Trình duyệt này không mở được camera. Hãy nhập mã phòng 4 số trên màn hình lớn.',
  foreign: 'Đây không phải mã QR của Bắt Bài.',
};

/** A join link from the big screen's QR code (…/play/1234), or null. */
function joinUrl(text: string): URL | null {
  try {
    const url = new URL(text);
    return /^\/play\/\d{4}\/?$/.test(url.pathname) ? url : null;
  } catch {
    return null;
  }
}

/** Reads the big screen's QR code with the phone camera, for phones without a QR scanner app. */
export function QrScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<Problem>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });

    function scan() {
      const video = videoRef.current;
      if (cancelled || !video || !context) return;
      if (video.videoWidth) {
        canvas.width = SCAN_WIDTH;
        canvas.height = Math.round((video.videoHeight / video.videoWidth) * SCAN_WIDTH);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const found = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        const url = found && joinUrl(found.data);
        if (url) {
          // Same server: switch page in place; another address (a LAN host): open it like a QR app would.
          if (url.origin === location.origin) navigate(url.pathname);
          else location.assign(url.href);
          return;
        }
        if (found) {
          setProblem('foreign');
          timer = setTimeout(() => {
            setProblem(null);
            scan();
          }, FOREIGN_HINT_MS);
          return;
        }
      }
      timer = setTimeout(scan, SCAN_EVERY_MS);
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setProblem('unavailable');
    } else {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        .then((media) => {
          if (cancelled) return media.getTracks().forEach((track) => track.stop());
          stream = media;
          if (videoRef.current) videoRef.current.srcObject = media;
          scan();
        })
        .catch((err: Error) => setProblem(err.name === 'NotAllowedError' ? 'denied' : 'unavailable'));
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="card qr-scanner">
      <h2>Quét mã QR</h2>
      <p className="muted">Hướng camera vào mã QR trên màn hình lớn.</p>
      {(problem === null || problem === 'foreign') && (
        <div className="qr-scanner-view">
          <video ref={videoRef} autoPlay muted playsInline />
          <span className="qr-scanner-frame" />
        </div>
      )}
      {problem && <p className="error-text">{MESSAGES[problem]}</p>}
    </div>
  );
}
