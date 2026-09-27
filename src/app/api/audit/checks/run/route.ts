import { requireAuth } from '@/lib/auth';
import { ok, withHandler, ApiError } from '@/lib/http';
import db from '@/lib/db';
import { assertProject } from '@/lib/audit/guard';
import { runBoqCheck } from '@/lib/audit/boqCheck';
import { runVisaCheck } from '@/lib/audit/visaCheck';
import { runFindingScan } from '@/lib/audit/findingScan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withHandler(async (req) => {
  const auth = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  const projectId = body.project_id;
  if (!projectId) throw new ApiError(400, '缺少 project_id');
  await assertProject(projectId, auth.userId);

  const programType = body.program_type || 'boq_settlement';
  let result;
  if (programType === 'boq_settlement') result = await runBoqCheck(projectId, auth.userId);
  else if (programType === 'visa_evidence') result = await runVisaCheck(projectId, auth.userId);
  else { const e: any = new Error('不支持的核对类型'); e.status = 400; throw e; }

  let findings: any = null;
  try {
    findings = await runFindingScan(projectId, auth.userId);
  } catch (e: any) {
    console.error('[audit] 疑点扫描失败:', e?.message);
  }
  return ok({ programId: result.programId, summary: result.summary, findings });
});
