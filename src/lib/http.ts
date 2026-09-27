/**
 * 统一的 HTTP 响应与错误处理。
 * 规则：客户端只看到规范化错误结构 { error: string }，生产环境不返回堆栈/内部细节。
 */
import type { NextRequest } from 'next/server';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** 成功响应 */
export function ok(data: any, init?: ResponseInit): Response {
  return Response.json(data, init);
}

/** 错误响应 */
export function fail(status: number, message: string, init?: ResponseInit): Response {
  return Response.json({ error: message }, { ...init, status });
}

/** 路由处理器包裹器：统一捕获异常并规范化为 JSON 响应 */
export function withHandler(
  fn: (req: NextRequest, ctx: { params: any }) => Promise<Response>
) {
  return async (req: NextRequest, ctx: { params: any }): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (err: any) {
      if (err instanceof ApiError) {
        return fail(err.status, err.message);
      }
      console.error('[route error]', err?.stack || err?.message || err);
      const msg =
        process.env.NODE_ENV === 'production'
          ? '请求处理失败'
          : err?.message || '请求处理失败';
      return fail(500, msg);
    }
  };
}

/** 解析 JSON 请求体，失败抛出 ApiError(400) */
export async function readJson<T = any>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, '请求体格式错误');
  }
}
