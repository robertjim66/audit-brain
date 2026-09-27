/**
 * 审计表格工具
 * 把 OCR/Excel 产出的 HTML <table> 解析为行列矩阵，正确处理 rowspan/colspan，
 * 并提供按列取值与数值清洗。
 */

export function cleanCell(html: any): string {
  return String(html == null ? '' : html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ ]+/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export function htmlTableToRows(html: string): { rows: string[][]; rowCount: number; colCount: number } {
  if (!html || !/<table/i.test(html)) return { rows: [], rowCount: 0, colCount: 0 };
  const tableHtml = html.match(/<table[\s\S]*?<\/table>/i)?.[0] || html;
  const trList = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const grid: any[] = [];
  const OCC = { __occ: true };

  trList.forEach((trHtml: string, r: number) => {
    if (!grid[r]) grid[r] = [];
    let c = 0;
    const cells = trHtml.match(/<(td|th)[\s\S]*?<\/\1>/gi) || [];
    cells.forEach((cellHtml: string) => {
      while (grid[r][c] === OCC || (grid[r][c] && grid[r][c].__occ)) c++;
      const rs = Math.max(1, parseInt((cellHtml.match(/rowspan\s*=\s*["']?(\d+)/i) || [])[1], 10) || 1);
      const cs = Math.max(1, parseInt((cellHtml.match(/colspan\s*=\s*["']?(\d+)/i) || [])[1], 10) || 1);
      const text = cleanCell(cellHtml);
      for (let dr = 0; dr < rs; dr++) {
        for (let dc = 0; dc < cs; dc++) {
          const rr = r + dr, cc = c + dc;
          if (!grid[rr]) grid[rr] = [];
          grid[rr][cc] = dr === 0 && dc === 0 ? text : OCC;
        }
      }
      c += cs;
    });
  });

  const rows: string[][] = [];
  const colCount = grid.reduce((m, row) => Math.max(m, row.length), 0);
  grid.forEach((row, r) => {
    const out: string[] = [];
    for (let c = 0; c < colCount; c++) {
      let v = row[c];
      if (v === undefined || (v && v.__occ)) {
        v = r > 0 ? rows[r - 1][c] : '';
      }
      out.push(typeof v === 'string' ? v : '');
    }
    rows.push(out);
  });
  return { rows, rowCount: rows.length, colCount };
}

export function toNumber(text: any): number | null {
  if (text == null) return null;
  let s = String(text).trim();
  if (!s) return null;
  let neg = false;
  if (/^[（(].*[)）]$/.test(s)) { neg = true; s = s.slice(1, -1); }
  const m = s.replace(/[,，]/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  if (Number.isNaN(n)) return null;
  return neg ? -n : n;
}

export function locateColumns(rows: string[][], _nameKeywords: string[] = [], _codeKeywords: string[] = []): { headerRow: number; columns: Record<string, number | null> } {
  const result: { headerRow: number; columns: Record<string, number | null> } = { headerRow: -1, columns: {} };
  let best = -1, bestScore = 0;
  rows.forEach((row, i) => {
    if (i > Math.min(8, rows.length - 1)) return;
    let score = 0;
    const map: Record<string, number> = {};
    row.forEach((cell, c) => {
      const t = String(cell).replace(/\s/g, '');
      if (/序号|编号|编码/.test(t)) { map.code = c; score++; }
      if (/名称|分项名称|子目|项目名称/.test(t)) { map.name = c; score++; }
      if (/单位/.test(t)) { map.unit = c; score++; }
      if (/工程量|数量/.test(t)) { map.qty = c; score++; }
      if (/综合单价|单价/.test(t)) { map.price = c; score++; }
      if (/合价|金额|总价/.test(t)) { map.amount = c; score++; }
    });
    if (score > bestScore) { bestScore = score; best = i; result.columns = map; }
  });
  result.headerRow = best;
  return result;
}

export function rowsToCsv(rows: string[][]): string {
  return rows.map(r => r.map(c => {
    const s = String(c == null ? '' : c).replace(/\s*\n\s*/g, ' ');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\n');
}
