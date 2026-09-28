'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useProject } from '@/components/layout/Providers';
import { api } from '@/lib/apiClient';
import { useToast } from '@/components/ui/Toast';
import { Button, Card, Badge, Modal, Input, Textarea, Select, Spinner } from '@/components/ui/primitives';
import { AUDIT_TYPES, PROJECT_STATUS } from '@/lib/constants';
import type { AuditProject, ProjectMember, ProjectRole } from '@/types';

type UserOption = { id: string; username: string; nickname?: string; is_admin: boolean };

const ROLE_LABEL: Record<ProjectRole, string> = { owner: '归属人', reviewer: '复核人' };

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { currentProjectId, setCurrentProject } = useProject();

  const [proj, setProj] = useState<AuditProject | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ project_name: '', project_code: '', audit_type: 'cost', audit_period: '', description: '', status: 0 });

  // 成员管理弹窗
  const [memberOpen, setMemberOpen] = useState(false);
  const [options, setOptions] = useState<UserOption[]>([]);
  const [pickUser, setPickUser] = useState('');
  const [pickRole, setPickRole] = useState<ProjectRole>('reviewer');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [p, ms] = await Promise.all([
        api.get<AuditProject>(`/audit/projects/${id}`),
        api.get<ProjectMember[]>(`/audit/projects/${id}/members`),
      ]);
      setProj(p);
      setMembers(ms);
      setForm({
        project_name: p.project_name,
        project_code: p.project_code || '',
        audit_type: p.audit_type,
        audit_period: p.audit_period || '',
        description: p.description || '',
        status: p.status,
      });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { load(); }, [load]);

  const openMemberModal = async () => {
    setMemberOpen(true);
    if (options.length) return;
    try {
      const list = await api.get<UserOption[]>('/admin/users/options');
      setOptions(list);
    } catch (e: any) {
      // 非管理员没有该接口，成员管理本就是 owner 专属，这里静默降级即可
      toast.error('无法加载用户列表：' + e.message);
    }
  };

  async function save() {
    if (!proj) return;
    if (!form.project_name.trim()) { toast.error('请输入项目名称'); return; }
    try {
      await api.put(`/audit/projects/${proj.id}`, form);
      toast.success('已更新');
      setEditOpen(false);
      load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function addMember() {
    if (!proj || !pickUser) { toast.error('请选择用户'); return; }
    setAdding(true);
    try {
      const r = await api.post<{ members: ProjectMember[] }>(`/audit/projects/${proj.id}/members`, {
        user_id: pickUser,
        project_role: pickRole,
      });
      setMembers(r.members);
      setPickUser('');
      toast.success('成员已添加');
    } catch (e: any) { toast.error(e.message); }
    finally { setAdding(false); }
  }

  async function removeMember(m: ProjectMember) {
    if (!proj) return;
    if (!confirm(`确认将「${m.nickname || m.username}」移出该项目？其将无法再访问本项目数据。`)) return;
    try {
      const r = await api.del<{ members: ProjectMember[] }>(`/audit/projects/${proj.id}/members?member_id=${m.id}`);
      setMembers(r.members);
      toast.success('已移除');
    } catch (e: any) { toast.error(e.message); }
  }

  async function remove() {
    if (!proj) return;
    if (!confirm(`确定删除项目「${proj.project_name}」？该操作会一并软删其资料与要素。`)) return;
    try {
      await api.del(`/audit/projects/${proj.id}`);
      if (currentProjectId === proj.id) setCurrentProject(null);
      toast.success('已删除');
      router.push('/projects');
    } catch (e: any) { toast.error(e.message); }
  }

  function enterDocs() {
    if (!proj) return;
    setCurrentProject(proj.id);
    router.push('/documents');
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size={28} /></div>;

  if (!proj) {
    return (
      <Card className="py-16 text-center text-text-muted">
        <p>项目不存在，或你无权访问该项目。</p>
        <Link href="/projects" className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-sm text-primary-fg">返回项目列表</Link>
      </Card>
    );
  }

  const canManage = proj.can_manage === true;
  const role = proj.my_role as ProjectRole | null;

  return (
    <div>
      <div className="flex items-start justify-between mb-5 gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-text truncate">{proj.project_name}</h1>
            <Badge color={proj.status === 1 ? 'success' : 'primary'}>
              {PROJECT_STATUS.find((s) => s.value === proj.status)?.label}
            </Badge>
            {role && <Badge color={role === 'owner' ? 'primary' : 'muted'}>我：{ROLE_LABEL[role]}</Badge>}
          </div>
          <p className="text-sm text-text-muted mt-0.5">
            {proj.project_code || '无编号'} · {AUDIT_TYPES.find((t) => t.value === proj.audit_type)?.label || proj.audit_type}
            {proj.audit_period ? ` · ${proj.audit_period}` : ''}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button onClick={enterDocs}>进入资料舱</Button>
          {canManage && (
            <>
              <Button variant="secondary" onClick={openMemberModal}>成员管理</Button>
              <Button variant="secondary" onClick={() => setEditOpen(true)}>编辑</Button>
              <Button variant="danger" onClick={remove}>删除</Button>
            </>
          )}
        </div>
      </div>

      {!canManage && (
        <div className="mb-4 rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-secondary">
          你在本项目中是{ROLE_LABEL.reviewer}，可参与资料上传、问答、核对与疑点处置；编辑项目与管理成员需归属人权限。
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {[
          { label: '资料', value: proj.doc_count ?? 0 },
          { label: '已解析', value: proj.parsed_count ?? 0 },
          { label: '解析失败', value: proj.failed_count ?? 0 },
          { label: '疑点', value: proj.finding_count ?? 0 },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-sm text-text-muted">{s.label}</div>
            <div className="text-2xl font-bold mt-1 text-text">{s.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-semibold text-text mb-3">项目信息</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex gap-3">
              <dt className="text-text-muted w-20 shrink-0">项目说明</dt>
              <dd className="text-text-secondary whitespace-pre-wrap">{proj.description || '—'}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-text-muted w-20 shrink-0">归属人</dt>
              <dd className="text-text-secondary">
                {proj.owner_nickname || proj.owner_username}
                {proj.owner_username ? <span className="text-text-muted"> @{proj.owner_username}</span> : null}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-text-muted w-20 shrink-0">创建时间</dt>
              <dd className="text-text-secondary">{String(proj.created_at || '').slice(0, 19).replace('T', ' ')}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-text">项目成员</h2>
            <span className="text-xs text-text-muted">{members.length} 人</span>
          </div>
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm text-text truncate">
                    {m.nickname || m.username}
                    {m.is_admin && <span className="ml-1 text-xs text-warning">管理员</span>}
                  </div>
                  <div className="text-xs text-text-muted">@{m.username}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge color={m.project_role === 'owner' ? 'primary' : 'muted'}>{ROLE_LABEL[m.project_role]}</Badge>
                  {canManage && m.project_role !== 'owner' && (
                    <button onClick={() => removeMember(m)} className="text-xs text-danger hover:underline">移除</button>
                  )}
                </div>
              </div>
            ))}
            {!members.length && <p className="text-sm text-text-muted">暂无成员记录</p>}
          </div>
          {canManage && (
            <p className="mt-3 text-xs text-text-muted">
              归属人可编辑项目、管理成员并删除项目；复核人可参与业务操作。移除成员后其将无法访问本项目。
            </p>
          )}
        </Card>
      </div>

      {/* 编辑项目 */}
      <Modal open={editOpen} title="编辑项目" onClose={() => setEditOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setEditOpen(false)}>取消</Button><Button onClick={save}>保存</Button></>}>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-text-secondary">项目名称 *</label>
            <Input value={form.project_name} onChange={(e) => setForm({ ...form, project_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-text-secondary">项目编号</label>
              <Input value={form.project_code} onChange={(e) => setForm({ ...form, project_code: e.target.value })} placeholder="选填" />
            </div>
            <div>
              <label className="text-sm text-text-secondary">审计类型</label>
              <Select value={form.audit_type} onChange={(e) => setForm({ ...form, audit_type: e.target.value })}>
                {AUDIT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-text-secondary">审计/工程期间</label>
              <Input value={form.audit_period} onChange={(e) => setForm({ ...form, audit_period: e.target.value })} placeholder="选填" />
            </div>
            <div>
              <label className="text-sm text-text-secondary">项目状态</label>
              <Select value={String(form.status)} onChange={(e) => setForm({ ...form, status: Number(e.target.value) })}>
                {PROJECT_STATUS.map((s) => <option key={s.value} value={String(s.value)}>{s.label}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm text-text-secondary">项目说明</label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
        </div>
      </Modal>

      {/* 成员管理 */}
      <Modal open={memberOpen} title="成员管理" onClose={() => setMemberOpen(false)} width="max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-text-secondary">选择用户</label>
            <div className="flex gap-2 mt-1">
              <Select value={pickUser} onChange={(e) => setPickUser(e.target.value)} className="flex-1">
                <option value="">请选择…</option>
                {options
                  .filter((o) => !members.some((m) => String(m.user_id) === String(o.id)))
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nickname || o.username} (@{o.username}){o.is_admin ? ' · 管理员' : ''}
                    </option>
                  ))}
              </Select>
              <Select value={pickRole} onChange={(e) => setPickRole(e.target.value as ProjectRole)} className="w-28">
                <option value="reviewer">复核人</option>
                <option value="owner">归属人</option>
              </Select>
              <Button onClick={addMember} disabled={!pickUser || adding}>{adding ? '添加中…' : '添加'}</Button>
            </div>
            {options.length === 0 && (
              <p className="text-xs text-text-muted mt-1">未能加载用户列表。若你是通过角色授权协作，此处仍需归属人逐个添加。</p>
            )}
          </div>

          <div className="border-t border-border pt-3">
            <div className="text-sm text-text-secondary mb-2">当前成员（{members.length}）</div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm text-text truncate">{m.nickname || m.username}</div>
                    <div className="text-xs text-text-muted">@{m.username}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge color={m.project_role === 'owner' ? 'primary' : 'muted'}>{ROLE_LABEL[m.project_role]}</Badge>
                    {m.project_role !== 'owner' && (
                      <button onClick={() => removeMember(m)} className="text-xs text-danger hover:underline">移除</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
