'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, useTheme, useProject } from './Providers';
import { Button } from '@/components/ui/primitives';
import { GuideButton } from './UserGuide';
import { api } from '@/lib/apiClient';
import type { AuditProject } from '@/types';
import {
  IconCockpit, IconProjects, IconDocuments, IconChat, IconChecks, IconFindings,
  IconModel, IconUsers, IconRoles, IconSettings,
  IconShieldCheck, IconSidebar, IconChevronDown, IconChevronRight, IconCheck,
  IconSun, IconMoon, IconLogOut, IconBuilding, type IconProps,
} from '@/components/ui/icons';

interface NavItem {
  key: string;
  label: string;
  icon: React.ComponentType<IconProps>;
  href: string;
  adminOnly?: boolean;
}

const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: '审计作业',
    items: [
      { key: 'cockpit', label: '审计驾驶舱', icon: IconCockpit, href: '/cockpit' },
      { key: 'projects', label: '审计项目', icon: IconProjects, href: '/projects' },
      { key: 'documents', label: '资料舱', icon: IconDocuments, href: '/documents' },
      { key: 'chat', label: '智能问答', icon: IconChat, href: '/chat' },
      { key: 'checks', label: '核对程序', icon: IconChecks, href: '/checks' },
      { key: 'findings', label: '疑点台账', icon: IconFindings, href: '/findings' },
    ],
  },
  {
    title: '系统管理',
    items: [
      { key: 'ai-config', label: '模型配置', icon: IconModel, href: '/admin/ai-model-config', adminOnly: true },
      { key: 'admin-users', label: '用户管理', icon: IconUsers, href: '/admin/users', adminOnly: true },
      { key: 'admin-roles', label: '角色管理', icon: IconRoles, href: '/admin/roles', adminOnly: true },
    ],
  },
  {
    title: '账户',
    items: [{ key: 'profile', label: '个人设置', icon: IconSettings, href: '/profile' }],
  },
];

