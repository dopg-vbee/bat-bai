import { TEAMS, type GameAwards, type TeamStanding } from '../../../shared/types.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { Emoji } from '../../components/Emoji.tsx';
import { formatPoints } from '../../lib/format.ts';

/** Delay between two cards appearing; HostEnded plays a chime on the same beat. */
export const AWARD_STAGGER_MS = 400;

interface AwardCard {
  icon: string;
  title: string;
  /** Either a player wins the card, or a thing (a song, a team) named by `text`. */
  player?: { name: string; avatar: string; color: string };
  text?: string;
  detail: string;
}

const seconds = (ms: number) => (ms / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 });

/** The cards to show, in order; titles nobody earned are left out. `champion`: the best team, if any. */
export function awardCards(awards: GameAwards, champion: TeamStanding | null): AwardCard[] {
  const { fastest, streak, guesser, hardest } = awards;
  const cards: (AwardCard | null)[] = [
    champion && {
      icon: '🏆',
      title: 'Đội vô địch',
      text: `Đội ${TEAMS[champion.team].name}`,
      detail: `trung bình ${formatPoints(champion.score)} điểm · ${champion.members} người`,
    },
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
      text: hardest.title,
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
            <span className="award-winner">{card.text}</span>
          )}
          <span className="award-detail">{card.detail}</span>
        </li>
      ))}
    </ul>
  );
}
