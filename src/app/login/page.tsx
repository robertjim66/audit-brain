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
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
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
    </div>
  );
}
