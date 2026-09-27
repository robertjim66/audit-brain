/**
 * 审计证据溯源问答：会话与消息持久化，编排 Agent 取证循环。
 */
import db from '@/lib/db';
import snowflake from '@/lib/snowflake';
import { ApiError } from '@/lib/http';
import { runAgent, AgentEvent } from './agentLoop';

// 继承 ApiError：withHandler 只按 instanceof ApiError 分发状态码，
// 否则 ServiceError 会被兜成 500，404/403 无法透出。
class ServiceError extends ApiError {
  constructor(message: string, status: number) {
    super(status, message);
  }
}

async function assertProjectAccess(projectId: string | number, userId: string | number, isAdmin: boolean): Promise<any> {
  const [rows]: any = await db.query('SELECT id, project_name, user_id FROM audit_project WHERE id=? AND del_flag=0', [projectId]);
  if (!rows.length) throw new ServiceError('项目不存在', 404);
  if (!isAdmin && String(rows[0].user_id) !== String(userId)) throw new ServiceError('无权访问该项目', 403);
  return rows[0];
}

async function assertSessionAccess(sessionId: string | number, userId: string | number, isAdmin: boolean): Promise<any> {
  const [rows]: any = await db.query('SELECT * FROM audit_chat_session WHERE id=? AND del_flag=0', [sessionId]);
  if (!rows.length) throw new ServiceError('会话不存在', 404);
  if (!isAdmin && String(rows[0].user_id) !== String(userId)) throw new ServiceError('无权访问该会话', 403);
  return rows[0];
}

export async function createSession(projectId: string | number, userId: string | number, isAdmin: boolean, title?: string): Promise<any> {
  await assertProjectAccess(projectId, userId, isAdmin);
  const id = snowflake.nextId();
  await db.query(
    'INSERT INTO audit_chat_session (id, project_id, title, user_id, last_message_at, created_by, updated_by) VALUES (?,?,?,?,NULL,?,?)',
    [id, projectId, title || '新会话', userId, userId, userId]
  );
  return getSession(id);
}

async function getSession(id: string | number): Promise<any> {
  const [rows]: any = await db.query('SELECT * FROM audit_chat_session WHERE id=? AND del_flag=0', [id]);
  return rows[0] || null;
}

export async function listSessions(projectId: string | number, userId: string | number, isAdmin: boolean): Promise<any[]> {
  await assertProjectAccess(projectId, userId, isAdmin);
  const [rows]: any = await db.query(
    `SELECT s.*, (SELECT content FROM audit_chat_message m WHERE m.session_id=s.id AND m.role='user' ORDER BY m.created_at ASC LIMIT 1) AS first_question
     FROM audit_chat_session s WHERE s.project_id=? AND s.del_flag=0 ORDER BY s.last_message_at DESC, s.created_at DESC`,
    [projectId]
  );
  return rows;
}

export async function listMessages(sessionId: string | number): Promise<any[]> {
  const [rows]: any = await db.query(
    'SELECT id, role, content, citations_json, created_at FROM audit_chat_message WHERE session_id=? ORDER BY created_at ASC',
    [sessionId]
  );
  return rows.map((r: any) => ({
    id: String(r.id), role: r.role, content: r.content, createdAt: r.created_at,
    meta: r.citations_json ? JSON.parse(r.citations_json) : null,
  }));
}

export async function deleteSession(sessionId: string | number, userId: string | number, isAdmin: boolean): Promise<any> {
  const s = await assertSessionAccess(sessionId, userId, isAdmin);
  await db.query('UPDATE audit_chat_session SET del_flag=1, updated_by=? WHERE id=?', [userId, sessionId]);
  return s;
}

async function prepareAsk(sessionId: string | number, userId: string | number, isAdmin: boolean, content: any): Promise<{ session: any; question: string; history: any[] }> {
  const session = await assertSessionAccess(sessionId, userId, isAdmin);
  const question = String(content || '').trim();
  if (!question) throw new ServiceError('问题不能为空', 400);

  const [histRows]: any = await db.query(
    `SELECT role, content FROM (
       SELECT role, content, created_at FROM audit_chat_message WHERE session_id=? ORDER BY created_at DESC LIMIT 6
     ) t ORDER BY created_at ASC`,
    [sessionId]
  );

  const userMsgId = snowflake.nextId();
  await db.query(
    'INSERT INTO audit_chat_message (id, session_id, project_id, role, content) VALUES (?,?,?,?,?)',
    [userMsgId, sessionId, session.project_id, 'user', question.slice(0, 60000)]
  );

  return { session, question, history: histRows.map((r: any) => ({ role: r.role, content: r.content })) };
}

