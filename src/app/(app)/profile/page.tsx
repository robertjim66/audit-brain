'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth, useTheme, useProject } from '@/components/layout/Providers';
import { api } from '@/lib/apiClient';
import { Button, Card, Badge, Input, Spinner } from '@/components/ui/primitives';
import type { User } from '@/types';

function passwordStrength(pwd: string): { level: number; label: string; color: string; hint: string } {
  if (!pwd) return { level: 0, label: '未输入', color: 'bg-border', hint: '至少 6 位' };
  let score = 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 10) score++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^\w\s]/.test(pwd)) score++;
  if (score <= 2) return { level: 1, label: '弱', color: 'bg-danger', hint: '建议混合大小写字母、数字与符号' };
  if (score <= 3) return { level: 2, label: '中', color: 'bg-warning', hint: '再长一些会更安全' };
  return { level: 3, label: '强', color: 'bg-success', hint: '强度良好' };
}

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { currentProjectId, setCurrentProject } = useProject();

  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [msg, setMsg] = useState('');

  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  const [clearing, setClearing] = useState(false);

  // 以服务端数据为准填充表单，避免首屏闪烁
  useEffect(() => {
    if (!user) return;
    setNickname(user.nickname || '');
    setEmail(user.email || '');
  }, [user]);

  const dirtyProfile = !!user && (nickname !== (user.nickname || '') || email !== (user.email || ''));
  const strength = passwordStrength(newPwd);
  const pwdMismatch = !!confirmPwd && newPwd !== confirmPwd;
  const canSubmitPwd = oldPwd.length > 0 && newPwd.length >= 6 && newPwd === confirmPwd && !savingPwd;

  const saveProfile = useCallback(async () => {
    setSavingProfile(true); setMsg('');
    try {
      await api.put('/auth/me', { nickname, email });
      await refresh();
      setMsg('✅ 资料已保存');
    } catch (e: any) { setMsg('保存失败：' + e.message); }
    finally { setSavingProfile(false); }
  }, [nickname, email, refresh]);

  const savePassword = useCallback(async () => {
    setSavingPwd(true); setMsg('');
    try {
      await api.post('/auth/change-password', { old_password: oldPwd, new_password: newPwd });
      setOldPwd(''); setNewPwd(''); setConfirmPwd('');
      setMsg('✅ 密码已修改，下次登录请使用新密码');
    } catch (e: any) { setMsg('修改失败：' + e.message); }
    finally { setSavingPwd(false); }
  }, [oldPwd, newPwd, confirmPwd]);

  const clearProject = useCallback(() => {
    setClearing(true);
    setCurrentProject(null);
    setMsg('已退出当前项目上下文');
    setClearing(false);
  }, [setCurrentProject]);

  if (!user) return <div className="flex items-center gap-3 text-text-muted"><Spinner /> 加载账号信息…</div>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-text">个人设置</h1>
        <p className="text-sm text-text-muted">维护昵称与邮箱、修改登录密码、调整界面偏好。</p>
      </div>

      {msg && (
        <div className="rounded-lg bg-card border border-border px-3 py-2 text-sm text-text-secondary">{msg}</div>
      )}

      {/* 账号概览 */}
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-semibold shrink-0">
            {(user.nickname || user.username || '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-text truncate">{user.nickname || user.username}</span>
              {user.is_admin === true && <Badge color="warning">管理员</Badge>}
            </div>
            <div className="text-sm text-text-muted">@{user.username}</div>
            {user.created_at && (
              <div className="text-xs text-text-muted mt-0.5">注册于 {String(user.created_at).slice(0, 10)}</div>
            )}
          </div>
        </div>
      </Card>

      {/* 基本资料 */}
      <Card className="p-5">
        <h2 className="font-semibold text-text mb-1">基本资料</h2>
        <p className="text-xs text-text-muted mb-4">登录用户名创建后不可修改。</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">登录用户名</label>
            <Input value={user.username} disabled />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">昵称</label>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="显示在顶栏与协作记录中"
              maxLength={50}
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">邮箱</label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="选填，用于接收通知"
              maxLength={100}
            />
            <p className="text-xs text-text-muted mt-1">留空可清除已填邮箱。</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={saveProfile} disabled={!dirtyProfile || savingProfile || !nickname.trim()}>
              {savingProfile ? '保存中…' : '保存资料'}
            </Button>
            {dirtyProfile && <span className="text-xs text-text-muted">有未保存的修改</span>}
          </div>
        </div>
      </Card>

      {/* 修改密码 */}
      <Card className="p-5">
        <h2 className="font-semibold text-text mb-1">修改密码</h2>
        <p className="text-xs text-text-muted mb-4">修改后当前登录状态仍有效，其他设备需重新登录。</p>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm text-text-secondary mb-1">原密码</label>
            <Input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} placeholder="6-50 位" />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">新密码</label>
            <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="6-50 位" />
            {newPwd && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full ${i <= strength.level ? strength.color : 'bg-border'}`}
                    />
                  ))}
                </div>
                <div className="text-xs text-text-muted mt-1">强度：{strength.label} · {strength.hint}</div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">确认新密码</label>
            <Input
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              placeholder="再次输入新密码"
            />
            {pwdMismatch && <p className="text-xs text-danger mt-1">两次输入的新密码不一致</p>}
          </div>
          <Button onClick={savePassword} disabled={!canSubmitPwd}>
            {savingPwd ? '提交中…' : '修改密码'}
          </Button>
        </div>
      </Card>

      {/* 界面偏好 */}
      <Card className="p-5">
        <h2 className="font-semibold text-text mb-1">界面偏好</h2>
        <p className="text-xs text-text-muted mb-4">偏好保存在本地浏览器，不影响其他设备。</p>
        <div className="space-y-4">
          <div className="flex items-center justify-between max-w-md">
            <div>
              <div className="text-sm text-text">深色模式</div>
              <div className="text-xs text-text-muted">当前为{theme === 'dark' ? '深色' : '浅色'}主题</div>
            </div>
            <Button variant="secondary" onClick={toggleTheme}>
              {theme === 'dark' ? '切到浅色' : '切到深色'}
            </Button>
          </div>
          <div className="flex items-center justify-between max-w-md border-t border-border pt-4">
            <div>
              <div className="text-sm text-text">当前项目上下文</div>
              <div className="text-xs text-text-muted">
                {currentProjectId ? '资料舱、问答、核对等模块按此项目过滤' : '未选择，模块会提示先选项目'}
              </div>
            </div>
            {currentProjectId && (
              <Button variant="secondary" onClick={clearProject} disabled={clearing}>
                清除选择
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
