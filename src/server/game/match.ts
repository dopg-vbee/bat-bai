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
function acceptedForms(title: string): string[] {
  const forms = [title, title.replace(/\([^)]*\)|\[[^\]]*\]/g, ' '), title.split(/\s[-–—|]\s/)[0]];
  return [...new Set(forms.map(compact).filter(Boolean))];
}

/** Typos forgiven grow with the answer length; short names must be exact. */
const allowedTypos = (length: number) => (length < 5 ? 0 : length < 9 ? 1 : length < 15 ? 2 : 3);

export function levenshtein(a: string, b: string, max = Infinity): number {
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

export function isCorrect(guess: string, title: string): boolean {
  const attempt = compact(guess);
  if (!attempt) return false;
  return acceptedForms(title).some((form) => {
    const max = allowedTypos(form.length);
    return levenshtein(attempt, form, max) <= max;
  });
}
