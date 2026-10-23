// Noto's animated WebPs loop forever. Rewriting the loop count in the ANIM chunk to 1 makes the
// browser play them once and rest on the last frame.

const blobs = new Map<string, Promise<Blob>>();

function setLoopCountToOne(buffer: ArrayBuffer): Blob {
  const view = new DataView(buffer);
  // RIFF header (12 bytes), then chunks: fourcc (4) + size (4, LE) + payload (padded to even).
  for (let offset = 12; offset + 8 <= view.byteLength; ) {
    const fourcc = String.fromCharCode(...new Uint8Array(buffer, offset, 4));
    const size = view.getUint32(offset + 4, true);
    if (fourcc === 'ANIM') {
      view.setUint16(offset + 8 + 4, 1, true); // payload: background colour (4), loop count (2)
      break;
    }
    offset += 8 + size + (size & 1);
  }
  return new Blob([buffer], { type: 'image/webp' });
}

/** The animation at `url`, patched to play once. Cached per URL; rejects if it can't be fetched. */
export function playOnceBlob(url: string): Promise<Blob> {
  let blob = blobs.get(url);
  if (!blob) {
    blob = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then(setLoopCountToOne);
    blobs.set(url, blob);
    blob.catch(() => blobs.delete(url));
  }
  return blob;
}
