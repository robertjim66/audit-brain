/**
 * 图形验证码（零第三方依赖）
 *
 * 设计取舍：
 * 1. 图片在**服务端**生成 —— 前端生成等于把答案交给客户端，等于没有验证码。
 * 2. PNG 手写编码（zlib 内置 + CRC32），不引入 canvas / 图形库，保持项目依赖克制。
 * 3. 字形用内置 5×7 点阵（0-9），不依赖系统字体，跨平台渲染一致。
 * 4. 答案**只存服务端内存**，token 里只有随机 jti ——
 *    若把答案塞进 JWT，前端 base64 解一下就能看见，验证码形同虚设。
 * 5. 一次性：校验过（无论成功或失败）立即失效，避免拿着一个验证码暴力撞库。
 *
 * 已知边界：答案存在进程内存，多实例部署或重启后旧验证码会失效
 * （用户点一下刷新即可）。如需多实例，可换成 Redis 或数据库存储。
 */
import zlib from 'node:zlib';
import { randomBytes, randomInt } from 'node:crypto';
import jwt from 'jsonwebtoken';

const WIDTH = 152;
const HEIGHT = 64;
const SCALE = 6;
const CODE_LEN = 4;
const TTL_MS = 5 * 60 * 1000; // 验证码有效期 5 分钟

/** 5×7 点阵字库：每行 5 bit，最高位为最左侧像素 */
const GLYPHS: Record<string, number[]> = {
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
};

// ============ PNG 编码 ============
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width: number, height: number, rgb: Buffer): Buffer {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type: None
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ============ 绘制 ============
function renderImage(code: string): Buffer {
  const px = Buffer.alloc(WIDTH * HEIGHT * 3);
  const setPx = (x: number, y: number, r: number, g: number, b: number) => {
    if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
    const i = (y * WIDTH + x) * 3;
    px[i] = r; px[i + 1] = g; px[i + 2] = b;
  };

  // 背景
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) setPx(x, y, 244, 246, 248);
  }

  // 噪点
  for (let i = 0; i < 320; i++) {
    const v = randomInt(190, 226);
    setPx(randomInt(0, WIDTH), randomInt(0, HEIGHT), v, v + randomInt(0, 6), v + randomInt(4, 12));
  }

  // 干扰线
  for (let i = 0; i < 3; i++) {
    let x = randomInt(0, Math.floor(WIDTH / 3));
    let y = randomInt(4, HEIGHT - 4);
    const step = randomInt(1, 3);
    const r = randomInt(150, 205), g = randomInt(160, 210), b = randomInt(170, 220);
    while (x < WIDTH) {
      setPx(x, y, r, g, b);
      setPx(x, y + 1, r, g, b);
      x += step;
      y += randomInt(-1, 2);
    }
  }

  // 字符：主色系深蓝，逐字随机深浅与垂直偏移，轻微右倾模拟手写抖动
  let x0 = 14;
  for (const ch of code) {
    const glyph = GLYPHS[ch];
    if (!glyph) { x0 += 5 * SCALE + 6; continue; }
    const y0 = 9 + randomInt(0, 7);
    const tone = randomInt(0, 40);
    const r = 18 + tone, g = 58 + tone, b = 96 + tone;
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (!(glyph[row] & (1 << (4 - col)))) continue;
        const skew = Math.floor(row / 3);
        const bx = x0 + col * SCALE + skew;
        const by = y0 + row * SCALE;
        for (let dy = 0; dy < SCALE - 1; dy++) {
          for (let dx = 0; dx < SCALE - 1; dx++) setPx(bx + dx, by + dy, r, g, b);
        }
      }
    }
    x0 += 5 * SCALE + 6;
  }

  // 边框
  for (let x = 0; x < WIDTH; x++) { setPx(x, 0, 214, 219, 226); setPx(x, HEIGHT - 1, 214, 219, 226); }
  for (let y = 0; y < HEIGHT; y++) { setPx(0, y, 214, 219, 226); setPx(WIDTH - 1, y, 214, 219, 226); }

  return encodePng(WIDTH, HEIGHT, px);
}

// ============ 答案存储（进程内存，一次性） ============
interface Entry { code: string; exp: number }
const store = new Map<string, Entry>();

function purgeExpired(now = Date.now()) {
  for (const [k, v] of store) if (v.exp <= now) store.delete(k);
}

function getSecret(): string {
  return process.env.JWT_SECRET || 'dev-captcha-secret';
}

/** 生成验证码：返回可直接用于 <img src> 的 dataURL，以及配套的短期 token */
export function createCaptcha(): { token: string; image: string } {
  purgeExpired();
  let code = '';
  for (let i = 0; i < CODE_LEN; i++) code += String(randomInt(0, 10));
  const jti = randomBytes(16).toString('hex');
  store.set(jti, { code, exp: Date.now() + TTL_MS });
  const token = jwt.sign({ jti, typ: 'captcha' }, getSecret(), { expiresIn: '5m' });
  const image = `data:image/png;base64,${renderImage(code).toString('base64')}`;
  return { token, image };
}

export type CaptchaResult = { ok: true } | { ok: false; reason: 'missing' | 'invalid' | 'expired' };

/**
 * 校验验证码。
 * 无论成功或失败，被校验过的 token 立即失效 —— 防止拿同一个验证码反复撞库。
 */
export function verifyCaptcha(input: string | undefined, token: string | undefined): CaptchaResult {
  if (!input || !token) return { ok: false, reason: 'missing' };
  let payload: any;
  try {
    payload = jwt.verify(token, getSecret());
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  const jti = String(payload?.jti || '');
  if (!jti || payload?.typ !== 'captcha') return { ok: false, reason: 'invalid' };
  const entry = store.get(jti);
  if (!entry) return { ok: false, reason: 'expired' };
  // 一次性：取出即销毁
  store.delete(jti);
  if (entry.exp <= Date.now()) return { ok: false, reason: 'expired' };
  if (String(input).trim() !== entry.code) return { ok: false, reason: 'invalid' };
  return { ok: true };
}
