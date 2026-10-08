import type { MetadataRoute } from 'next';
import { absoluteUrl, PRIVATE_PATHS, PUBLIC_PATHS, siteUrl } from '@/lib/site';

/**
 * robots.txt
 *
 * 本系统绝大多数页面需要登录，爬虫抓不到也**不应该**去抓 ——
 * 因此只允许公开路径，后台与接口一律 disallow，避免内部路径被搜索引擎收录。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: PUBLIC_PATHS,
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: siteUrl,
  };
}
