/**
 * 核对程序二：签证/合同三方签章证据链核对
 */
import db from '@/lib/db';
import snowflake from '@/lib/snowflake';
import { ApiError } from '@/lib/http';

const PARTIES = [
  { key: 'owner', name: '建设单位（发包人/甲方）', kw: /建设单位|发包人|建设方|委托单位|甲方/ },
  { key: 'supervisor', name: '监理单位（监理人）', kw: /监理单位|监理人|总监理工程师|监理方/ },
  { key: 'contractor', name: '施工单位（承包人/乙方）', kw: /施工单位|承包人|施工方|中标单位|乙方/ },
];

export async function runVisaCheck(projectId: string | number, userId: string | number): Promise<{ programId: string; summary: any }> {
  const [docs]: any = await db.query(
    "SELECT id, file_name, doc_type, biz_category FROM audit_document WHERE project_id=? AND del_flag=0 AND parse_status='done'",
    [projectId]
  );
  const sealDocs = docs.filter((d: any) =>
    ['contract', 'visa', 'settlement', 'payment'].includes(d.biz_category) ||
    (d.doc_type || '').includes('scan') ||
    (d.doc_type || '').includes('pdf')
  );
  const docIds = sealDocs.map((d: any) => String(d.id));
  if (!docIds.length) {
    throw new ApiError(400, '未找到合同/签证类已解析资料');
  }

  const [els]: any = await db.query(
    `SELECT id, document_id docId, page_no pageNo, element_type, content_md FROM audit_element
     WHERE project_id=? AND document_id IN (${docIds.map(() => '?').join(',')})`,
    [projectId, ...docIds]
  );
  const docName: Record<string, string> = {};
  docs.forEach((d: any) => { docName[String(d.id)] = d.file_name; });

  const pages = new Map<string, any>();
  els.forEach((e: any) => {
    const k = e.docId + '|' + e.pageNo;
    if (!pages.has(k)) pages.set(k, { docId: String(e.docId), pageNo: e.pageNo, seals: [], text: '' });
    const p = pages.get(k);
    if (e.element_type === 'seal') p.seals.push(String(e.content_md || '').replace(/\s+/g, ' '));
    else p.text += ' ' + String(e.content_md || '');
  });

  const [oldProgs]: any = await db.query("SELECT id FROM audit_check_program WHERE project_id=? AND program_type='visa_evidence' AND del_flag=0", [projectId]);
  for (const o of oldProgs) await db.query('UPDATE audit_check_item SET del_flag=1 WHERE program_id=?', [o.id]);
  await db.query("UPDATE audit_check_program SET del_flag=1 WHERE project_id=? AND program_type='visa_evidence' AND del_flag=0", [projectId]);

  const programId = String(snowflake.nextId());
  await db.query(
    'INSERT INTO audit_check_program (id, project_id, program_type, program_name, status, created_by) VALUES (?,?,?,?,?,?)',
    [programId, projectId, 'visa_evidence', '签证/合同三方签章证据链核对', 'running', userId]
  );

  const items: any[] = [];
  const signPages = [...pages.values()].filter((p) => p.seals.length > 0);

  for (const p of signPages) {
    const sealsText = p.seals.join(' ');
    for (const party of PARTIES) {
      const hasLine = party.kw.test(p.text);
      const sealCount = p.seals.length;
      let conclusion = 'match', desc = '', suggestion = '';
      if (hasLine && sealCount > 0) {
        conclusion = 'match';
        desc = `签字栏存在，本页共 ${sealCount} 枚签章`;
      } else if (hasLine && sealCount === 0) {
        conclusion = 'diff';
        desc = `正文有"${party.name}"签字栏，但本页未见任何签章`;
        suggestion = '有栏无章：疑似未签字盖章，需核实原件是否漏盖';
      } else if (!hasLine) {
        conclusion = 'diff';
        desc = `全文未见"${party.name}"签字栏，本页共 ${sealCount} 枚签章（未识别到该方会签）`;
        suggestion = '工程合同/签证通常需三方会签，建议核实该方是否应参与、是否漏签';
      }
      items.push({
        item_code: `${docName[p.docId] || 'doc'}·第${p.pageNo}页`,
        item_name: party.name,
        conclusion,
        diff_desc: desc,
        suggestion,
        evidence: {
          left: { docId: p.docId, fileName: docName[p.docId], pageNo: p.pageNo, sheetName: null, elementId: null },
          right: null,
        },
      });
    }
  }

  if (!signPages.length) {
    items.push({
      item_code: '全部资料', item_name: '三方签章',
      conclusion: 'diff',
      diff_desc: '已解析资料中未识别到任何印章要素',
      suggestion: '疑似合同/签证无盖章，或 OCR 未识别，需逐页人工核实',
      evidence: { left: null, right: null },
    });
  }

  let match = 0, diff = 0;
  for (const it of items) {
    if (it.conclusion === 'match') match++; else diff++;
    await db.query(
      `INSERT INTO audit_check_item
       (id, program_id, project_id, item_code, item_name, unit, left_label, right_label,
        qty_left, qty_right, price_left, price_right, amount_left, amount_right,
        diff_qty, diff_amount, conclusion, diff_desc, evidence_json, suggestion, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [String(snowflake.nextId()), programId, projectId, it.item_code, it.item_name, '', '资料原文', '签章识别',
        null, null, null, null, null, null,
        null, null, it.conclusion, it.diff_desc, JSON.stringify(it.evidence), it.suggestion, userId]
    );
  }

  const summary = {
    total: items.length, match, diff, unconfirmed: 0,
    onlyLeft: 0, onlyRight: 0,
    totalDiffAmount: 0, totalIncrease: 0, totalDecrease: 0,
    leftLabel: '资料原文', rightLabel: '签章识别',
    leftCount: signPages.length, rightCount: signPages.reduce((s: number, p: any) => s + p.seals.length, 0),
    signPageCount: signPages.length,
  };
  await db.query("UPDATE audit_check_program SET status='done', summary_json=? WHERE id=?", [JSON.stringify(summary), programId]);
  return { programId, summary };
}
