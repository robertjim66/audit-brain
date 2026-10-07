'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/components/layout/Providers';
import { useToast } from '@/components/ui/Toast';
import { Button, Input } from '@/components/ui/primitives';

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
    <div className="min-h-screen flex items-start justify-center bg-bg p-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary text-primary-fg flex items-center justify-center text-2xl">🔍</div>
          <h1 className="text-xl font-bold text-text mt-3">审计智脑 AuditBrain</h1>
          <p className="text-sm text-text-muted mt-1">资料上传 · AI 审读 · 疑点溯源</p>
        </div>
        <div className="bg-card border border-border rounded-2xl shadow-card p-6">
          <div className="flex mb-5 rounded-lg bg-bg p-1">
            <button
              className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${mode === 'login' ? 'bg-primary text-primary-fg' : 'text-text-secondary'}`}
              onClick={() => setMode('login')}
            >登录</button>
            <button
              className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${mode === 'register' ? 'bg-primary text-primary-fg' : 'text-text-secondary'}`}
              onClick={() => setMode('register')}
            >注册</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-text-secondary">用户名</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="3-20 位字母/数字/中文" autoFocus />
            </div>
            <div>
              <label className="text-sm text-text-secondary">密码</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6-50 位" />
            </div>
            {mode === 'register' && (
              <div>
                <label className="text-sm text-text-secondary">昵称</label>
                <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="选填，默认同用户名" />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '处理中…' : mode === 'login' ? '登 录' : '注 册'}
            </Button>
          </form>
        </div>
        <p className="text-center text-xs text-text-muted mt-4">本系统为审计辅助工具，AI 结论仅供参考，请以人工复核为准</p>
      </div>

      {/* 系统能做什么 */}
      <div className="w-full max-w-sm mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-text">这套系统帮你做什么</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
          建设工程结算审计要核对几百页结算书、几十份签证单再加合同与发票。系统负责把资料读成可比对的数据、
          两边自动比对、把可疑之处连同证据整理成清单；<span className="text-text">判断合不合理、最终下结论，仍然由你来做。</span>
        </p>
        <ul className="mt-3 space-y-1.5">
          {[
            ['少花时间', '自动翻找与比对，不用逐页手工核对'],
            ['少漏问题', '抽出一页某个单价差两元、签证少一方盖章这类细节'],
            ['说得清责任', '每条疑点的处理人与处置时间全程留痕'],
          ].map(([t, d]) => (
            <li key={t} className="flex gap-2 text-xs">
              <span className="text-primary shrink-0">·</span>
              <span>
                <span className="font-medium text-text">{t}</span>
                <span className="text-text-secondary">：{d}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-text-muted">
          登录后点顶栏的
          <span className="text-text-secondary">「📖 使用指南」</span>
          可看到完整操作顺序与资料准备要求。
        </p>
      </div>
    </div>
  );
}
