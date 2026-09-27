import mysql from 'mysql2/promise';

// 数据库配置 - 优先使用环境变量（Next.js 自动加载 .env）
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ai_audit',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  // BIGINT(雪花ID，18位) 以字符串返回，避免 JS Number 精度丢失
  supportBigNumbers: true,
  bigNumberStrings: true,
  // 远程 RDS 场景：开启 TCP keep-alive，防止空闲连接被静默掐断
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
};

// 注意：不在启动期强制退出。数据库连接在请求级按需建立，不可用时由 mysql2 抛出并被
// 路由层的 withHandler 统一转换为 500 结构化错误；这样即便 DB 暂未配置/短暂不可用，
// 服务也能正常启动与对外提供静态资源与无 DB 的接口。
if (process.env.NODE_ENV === 'production' && !process.env.DB_HOST) {
  console.warn('⚠️  未配置数据库连接(DB_HOST)，涉及数据库的接口将在请求时返回错误');
}
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.warn('⚠️  未设置 JWT_SECRET，登录/鉴权将不可用（开发期会生成临时密钥）');
}

const pool = mysql.createPool(dbConfig);

pool.on('connection', (conn) => {
  conn.on('error', (err) => {
    console.error('[mysql connection error]', err.code, err.message);
  });
});

const CONN_ERROR_CODES = new Set([
  'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT', 'ECONNRESET', 'EPIPE', 'ENOTFOUND',
]);

function isReadOnly(sql: string): boolean {
  const head = String(sql).trimStart().toUpperCase();
  return head.startsWith('SELECT') || head.startsWith('SHOW') ||
         head.startsWith('DESC') || head.startsWith('EXPLAIN');
}

async function queryWithRetry(sql: string, params?: any, attempt = 0): Promise<[any, any]> {
  try {
    return await pool.query(sql, params);
  } catch (err: any) {
    if (attempt < 1 && err && CONN_ERROR_CODES.has(err.code) && isReadOnly(sql)) {
      console.warn('[mysql] 查询遇到连接错误，自动重试一次:', err.code);
      return queryWithRetry(sql, params, attempt + 1);
    }
    throw err;
  }
}

const db = {
  query: queryWithRetry,
  execute: (...args: any[]) => (pool as any).execute(...args),
  getConnection: (...args: any[]) => (pool as any).getConnection(...args),
  end: (...args: any[]) => (pool as any).end(...args),
  pool,
};

export default db;
