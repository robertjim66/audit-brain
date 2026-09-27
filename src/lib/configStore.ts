import db from './db';

/**
 * 统一配置中心：sl_sys_config（namespace 分域，如 audit.ai / sys）
 * 读写统一走这里；30s 内存缓存，密钥字段(is_secret)对外脱敏。
 */

interface ConfigRow {
  namespace: string;
  config_key: string;
  config_value: string | null;
  value_type: string;
  is_secret: number;
  description: string | null;
  updated_at?: any;
}

const CACHE_TTL_MS = 30 * 1000;
const cache = new Map<string, { value: any; ts: number }>();

function cacheKey(namespace: string, key: string) {
  return `${namespace}::${key}`;
}

function decodeValue(row: ConfigRow): any {
  const raw = row.config_value;
  if (raw == null) return null;
  switch (row.value_type) {
    case 'number':
      return Number(raw);
    case 'boolean':
      return raw === 'true' || raw === '1';
    case 'json':
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    default:
      return raw;
  }
}

function encodeValue(value: any, valueType?: string): { v: string; t: string } {
  const t = valueType || (typeof value === 'object' ? 'json' : typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string');
  if (t === 'json') return { v: JSON.stringify(value), t };
  if (t === 'boolean') return { v: value ? 'true' : 'false', t };
  return { v: String(value), t };
}

export async function getConfig<T = any>(namespace: string, key: string, defaultValue?: T): Promise<T | undefined> {
  const ck = cacheKey(namespace, key);
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return hit.value;
  }
  const [rows]: any = await db.query(
    'SELECT * FROM sl_sys_config WHERE namespace = ? AND config_key = ?',
    [namespace, key]
  );
  if (rows.length === 0) {
    cache.set(ck, { value: defaultValue, ts: Date.now() });
    return defaultValue;
  }
  const decoded = decodeValue(rows[0] as ConfigRow);
  cache.set(ck, { value: decoded, ts: Date.now() });
  return decoded as T;
}

export async function getNamespace(namespace: string): Promise<Record<string, any>> {
  const [rows]: any = await db.query(
    'SELECT * FROM sl_sys_config WHERE namespace = ?',
    [namespace]
  );
  const out: Record<string, any> = {};
  for (const r of rows) {
    out[(r as ConfigRow).config_key] = decodeValue(r as ConfigRow);
  }
  return out;
}

export async function setConfig(
  namespace: string,
  key: string,
  value: any,
  opts?: { valueType?: string; isSecret?: boolean; description?: string; updatedBy?: string }
): Promise<void> {
  const { v, t } = encodeValue(value, opts?.valueType);
  await db.query(
    `INSERT INTO sl_sys_config (namespace, config_key, config_value, value_type, is_secret, description, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), value_type = VALUES(value_type),
       is_secret = VALUES(is_secret), description = VALUES(description), updated_by = VALUES(updated_by)`,
    [
      namespace,
      key,
      v,
      t,
      opts?.isSecret ? 1 : 0,
      opts?.description || null,
      opts?.updatedBy || null,
    ]
  );
  cache.delete(cacheKey(namespace, key));
}

/** 失效缓存：指定 namespace 或全部，下次读取即重载 */
export function reloadConfig(namespace?: string): void {
  if (!namespace) {
    cache.clear();
    return;
  }
  const prefix = `${namespace}::`;
  for (const k of cache.keys()) {
    if (k.startsWith(prefix)) cache.delete(k);
  }
}

function maskSecretValue(secret: string): string {
  const s = String(secret ?? '');
  if (!s) return '';
  if (s.length <= 8) return '****';
  return `${s.slice(0, 4)}****${s.slice(-4)}`;
}

interface ConfigEntry {
  key: string;
  type: string;
  secret: boolean;
  description: string;
  updatedAt?: any;
  value: any;
}

export async function describeNamespace(namespace: string, maskSecrets = true): Promise<{ namespace: string; items: ConfigEntry[] }> {
  const [rows]: any = await db.query(
    `SELECT config_key, config_value, value_type, is_secret, description, updated_at
     FROM sl_sys_config WHERE namespace = ?`,
    [namespace]
  );
  const items: ConfigEntry[] = rows.map((r: ConfigRow) => ({
    key: r.config_key,
    type: r.value_type,
    secret: !!r.is_secret,
    description: r.description || '',
    updatedAt: r.updated_at,
    value: r.is_secret && maskSecrets ? maskSecretValue(r.config_value || '') : decodeValue(r),
  }));
  return { namespace, items };
}

export async function listNamespaces(): Promise<Array<{ namespace: string; itemCount: number; lastUpdatedAt: any }>> {
  const [rows]: any = await db.query(
    `SELECT namespace, COUNT(*) AS item_count, MAX(updated_at) AS last_updated_at
     FROM sl_sys_config GROUP BY namespace ORDER BY namespace`
  );
  return rows.map((r: any) => ({
    namespace: r.namespace,
    itemCount: Number(r.item_count),
    lastUpdatedAt: r.last_updated_at,
  }));
}

export async function setManyConfig(
  namespace: string,
  entries: Array<{ key: string; value: any; type?: string; secret?: boolean; description?: string }>,
  opts?: { userId?: string; skipEmptySecrets?: boolean }
): Promise<string[]> {
  const skip = opts?.skipEmptySecrets !== false;
  const written: string[] = [];
  for (const item of entries) {
    if (!item || !item.key) continue;
    if (item.value === undefined) continue;
    const isEmpty = item.value === null || item.value === '';
    if (skip && isEmpty) {
      const existing = await getConfig<any>(namespace, item.key);
      if (item.secret || (existing && typeof existing === 'object')) continue;
    }
    await setConfig(namespace, item.key, item.value, {
      valueType: item.type,
      isSecret: item.secret,
      description: item.description,
      updatedBy: opts?.userId,
    });
    written.push(item.key);
  }
  return written;
}

export async function removeConfig(namespace: string, key: string): Promise<boolean> {
  const [res]: any = await db.query(
    'DELETE FROM sl_sys_config WHERE namespace = ? AND config_key = ?',
    [namespace, key]
  );
  cache.delete(cacheKey(namespace, key));
  return (res?.affectedRows || 0) > 0;
}

/** 对外输出：密钥字段脱敏 */
export function maskSecret(rows: ConfigRow[]): Array<Record<string, any>> {
  return rows.map((r) => ({
    namespace: r.namespace,
    config_key: r.config_key,
    config_value: r.is_secret ? '******' : r.config_value,
    value_type: r.value_type,
    is_secret: r.is_secret,
    description: r.description,
  }));
}
