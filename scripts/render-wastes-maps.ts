/**
 * One-shot overview renderer for authored Gingey Wastes missions.
 * Writes color minimaps to tmp/wastes-maps/*.png
 */
import { mkdirSync, writeFileSync } from "fs";
import { EXPEDITION_LOCATIONS } from "../shared/src/data/expedition";
import { EXPEDITION_MISSIONS } from "../shared/src/levels/expeditionLevels";

const COLORS: Record<string, [number, number, number]> = {
  "#": [28, 24, 22],
  " ": [28, 24, 22],
  ".": [72, 68, 58],
  ",": [86, 78, 64],
  _: [58, 62, 54],
  S: [70, 160, 255],
  E: [90, 220, 110],
  H: [220, 190, 60],
  K: [220, 120, 40],
  B: [200, 50, 50],
  "1": [180, 160, 40],
  "2": [180, 100, 30],
  "3": [160, 40, 40],
  A: [80, 180, 220],
  M: [80, 220, 140],
  b: [160, 110, 60],
  h: [140, 90, 70],
  p: [180, 70, 160],
  r: [120, 100, 80],
  s: [150, 80, 80],
  O: [255, 60, 60],
  N: [200, 180, 80],
  T: [200, 50, 50],
  G: [160, 140, 50],
  C: [255, 140, 40],
  R: [150, 120, 70],
  L: [255, 215, 90],
  V: [200, 60, 200],
  "4": [120, 80, 40],
};

function crcTable(): Uint32Array {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
}
const CRC = crcTable();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typ = Buffer.from(type);
  const crcBuf = Buffer.concat([typ, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf));
  return Buffer.concat([len, typ, data, crc]);
}

function deflateStore(data: Uint8Array): Buffer {
  const parts: Buffer[] = [];
  let off = 0;
  while (off < data.length) {
    const size = Math.min(65535, data.length - off);
    const last = off + size >= data.length;
    const header = Buffer.alloc(5);
    header[0] = last ? 1 : 0;
    header.writeUInt16LE(size, 1);
    header.writeUInt16LE(size ^ 0xffff, 3);
    parts.push(header, Buffer.from(data.subarray(off, off + size)));
    off += size;
  }
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]!) % 65521;
    b = (b + a) % 65521;
  }
  const adler = Buffer.alloc(4);
  adler.writeUInt32BE(((b << 16) | a) >>> 0);
  return Buffer.concat([Buffer.from([0x78, 0x01]), Buffer.concat(parts), adler]);
}

function writePng(
  path: string,
  w: number,
  h: number,
  rgba: (x: number, y: number) => [number, number, number],
): void {
  const scale = 4;
  const W = w * scale;
  const H = h * scale;
  const raw = new Uint8Array((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    const row = y * (W * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < W; x++) {
      const [r, g, b] = rgba(Math.floor(x / scale), Math.floor(y / scale));
      const i = row + 1 + x * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateStore(raw)),
    chunk("IEND", new Uint8Array()),
  ]);
  writeFileSync(path, png);
}

mkdirSync("tmp/wastes-maps", { recursive: true });
for (const [id, mission] of Object.entries(EXPEDITION_MISSIONS)) {
  const h = mission.rows.length;
  const w = Math.max(...mission.rows.map((r) => r.length));
  const loc = EXPEDITION_LOCATIONS[id as keyof typeof EXPEDITION_LOCATIONS];
  const out = `tmp/wastes-maps/${id}.png`;
  writePng(out, w, h, (x, y) => {
    const ch = mission.rows[y]?.[x] ?? "#";
    return COLORS[ch] ?? [110, 100, 85];
  });
  console.log(`${loc.name}: ${w}x${h} -> ${out}`);
}
