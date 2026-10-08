import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site';

/**
 * sitemap.xml
 *
 * 只列出**无需登录**的页面。后台页面即使列进来，爬虫访问也会被登录守卫挡下，
 * 反而产生大量无效抓取，因此不纳入。
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: absoluteUrl('/'),
      lastModified,
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: absoluteUrl('/login'),
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.6,
    },
    {
      url: absoluteUrl('/privacy'),
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: absoluteUrl('/terms'),
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
