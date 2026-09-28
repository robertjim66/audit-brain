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
  // FormData 的 Content-Type 必须由浏览器生成（含 multipart boundary），不能覆盖为 application/json
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!headers.has('Content-Type') && options.method && options.method !== 'GET' && !isFormData) {
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

/**
 * 以带鉴权的方式在新标签页打开受保护的文件（如上传原件）。
 * 普通的 <a href> 不会带 Bearer 头，因此不能直接指向 /api/files/*。
 */
export async function openProtectedFile(path: string): Promise<void> {
  const res = await fetch(path.startsWith('/api') ? path : `${API_BASE}${path}`, {
    headers: (() => {
      const h = new Headers();
      const token = getToken();
      if (token) h.set('Authorization', `Bearer ${token}`);
      return h;
    })(),
  });
  if (res.status === 401) {
    clearToken();
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new ApiClientError(401, '登录已过期，请重新登录');
  }
  if (!res.ok) throw new ApiClientError(res.status, `打开文件失败（HTTP ${res.status}）`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  // 新标签页已接手 blob，延迟回收
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
  // 文件上传：multipart，Content-Type 由浏览器生成（apiFetch 对 FormData 不再设 JSON 头）
  upload: <T = any>(path: string, formData: FormData) =>
    apiFetch<T>(path, { method: 'POST', body: formData }),
  /** 带鉴权下载并触发浏览器下载（用于导出等非 JSON 二进制响应） */
  download: async (path: string, fileName: string): Promise<void> => {
    const res = await fetch(path.startsWith('/api') ? path : `${API_BASE}${path}`, {
      headers: (() => {
        const h = new Headers();
        const token = getToken();
        if (token) h.set('Authorization', `Bearer ${token}`);
        return h;
      })(),
    });
    if (res.status === 401) {
      clearToken();
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new ApiClientError(401, '登录已过期，请重新登录');
    }
    if (!res.ok) {
      let detail = `请求失败（HTTP ${res.status}）`;
      try {
        const body = JSON.parse(await res.text());
        if (body?.error) detail = body.error;
      } catch {}
      throw new ApiClientError(res.status, detail);
    }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  },
};
