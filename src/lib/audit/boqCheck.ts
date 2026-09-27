/**
 * 核对程序一：清单 ↔ 结算（控制价）跨页表勾稽
 * 按清单编码首次出现为主项，逐项比工程量/综合单价/合价，落 audit_check_program + audit_check_item。
 */
import db from '@/lib/db';
import snowflake from '@/lib/snowflake';
import { htmlTableToRows, locateColumns, toNumber, cleanCell } from '@/lib/parse/tableUtils';

const CODE_RE = /\d{9,13}/;
const EPS = 0.01;
const QTY_REL = 0.01;

function extractLines(els: any[], side: string): any[] {
  const out: any[] = [];
  for (const el of els) {
    const { rows } = htmlTableToRows(el.content_md || '');
    if (!rows.length) continue;
    const { columns } = locateColumns(rows);
    if (!columns.code || !columns.name) continue;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] || [];
      const rawCode = cleanCell(row[columns.code] || '').replace(/\s/g, '');
      const m = rawCode.match(CODE_RE);
      if (!m) continue;
      const code = m[0];
      out.push({
        code,
        name: cleanCell(row[columns.name] || '').replace(/\s+/g, ' ').slice(0, 80),
        unit: columns.unit != null ? cleanCell(row[columns.unit]) : '',
        qty: columns.qty != null ? toNumber(row[columns.qty]) : null,
        price: columns.price != null ? toNumber(row[columns.price]) : null,
        amount: columns.amount != null ? toNumber(row[columns.amount]) : null,
        side,
        elementId: String(el.id),
        docId: String(el.docId),
        pageNo: el.page_no,
        sheetName: el.sheet_name || null,
      });
    }
  }
  const map = new Map<string, any>();
  for (const l of out) if (!map.has(l.code)) map.set(l.code, l);
  return [...map.values()];
}

