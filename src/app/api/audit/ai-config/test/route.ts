import { requireAdmin } from '@/lib/auth';
import { ok, withHandler } from '@/lib/http';
import { testChain } from '@/lib/arkClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 连通性测试（仅管理员）
export const POST = withHandler(async (req) => {
  await requireAdmin(req);
  const body = await req.json().catch(() => ({}));
  const result = await testChain(Number(body?.timeoutMs) > 0 ? Number(body.timeoutMs) : 30000);
  return ok(result);
});
