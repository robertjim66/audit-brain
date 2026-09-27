import { requireAuth, isAdmin } from '@/lib/auth';
import { ApiError } from '@/lib/http';
import { askStream, assertSessionAccess } from '@/lib/audit/agent/chatService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 流式提问（SSE）。Agent 的取证进度与成稿正文实时下发，用户不必干等到最后。
 * 事件：start / progress / tool / answer / done / error
 * 注意：POST 无法用浏览器 EventSource，前端用 fetch + ReadableStream 读取。
 */
export async function POST(req: Request, ctx: { params: { id: string } }) {
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (e: any) {
    const status = e?.status || 401;
    return Response.json({ error: e?.message || '请先登录' }, { status });
  }

  const sessionId = ctx.params.id;
  // 先做一次访问校验：会话不存在/无权访问属「流还没开始」的错误，以正常 HTTP 状态码返回
  try {
    await assertSessionAccess(sessionId, auth.userId, await isAdmin(auth.userId));
  } catch (e: any) {
    const status = e?.status || 500;
    return Response.json({ error: e?.message || '会话访问失败' }, { status });
  }

  const body = await req.json().catch(() => ({}));
  const content = body?.content;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch { /* 客户端断开 */ }
      };
      const heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(': ping\n\n')); } catch { /* ignore */ }
      }, 15000);

      try {
        await askStream(
          sessionId,
          auth.userId,
          await isAdmin(auth.userId),
          content,
          (event, data) => send(event, data)
        );
      } catch (e: any) {
        send('error', { message: '流式问答失败：' + (e?.message || '未知错误') });
      } finally {
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* ignore */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
