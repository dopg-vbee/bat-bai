import { Emoji, EmojiText } from '../components/Emoji.tsx';

const STEPS: { art: string; title: string; text: string }[] = [
  {
    art: '📱',
    title: 'Vào phòng',
    text: 'Quét mã QR trên màn hình lớn, hoặc nhập mã phòng 4 số ở trang này. Đặt tên là chơi được.',
  },
  {
    art: '🎧',
    title: 'Nghe và đoán',
    text: 'Nghe đoạn lời bài hát, gõ tên bài vào điện thoại. Không cần gõ dấu. Sai thì đoán tiếp, không bị trừ điểm.',
  },
  {
    art: '🏆',
    title: 'Ghi điểm',
    text: 'Đúng càng nhanh càng nhiều điểm, từ 500 đến 1000. Sau mỗi câu có video đáp án và bảng xếp hạng.',
  },
  {
    art: '🎁',
    title: 'Thưởng thêm',
    // One bonus per line (the paragraph keeps line breaks).
    text: [
      '⚡ Câu x2: nhân đôi điểm.',
      '🎁 Hộp quà: thêm 100–300 điểm, người đang xếp sau dễ trúng hơn.',
      '🥷 Đôi khi hộp quà cướp 100–200 điểm của người đang đứng đầu.',
      '🔥 Đúng từ 3 câu liên tiếp: được cộng thêm.',
    ].join('\n'),
  },
  {
    art: '🤝',
    title: 'Chơi theo đội',
    text: 'Chọn đội ở sảnh chờ. Tùy host: điểm đội là trung bình cả đội, hoặc chỉ cần một người đúng là cả đội đúng.',
  },
];

/** The rules in a few lines, opened from the home page. */
export function HowToPlay() {
  return (
    <div className="card how-to-play">
      <h2>Hướng dẫn chơi</h2>
      <ol className="how-steps">
        {STEPS.map(({ art, title, text }) => (
          <li key={title}>
            <span className="how-step-art">
              <Emoji char={art} />
            </span>
            <div>
              <strong>{title}</strong>
              <p>
                <EmojiText text={text} />
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
