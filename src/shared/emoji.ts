/**
 * Every emoji the app draws, mapped to its Microsoft Fluent Emoji name (Iconify "fluent-emoji" set).
 * `npm run emoji` turns these into SVG files under src/client/public/emoji/; add a line here to use a new one.
 */
export const EMOJI_NAMES: Record<string, string> = {
  // Player avatars
  '🐶': 'dog-face',
  '🐱': 'cat-face',
  '🐭': 'mouse-face',
  '🐹': 'hamster',
  '🐰': 'rabbit-face',
  '🦊': 'fox',
  '🐻': 'bear',
  '🐼': 'panda',
  '🐨': 'koala',
  '🐯': 'tiger-face',
  '🦁': 'lion',
  '🐮': 'cow-face',
  '🐷': 'pig-face',
  '🐸': 'frog',
  '🐵': 'monkey-face',
  '🐔': 'chicken',
  '🐧': 'penguin',
  '🐤': 'baby-chick',
  '🦆': 'duck',
  '🦉': 'owl',
  '🐺': 'wolf',
  '🐴': 'horse-face',
  '🦄': 'unicorn',
  '🐝': 'honeybee',
  '🦋': 'butterfly',
  '🐞': 'lady-beetle',
  '🐢': 'turtle',
  '🐙': 'octopus',
  '🦀': 'crab',
  '🐬': 'dolphin',
  '🐳': 'spouting-whale',
  '🦈': 'shark',
  '🦓': 'zebra',
  '🦒': 'giraffe',
  '🦔': 'hedgehog',
  '🐲': 'dragon-face',
  '🌵': 'cactus',
  '🍄': 'mushroom',
  '🌻': 'sunflower',
  '🍉': 'watermelon',
  '🍕': 'pizza',
  '🍩': 'doughnut',
  '🎃': 'jack-o-lantern',
  '👻': 'ghost',
  '👽': 'alien',
  '🤖': 'robot',
  '🦩': 'flamingo',
  '🦜': 'parrot',
  '🐌': 'snail',
  '🦖': 't-rex',
  '🐿️': 'chipmunk',
  // Medals and moments
  '🥇': '1st-place-medal',
  '🥈': '2nd-place-medal',
  '🥉': '3rd-place-medal',
  '🏆': 'trophy',
  '🎉': 'party-popper',
  '🥳': 'partying-face',
  '😅': 'grinning-face-with-sweat',
  // Inside sentences
  '🤔': 'thinking-face',
  '😄': 'grinning-face-with-smiling-eyes',
  '😉': 'winking-face',
  '👀': 'eyes',
  '🎧': 'headphone',
  '📺': 'television',
};

export const AVATARS = Object.keys(EMOJI_NAMES).slice(0, Object.keys(EMOJI_NAMES).indexOf('🥇'));

/** "🐿️" → "1f43f" (the variation selector FE0F is dropped). */
export const emojiCode = (char: string) =>
  [...char]
    .map((c) => c.codePointAt(0)!.toString(16))
    .filter((cp) => cp !== 'fe0f')
    .join('-');

export const emojiUrl = (char: string) => `/emoji/${emojiCode(char)}.svg`;

/** Google Noto animated emoji (animated WebP), used for the big celebration moments. */
export const animatedEmojiUrl = (char: string) =>
  `https://fonts.gstatic.com/s/e/notoemoji/latest/${emojiCode(char)}/512.webp`;
