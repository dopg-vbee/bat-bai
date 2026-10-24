import { useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react';
import { OPEN_CLIP_SEC } from '../../../shared/types.ts';
import { formatTimestamp, parseTimestamp, roundTenth } from '../../../shared/youtube.ts';

const STEP = 0.1;
/** What the − / + buttons move the mark by. */
const NUDGE_SEC = 1;
const DEFAULT_CLIP_SEC = 20;
/** Slider length while the video's real duration is still loading (or unavailable). */
const FALLBACK_SPAN_SEC = 300;

interface TimeSliderProps {
  label: ReactNode;
  value: number;
  max: number;
  disabled?: boolean;
  onChange: (sec: number) => void;
}

function TimeSlider({ label, value, max, disabled = false, onChange }: TimeSliderProps) {
  const [draft, setDraft] = useState<string | null>(null);

  function handleRange(event: ChangeEvent<HTMLInputElement>) {
    onChange(Number(event.target.value));
  }

  function handleMinus() {
    onChange(value - NUDGE_SEC);
  }

  function handlePlus() {
    onChange(value + NUDGE_SEC);
  }

  function handleDraftChange(event: ChangeEvent<HTMLInputElement>) {
    setDraft(event.target.value);
  }

  function commitDraft() {
    if (draft === null) return;
    const parsed = parseTimestamp(draft);
    if (parsed !== null) onChange(parsed);
    setDraft(null);
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault(); // don't submit the question form
    commitDraft();
  }

  return (
    <div className={`time-slider${disabled ? ' disabled' : ''}`}>
      <span className="time-slider-label">{label}</span>
      <button type="button" className="btn btn-ghost-dark btn-sm step-btn" onClick={handleMinus} disabled={disabled}>
        −1s
      </button>
      <input
        type="range"
        className="time-range"
        min={0}
        max={max}
        step={STEP}
        value={Math.min(value, max)}
        onChange={handleRange}
        disabled={disabled}
      />
      <button type="button" className="btn btn-ghost-dark btn-sm step-btn" onClick={handlePlus} disabled={disabled}>
        +1s
      </button>
      <input
        className="input input-sm time-input"
        value={draft ?? formatTimestamp(value)}
        onChange={handleDraftChange}
        onBlur={commitDraft}
        onKeyDown={handleDraftKeyDown}
        disabled={disabled}
        aria-label="Thời điểm (phút:giây)"
      />
    </div>
  );
}

interface ClipRangeEditorProps {
  /** Video length in seconds; null while loading. */
  duration: number | null;
  startSec: number;
  endSec: number | null;
  onChange: (startSec: number, endSec: number | null) => void;
}

/** Start/end sliders for the YouTube clip, each with ±1s nudges and an exact-time box. */
export function ClipRangeEditor({ duration, startSec, endSec, onChange }: ClipRangeEditorProps) {
  const max = duration ?? Math.max(startSec, endSec ?? 0) + FALLBACK_SPAN_SEC;

  function handleStartChange(sec: number) {
    const limit = (endSec ?? max) - STEP;
    onChange(roundTenth(Math.min(Math.max(sec, 0), limit)), endSec);
  }

  function handleEndChange(sec: number) {
    onChange(startSec, roundTenth(Math.min(Math.max(sec, startSec + STEP), max)));
  }

  function handleEndToggle(event: ChangeEvent<HTMLInputElement>) {
    onChange(startSec, event.target.checked ? roundTenth(Math.min(max, startSec + DEFAULT_CLIP_SEC)) : null);
  }

  const endLabel = (
    <label className="end-toggle">
      <input type="checkbox" checked={endSec !== null} onChange={handleEndToggle} />
      Dừng ở
    </label>
  );

  return (
    <div className="range-editor">
      <TimeSlider label="Phát từ" value={startSec} max={max} onChange={handleStartChange} />
      <TimeSlider label={endLabel} value={endSec ?? max} max={max} disabled={endSec === null} onChange={handleEndChange} />
      <p className="range-summary">
        {endSec === null
          ? `Không đặt điểm dừng: phát ${OPEN_CLIP_SEC} giây.`
          : `Đoạn dài ${formatTimestamp(endSec - startSec)}.`}
        {duration === null ? ' Đang lấy độ dài video…' : ` Video dài ${formatTimestamp(duration)}.`}
      </p>
    </div>
  );
}
