const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const PATH_PREFIXES = ['shorts', 'embed', 'live', 'v'];

/** Accepts "90", "90s", "1m30s", "1h2m3s", "1:30", "1:02:03". */
export function parseTimestamp(input: string | null | undefined): number | null {
  const value = (input ?? '').trim().toLowerCase();
  if (!value) return null;
  if (/^\d+(\.\d+)?s?$/.test(value)) return Math.floor(parseFloat(value));
  if (/^\d+(:\d{1,2}){1,2}$/.test(value)) {
    return value.split(':').reduce((total, part) => total * 60 + Number(part), 0);
  }
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
  if (!match || !(match[1] || match[2] || match[3])) return null;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

export function parseYoutube(input: string): { id: string; start: number; end: number | null } | null {
  const raw = input.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const parts = url.pathname.split('/').filter(Boolean);
  let id: string | null = null;
  if (host === 'youtu.be') {
    id = parts[0] ?? null;
  } else if (/(^|\.)youtube(-nocookie)?\.com$/.test(host)) {
    if (parts[0] === 'watch') id = url.searchParams.get('v');
    else if (PATH_PREFIXES.includes(parts[0] ?? '')) id = parts[1] ?? null;
  }
  if (!id || !VIDEO_ID.test(id)) return null;

  const hashTime = new URLSearchParams(url.hash.slice(1)).get('t');
  const start = parseTimestamp(url.searchParams.get('t') ?? url.searchParams.get('start') ?? hashTime) ?? 0;
  const end = parseTimestamp(url.searchParams.get('end'));
  return { id, start, end: end !== null && end > start ? end : null };
}

export function formatTimestamp(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = String(sec % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

export const youtubeWatchUrl = (id: string, startSec: number) =>
  `https://www.youtube.com/watch?v=${id}&t=${startSec}s`;

export const formatRange = (startSec: number, endSec: number | null) =>
  endSec === null ? `từ ${formatTimestamp(startSec)}` : `${formatTimestamp(startSec)} – ${formatTimestamp(endSec)}`;
