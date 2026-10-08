'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/components/layout/Providers';
import { useToast } from '@/components/ui/Toast';
import { Button, Field, Input, Segmented, Spinner } from '@/components/ui/primitives';
import { IconShieldCheck, IconSparkles, IconCheck, IconClock } from '@/components/ui/icons';

const VALUES = [
  { icon: IconSparkles, t: '少花时间', d: '自动翻找与比对，不用逐页手工核对' },
  { icon: IconCheck, t: '少漏问题', d: '抽出一页某个单价差两元、签证少一方盖章这类细节' },
  { icon: IconClock, t: '说得清责任', d: '每条疑点的处理人与处置时间全程留痕' },
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await api.post<{ token: string; user: any }>('/auth/login', { username, password });
        login(res.token, res.user);
        toast.success('登录成功');
        router.replace('/cockpit');
      } else {
        const res = await api.post<{ token: string; user: any }>('/auth/register', { username, password, nickname: nickname || username });
        login(res.token, res.user);
        toast.success('注册成功');
        router.replace('/cockpit');
      }
    } catch (err: any) {
      toast.error(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen justify-center bg-bg px-4 py-8">
      {/* my-auto 代替外层 items-center：视口比卡片矮时可正常滚动，不会裁掉顶部 */}
      <div className="my-auto grid w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-pop lg:max-w-5xl lg:grid-cols-[1.05fr_1fr]">

        {/* ============ 品牌面板：直接用主色，与系统内主色同源（lg 以下隐藏） ============ */}
        <div className="relative hidden flex-col overflow-hidden bg-gradient-to-br from-primary to-primary-hover p-10 text-primary-fg lg:flex">
          {/* 低调的圆形装饰，避免大色块发闷 */}
          <span className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full border-[18px] border-primary-fg/[0.07]" />
          <span className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full border-[14px] border-primary-fg/[0.05]" />

          <div className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-fg/15 ring-1 ring-primary-fg/20">
              <IconShieldCheck size={24} />
            </span>
            <span className="leading-tight">
              <span className="block text-base font-semibold">审计智脑</span>
              <span className="block text-2xs tracking-[0.1em] opacity-70">AUDITBRAIN</span>
            </span>
          </div>

          <p className="relative mt-10 max-w-xs text-[15px] font-medium leading-relaxed">
            让 AI 承担翻阅与比对，<br />
            <span className="opacity-80">人只做判断。</span>
          </p>

          <div className="relative mt-10 space-y-5">
            {VALUES.map(({ icon: Icon, t, d }) => (
              <div key={t} className="flex gap-3">
                <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary-fg/15">
                  <Icon size={13} />
                </span>
                <span className="text-xs leading-relaxed">
                  <span className="font-medium">{t}</span>
                  <span className="opacity-75">：{d}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="relative mt-auto pt-10">
            <div className="border-t border-primary-fg/20 pt-4 text-2xs leading-relaxed opacity-75">
              系统不下审计结论 —— 只指出可疑之处与证据位置，
              <br />
              是否构成问题由审计人员判断。
            </div>
          </div>
        </div>

        {/* ============ 表单 ============ */}
        <div className="flex flex-col p-7 lg:p-10">
          {/* 窄屏下品牌行（面板被隐藏时补上标识） */}
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-fg">
              <IconShieldCheck size={20} />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold text-text">审计智脑</span>
              <span className="block text-2xs tracking-[0.1em] text-text-muted">AUDITBRAIN</span>
            </span>
          </div>

          <div className="hidden lg:block">
            <h1 className="text-lg font-semibold leading-tight tracking-tight text-text">
              {mode === 'login' ? '登录' : '创建账号'}
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-text-secondary">
              {mode === 'login' ? '继续你的审计作业。' : '注册后即可创建第一个审计项目。'}
            </p>
          </div>

          <div className="mt-5">
            <Segmented
              full
              value={mode}
              onChange={(v) => setMode(v as 'login' | 'register')}
              options={[
                { value: 'login', label: '登录' },
                { value: 'register', label: '注册' },
              ]}
            />
          </div>

          <form onSubmit={handleSubmit} className="mb-5 mt-5 space-y-3.5">
            <Field label="用户名">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="3-20 位字母 / 数字 / 中文"
                autoFocus
                autoComplete="username"
              />
            </Field>
            <Field label="密码">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6-50 位"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </Field>
            {mode === 'register' && (
              <Field label="昵称" hint="选填，默认同用户名；会显示在处置记录中">
                <Input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="如：李工"
                />
              </Field>
            )}
            <Button type="submit" className="mt-1 w-full" size="lg" disabled={loading}>
              {loading ? <Spinner size={15} /> : null}
              {loading ? '处理中…' : mode === 'login' ? '登 录' : '注 册'}
            </Button>
          </form>

          <p className="mt-auto border-t border-border pt-4 text-2xs leading-relaxed text-text-muted">
            本系统为审计辅助工具，AI 结论仅供参考，请以人工复核为准。
          </p>
          <div className="mt-3 text-center">
            <Link
              href="/privacy"
              className="text-2xs text-text-muted underline decoration-border underline-offset-4 transition-colors hover:text-text-secondary"
            >
              隐私政策
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
