'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/apiClient';
import { useProject } from '@/components/layout/Providers';
import { useToast } from '@/components/ui/Toast';
import { Button, Card, Badge, Modal, Input, Textarea, Select, Spinner } from '@/components/ui/primitives';
import { AUDIT_TYPES, PROJECT_STATUS } from '@/lib/constants';
import type { AuditProject } from '@/types';

export default function ProjectsPage() {
  const router = useRouter();
  const { setCurrentProject } = useProject();
  const toast = useToast();
  const [list, setList] = useState<AuditProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AuditProject | null>(null);
  const [form, setForm] = useState({ project_name: '', project_code: '', audit_type: 'cost', audit_period: '', description: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<AuditProject[]>(`/audit/projects?keyword=${encodeURIComponent(keyword)}`);
      setList(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [keyword, toast]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ project_name: '', project_code: '', audit_type: 'cost', audit_period: '', description: '' });
    setModalOpen(true);
  }
  function openEdit(p: AuditProject) {
    setEditing(p);
    setForm({ project_name: p.project_name, project_code: p.project_code || '', audit_type: p.audit_type, audit_period: p.audit_period || '', description: p.description || '' });
    setModalOpen(true);
  }

  async function save() {
    if (!form.project_name.trim()) { toast.error('请输入项目名称'); return; }
    try {
      if (editing) {
        await api.put(`/audit/projects/${editing.id}`, form);
        toast.success('已更新');
      } else {
        await api.post('/audit/projects', form);
        toast.success('已创建');
      }
      setModalOpen(false);
      load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function remove(p: AuditProject) {
    if (!confirm(`确定删除项目「${p.project_name}」？该操作将一并软删其资料与要素。`)) return;
    try {
      await api.del(`/audit/projects/${p.id}`);
      toast.success('已删除');
      load();
    } catch (e: any) { toast.error(e.message); }
  }

  function enterProject(p: AuditProject) {
    setCurrentProject(p.id);
    router.push(`/projects/${p.id}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-text">审计项目</h1>
          <p className="text-sm text-text-muted mt-0.5">你参与的项目（归属人 + 复核人），点击卡片查看详情与成员</p>
        </div>
        <div className="flex gap-2">
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索项目名称/编号" className="w-56" />
          <Button onClick={openCreate}>+ 新建项目</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size={28} /></div>
      ) : list.length === 0 ? (
        <Card className="py-16 text-center text-text-muted">暂无项目，点击右上角「新建项目」开始</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((p) => (
            <Card key={p.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => enterProject(p)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-text truncate">{p.project_name}</div>
                  <div className="text-xs text-text-muted mt-0.5">{p.project_code || '无编号'} · {AUDIT_TYPES.find((t) => t.value === p.audit_type)?.label || p.audit_type}</div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge color={p.status === 1 ? 'success' : 'primary'}>
                    {PROJECT_STATUS.find((s) => s.value === p.status)?.label}
                  </Badge>
                  {p.my_role && (
                    <Badge color={p.my_role === 'owner' ? 'primary' : 'muted'}>
                      {p.my_role === 'owner' ? '我负责' : '我参与'}
                    </Badge>
                  )}
                </div>
              </div>
              {p.description && <p className="text-sm text-text-secondary mt-2 line-clamp-2">{p.description}</p>}
              <div className="flex gap-4 mt-3 text-xs text-text-muted">
                <span>资料 {p.doc_count || 0}</span>
                <span>已解析 {p.parsed_count || 0}</span>
                <span>疑点 {p.finding_count || 0}</span>
                {(p.member_count || 0) > 1 && <span>成员 {p.member_count}</span>}
              </div>
              <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                {p.can_manage && (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => openEdit(p)}>编辑</Button>
                    <Button variant="ghost" size="sm" className="text-danger" onClick={() => remove(p)}>删除</Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} title={editing ? '编辑项目' : '新建项目'} onClose={() => setModalOpen(false)}
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>取消</Button>
          <Button onClick={save}>保存</Button>
        </>}>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-text-secondary">项目名称 *</label>
            <Input value={form.project_name} onChange={(e) => setForm({ ...form, project_name: e.target.value })} placeholder="如：XX 小区竣工结算审计" />
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
          <div>
            <label className="text-sm text-text-secondary">审计/工程期间</label>
            <Input value={form.audit_period} onChange={(e) => setForm({ ...form, audit_period: e.target.value })} placeholder="选填，如 2024-2025" />
          </div>
          <div>
            <label className="text-sm text-text-secondary">项目说明</label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="选填" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
