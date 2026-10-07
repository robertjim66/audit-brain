'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/apiClient';
import { Button, Card, Modal, Input, Badge, Table, useConfirm } from '@/components/ui/primitives';

type UserRow = {
  id: string;
  username: string;
  nickname: string;
  email: string | null;
  is_admin: number;
  created_at: string;
  role_names: string[];
  role_ids: string[];
};
type Role = { id: string; role_name: string; role_code: string; description: string; status: number };

export default function UsersAdminPage() {
  const { confirm, ConfirmNode } = useConfirm();
  const [list, setList] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [msg, setMsg] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ list: UserRow[]; total: number }>(
        `/admin/users?page=${page}&page_size=${pageSize}&keyword=${encodeURIComponent(keyword)}`
      );
      setList(r.list);
      setTotal(r.total);
    } catch (e: any) { setMsg(e.message); }
  }, [page, pageSize, keyword]);

  useEffect(() => { load(); }, [load]);

  async function loadRoles() {
    try {
      const r = await api.get<Role[]>('/admin/roles');
      setRoles(r);
    } catch (e: any) { setMsg(e.message); }
  }

  // ---- 新增 ----
  const [nf, setNf] = useState({ username: '', password: '', nickname: '', is_admin: false });
  async function createUser() {
    try {
      await api.post('/admin/users', nf);
      setMsg('用户已创建'); setCreateOpen(false); setNf({ username: '', password: '', nickname: '', is_admin: false });
      await load();
    } catch (e: any) { setMsg('创建失败：' + e.message); }
  }

  // ---- 编辑 ----
  const [ef, setEf] = useState({ nickname: '', email: '', is_admin: false });
  function openEdit(u: UserRow) {
    setEditing(u);
    setEf({ nickname: u.nickname, email: u.email || '', is_admin: u.is_admin === 1 });
  }
  async function saveEdit() {
    if (!editing) return;
    try {
      await api.put(`/admin/users/${editing.id}`, ef);
      setMsg('已保存'); setEditing(null); await load();
    } catch (e: any) { setMsg('保存失败：' + e.message); }
  }

  // ---- 删除 ----
  async function del(u: UserRow) {
    const ok = await confirm(`确认删除用户「${u.username}」？此操作不可撤销。`);
    if (!ok) return;
    try {
      await api.del(`/admin/users/${u.id}`);
      setMsg('已删除'); await load();
    } catch (e: any) { setMsg('删除失败：' + e.message); }
  }

  // ---- 分配角色 ----
  const [roleUid, setRoleUid] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  function openRoles(u: UserRow) {
    setRoleUid(u.id);
    setChecked(u.role_ids);
    setRoleOpen(true);
    loadRoles();
  }
  async function saveRoles() {
    if (!roleUid) return;
    try {
      await api.post(`/admin/users/${roleUid}/roles`, { role_ids: checked });
      setMsg('角色已更新'); setRoleOpen(false); await load();
    } catch (e: any) { setMsg('分配失败：' + e.message); }
  }

  // ---- 重置密码 ----
  const [pwdUid, setPwdUid] = useState<string | null>(null);
  const [npwd, setNpwd] = useState('');
  function openPwd(u: UserRow) { setPwdUid(u.id); setNpwd(''); setPwdOpen(true); }
  async function savePwd() {
    if (!pwdUid) return;
    try {
      await api.post(`/admin/users/${pwdUid}/reset-password`, { newPassword: npwd });
      setMsg('密码已重置'); setPwdOpen(false);
    } catch (e: any) { setMsg('重置失败：' + e.message); }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold leading-tight tracking-tight text-text">用户管理</h1>
          <p className="mt-1 text-sm leading-relaxed text-text-secondary">创建 / 编辑账号、分配角色、重置密码。超级管理员账号受保护。</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ 新增用户</Button>
      </div>

      {msg && <div className="rounded-lg bg-bg px-3 py-2 text-sm text-text-secondary">{msg}</div>}

      <div className="flex gap-2">
        <Input placeholder="搜索用户名 / 昵称" value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} className="max-w-xs" />
      </div>

      <Card className="overflow-hidden">
        <Table headers={['用户名', '昵称', '邮箱', '角色', '类型', '创建时间', '操作']}>
          {list.map((u) => (
            <tr key={u.id} className="border-t border-border hover:bg-bg">
              <td className="px-3 py-2.5 text-text">{u.username}</td>
              <td className="px-3 py-2.5 text-text-secondary">{u.nickname}</td>
              <td className="px-3 py-2.5 text-text-muted text-xs">{u.email || '—'}</td>
              <td className="px-3 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {u.role_names.length ? u.role_names.map((r, i) => <Badge key={i} color="primary">{r}</Badge>) : <span className="text-text-muted text-xs">—</span>}
                </div>
              </td>
              <td className="px-3 py-2.5">{u.is_admin === 1 ? <Badge color="danger">超管</Badge> : <Badge color="muted">普通</Badge>}</td>
              <td className="px-3 py-2.5 text-text-muted text-xs">{u.created_at?.slice(0, 19) || '—'}</td>
              <td className="px-3 py-2.5">
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(u)}>编辑</Button>
                  <Button size="sm" variant="secondary" onClick={() => openRoles(u)}>角色</Button>
                  {u.is_admin !== 1 && <Button size="sm" variant="secondary" onClick={() => openPwd(u)}>密码</Button>}
                  {u.is_admin !== 1 && <Button size="sm" variant="danger" onClick={() => del(u)}>删除</Button>}
                </div>
              </td>
            </tr>
          ))}
          {!list.length && <tr><td colSpan={7} className="px-3 py-10 text-center text-text-muted">暂无用户</td></tr>}
        </Table>
      </Card>

      <div className="flex items-center gap-3 text-sm text-text-muted">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</Button>
        <span>第 {page} / {totalPages} 页（共 {total} 人）</span>
        <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>下一页</Button>
      </div>

      {/* 新增 */}
      <Modal open={createOpen} title="新增用户" onClose={() => setCreateOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setCreateOpen(false)}>取消</Button><Button onClick={createUser}>创建</Button></>}>
        <div className="space-y-3">
          <div><label className="text-sm text-text-secondary">用户名 *</label><Input value={nf.username} onChange={(e) => setNf({ ...nf, username: e.target.value })} placeholder="登录名" /></div>
          <div><label className="text-sm text-text-secondary">密码 *（≥6 位）</label><Input type="password" value={nf.password} onChange={(e) => setNf({ ...nf, password: e.target.value })} placeholder="初始密码" /></div>
          <div><label className="text-sm text-text-secondary">昵称</label><Input value={nf.nickname} onChange={(e) => setNf({ ...nf, nickname: e.target.value })} placeholder="显示名" /></div>
          <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={nf.is_admin} onChange={(e) => setNf({ ...nf, is_admin: e.target.checked })} /> 设为超级管理员</label>
        </div>
      </Modal>

      {/* 编辑 */}
      <Modal open={!!editing} title="编辑用户" onClose={() => setEditing(null)}
        footer={<><Button variant="secondary" onClick={() => setEditing(null)}>取消</Button><Button onClick={saveEdit}>保存</Button></>}>
        {editing && (
          <div className="space-y-3">
            <div><label className="text-sm text-text-secondary">昵称</label><Input value={ef.nickname} onChange={(e) => setEf({ ...ef, nickname: e.target.value })} /></div>
            <div><label className="text-sm text-text-secondary">邮箱</label><Input value={ef.email} onChange={(e) => setEf({ ...ef, email: e.target.value })} /></div>
            {editing.is_admin !== 1 && (
              <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={ef.is_admin} onChange={(e) => setEf({ ...ef, is_admin: e.target.checked })} /> 设为超级管理员</label>
            )}
            {editing.is_admin === 1 && <p className="text-xs text-warning">超级管理员权限不可通过此界面修改。</p>}
          </div>
        )}
      </Modal>

      {/* 分配角色 */}
      <Modal open={roleOpen} title="分配角色" onClose={() => setRoleOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setRoleOpen(false)}>取消</Button><Button onClick={saveRoles}>保存</Button></>}>
        <div className="space-y-2">
          {roles.map((r) => (
            <label key={r.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 cursor-pointer hover:bg-bg">
              <input type="checkbox" checked={checked.includes(r.id)} onChange={(e) => setChecked((c) => e.target.checked ? [...c, r.id] : c.filter((x) => x !== r.id))} />
              <span className="text-text">{r.role_name}</span>
              <span className="text-xs text-text-muted">{r.role_code}</span>
            </label>
          ))}
          {!roles.length && <p className="text-text-muted text-sm">暂无可选角色</p>}
        </div>
      </Modal>

      {/* 重置密码 */}
      <Modal open={pwdOpen} title="重置密码" onClose={() => setPwdOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setPwdOpen(false)}>取消</Button><Button onClick={savePwd}>重置</Button></>}>
        <div className="space-y-2">
          <label className="text-sm text-text-secondary">新密码（≥6 位）</label>
          <Input type="password" value={npwd} onChange={(e) => setNpwd(e.target.value)} placeholder="输入新密码" />
        </div>
      </Modal>

      {ConfirmNode}
    </div>
  );
}
