import { Gift, Music, Smartphone, Trophy, Users, type LucideIcon } from 'lucide-react';

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Smartphone,
    title: 'Vào phòng',
    text: 'Quét mã QR trên màn hình lớn, hoặc nhập mã phòng 4 số ở trang này. Đặt tên là chơi được.',
  },
  {
    icon: Music,
    title: 'Nghe và đoán',
    text: 'Nghe đoạn lời bài hát, gõ tên bài vào điện thoại. Không cần gõ dấu. Sai thì đoán tiếp, không bị trừ điểm.',
  },
  {
    icon: Trophy,
    title: 'Ghi điểm',
    text: 'Đúng càng nhanh càng nhiều điểm, từ 500 đến 1000. Sau mỗi câu có video đáp án và bảng xếp hạng.',
  },
  {
    icon: Gift,
    title: 'Thưởng thêm',
    text: 'Câu x2 được nhân đôi điểm. Hộp quà tặng thêm 100–300 điểm, người đang xếp sau dễ trúng hơn. Đúng từ 3 câu liên tiếp được cộng thêm.',
  },
  {
    icon: Users,
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
        {STEPS.map(({ icon: Icon, title, text }) => (
          <li key={title}>
            <Icon />
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
