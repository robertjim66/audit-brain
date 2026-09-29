/**
 * 核对结果导出：Excel 台账（xlsx）+ 发现清单（docx）。
 * 核对结果 / 疑点台账的文档导出（Word / Excel）结构定义与生成。
 */
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, BorderStyle } from 'docx';
import db from '@/lib/db';

const TYPE_LABEL: Record<string, string> = {
  no_seal: '签章异常/三无签证', no_photo: '缺少影像资料', qty_diff: '量差异常',
  round_amount: '凑整金额', late_visa: '集中/竣工后签证', duplicate: '重复计量',
  invoice_serial: '连号发票', other: '其他',
};
const STATUS_LABEL: Record<string, string> = { open: '待核实', confirmed: '已核实', misreport: '误报', closed: '已关闭' };
const CONCL_LABEL: Record<string, string> = { match: '一致', diff: '差异', unconfirmed: '无法确认' };

async function loadProjectData(projectId: string | number) {
  const [programs]: any = await db.query(
    "SELECT * FROM audit_check_program WHERE project_id=? AND del_flag=0 ORDER BY created_at DESC",
    [projectId]
  );
  const [items]: any = await db.query(
    "SELECT * FROM audit_check_item WHERE project_id=? AND del_flag=0 ORDER BY conclusion, id",
    [projectId]
  );
  const [findings]: any = await db.query(
    "SELECT * FROM audit_finding WHERE project_id=? AND del_flag=0 ORDER BY FIELD(risk_level,'high','mid','low'), id",
    [projectId]
  );
  // 每条疑点最近一次处置的处理人（内部台账用；对外 Word 清单不含此列）
  const { latestHandlers } = await import('@/lib/audit/dispose');
  const handlers = await latestHandlers(findings.map((f: any) => String(f.id)));
  return {
    programs: programs.map((p: any) => ({ ...p, summary: (() => { try { return JSON.parse(p.summary_json || '{}'); } catch { return {}; } })() })),
    items: items.map((i: any) => ({ ...i, evidence: (() => { try { return JSON.parse(i.evidence_json || '{}'); } catch { return {}; } })() })),
    findings: findings.map((f: any) => ({ ...f, handler: handlers[String(f.id)] || null })),
  };
}

export async function buildChecksWorkbook(projectId: string | number): Promise<Buffer> {
  const { programs, items, findings } = await loadProjectData(projectId);
  const wb = XLSX.utils.book_new();

  // 1. 汇总
  const summaryAoa: any[] = [['程序名称', '类型', '状态', '总数', '一致', '差异', '无法确认', '核增(元)', '核减(元)']];
  programs.forEach((p: any) => {
    const s = p.summary || {};
    summaryAoa.push([
      p.program_name, p.program_type, p.status, s.total || 0, s.match || 0, s.diff || 0, s.unconfirmed || 0,
      s.totalIncrease || 0, s.totalDecrease || 0,
    ]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryAoa), '汇总');

  // 2. 勾稽明细
  const itemAoa: any[] = [['编码/编号', '名称', '单位', '左工程量', '右工程量', '左单价', '右单价', '左合价', '右合价', '差异量', '差异额', '结论', '说明']];
  items.forEach((i: any) => {
    itemAoa.push([
      i.item_code, i.item_name, i.unit, i.qty_left, i.qty_right, i.price_left, i.price_right,
      i.amount_left, i.amount_right, i.diff_qty, i.diff_amount, CONCL_LABEL[i.conclusion] || i.conclusion,
      i.diff_desc || '',
    ]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(itemAoa), '清单勾稽明细');

  // 3. 签章核对（visa 类）
  const visaAoa: any[] = [['资料·页码', '方', '结论', '说明']];
  items.filter((i: any) => i.conclusion !== undefined && i.item_name && /建设单位|监理|施工/.test(i.item_name)).forEach((i: any) => {
    visaAoa.push([i.item_code, i.item_name, CONCL_LABEL[i.conclusion] || i.conclusion, i.diff_desc || '']);
  });
  if (visaAoa.length === 1) visaAoa.push(['（无签章核对记录）', '', '', '']);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(visaAoa), '签章核对');

  // 4. 疑点台账
  // 内部工作底稿：加「处理人 / 处置时间」两列，便于追溯责任
  const findAoa: any[] = [['类型', '标题', '风险', '描述', '建议', '金额', '证据位置', '状态', '处理人', '处置时间']];
  findings.forEach((f: any) => {
    const ev = (() => { try { return JSON.parse(f.evidence_json || '{}'); } catch { return {}; } })();
    const loc = [ev.left?.fileName, ev.left?.pageNo ? `第${ev.left.pageNo}页` : '', ev.right?.fileName].filter(Boolean).join('/');
    const h = f.handler;
    findAoa.push([
      TYPE_LABEL[f.finding_type] || f.finding_type, f.title, f.risk_level, f.description || '', f.suggestion || '',
      ev.amount != null ? ev.amount : '', loc, STATUS_LABEL[f.status] || f.status,
      h ? (h.nickname || h.username || '') : '',
      h && h.created_at ? String(h.created_at).slice(0, 16) : '',
    ]);
  });
  if (findAoa.length === 1) findAoa.push(['（暂无疑点）', '', '', '', '', '', '', '', '', '']);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(findAoa), '疑点台账');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function cell(text: string, bold = false): TableCell {
  return new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(text ?? ''), bold })] })] });
}

export async function buildFindingsDocx(projectId: string | number): Promise<Buffer> {
  const { findings } = await loadProjectData(projectId);
  const children: any[] = [
    new Paragraph({ text: '工程审计疑点发现清单', heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: `生成时间：${new Date().toLocaleString('zh-CN')}　共 ${findings.length} 条疑点`, spacing: { after: 200 } }),
  ];

  if (!findings.length) {
    children.push(new Paragraph({ text: '（本次扫描未发现疑点。）' }));
  } else {
    const header = new TableRow({
      tableHeader: true,
      children: ['类型', '风险', '疑点描述', '审计建议', '金额', '证据位置'].map((t) => cell(t, true)),
    });
    const rows = findings.map((f: any) => {
      const ev = (() => { try { return JSON.parse(f.evidence_json || '{}'); } catch { return {}; } })();
      const loc = [ev.left?.fileName, ev.left?.pageNo ? `P${ev.left.pageNo}` : '', ev.right?.fileName].filter(Boolean).join('/');
      return new TableRow({
        children: [
          cell(TYPE_LABEL[f.finding_type] || f.finding_type),
          cell(f.risk_level),
          cell(f.description || ''),
          cell(f.suggestion || ''),
          cell(ev.amount != null ? String(ev.amount) : ''),
          cell(loc),
        ],
      });
    });
    children.push(new Table({
      width: { size: 100, type: 'pct' } as any,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.SINGLE, size: 1 },
        left: { style: BorderStyle.SINGLE, size: 1 }, right: { style: BorderStyle.SINGLE, size: 1 },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1 }, insideVertical: { style: BorderStyle.SINGLE, size: 1 },
      },
      rows: [header, ...rows],
    }));
    children.push(new Paragraph({ text: '', spacing: { before: 200 } }));
    children.push(new Paragraph({ text: '复核与取证说明：以上疑点由系统依据资料解析结果与规则自动归集，需审计人员调阅原件进一步核实；风险等级为系统初判，不构成最终审计结论。' }));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
