import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react';
import { FileAudio, FileUp, X } from 'lucide-react';
import { MAX_AUDIO_MB } from '../../../shared/types.ts';

interface AudioDropzoneProps {
  file: File | null;
  /** Extra line under the prompt, e.g. "bỏ trống nếu giữ file cũ". */
  note?: string;
  onChange: (file: File | null) => void;
}

const ERROR_VISIBLE_MS = 4000;

const isMp3 = (file: File) => file.type === 'audio/mpeg' || /\.mp3$/i.test(file.name);

export function AudioDropzone({ file, note, onChange }: AudioDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), ERROR_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [error]);

  // A file dropped just outside the zone would otherwise make the browser open it and leave the page.
  useEffect(() => {
    const block = (event: globalThis.DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
    };
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => {
      window.removeEventListener('dragover', block);
      window.removeEventListener('drop', block);
    };
  }, []);

  function accept(picked: File | undefined) {
    if (!picked) return;
    if (!isMp3(picked)) return setError(`"${picked.name}" không phải file MP3`);
    if (picked.size > MAX_AUDIO_MB * 1024 * 1024) return setError(`File quá lớn (tối đa ${MAX_AUDIO_MB}MB)`);
    setError('');
    onChange(picked);
  }

  function handleClick() {
    inputRef.current?.click();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    inputRef.current?.click();
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    accept(event.dataTransfer.files[0]);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    accept(event.target.files?.[0]);
  }

  function handleClear() {
    onChange(null);
  }

  // Also the hover text: the narrow zone may cut it short.
  const meta = file
    ? `${(file.size / 1024 / 1024).toFixed(1)} MB · bấm hoặc kéo file khác để đổi`
    : `hoặc bấm để chọn · tối đa ${MAX_AUDIO_MB}MB${note ? ` · ${note}` : ''}`;
  return (
    <div className="dropzone-field">
      <div
        className={`dropzone${dragging ? ' dragging' : ''}${file ? ' has-file' : ''}`}
        title={meta}
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input ref={inputRef} type="file" accept="audio/mpeg,.mp3" hidden onChange={handleInputChange} />
        <span className="dropzone-icon">{file ? <FileAudio /> : <FileUp />}</span>
        <strong className="dropzone-title">{file ? file.name : 'Kéo thả file MP3 vào đây'}</strong>
        <span className="dropzone-meta">{meta}</span>
      </div>
      {error && <p className="error-text">{error}</p>}
      {previewUrl && (
        <div className="dropzone-preview">
          <audio controls src={previewUrl} />
          <button type="button" className="btn btn-ghost-dark btn-sm" onClick={handleClear}>
            <X /> Bỏ chọn
          </button>
        </div>
      )}
    </div>
  );
}
