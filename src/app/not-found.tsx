import Link from 'next/link';
import { IconShieldCheck } from '@/components/ui/icons';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-card">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-fg">
          <IconShieldCheck size={24} />
        </span>

        <div className="num mt-5 text-4xl font-semibold leading-none tracking-tight text-text">404</div>
        <h1 className="mt-3 text-base font-semibold text-text">页面不存在，或你没有访问权限</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          该地址可能已变更、已被移除，或需要登录并加入对应审计项目后才能查看。
        </p>

        {/* Link 内不能嵌套 button，这里直接用带按钮样式的链接 */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-3.5 py-[7px] text-sm font-medium text-primary-fg shadow-sm transition-all duration-150 hover:bg-primary-hover"
          >
            返回登录
          </Link>
          <Link
            href="/privacy"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-3.5 py-[7px] text-sm font-medium text-text transition-colors duration-150 hover:bg-surface2"
          >
            隐私政策
          </Link>
        </div>
      </div>
    </div>
  );
}
