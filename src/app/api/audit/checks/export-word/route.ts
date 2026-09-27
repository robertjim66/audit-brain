import { requireAuth } from '@/lib/auth';
import { withHandler, ApiError } from '@/lib/http';
import { assertProject } from '@/lib/audit/guard';
import { buildFindingsDocx } from '@/lib/audit/exporters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withHandler(async (req) => {
  const auth = await requireAuth(req);
  const projectId = req.nextUrl.searchParams.get('project_id');
  if (!projectId) throw new ApiError(400, '缺少 project_id');
  await assertProject(projectId, auth.userId);

  const buf = await buildFindingsDocx(projectId);
  const fileName = encodeURIComponent(`疑点发现清单_${projectId}.docx`);
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename*=UTF-8''${fileName}`,
    },
  });
});
