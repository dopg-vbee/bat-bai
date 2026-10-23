import type { GameAwards } from '../../../shared/types.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { Emoji } from '../../components/Emoji.tsx';

/** Delay between two cards appearing; HostEnded plays a chime on the same beat. */
export const AWARD_STAGGER_MS = 400;

interface AwardCard {
  icon: string;
  title: string;
  /** Either a player or a song is the winner of the card. */
  player?: { name: string; avatar: string; color: string };
  song?: string;
  detail: string;
}

const seconds = (ms: number) => (ms / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 });

/** The cards to show, in order; titles nobody earned are left out. */
export function awardCards({ fastest, streak, guesser, hardest }: GameAwards): AwardCard[] {
  const cards: (AwardCard | null)[] = [
    fastest && {
      icon: '⚡',
      title: 'Tay nhanh nhất',
      player: fastest,
      detail: `${seconds(fastest.ms)} giây · ${fastest.question}`,
    },
    streak && {
      icon: '🔥',
      title: 'Chiến thần chuỗi',
      player: streak,
      detail: `${streak.streak} câu đúng liên tiếp`,
    },
    guesser && {
      icon: '😅',
      title: 'Thánh đoán bừa',
      player: guesser,
      detail: `${guesser.wrong} lần đoán sai`,
    },
    hardest && {
      icon: '🤔',
      title: 'Câu khó nhất',
      song: hardest.title,
      detail: `${hardest.correct}/${hardest.players} người đoán đúng`,
    },
  ];
  return cards.filter((card): card is AwardCard => card !== null);
}

/** Fun titles after the podium, one card after another. */
export function Awards({ cards }: { cards: AwardCard[] }) {
  return (
    <ul className="awards">
      {cards.map((card, i) => (
        <li key={card.title} className="award-card" style={{ animationDelay: `${i * AWARD_STAGGER_MS}ms` }}>
          <span className="award-title">
            <Emoji char={card.icon} /> {card.title}
          </span>
          {card.player ? (
            <span className="award-winner">
              <Avatar avatar={card.player.avatar} color={card.player.color} size="sm" />
              {card.player.name}
            </span>
          ) : (
            <span className="award-winner">{card.song}</span>
          )}
          <span className="award-detail">{card.detail}</span>
        </li>
      ))}
    </ul>
  );
}
