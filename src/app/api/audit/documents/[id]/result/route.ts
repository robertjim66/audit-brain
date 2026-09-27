import { requireAuth } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import { loadResult } from '@/lib/parse/parseService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withHandler(async (req, ctx) => {
  await requireAuth(req);
  const [rows]: any = await db.query('SELECT * FROM audit_document WHERE id=? AND del_flag=0', [ctx.params.id]);
  if (rows.length === 0) throw new ApiError(404, '资料不存在');
  const doc = rows[0];
  const stored = loadResult(ctx.params.id);
  if (!stored) throw new ApiError(404, '解析结果不存在，请先解析', );

  const p: any = stored.parser || {};
  let data: any;
  if (stored.kind === 'excel') {
    data = {
      kind: 'excel',
      sheetCount: p.sheetCount,
      sheets: (p.sheets || []).map((s: any) => ({
        name: s.name, index: s.index, rowCount: s.rowCount, colCount: s.colCount,
        range: s.range, html: s.html, merges: s.merges,
      })),
    };
  } else if (stored.kind === 'word') {
    data = { kind: 'word', html: p.html, markdownText: p.markdownText, elements: p.elements, warnings: p.warnings };
  } else {
    const pageFilter = req.nextUrl.searchParams.get('page') ? Number(req.nextUrl.searchParams.get('page')) : null;
    let pages = (p.pages || []).map((pg: any) => ({
      pageNo: pg.pageNo,
      width: pg.width,
      height: pg.height,
      markdown: pg.markdown,
      localImage: pg.localImage || '',
      inputImage: pg.inputImage || '',
      blockImages: pg.blockImages || {},
      elements: (pg.elements || []).map((e: any) => ({
        index: e.index, label: e.label, elementType: e.elementType,
        content: e.content, bbox: e.bbox,
      })),
    }));
    if (pageFilter) pages = pages.filter((pg: any) => pg.pageNo === pageFilter);
    data = { kind: 'ocr', docType: p.docType, numPages: p.numPages, jobId: stored.ocrJobId, pages };
  }
  return ok({ document: doc, result: data });
});
