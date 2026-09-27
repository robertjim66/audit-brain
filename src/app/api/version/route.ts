import { ok } from '@/lib/http';

export const runtime = 'nodejs';

export const GET = async () => {
  return ok({
    name: '审计智脑 AuditBrain',
    version: '1.0.0',
    time: new Date().toISOString(),
  });
};
