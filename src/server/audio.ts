import { createHash } from 'node:crypto';

export class AudioError extends Error {}

const BITRATES_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BITRATES_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000], // MPEG 1
  2: [22050, 24000, 16000], // MPEG 2
  0: [11025, 12000, 8000], // MPEG 2.5
};
const SCAN_LIMIT = 256 * 1024;

/** Length of the MPEG Layer III frame starting at `i`, or 0 if there is no valid header. */
function frameLength(buf: Buffer, i: number): number {
  if (i + 4 > buf.length || buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) return 0;
  const version = (buf[i + 1] >> 3) & 3;
  const layer = (buf[i + 1] >> 1) & 3;
  const bitrateIndex = buf[i + 2] >> 4;
  const sampleRateIndex = (buf[i + 2] >> 2) & 3;
  const padding = (buf[i + 2] >> 1) & 1;
  if (version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) return 0;
  const mpeg1 = version === 3;
  const bitrate = (mpeg1 ? BITRATES_V1 : BITRATES_V2)[bitrateIndex] * 1000;
  return Math.floor(((mpeg1 ? 144 : 72) * bitrate) / SAMPLE_RATES[version][sampleRateIndex]) + padding;
}

function findFirstFrame(buf: Buffer): number {
  const limit = Math.min(buf.length, SCAN_LIMIT);
  for (let i = 0; i < limit; i++) {
    const length = frameLength(buf, i);
    // Require a second frame right after, so random 0xFF bytes do not count.
    if (length && (i + length >= buf.length || frameLength(buf, i + length))) return i;
  }
  return -1;
}

/**
 * Validates an MP3 and strips ID3 tags, so the song title in the file metadata
 * cannot leak the answer. Returns the cleaned bytes.
 */
export function prepareMp3(input: Buffer): Buffer {
  let buf = input;
  while (buf.length >= 10 && buf.toString('latin1', 0, 3) === 'ID3') {
    const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    const footer = buf[5] & 0x10 ? 10 : 0;
    buf = buf.subarray(10 + size + footer);
  }
  if (buf.length >= 128 && buf.toString('latin1', buf.length - 128, buf.length - 125) === 'TAG') {
    buf = buf.subarray(0, buf.length - 128);
  }
  const start = findFirstFrame(buf);
  if (start < 0) throw new AudioError('File không phải MP3 hợp lệ');
  return Buffer.from(buf.subarray(start));
}

export const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');
