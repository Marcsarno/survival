// MediaRecorder writes WebM files without a Duration, so browsers cannot show a seek bar for them.
// This inserts Segment > Info > Duration. Usage: node tools/webm-duration.mjs file.webm [seconds]
// Without seconds, the duration is read from the last cluster and block timecodes.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const ID = { EBML: 0x1a45dfa3, Segment: 0x18538067, Info: 0x1549a966, TimecodeScale: 0x2ad7b1, Duration: 0x4489, Cluster: 0x1f43b675, Timecode: 0xe7, SimpleBlock: 0xa3, BlockGroup: 0xa0 };

function readId(b, p) { let len = 1, m = 0x80; while (len <= 4 && !(b[p] & m)) { len++; m >>= 1; } let id = 0; for (let i = 0; i < len; i++) id = id * 256 + b[p + i]; return { id, len }; }
function readSize(b, p) {
  let len = 1, m = 0x80; while (len <= 8 && !(b[p] & m)) { len++; m >>= 1; }
  let v = b[p] & (m - 1), allOnes = v === m - 1;
  for (let i = 1; i < len; i++) { v = v * 256 + b[p + i]; if (b[p + i] !== 0xff) allOnes = false; }
  return { size: allOnes ? Infinity : v, len };
}
function uint(b, p, n) { let v = 0; for (let i = 0; i < n; i++) v = v * 256 + b[p + i]; return v; }

/** Duration in ms from the last cluster timecode plus the last block's relative timecode. */
function scanDuration(b, segStart, end) {
  let p = segStart, last = 0;
  while (p < end) {
    const { id, len } = readId(b, p); const s = readSize(b, p + len); const data = p + len + s.len;
    if (id === ID.Cluster) {
      let q = data, ctc = 0; const cend = s.size === Infinity ? end : data + s.size;
      while (q < cend) {
        const e = readId(b, q); const es = readSize(b, q + e.len); const d = q + e.len + es.len;
        if (e.id === ID.Cluster) break; // unknown-size cluster ends at the next cluster
        if (e.id === ID.Timecode) ctc = uint(b, d, es.size);
        if (e.id === ID.SimpleBlock) { const tn = readSize(b, d); const rel = (b[d + tn.len] << 8 | b[d + tn.len + 1]) << 16 >> 16; last = Math.max(last, ctc + rel); }
        q = d + es.size;
      }
      p = q; continue;
    }
    p = data + (s.size === Infinity ? 0 : s.size);
  }
  return last;
}

export function fixWebmDuration(file, seconds) {
  const b = fs.readFileSync(file);
  let p = 0;
  const h = readId(b, p); if (h.id !== ID.EBML) throw new Error('not a WebM file');
  const hs = readSize(b, p + h.len); p = p + h.len + hs.len + hs.size;
  const seg = readId(b, p); if (seg.id !== ID.Segment) throw new Error('no Segment');
  const ss = readSize(b, p + seg.len); const segData = p + seg.len + ss.len;
  let q = segData;
  while (q < b.length) {
    const e = readId(b, q); const es = readSize(b, q + e.len); const d = q + e.len + es.len;
    if (e.id === ID.Info) {
      let r = d, scale = 1e6;
      while (r < d + es.size) {
        const c = readId(b, r); const cs = readSize(b, r + c.len); const cd = r + c.len + cs.len;
        if (c.id === ID.Duration) { // already has one: overwrite it (e.g. a wrong value)
          const ms = seconds ? seconds * 1000 : scanDuration(b, segData, b.length);
          if (cs.size === 8) b.writeDoubleBE((ms * 1e6) / scale, cd); else b.writeFloatBE((ms * 1e6) / scale, cd);
          fs.writeFileSync(file, b); return ms / 1000;
        }
        if (c.id === ID.TimecodeScale) scale = uint(b, cd, cs.size);
        r = cd + cs.size;
      }
      const ms = seconds ? seconds * 1000 : scanDuration(b, segData, b.length);
      const dur = Buffer.alloc(11); dur[0] = 0x44; dur[1] = 0x89; dur[2] = 0x88; dur.writeDoubleBE((ms * 1e6) / scale, 3);
      const content = Buffer.concat([b.subarray(d, d + es.size), dur]);
      const size = Buffer.alloc(8); size[0] = 0x01; size.writeUIntBE(content.length, 2, 6);
      const out = Buffer.concat([b.subarray(0, q), b.subarray(q, q + e.len), size, content, b.subarray(d + es.size)]);
      fs.writeFileSync(file, out);
      return ms / 1000;
    }
    q = d + (es.size === Infinity ? 0 : es.size);
  }
  throw new Error('no Info element');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [file, secs] = process.argv.slice(2);
  const r = fixWebmDuration(file, secs ? +secs : undefined);
  console.log(file, `duration set to ${r.toFixed(2)} s`);
}
