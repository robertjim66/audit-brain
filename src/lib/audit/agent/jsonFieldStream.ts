/**
 * 流式 JSON 字符串字段增量解码器。
 * 成稿阶段要求模型输出强约束 JSON（{"answer":"...",...}），但要让用户边生成边看到正文。
 * 本模块按字符推进状态机，只把 answer 字段「已确定完整」的部分吐出来，
 * 避免把半个转义序列（如结尾正好是 \ 或 \u4e2）渲染成乱码。
 */
interface FieldStreamer {
  push: (chunk: string) => string;
  value: () => string;
  isDone: () => boolean;
  reset: () => void;
}

export function createJsonFieldStreamer(field: string): FieldStreamer {
  const needle = new RegExp(`"${field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:\\s*"`);
  const ESC: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };

  let buf = '';
  let scan = 0;
  let pos = -1;
  let out = '';
  let pushed = 0;
  let done = false;

  function reset() {
    buf = ''; scan = 0; pos = -1; out = ''; pushed = 0; done = false;
  }

  function locate(): number {
    for (;;) {
      const m = needle.exec(buf.slice(scan));
      if (m) return scan + m.index + m[0].length;
      scan = Math.max(0, buf.length - 32);
      return -1;
    }
  }

  function decode(): number {
    let i = pos;
    for (; i < buf.length; i++) {
      const ch = buf[i];
      if (ch === '\\') {
        const next = buf[i + 1];
        if (next === undefined) break;
        if (next === 'u') {
          if (i + 6 > buf.length) break;
          const hex = buf.slice(i + 2, i + 6);
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            out += String.fromCharCode(parseInt(hex, 16));
            i += 5;
            pos = i + 1;
            continue;
          }
          out += 'u';
          i += 1;
          pos = i + 1;
          continue;
        }
        const mapped = ESC[next];
        if (mapped !== undefined) {
          out += mapped;
          i += 1;
          pos = i + 1;
          continue;
        }
        out += next;
        i += 1;
        pos = i + 1;
        continue;
      }
      if (ch === '"') {
        done = true;
        return i;
      }
      out += ch;
      pos = i + 1;
    }
    return i;
  }

  function push(chunk: string): string {
    if (done) return '';
    buf += chunk;
    if (pos < 0) {
      const at = locate();
      if (at < 0) {
        // 键名迟迟不出现就别再扫了，避免空转。让最终 answer 兜底。
        if (buf.length > 2000) done = true;
        return '';
      }
      pos = at;
    }
    decode();
    if (pos < 0) return '';
    const newly = out.slice(pushed);
    pushed = out.length;
    return newly;
  }

  function value(): string {
    return out;
  }

  function isDone(): boolean {
    return done;
  }

  return { push, value, isDone, reset };
}
