import { requireAdmin } from '@/lib/auth';
import { ok, withHandler } from '@/lib/http';
import { reload } from '@/lib/arkClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 清缓存重载（仅管理员）
export const POST = withHandler(async (req) => {
  await requireAdmin(req);
  reload();
  return ok({ ok: true });
});