async function persistFailure(session: any, userId: string | number, question: string, e: any): Promise<void> {
  const errId = snowflake.nextId();
  await db.query(
    'INSERT INTO audit_chat_message (id, session_id, project_id, role, content, citations_json) VALUES (?,?,?,?,?,?)',
    [errId, session.id, session.project_id, 'assistant',
      '审计助手暂时无法完成本次分析（模型服务调用失败），请稍后重试或检查「模型设置」中的模型与密钥。',
      JSON.stringify({ error: true, errorMsg: String(e.message || e).slice(0, 500), attempts: e.attempts || null })]
  );
  await touchSession(session, userId, question);
}

async function persistAnswer(session: any, userId: string | number, question: string, result: any): Promise<any> {
  const meta = {
    citations: result.citations,
    missing: result.missing,
    confidence: result.confidence,
    trace: result.trace,
    model: result.model,
    modelKey: result.modelKey,
    usage: result.usage,
    rounds: result.rounds,
    evidenceCount: result.evidenceCount,
  };
  const asstId = snowflake.nextId();
  await db.query(
    'INSERT INTO audit_chat_message (id, session_id, project_id, role, content, citations_json) VALUES (?,?,?,?,?,?)',
    [asstId, session.id, session.project_id, 'assistant', result.answer, JSON.stringify(meta)]
  );
  await touchSession(session, userId, question);

  return {
    id: String(asstId), role: 'assistant', content: result.answer,
    citations: result.citations, missing: result.missing, confidence: result.confidence,
    trace: result.trace, model: result.model, modelKey: result.modelKey,
    usage: result.usage, rounds: result.rounds, evidenceCount: result.evidenceCount,
  };
}

export async function ask(sessionId: string | number, userId: string | number, isAdmin: boolean, content: any): Promise<any> {
  const { session, question, history } = await prepareAsk(sessionId, userId, isAdmin, content);
  let result: any;
  try {
    result = await runAgent({ projectId: String(session.project_id), question, history, userId });
  } catch (e: any) {
    await persistFailure(session, userId, question, e);
    throw new ServiceError('Agent 运行失败：' + String(e.message || e).slice(0, 200), 502);
  }
  return persistAnswer(session, userId, question, result);
}

export async function askStream(
  sessionId: string | number,
  userId: string | number,
  isAdmin: boolean,
  content: any,
  emit: (event: string, data: any) => void
): Promise<any | null> {
  const safeEmit = (event: string, data: any) => { try { emit(event, data); } catch { /* 客户端断开，忽略 */ } };
  const { session, question, history } = await prepareAsk(sessionId, userId, isAdmin, content);
  safeEmit('start', { question, sessionId: String(sessionId) });

  let result: any;
  try {
    result = await runAgent({
      projectId: String(session.project_id),
      question,
      history,
      userId,
      onEvent: (ev: AgentEvent) => {
        if (ev.type === 'tool' || ev.type === 'answer') safeEmit(ev.type, ev);
        else safeEmit('progress', ev);
      },
    });
  } catch (e: any) {
    await persistFailure(session, userId, question, e);
    safeEmit('error', { message: 'Agent 运行失败：' + String(e.message || e).slice(0, 200) });
    return null;
  }

  const msg = await persistAnswer(session, userId, question, result);
  safeEmit('done', msg);
  return msg;
}

async function touchSession(session: any, userId: string | number, question: string): Promise<void> {
  const title = session.title && session.title !== '新会话' ? session.title : question.slice(0, 20);
  await db.query('UPDATE audit_chat_session SET last_message_at=NOW(3), title=?, updated_by=? WHERE id=?',
    [title, userId, session.id]);
}

export { assertSessionAccess, assertProjectAccess, ServiceError };
