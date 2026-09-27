'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/apiClient';
import { Button, Card, Modal, Input, Badge, Table, useConfirm } from '@/components/ui/primitives';

type Role = {
  id: string;
  role_name: string;
  role_code: string;
  description: string;
  status: number;
  sort_no: number;
  user_count: number;
  menu_ids: number[];
};
type Menu = {
  id: number;
  page_key: string;
  menu_name: string;
  menu_icon: string;
  menu_url: string;
  sort_no: number;
  is_enabled: number;
  is_builtin: number;
  parent_id: number;
  menu_type: number;
  perm_key: string | null;
};

export default function RolesAdminPage() {
  const { confirm, ConfirmNode } = useConfirm();
  const [list, setList] = useState<Role[]>([]);
  const [msg, setMsg] = useState('');
  const [menus, setMenus] = useState<Menu[]>([]);

  const [editing, setEditing] = useState<Role | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get<Role[]>('/admin/roles');
      setList(r);
    } catch (e: any) { setMsg(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function loadMenus() {
    try { const r = await api.get<Menu[]>('/admin/menus'); setMenus(r); } catch (e: any) { setMsg(e.message); }
  }

  // 新增
  const [nf, setNf] = useState({ role_name: '', role_code: '', description: '', status: 1 });
  async function createRole() {
    if (!/^[A-Z_]+$/.test(nf.role_code.trim().toUpperCase())) { setMsg('角色标识只能为大写字母和下划线'); return; }
    try {
      await api.post('/admin/roles', { ...nf, role_code: nf.role_code.trim().toUpperCase() });
      setMsg('角色已创建'); setCreateOpen(false); setNf({ role_name: '', role_code: '', description: '', status: 1 }); await load();
    } catch (e: any) { setMsg('创建失败：' + e.message); }
  }

  // 编辑
  const [ef, setEf] = useState({ role_name: '', description: '', status: 1, sort_no: 0 });
  function openEdit(r: Role) { setEditing(r); setEf({ role_name: r.role_name, description: r.description, status: r.status, sort_no: r.sort_no }); }
  async function saveEdit() {
    if (!editing) return;
    try { await api.put(`/admin/roles/${editing.id}`, ef); setMsg('已保存'); setEditing(null); await load(); }
    catch (e: any) { setMsg('保存失败：' + e.message); }
  }

  // 删除
  async function del(r: Role) {
    const ok = await confirm(`确认删除角色「${r.role_name}」？该角色下的用户关联将被清除。`);
    if (!ok) return;
    try { await api.del(`/admin/roles/${r.id}`); setMsg('已删除'); await load(); }
    catch (e: any) { setMsg('删除失败：' + e.message); }
  }

  // 分配菜单
  const [menuRid, setMenuRid] = useState<string | null>(null);
  const [checked, setChecked] = useState<number[]>([]);
  function openMenus(r: Role) {
    setMenuRid(r.id); setChecked(r.menu_ids); setMenuOpen(true); loadMenus();
  }
  async function saveMenus() {
    if (!menuRid) return;
    try { await api.put(`/admin/roles/${menuRid}/menus`, { menu_ids: checked }); setMsg('菜单权限已更新'); setMenuOpen(false); await load(); }
    catch (e: any) { setMsg('保存失败：' + e.message); }
  }

  // 菜单树（按 parent_id 缩进）
  function renderMenu(m: Menu, depth: number) {
    return (
      <label key={m.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 cursor-pointer hover:bg-bg" style={{ marginLeft: depth * 16 }}>
        <input type="checkbox" checked={checked.includes(m.id)} onChange={(e) => setChecked((c) => e.target.checked ? [...c, m.id] : c.filter((x) => x !== m.id))} />
        <span className="text-text">{m.menu_icon} {m.menu_name}</span>
        {m.menu_type === 1 && <Badge color="muted">按钮</Badge>}
        {m.is_builtin === 1 && <span className="text-xs text-text-muted">内置</span>}
      </label>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">角色管理</h1>
          <p className="text-sm text-text-muted">定义角色及其菜单/按钮权限。预置角色 ADMIN / AUDITOR 不可删除。</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ 新增角色</Button>
      </div>

      {msg && <div className="rounded-lg bg-bg px-3 py-2 text-sm text-text-secondary">{msg}</div>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {list.map((r) => (
          <Card key={r.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-text">{r.role_name}</div>
                <div className="text-xs text-text-muted">{r.role_code}</div>
              </div>
              {r.status === 1 ? <Badge color="success">启用</Badge> : <Badge color="muted">停用</Badge>}
            </div>
            <p className="text-sm text-text-secondary line-clamp-2">{r.description || '—'}</p>
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span>用户 {r.user_count}</span>
              <span>权限项 {r.menu_ids.length}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Button size="sm" variant="secondary" onClick={() => openEdit(r)}>编辑</Button>
              <Button size="sm" variant="secondary" onClick={() => openMenus(r)}>配置菜单</Button>
              {!['1', '2'].includes(r.id) && <Button size="sm" variant="danger" onClick={() => del(r)}>删除</Button>}
            </div>
          </Card>
        ))}
      </div>

      {/* 新增 */}
      <Modal open={createOpen} title="新增角色" onClose={() => setCreateOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setCreateOpen(false)}>取消</Button><Button onClick={createRole}>创建</Button></>}>
        <div className="space-y-3">
          <div><label className="text-sm text-text-secondary">角色名称 *</label><Input value={nf.role_name} onChange={(e) => setNf({ ...nf, role_name: e.target.value })} /></div>
          <div><label className="text-sm text-text-secondary">角色标识 *（大写字母+下划线，如 AUDITOR）</label><Input value={nf.role_code} onChange={(e) => setNf({ ...nf, role_code: e.target.value.toUpperCase() })} placeholder="AUDITOR" /></div>
          <div><label className="text-sm text-text-secondary">描述</label><Input value={nf.description} onChange={(e) => setNf({ ...nf, description: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={nf.status === 1} onChange={(e) => setNf({ ...nf, status: e.target.checked ? 1 : 0 })} /> 启用</label>
        </div>
      </Modal>

      {/* 编辑 */}
      <Modal open={!!editing} title="编辑角色" onClose={() => setEditing(null)}
        footer={<><Button variant="secondary" onClick={() => setEditing(null)}>取消</Button><Button onClick={saveEdit}>保存</Button></>}>
        {editing && (
          <div className="space-y-3">
            <div><label className="text-sm text-text-secondary">角色名称</label><Input value={ef.role_name} onChange={(e) => setEf({ ...ef, role_name: e.target.value })} /></div>
            <div><label className="text-sm text-text-secondary">描述</label><Input value={ef.description} onChange={(e) => setEf({ ...ef, description: e.target.value })} /></div>
            <div><label className="text-sm text-text-secondary">排序号</label><Input type="number" value={ef.sort_no} onChange={(e) => setEf({ ...ef, sort_no: Number(e.target.value) })} /></div>
            <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={ef.status === 1} onChange={(e) => setEf({ ...ef, status: e.target.checked ? 1 : 0 })} /> 启用</label>
          </div>
        )}
      </Modal>

      {/* 配置菜单 */}
      <Modal open={menuOpen} title="配置菜单权限" onClose={() => setMenuOpen(false)} width="max-w-2xl"
        footer={<><Button variant="secondary" onClick={() => setMenuOpen(false)}>取消</Button><Button onClick={saveMenus}>保存</Button></>}>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {menus
            .filter((m) => m.parent_id === 0)
            .map((p) => (
              <div key={p.id} className="space-y-2">
                {renderMenu(p, 0)}
                {menus.filter((c) => c.parent_id === p.id).map((c) => renderMenu(c, 1))}
              </div>
            ))}
        </div>
      </Modal>

      {ConfirmNode}
    </div>
  );
}
