import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from './db';
import { ApiError } from './http';

// JWT 密钥：优先环境变量；生产环境缺失则启动失败，开发环境生成临时密钥（重启失效）
let devJwtSecret: string | null = null;

function getJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('生产环境必须设置 JWT_SECRET 环境变量');
  }
  let secret = devJwtSecret;
  if (secret === null) {
    secret = randomBytes(48).toString('base64');
    devJwtSecret = secret;
    console.warn('⚠️  未设置 JWT_SECRET，已生成临时密钥（重启后 token 失效）');
  }
  return secret;
}

const JWT_EXPIRES_IN = '30d';

export interface AuthUser {
  userId: string;
  username: string;
}

export function signToken(userId: string, username: string): string {
  return jwt.sign({ userId, username }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): AuthUser {
  const decoded = jwt.verify(token, getJwtSecret()) as { userId: string; username: string };
  return { userId: String(decoded.userId), username: decoded.username || '' };
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** 从请求头解析并校验 JWT，返回身份信息；失败抛出 ApiError(401) */
export async function requireAuth(req: Request): Promise<AuthUser> {
  const header = req.headers.get('Authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token) {
    throw new ApiError(401, '请先登录');
  }
  try {
    return verifyToken(token);
  } catch {
    throw new ApiError(401, '登录已过期，请重新登录');
  }
}

/** 判断用户是否为系统管理员（优先 is_admin 字段，回退最小 id） */
export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const [rows]: any = await db.query(
      'SELECT is_admin FROM sl_sys_user WHERE id = ? AND del_flag = 0',
      [userId]
    );
    if (rows.length > 0 && rows[0].is_admin !== undefined) {
      return rows[0].is_admin === 1;
    }
  } catch {
    /* ignore */
  }
  const [users]: any = await db.query('SELECT id FROM sl_sys_user ORDER BY id LIMIT 1');
  return users.length > 0 && String(users[0].id) === String(userId);
}

/** 仅管理员可访问：校验身份后判断管理员权限，失败抛出 ApiError(403) */
export async function requireAdmin(req: Request): Promise<AuthUser> {
  const auth = await requireAuth(req);
  if (!(await isAdmin(auth.userId))) {
    throw new ApiError(403, '仅管理员可操作');
  }
  return auth;
}
