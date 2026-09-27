import db from './db';
import snowflake from './snowflake';

/**
 * 统一 AI 请求日志（fire-and-forget，不阻塞主流程）。
 * 写入 sl_sys_ai_log；表缺失或写失败仅打印告警，不影响业务。
 */
function maskImages(body: any): any {
  if (!body || typeof body !== 'object') return body;
  const clone = Array.isArray(body) ? [...body] : { ...body };
  if (Array.isArray(clone.messages)) {
    clone.messages = clone.messages.map((m: any) => {
      if (m && Array.isArray(m.content)) {
        return {
          ...m,
          content: m.content.map((c: any) =>
            c && c.type === 'image_url' ? { ...c, image_url: '[REDACTED]' } : c
          ),
        };
      }
      return m;
    });
  }
  return clone;
}

export function recordAIRequest(p: {
  userId?: string | number | null;
  businessType?: string;
  businessId?: string | number | null;
  requestUrl?: string | null;
  requestModel?: string | null;
  requestBody?: any;
  responseResult?: any;
  requestTime?: Date;
  responseTime?: Date;
  status?: number;
  errorMsg?: string | null;
}): void {
  try {
    const body = maskImages(p.requestBody || {});
    const requestParams = JSON.stringify(body).substring(0, 60000);
    const responseResult =
      typeof p.responseResult === 'string'
        ? p.responseResult.substring(0, 60000)
        : JSON.stringify(p.responseResult != null ? p.responseResult : null).substring(0, 60000);
    const id = snowflake.nextId();
    const costTime =
      p.responseTime && p.requestTime
        ? p.responseTime.getTime() - p.requestTime.getTime()
        : null;

    db.query(
      `INSERT INTO sl_sys_ai_log
       (id, user_id, business_type, business_id, request_url, request_model, request_params,
        response_result, status, error_msg, request_time, response_time, cost_time, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        p.userId || null,
        p.businessType,
        p.businessId != null ? String(p.businessId) : null,
        p.requestUrl || null,
        p.requestModel || null,
        requestParams,
        responseResult,
        p.status || 0,
        p.errorMsg ? String(p.errorMsg).substring(0, 500) : null,
        p.requestTime,
        p.responseTime || null,
        costTime,
        p.userId || null,
      ]
    ).catch((err) => console.error('[aiLogger] 写入 AI 日志失败:', err.message));
  } catch (err: any) {
    console.error('[aiLogger] 记录 AI 日志异常:', err.message);
  }
}
