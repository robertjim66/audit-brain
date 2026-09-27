import './globals.css';
import type { Metadata } from 'next';
import { Providers } from '@/components/layout/Providers';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: '审计智脑 AuditBrain',
  description: '面向建设工程审计的智能审读平台',
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