// ============ 顶栏项目切换器（原生 select 太粗糙，改自定义下拉） ============
function ProjectSwitcher() {
  const { currentProjectId, setCurrentProject } = useProject();
  const [projects, setProjects] = useState<AuditProject[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    api.get<AuditProject[]>('/audit/projects')
      .then((l) => { if (!cancelled) setProjects(l || []); })
      .catch(() => { if (!cancelled) setProjects([]); });
    return () => { cancelled = true; };
  }, [currentProjectId]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = projects.find((p) => String(p.id) === String(currentProjectId));

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group flex items-center gap-2 rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm transition-colors duration-150 hover:border-border-strong max-w-[320px]"
        title="切换审计项目"
      >
        <IconBuilding size={15} className="text-text-muted shrink-0" />
        {current ? (
          <span className="truncate font-medium text-text">
            {current.project_name}
            {current.my_role === 'reviewer' && <span className="ml-1 text-xs text-text-muted">参与</span>}
          </span>
        ) : (
          <span className="text-text-muted">选择审计项目…</span>
        )}
        <IconChevronDown
          size={14}
          className={`shrink-0 text-text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-[320px] overflow-hidden rounded-xl border border-border bg-card shadow-pop animate-fade-in-up">
          {projects.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-text-muted">
              暂无项目，先到「审计项目」创建一个
            </div>
          ) : (
            <div className="max-h-[320px] overflow-y-auto py-1">
              {projects.map((p) => {
                const sel = String(p.id) === String(currentProjectId);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setCurrentProject(String(p.id)); setOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors duration-100 hover:bg-surface2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm ${sel ? 'font-medium text-text' : 'text-text-secondary'}`}>
                        {p.project_name}
                      </span>
                      <span className="mt-0.5 block text-xs text-text-muted">
                        资料 {p.doc_count || 0} · 疑点 {p.finding_count || 0}
                      </span>
                    </span>
                    {p.my_role === 'reviewer' && (
                      <span className="shrink-0 rounded border border-border px-1.5 py-px text-2xs text-text-muted">参与</span>
                    )}
                    {sel && <IconCheck size={15} className="shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { currentProjectId, setCurrentProject } = useProject();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [myProjects, setMyProjects] = useState<AuditProject[]>([]);

  // 当前项目已不在可见列表（被移除成员或项目被删）时清空上下文，避免各模块查到空数据
  useEffect(() => {
    let cancelled = false;
    api.get<AuditProject[]>('/audit/projects')
      .then((list) => { if (!cancelled) setMyProjects(list || []); })
      .catch(() => { if (!cancelled) setMyProjects([]); });
    return () => { cancelled = true; };
  }, [currentProjectId]);

  useEffect(() => {
    if (!currentProjectId || !myProjects.length) return;
    if (!myProjects.some((p) => String(p.id) === String(currentProjectId))) {
      setCurrentProject(null);
    }
  }, [currentProjectId, myProjects, setCurrentProject]);

  const isAdmin = user?.is_admin === true;
  const groups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((n) => !n.adminOnly || isAdmin) }))
    .filter((g) => g.items.length > 0);

  const initial = (user?.nickname || user?.username || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="flex h-screen bg-bg">
      {/* ============ 侧边栏 ============ */}
      <aside
        className={`${collapsed ? 'w-[60px]' : 'w-[228px]'} shrink-0 border-r border-border bg-card flex flex-col transition-[width] duration-200 ease-smooth`}
      >
        {/* 品牌 */}
        <div className={`h-14 flex items-center border-b border-border ${collapsed ? 'justify-center px-2' : 'gap-2.5 px-4'}`}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-fg shadow-sm">
            <IconShieldCheck size={18} />
          </span>
          {!collapsed && (
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[13px] font-semibold text-text">审计智脑</span>
              <span className="block truncate text-2xs tracking-wide text-text-muted">AUDITBRAIN</span>
            </span>
          )}
        </div>

        {/* 导航 */}
        <nav className="flex-1 overflow-y-auto py-3">
          {groups.map((g, gi) => (
            <div key={g.title} className={gi > 0 ? 'mt-4' : ''}>
              {!collapsed && (
                <div className="px-4 pb-1.5 text-2xs font-medium uppercase tracking-[0.08em] text-text-muted">
                  {g.title}
                </div>
              )}
              {collapsed && gi > 0 && <div className="mx-3 mb-2 h-px bg-border" />}
              <ul>
                {g.items.map((item) => {
                  const active =
                    pathname === item.href || (item.href !== '/cockpit' && pathname?.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <li key={item.key} className="px-2">
                      <Link
                        href={item.href}
                        title={item.label}
                        className={`group relative flex items-center rounded-lg text-sm transition-colors duration-150 ${
                          collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-2.5 py-2'
                        } ${
                          active
                            ? 'bg-primary/[0.08] text-primary font-medium'
                            : 'text-text-secondary hover:bg-surface2 hover:text-text'
                        }`}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-r bg-primary" />
                        )}
                        <Icon size={17} className="shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* 收起 */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={`m-2 flex items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-xs text-text-muted transition-colors hover:bg-surface2 hover:text-text ${
            collapsed ? 'px-0' : 'px-2'
          }`}
          title={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          <IconSidebar size={14} className={collapsed ? '' : 'rotate-180'} />
          {!collapsed && <span>收起</span>}
        </button>
      </aside>

      {/* ============ 主区 ============ */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-card/85 px-5 backdrop-blur-md">
          <ProjectSwitcher />

          <div className="flex items-center gap-1">
            <GuideButton />
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? '切换为浅色' : '切换为深色'}
              className="rounded-lg p-2 text-text-muted transition-colors hover:bg-surface2 hover:text-text"
            >
              {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
            </button>

            <div className="mx-1.5 h-5 w-px bg-border" />

            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initial}
              </span>
              <span className="hidden text-sm text-text-secondary sm:inline">
                {user?.nickname || user?.username}
              </span>
            </div>
            <button
              onClick={() => logout()}
              title="退出登录"
              className="rounded-lg p-2 text-text-muted transition-colors hover:bg-surface2 hover:text-danger"
            >
              <IconLogOut size={16} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {/* 常规页面照常滚动；需要"铺满一屏"的页面（如个人设置）用 flex-1 拿满高度 */}
          <div className="flex min-h-full flex-col px-6 py-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