export async function runBoqCheck(projectId: string | number, userId: string | number): Promise<{ programId: string; summary: any }> {
  const [xls]: any = await db.query(
    "SELECT id, document_id docId, sheet_name sheetName, page_no pageNo, content_md content_md FROM audit_element WHERE project_id=? AND element_type='table' AND sheet_name LIKE '%分部分项%'",
    [projectId]
  );
  const [pdf]: any = await db.query(
    `SELECT id, document_id docId, sheet_name sheetName, page_no pageNo, content_md content_md FROM audit_element
      WHERE project_id=? AND element_type='table'
        AND anchor_label LIKE '%分部分项%'
        AND (anchor_label LIKE '%计价%' OR anchor_label LIKE '%结算%' OR anchor_label LIKE '%清单%')`,
    [projectId]
  );
  if (!xls.length && !pdf.length) {
    const e: any = new Error('未在资料中识别到"分部分项"清单/结算表，请先完成资料解析');
    e.status = 400; throw e;
  }

  const left = extractLines(xls, 'left');
  const right = extractLines(pdf, 'right');
  const lmap = new Map(left.map((l) => [l.code, l]));
  const rmap = new Map(right.map((l) => [l.code, l]));

  const [docs]: any = await db.query('SELECT id, file_name FROM audit_document WHERE project_id=?', [projectId]);
  const docName: Record<string, string> = {};
  docs.forEach((d: any) => { docName[String(d.id)] = d.file_name; });

  const leftLabel = xls.length ? 'Excel 清单' : '清单资料';
  const rightLabel = pdf.length ? '结算/控制价资料' : '结算资料';

  const [oldProgs]: any = await db.query("SELECT id FROM audit_check_program WHERE project_id=? AND program_type='boq_settlement' AND del_flag=0", [projectId]);
  for (const o of oldProgs) await db.query('UPDATE audit_check_item SET del_flag=1 WHERE program_id=?', [o.id]);
  await db.query("UPDATE audit_check_program SET del_flag=1 WHERE project_id=? AND program_type='boq_settlement' AND del_flag=0", [projectId]);

  const programId = String(snowflake.nextId());
  await db.query(
    'INSERT INTO audit_check_program (id, project_id, program_type, program_name, status, created_by) VALUES (?,?,?,?,?,?)',
    [programId, projectId, 'boq_settlement', '清单↔结算跨页表勾稽', 'running', userId]
  );

  const codes = new Set([...lmap.keys(), ...rmap.keys()]);
  let match = 0, diff = 0, unconfirmed = 0, onlyLeft = 0, onlyRight = 0;
  let totalDiffAmount = 0, totalIncrease = 0, totalDecrease = 0;
  const items: any[] = [];
  const comparable = left.length > 0 && right.length > 0;

  for (const code of codes) {
    const l = lmap.get(code), r = rmap.get(code);
    const item: any = {
      item_code: code,
      item_name: (l && l.name) || (r && r.name) || '',
      unit: (l && l.unit) || (r && r.unit) || '',
      left_label: leftLabel, right_label: rightLabel,
      qty_left: l ? l.qty : null, qty_right: r ? r.qty : null,
      price_left: l ? l.price : null, price_right: r ? r.price : null,
      amount_left: l ? l.amount : null, amount_right: r ? r.amount : null,
      diff_qty: null, diff_amount: null, conclusion: 'unconfirmed', diff_desc: null, suggestion: null,
      evidence: {
        left: l ? { docId: l.docId, fileName: docName[l.docId], pageNo: l.pageNo, sheetName: l.sheetName, elementId: l.elementId } : null,
        right: r ? { docId: r.docId, fileName: docName[r.docId], pageNo: r.pageNo, sheetName: r.sheetName, elementId: r.elementId } : null,
      },
    };

    if (!comparable) {
      unconfirmed++;
      item.conclusion = 'unconfirmed';
      item.diff_desc = left.length === 0
        ? `未从左方（${leftLabel}）提取到可比对的清单项，无法确认该编码是否存在差异`
        : `未从右方（${rightLabel}）提取到可比对的清单项，无法确认该编码是否存在差异`;
      item.suggestion = left.length === 0
        ? '补充或重新解析清单（Excel）资料后重新核对'
        : '补充或重新解析结算/控制价资料后重新核对';
      items.push(item);
      continue;
    }

    if (l && r) {
      if (l.qty == null && r.qty == null && l.price == null && r.price == null && l.amount == null && r.amount == null) {
        unconfirmed++;
        item.conclusion = 'unconfirmed';
        item.diff_desc = '两侧均未解析出工程量/综合单价/合价，无法确认是否存在差异';
        item.suggestion = '提高原件清晰度或人工补录关键数值后重新核对';
        items.push(item);
        continue;
      }
      const qd = (l.qty != null && r.qty != null) ? l.qty - r.qty : null;
      const ad = (l.amount != null && r.amount != null) ? r.amount - l.amount : null;
      const qtyOk = qd == null || Math.abs(qd) <= Math.max(EPS, Math.abs(r.qty) * QTY_REL);
      const priceOk = (l.price == null || r.price == null) || Math.abs((l.price ?? 0) - (r.price ?? 0)) <= EPS;
      const amtOk = (l.amount == null || r.amount == null) || Math.abs((l.amount ?? 0) - (r.amount ?? 0)) <= EPS;
      item.diff_qty = qd;
      item.diff_amount = ad;
      if (qtyOk && priceOk && amtOk) {
        item.conclusion = 'match'; match++;
      } else {
        item.conclusion = 'diff'; diff++;
        const parts: string[] = [];
        if (!qtyOk) parts.push(`工程量 ${l.qty} vs ${r.qty}（差 ${qd}）`);
        if (priceOk === false) parts.push(`综合单价 ${l.price} vs ${r.price}`);
        if (amtOk === false) parts.push(`合价 ${l.amount} vs ${r.amount}（差 ${ad}）`);
        item.diff_desc = parts.join('；');
        item.suggestion = '核对该清单项工程量/单价/合价差异原因，确认是否多计少计';
        if (ad != null) { totalDiffAmount += Math.abs(ad); if (ad > 0) totalIncrease += ad; else totalDecrease += -ad; }
      }
    } else if (l) {
      onlyLeft++;
      item.conclusion = 'diff'; diff++;
      item.diff_desc = `右方（${rightLabel}）未见该编码清单项，左方有金额 ${l.amount}`;
      item.suggestion = '核实是否右方漏项或左方多计';
    } else {
      onlyRight++;
      item.conclusion = 'diff'; diff++;
      item.diff_desc = `左方（${leftLabel}）未见该编码清单项，右方有金额 ${r.amount}`;
      item.suggestion = '核实是否左方清单遗漏（如漏计单位工程）';
    }
    items.push(item);
  }

  for (const it of items) {
    await db.query(
      `INSERT INTO audit_check_item
       (id, program_id, project_id, item_code, item_name, unit, left_label, right_label,
        qty_left, qty_right, price_left, price_right, amount_left, amount_right,
        diff_qty, diff_amount, conclusion, diff_desc, evidence_json, suggestion, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [String(snowflake.nextId()), programId, projectId, it.item_code, it.item_name, it.unit, it.left_label, it.right_label,
        it.qty_left, it.qty_right, it.price_left, it.price_right, it.amount_left, it.amount_right,
        it.diff_qty, it.diff_amount, it.conclusion, it.diff_desc, JSON.stringify(it.evidence), it.suggestion, userId]
    );
  }

  const summary = {
    total: items.length, match, diff, unconfirmed, onlyLeft, onlyRight,
    totalDiffAmount: Math.round(totalDiffAmount * 100) / 100,
    totalIncrease: Math.round(totalIncrease * 100) / 100,
    totalDecrease: Math.round(totalDecrease * 100) / 100,
    leftLabel, rightLabel,
    leftCount: left.length, rightCount: right.length,
  };
  await db.query("UPDATE audit_check_program SET status='done', summary_json=? WHERE id=?", [JSON.stringify(summary), programId]);
  return { programId, summary };
}
