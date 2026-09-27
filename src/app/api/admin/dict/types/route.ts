import { requireAdmin } from '@/lib/auth';
import { ok, withHandler } from '@/lib/http';
import db from '@/lib/db';
import { ensureDictTable } from '@/lib/admin/ensure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withHandler(async (req) => {
  await requireAdmin(req);
  await ensureDictTable();
  const [rows]: any = await db.query(
    `SELECT DISTINCT dict_type FROM sl_sys_dict WHERE del_flag = 0 ORDER BY dict_type`
  );
  return ok(rows.map((r: any) => r.dict_type));
});
