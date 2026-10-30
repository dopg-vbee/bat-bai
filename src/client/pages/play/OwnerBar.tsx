import { ListOrdered, Pause, Play, SkipForward, Trophy, UserX, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { PlayerIdentity, PlayerState } from '../../../shared/types.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { socket } from '../../lib/socket.ts';
import { JoinCard } from '../host/JoinCard.tsx';

/** The one button that moves the game on from where it is. */
function nextStep(state: PlayerState): { label: string; icon: ReactNode } | null {
  switch (state.phase) {
    case 'question':
      return { label: 'Hiện đáp án', icon: <SkipForward /> };
    case 'reveal':
      return state.qIndex + 1 >= state.qTotal
        ? { label: 'Kết thúc game', icon: <Trophy /> }
        : { label: 'Xem bảng xếp hạng', icon: <ListOrdered /> };
    case 'leaderboard':
      return { label: 'Câu tiếp', icon: <SkipForward /> };
    case 'finale':
      return { label: 'Xem kết quả', icon: <Trophy /> };
    default:
      return null;
  }
}

function Member({ member }: { member: PlayerIdentity }) {
  function handleKick() {
    socket.emit('host:kick', member.id);
  }

  return (
    <li className="owner-member">
      <Avatar avatar={member.avatar} color={member.color} size="sm" />
      <span className="owner-member-name">{member.name}</span>
      <button className="btn btn-ghost-dark icon-btn" onClick={handleKick} aria-label={`Mời ${member.name} ra khỏi phòng`}>
        <UserX />
      </button>
    </li>
  );
}

/** What the room owner has beyond a player: invite, start, kick (lobby), then pace and end the game. */
export function OwnerBar({ state }: { state: PlayerState }) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const paused = state.pausedAt > 0;
  const step = nextStep(state);

  function handleStart() {
    socket.emit('host:next');
  }

  function handleNext() {
    socket.emit('host:next');
  }

  function handleTogglePause() {
    socket.emit(paused ? 'host:resume' : 'host:pause');
  }

  function handleAskEnd() {
    setConfirmEnd(true);
  }

  function handleCancelEnd() {
    setConfirmEnd(false);
  }

  function handleEnd() {
    setConfirmEnd(false);
    socket.emit('host:end');
  }

  if (state.phase === 'ended') return null;

  if (state.phase === 'lobby') {
    return (
      <section className="owner-lobby stack">
        <JoinCard code={state.code} />
        {state.members && state.members.length > 0 && (
          <ul className="owner-members">
            {state.members.map((member) => (
              <Member key={member.id} member={member} />
            ))}
          </ul>
        )}
        <button className="btn btn-primary btn-lg" onClick={handleStart} disabled={state.playerCount < 2}>
          <Play /> {state.playerCount < 2 ? 'Chờ thêm người chơi' : 'Bắt đầu'}
        </button>
      </section>
    );
  }

  return (
    <div className="owner-bar">
      {confirmEnd ? (
        <>
          <span>Kết thúc ván này?</span>
          <button className="btn btn-ghost-dark" onClick={handleCancelEnd}>
            <X /> Thôi
          </button>
          <button className="btn btn-primary" onClick={handleEnd}>
            Kết thúc
          </button>
        </>
      ) : (
        <>
          <button className="btn btn-ghost-dark" onClick={handleTogglePause}>
            {paused ? <Play /> : <Pause />} {paused ? 'Tiếp tục' : 'Tạm dừng'}
          </button>
          {step && (
            <button className="btn btn-primary" onClick={handleNext}>
              {step.icon} {step.label}
            </button>
          )}
          <button className="btn btn-ghost-dark" onClick={handleAskEnd}>
            Kết thúc
          </button>
        </>
      )}
    </div>
  );
}
