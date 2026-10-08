import './globals.css';
import type { Metadata } from 'next';
import { Providers } from '@/components/layout/Providers';
import { ToastProvider } from '@/components/ui/Toast';

// 分享链接的绝对地址基准：部署时通过 NEXT_PUBLIC_SITE_URL 配置真实域名，
// 未配置时回退本地地址（OG 图片相对路径会以此为基准解析成绝对 URL）。
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3003';

const title = '审计智脑 AuditBrain · 建设工程审计智能审读平台';
const description =
  '让 AI 承担翻阅与比对，人只做判断。面向建设工程审计：资料上传 → AI 解析 → 证据溯源问答 → 自动核对 → 疑点沉淀。系统不下审计结论，只指出可疑之处与证据位置。';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: '%s · 审计智脑',
  },
  description,
  keywords: ['建设工程审计', '工程结算审计', 'AI 审计', '勾稽核对', '疑点台账', '证据溯源'],
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: siteUrl,
    siteName: '审计智脑 AuditBrain',
    title,
    description,
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
    description,
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>
          <ToastProvider>{children}</ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
