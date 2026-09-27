// 数据库初始化脚本：按顺序执行 sql/v1.0.x 与 sql/v1.1.x 下的全部 SQL
// 用法：node scripts/migrate.mjs   （需先 cp .env.example .env 并填好 DB_*）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

// 加载 .env（Node 20.6+ 支持 process.loadEnvFile）
try {
  if (fs.existsSync('.env')) process.loadEnvFile('.env');
} catch { /* ignore */ }

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';

function listSql(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
}

function splitStatements(sql) {
  // 按分号切分（这些初始化脚本不含字符串内的分号歧义）
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));
}

async function main() {
  const cfg = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ai_audit',
    multipleStatements: true,
  };
  const conn = await mysql.createConnection(cfg);
  console.log(`🔌 连接数据库 ${cfg.host}/${cfg.database}`);

  const dirs = [
    path.join(ROOT, 'sql/v1.0.x'),
    path.join(ROOT, 'sql/v1.1.x'),
  ];
  for (const dir of dirs) {
    const files = listSql(dir);
    console.log(`\n📂 ${path.basename(path.dirname(dir))}/${path.basename(dir)} (${files.length} 个文件)`);
    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), 'utf8');
      const stmts = splitStatements(content);
      for (const st of stmts) {
        try {
          await conn.query(st);
        } catch (e) {
          // ALTER/INSERT IGNORE 等可能因重复执行报错，属正常，忽略
          console.warn(`   ⚠️  ${file} 语句跳过: ${e.message.split('\n')[0]}`);
        }
      }
      console.log(`   ✓ ${file}`);
    }
  }
  await conn.end();
  console.log('\n✅ 数据库初始化完成。请注册第一个账号（自动成为管理员）。');
}

main().catch((e) => {
  console.error('❌ 初始化失败:', e.message);
  process.exit(1);
});
