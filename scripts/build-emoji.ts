// Writes one Fluent Emoji SVG per entry of EMOJI_NAMES into src/client/public/emoji/.
// Runs before `dev` and `build`; the files are generated, not committed.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { getIconData, iconToHTML, iconToSVG } from '@iconify/utils';
import type { IconifyJSON } from '@iconify/types';
import { EMOJI_NAMES, emojiCode } from '../src/shared/emoji.ts';

const icons = createRequire(import.meta.url)('@iconify-json/fluent-emoji/icons.json') as IconifyJSON;
const outDir = path.resolve(import.meta.dirname, '../src/client/public/emoji');

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const missing: string[] = [];
for (const [char, name] of Object.entries(EMOJI_NAMES)) {
  const data = getIconData(icons, name);
  if (!data) {
    missing.push(`${char} ${name}`);
    continue;
  }
  const { attributes, body } = iconToSVG(data);
  // iconToHTML adds xmlns itself; a fixed size gives <img> a sane intrinsic size.
  const svg = iconToHTML(body, { ...attributes, width: '32', height: '32' });
  await writeFile(path.join(outDir, `${emojiCode(char)}.svg`), svg);
}

if (missing.length) {
  console.error(`Không tìm thấy trong Fluent Emoji: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`✓ ${Object.keys(EMOJI_NAMES).length} emoji → ${path.relative(process.cwd(), outDir)}`);
