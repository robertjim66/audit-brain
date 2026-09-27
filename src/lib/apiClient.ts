'use client';

// 前端 API 客户端：统一相对路径 /api 调用（同源，无 CORS）、自动附加 Bearer、401 跳转登录
const TOKEN_KEY = 'asa_token';
const API_BASE = '/api';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('asa_user');
  localStorage.removeItem('asa_current_project');
}

export interface ApiResult<T = any> {
  data: T;
  ok: boolean;
  status: number;
}

export class ApiClientError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.method && options.method !== 'GET') {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new ApiClientError(401, '登录已过期，请重新登录');
  }

  let body: any = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const msg = (body && body.error) || `请求失败 (${res.status})`;
    throw new ApiClientError(res.status, msg);
  }
  return body as T;
}

export const api = {
  get: <T = any>(path: string) => apiFetch<T>(path, { method: 'GET' }),
  post: <T = any>(path: string, data?: any) =>
    apiFetch<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  put: <T = any>(path: string, data?: any) =>
    apiFetch<T>(path, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }),
  patch: <T = any>(path: string, data?: any) =>
    apiFetch<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  del: <T = any>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
  // 文件上传：multipart，不设置 Content-Type（让浏览器填 boundary）
  upload: <T = any>(path: string, formData: FormData) =>
    apiFetch<T>(path, { method: 'POST', body: formData, headers: new Headers() }),
};
