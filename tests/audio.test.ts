import { describe, expect, it } from 'vitest';
import { AudioError, prepareMp3 } from '../src/server/audio.ts';
import { fakeMp3 } from './helpers.ts';

describe('prepareMp3', () => {
  it('strips ID3v2 tags so the title cannot leak', () => {
    const input = fakeMp3({ id3Title: 'Lac Troi' });
    const output = prepareMp3(input);
    expect(output.includes(Buffer.from('Lac Troi'))).toBe(false);
    expect(output.equals(fakeMp3())).toBe(true);
  });

  it('strips an ID3v1 tag at the end', () => {
    const tag = Buffer.alloc(128);
    tag.write('TAGSecret Song', 'latin1');
    const output = prepareMp3(Buffer.concat([fakeMp3(), tag]));
    expect(output.includes(Buffer.from('Secret Song'))).toBe(false);
  });

  it('skips leading junk before the first frame', () => {
    const output = prepareMp3(Buffer.concat([Buffer.alloc(300), fakeMp3()]));
    expect(output[0]).toBe(0xff);
    expect(output.length).toBe(fakeMp3().length);
  });

  it('rejects files that are not MP3', () => {
    expect(() => prepareMp3(Buffer.from('RIFF....WAVEfmt '.repeat(100)))).toThrow(AudioError);
    expect(() => prepareMp3(Buffer.from('hello world'))).toThrow(AudioError);
    expect(() => prepareMp3(Buffer.alloc(0))).toThrow(AudioError);
  });
});
