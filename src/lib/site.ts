/**
 * 站点基础信息（SEO 单一数据源）
 *
 * 部署时通过 NEXT_PUBLIC_SITE_URL 指定真实域名 —— sitemap、robots、canonical、
 * OG 图片都以此为准。未配置时回退本地地址。
 */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3003').replace(/\/$/, '');

export const siteName = '审计智脑 AuditBrain';

export const siteDescription =
  '面向建设工程审计的智能审读平台：资料上传 → AI 解析 → 证据溯源问答 → 自动核对 → 疑点沉淀。让 AI 承担翻阅与比对，人只做判断。';

export const siteKeywords = [
  '建设工程审计',
  '工程结算审计',
  '审计软件',
  '工程量清单勾稽',
  '签证签章核对',
  '疑点台账',
  'AI 审计',
];

/** 项目源码仓库：个人独立开发，对外公开可查 —— 作为"可验证"的一部分放在页面上 */
export const repoUrl = 'https://github.com/robertjim66/audit-brain';

/** 无需登录即可访问、允许被搜索引擎收录的公开路径 */
export const PUBLIC_PATHS = ['/', '/login', '/privacy', '/terms'];

/** 后台与接口路径：一律禁止抓取，避免内部路径被索引 */
export const PRIVATE_PATHS = [
  '/api/',
  '/cockpit',
  '/projects',
  '/documents',
  '/chat',
  '/checks',
  '/findings',
  '/profile',
  '/admin',
];

export function absoluteUrl(path: string): string {
  return `${siteUrl}${path}`;
}
