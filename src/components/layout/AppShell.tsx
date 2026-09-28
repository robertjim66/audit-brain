'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, useTheme, useProject } from './Providers';
import { Button } from '@/components/ui/primitives';
import { api } from '@/lib/apiClient';
import type { AuditProject } from '@/types';

interface NavItem {
  key: string;
  label: string;
  icon: string;
  href: string;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { key: 'cockpit', label: '审计驾驶舱', icon: '🧭', href: '/cockpit' },
  { key: 'projects', label: '审计项目', icon: '📁', href: '/projects' },
  { key: 'documents', label: '资料舱', icon: '📄', href: '/documents' },
  { key: 'chat', label: '智能问答', icon: '💬', href: '/chat' },
  { key: 'checks', label: '核对程序', icon: '✅', href: '/checks' },
  { key: 'findings', label: '疑点台账', icon: '⚠️', href: '/findings' },
  { key: 'ai-config', label: '模型配置', icon: '🤖', href: '/admin/ai-model-config', adminOnly: true },
  { key: 'admin-users', label: '用户管理', icon: '👥', href: '/admin/users', adminOnly: true },
  { key: 'admin-roles', label: '角色管理', icon: '🔑', href: '/admin/roles', adminOnly: true },
  { key: 'profile', label: '个人设置', icon: '⚙️', href: '/profile' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { currentProjectId, setCurrentProject } = useProject();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [myProjects, setMyProjects] = useState<AuditProject[]>([]);

  // 我参与的项目（归属人 + 复核人），供顶栏切换
  useEffect(() => {
    let cancelled = false;
    api.get<AuditProject[]>('/audit/projects')
      .then((list) => { if (!cancelled) setMyProjects(list || []); })
      .catch(() => { if (!cancelled) setMyProjects([]); });
    return () => { cancelled = true; };
  }, [currentProjectId]);

  // 顶栏显示项目名而非雪花 ID：按当前项目 id 查一次名称（AppShell 每次整页加载只挂载一次）
  useEffect(() => {
    if (!currentProjectId) { setProjectName(null); return; }
    const hit = myProjects.find((p) => String(p.id) === String(currentProjectId));
    setProjectName(hit?.project_name || null);
  }, [currentProjectId, myProjects]);

  // 当前项目已不在可见列表（如被移除成员或项目被删）时清空上下文，避免各模块查到空数据
  useEffect(() => {
    if (!currentProjectId || !myProjects.length) return;
    if (!myProjects.some((p) => String(p.id) === String(currentProjectId))) {
      setCurrentProject(null);
    }
  }, [currentProjectId, myProjects, setCurrentProject]);

  const isAdmin = user?.is_admin === true;
  const visibleNav = NAV.filter((n) => !n.adminOnly || isAdmin);

  return (
    <div className="min-h-screen flex bg-bg">
      {/* 侧边栏 */}
      <aside
        className={`${collapsed ? 'w-16' : 'w-56'} shrink-0 bg-card border-r border-border flex flex-col transition-all`}
      >
        <div className="h-14 flex items-center gap-2 px-4 border-b border-border">
          <span className="w-8 h-8 rounded-lg bg-primary text-primary-fg flex items-center justify-center text-lg">🔍</span>
          {!collapsed && <span className="font-semibold text-text">审计智脑</span>}
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {visibleNav.map((item) => {
            const active = pathname === item.href || (item.href !== '/cockpit' && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
                  active ? 'bg-primary/10 text-primary font-medium' : 'text-text-secondary hover:bg-bg'
                }`}
                title={item.label}
              >
                <span className="text-lg w-5 text-center">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="m-2 py-2 text-xs text-text-muted hover:text-text border border-border rounded-lg"
        >
          {collapsed ? '展开' : '收起'}
        </button>
      </aside>

      {/* 主区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶栏 */}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-5">
          <div className="flex items-center gap-3 min-w-0">
            {myProjects.length > 0 ? (
              <select
                value={currentProjectId || ''}
                onChange={(e) => setCurrentProject(e.target.value || null)}
                className="max-w-[280px] rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm text-text-secondary outline-none focus:border-primary"
                title="切换审计项目"
              >
                <option value="">选择审计项目…</option>
                {myProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_name}{p.my_role === 'reviewer' ? '（参与）' : ''}
                  </option>
                ))}
              </select>
            ) : currentProjectId ? (
              <span className="text-sm text-text-secondary truncate">
                当前项目：<span className="text-primary font-medium">{projectName || currentProjectId}</span>
              </span>
            ) : (
              <span className="text-sm text-text-muted">未选择项目</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="text-lg" title="切换深浅色">
              {theme === 'dark' ? '🌞' : '🌙'}
            </button>
            <span className="text-sm text-text-secondary">{user?.nickname || user?.username}</span>
            <Button variant="secondary" size="sm" onClick={() => { logout(); }}>
              退出
            </Button>
          </div>
        </header>

        {/* 内容 */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
