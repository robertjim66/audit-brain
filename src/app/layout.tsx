import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/layout/Providers';
import { ToastProvider } from '@/components/ui/Toast';
import { siteDescription, siteKeywords, siteName, siteUrl } from '@/lib/site';

const title = '审计智脑 AuditBrain · 建设工程审计智能审读平台';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: '%s · 审计智脑',
  },
  description: siteDescription,
  keywords: siteKeywords,
  applicationName: siteName,
  // 规范链接：避免带参数/多入口的重复内容被判为不同页面
  alternates: { canonical: '/' },
  // 公开页允许索引；后台路径由 robots.txt 统一 disallow
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: siteUrl,
    siteName,
    title,
    description: siteDescription,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: '审计智脑 AuditBrain —— 让 AI 承担翻阅与比对，人只做判断',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description: siteDescription,
    images: ['/og.png'],
  },
  appleWebApp: {
    title: '审计智脑',
    capable: true,
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 浏览器/移动设备地址栏配色，与主色同源
  themeColor: '#1A4C7A',
};

/** 结构化数据：帮助搜索引擎理解这是什么产品（价格 0 与"无付费功能"的实际情况一致） */
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: siteName,
  description: siteDescription,
  url: siteUrl,
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: '建设工程审计辅助工具',
  operatingSystem: 'Web（浏览器）',
  inLanguage: 'zh-CN',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
  featureList: [
    '工程资料上传与自动解析',
    '清单与结算跨页表勾稽核对',
    '签证合同三方签章证据链核对',
    '带证据溯源的智能问答',
    '疑点台账与处置留痕',
    'Excel 台账与 Word 清单导出',
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <script
          type="application/ld+json"
          // 结构化数据为静态常量，无用户输入，不存在注入风险
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers>
          <ToastProvider>{children}</ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
