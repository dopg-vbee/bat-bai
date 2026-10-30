import type { ChangeEvent } from 'react';

const CODE_LENGTH = 4;

interface RoomCodeInputProps {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  invalid: boolean;
}

/**
 * The room code as one tile per digit. A single transparent input lies over the tiles, so typing,
 * pasting, autofill and the numeric keypad all behave like a plain field.
 */
export function RoomCodeInput({ value, onChange, invalid }: RoomCodeInputProps) {
  const current = Math.min(value.length, CODE_LENGTH - 1);
  return (
    <div className={`code-field${invalid ? ' invalid' : ''}`}>
      <div className="code-cells" aria-hidden>
        {Array.from({ length: CODE_LENGTH }, (_, i) => (
          <span key={i} className={`code-cell${i < value.length ? ' filled' : ''}${i === current ? ' current' : ''}`}>
            {value[i]}
          </span>
        ))}
      </div>
      <input
        id="room-code"
        className="code-input"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        aria-label="Mã phòng"
        aria-invalid={invalid}
        value={value}
        onChange={onChange}
        autoFocus
      />
    </div>
  );
}
