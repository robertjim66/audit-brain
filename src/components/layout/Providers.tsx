'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, getToken, setToken, clearToken } from '@/lib/apiClient';
import type { User, AuditProject } from '@/types';

// ============ 认证上下文 ============
interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refresh: () => Promise<void>;
}
const AuthContext = createContext<AuthCtx | null>(null);

// ============ 主题上下文 ============
interface ThemeCtx {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}
const ThemeContext = createContext<ThemeCtx | null>(null);

// ============ 项目上下文 ============
interface ProjectCtx {
  currentProjectId: string | null;
  setCurrentProject: (id: string | null) => void;
}
const ProjectContext = createContext<ProjectCtx | null>(null);

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // 主题初始化
  useEffect(() => {
    const saved = (localStorage.getItem('asa_theme') as 'light' | 'dark') || 'light';
    setTheme(saved);
    document.documentElement.classList.toggle('dark', saved === 'dark');
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('asa_theme', next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      return next;
    });
  }, []);

  // 认证初始化：有 token 则拉取当前用户
  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<User>('/auth/me');
      setUser(me);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 路由守卫：受保护页面需登录
  useEffect(() => {
    if (loading) return;
    const isLoginPage = pathname?.startsWith('/login');
    if (!user && !isLoginPage && pathname !== '/') {
      router.replace('/login');
    }
    if (user && isLoginPage) {
      router.replace('/cockpit');
    }
  }, [user, loading, pathname, router]);

  // 项目上下文初始化
  useEffect(() => {
    const pid = localStorage.getItem('asa_current_project');
    if (pid) setCurrentProjectId(pid);
  }, []);

  const login = useCallback((token: string, u: User) => {
    setToken(token);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setCurrentProjectId(null);
    router.replace('/login');
  }, [router]);

  const setCurrentProject = useCallback((id: string | null) => {
    setCurrentProjectId(id);
    if (id) localStorage.setItem('asa_current_project', id);
    else localStorage.removeItem('asa_current_project');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
        <ProjectContext.Provider value={{ currentProjectId, setCurrentProject }}>
          {children}
        </ProjectContext.Provider>
      </AuthContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必须在 Providers 内使用');
  return ctx;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme 必须在 Providers 内使用');
  return ctx;
}

export function useProject(): ProjectCtx {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject 必须在 Providers 内使用');
  return ctx;
}
