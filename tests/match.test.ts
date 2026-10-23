import { describe, expect, it } from 'vitest';
import { checkGuess, normalize } from '../src/server/game/match.ts';
import { scoreFor } from '../src/server/game/room.ts';

describe('normalize', () => {
  it('strips Vietnamese diacritics, đ and punctuation', () => {
    expect(normalize('  Đừng Làm Trái Tim Anh Đau!! ')).toBe('dung lam trai tim anh dau');
    expect(normalize('Hãy Trao Cho Anh')).toBe('hay trao cho anh');
  });

  it('keeps non-Latin scripts', () => {
    expect(normalize('봄날 (Spring Day)')).not.toBe('');
  });
});

const isCorrect = (guess: string, title: string) => checkGuess(guess, title) === 'correct';

describe('checkGuess', () => {
  const title = 'Nơi Này Có Anh';

  it('accepts exact, unaccented, spacing and case variants', () => {
    expect(isCorrect('Nơi Này Có Anh', title)).toBe(true);
    expect(isCorrect('noi nay co anh', title)).toBe(true);
    expect(isCorrect('NOINAYCOANH', title)).toBe(true);
  });

  it('ignores upper/lower case and punctuation', () => {
    expect(isCorrect('NƠI NÀY CÓ ANH!!!', title)).toBe(true);
    expect(isCorrect('"nơi... này, có anh?"', title)).toBe(true);
    expect(isCorrect('Nơi-Này_Có~Anh', title)).toBe(true);
    expect(isCorrect('dont cry', "Don't Cry")).toBe(true);
    expect(isCorrect("DON’T CRY!", "Don't Cry")).toBe(true);
    expect(isCorrect('em cua ngay hom qua', 'Em Của Ngày Hôm Qua.')).toBe(true);
  });

  it('forgives small typos on long names', () => {
    expect(isCorrect('noi nay co ahn', title)).toBe(true);
    expect(isCorrect('noi nay co em', title)).toBe(false);
  });

  it('requires short names to be exact', () => {
    expect(isCorrect('Bống', 'Bông')).toBe(true); // diacritics ignored
    expect(isCorrect('Bang', 'Bông')).toBe(false);
  });

  it('accepts the name without parentheses or artist suffix', () => {
    expect(isCorrect('lac troi', 'Lạc Trôi (Triple D Remix)')).toBe(true);
    expect(isCorrect('see tinh', 'See Tình - Hoàng Thùy Linh')).toBe(true);
  });

  it('rejects empty and unrelated guesses', () => {
    expect(isCorrect('', title)).toBe(false);
    expect(isCorrect('!!!', title)).toBe(false);
    expect(isCorrect('Lạc Trôi', title)).toBe(false);
    expect(checkGuess('Lạc Trôi', title)).toBe('wrong');
  });

  it('accepts the name followed by extra words such as the artist', () => {
    expect(isCorrect('lạc trôi sơn tùng', 'Lạc Trôi')).toBe(true);
    expect(isCorrect('lac troj son tung mtp', 'Lạc Trôi')).toBe(true); // a typo in the name is still forgiven
    expect(isCorrect('bong dua', 'Bông')).toBe(false); // too short a name to take a prefix
    expect(isCorrect('noi nay', title)).toBe(false); // the start of the name is not enough
  });

  it('calls a guess a few typos or a word away close, still not correct', () => {
    expect(checkGuess('noi nay co em', title)).toBe('close');
    expect(checkGuess('noi nay co', title)).toBe('close');
    expect(checkGuess('Bang', 'Bông')).toBe('close');
    expect(checkGuess('no', title)).toBe('wrong'); // a couple of letters are close to nothing
    expect(checkGuess('hay trao cho anh', title)).toBe('wrong');
  });
});

describe('scoreFor', () => {
  it('slides from 1000 to 500 across the round', () => {
    expect(scoreFor(0, 30_000)).toBe(1000);
    expect(scoreFor(15_000, 30_000)).toBe(750);
    expect(scoreFor(30_000, 30_000)).toBe(500);
    expect(scoreFor(99_000, 30_000)).toBe(500);
  });
});
