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
  '💯': 'hundred-points',
  '⚡': 'high-voltage',
  '🎁': 'wrapped-gift',
  '🔥': 'fire',
  '😅': 'grinning-face-with-sweat',
  // Gift boxes that borrow points from the leader
  '💸': 'money-with-wings',
  '😱': 'face-screaming-in-fear',
  // Reactions thrown at the big screen
  '👍': 'thumbs-up',
  '❤️': 'red-heart',
  // Team badges (❤️ above is the red team)
  '💙': 'blue-heart',
  '💛': 'yellow-heart',
  '💜': 'purple-heart',
  '💚': 'green-heart',
  '🧡': 'orange-heart',
  '🩷': 'pink-heart',
  '🩵': 'light-blue-heart',
  '🤎': 'brown-heart',
  '🩶': 'grey-heart',
  '😆': 'grinning-squinting-face',
  '👏': 'clapping-hands',
  '😮': 'face-with-open-mouth',
  // Inside sentences
  '🤔': 'thinking-face',
  '😄': 'grinning-face-with-smiling-eyes',
  '😉': 'winking-face',
  '👀': 'eyes',
  '🎧': 'headphone',
  '📺': 'television',
  // The game is over
  '🏁': 'chequered-flag',
  // How-to-play pictures
  '📱': 'mobile-phone',
  '🤝': 'handshake',
};

export const AVATARS = Object.keys(EMOJI_NAMES).slice(0, Object.keys(EMOJI_NAMES).indexOf('🥇'));

/** "🐿️" → "1f43f" (the variation selector FE0F is dropped). */
export const emojiCode = (char: string) =>
  [...char]
    .map((c) => c.codePointAt(0)!.toString(16))
    .filter((cp) => cp !== 'fe0f')
    .join('-');

export const emojiUrl = (char: string) => `/emoji/${emojiCode(char)}.svg`;

/**
 * The reactions' Noto animations shrunk to 128px (in src/client/public/reactions/): a few dozen fly at once,
 * and decoding six 512px originals every frame made the big screen stutter.
 */
export const reactionAnimationUrl = (char: string) => `/reactions/${emojiCode(char)}.webp`;

/** Google Noto animated emoji (animated WebP), used for the big celebration moments. */
export const animatedEmojiUrl = (char: string) =>
  `https://fonts.gstatic.com/s/e/notoemoji/latest/${emojiCode(char)}/512.webp`;
