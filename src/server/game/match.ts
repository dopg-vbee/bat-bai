/** Lowercase, no Vietnamese diacritics, punctuation collapsed to single spaces. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const compact = (text: string) => normalize(text).replace(/ /g, '');

/** "Lạc Trôi (Remix)" also accepts "Lạc Trôi"; "See Tình - Hoàng Thùy Linh" also accepts "See Tình". */
/** Computed once per title: every guess of the round is checked against the same forms. */
const formsCache = new Map<string, string[]>();
function acceptedForms(title: string): string[] {
  let forms = formsCache.get(title);
  if (!forms) {
    const variants = [title, title.replace(/\([^)]*\)|\[[^\]]*\]/g, ' '), title.split(/\s[-–—|]\s/)[0]];
    forms = [...new Set(variants.map(compact).filter(Boolean))];
    formsCache.set(title, forms);
  }
  return forms;
}

/** Typos forgiven grow with the answer length; short names must be exact. */
const allowedTypos = (length: number) => (length < 5 ? 0 : length < 9 ? 1 : length < 15 ? 2 : 3);

function levenshtein(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
}

/** A few more typos than allowed still earns a "so close" on the phone (still a wrong guess). */
const closeTypos = (length: number) => allowedTypos(length) + (length < 5 ? 1 : 2);
/** "lạc trôi sơn tùng" counts for "Lạc Trôi": extra words after a name this long are ignored. */
const PREFIX_MIN_LENGTH = 5;

export type GuessMatch = 'correct' | 'close' | 'wrong';

export function checkGuess(guess: string, title: string): GuessMatch {
  const attempt = compact(guess);
  if (!attempt) return 'wrong';
  let close = false;
  for (const form of acceptedForms(title)) {
    const max = allowedTypos(form.length);
    if (levenshtein(attempt, form, max) <= max) return 'correct';
    const startsWithName =
      form.length >= PREFIX_MIN_LENGTH &&
      attempt.length > form.length &&
      levenshtein(attempt.slice(0, form.length), form, max) <= max;
    if (startsWithName) return 'correct';
    // Half the name at least, so a stray letter or two isn't "close" to every short title.
    const near = closeTypos(form.length);
    if (attempt.length * 2 >= form.length && levenshtein(attempt, form, near) <= near) close = true;
  }
  return close ? 'close' : 'wrong';
}
