'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/apiClient';
import { Button, Card, Modal, Input, Badge, useConfirm } from '@/components/ui/primitives';

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

export default function MenusAdminPage() {
  const { confirm, ConfirmNode } = useConfirm();
  const [list, setList] = useState<Menu[]>([]);
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState<Menu | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get<Menu[]>('/admin/menus'); setList(r); }
    catch (e: any) { setMsg(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const topMenus = list.filter((m) => m.parent_id === 0);
  const childrenOf = (pid: number) => list.filter((m) => m.parent_id === pid).sort((a, b) => a.sort_no - b.sort_no);
  const parentName = (id: number) => list.find((m) => m.id === id)?.menu_name || '';

  // 新增
  const [nf, setNf] = useState({ menu_name: '', menu_icon: '📄', menu_url: '', parent_id: 0, menu_type: 0, perm_key: '', sort_no: 99 });
  async function createMenu() {
    if (nf.menu_type === 0 && !nf.menu_url.trim()) { setMsg('菜单页面路径不能为空'); return; }
    if (nf.menu_type === 1 && !nf.perm_key.trim()) { setMsg('按钮权限标识不能为空'); return; }
    try {
      await api.post('/admin/menus', nf);
      setMsg('菜单已创建'); setCreateOpen(false); setNf({ menu_name: '', menu_icon: '📄', menu_url: '', parent_id: 0, menu_type: 0, perm_key: '', sort_no: 99 }); await load();
    } catch (e: any) { setMsg('创建失败：' + e.message); }
  }

  // 编辑
  const [ef, setEf] = useState({ menu_name: '', menu_icon: '', menu_url: '', sort_no: 0, is_enabled: 1, parent_id: 0, menu_type: 0, perm_key: '' });
  function openEdit(m: Menu) {
    setEditing(m);
    setEf({ menu_name: m.menu_name, menu_icon: m.menu_icon, menu_url: m.menu_url, sort_no: m.sort_no, is_enabled: m.is_enabled, parent_id: m.parent_id, menu_type: m.menu_type, perm_key: m.perm_key || '' });
  }
  async function saveEdit() {
    if (!editing) return;
    try { await api.put(`/admin/menus/${editing.id}`, ef); setMsg('已保存'); setEditing(null); await load(); }
    catch (e: any) { setMsg('保存失败：' + e.message); }
  }

  // 删除
  async function del(m: Menu) {
    const kids = childrenOf(m.id);
    const ok = await confirm(`确认删除菜单「${m.menu_name}」？${kids.length ? `将连带删除 ${kids.length} 个子项。` : ''}内置菜单不可删。`);
    if (!ok) return;
    try { await api.del(`/admin/menus/${m.id}`); setMsg('已删除'); await load(); }
    catch (e: any) { setMsg('删除失败：' + e.message); }
  }

  function Row({ m, depth }: { m: Menu; depth: number }) {
    return (
      <div style={{ marginLeft: depth * 24 }} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 hover:bg-bg">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">{m.menu_icon}</span>
          <span className="text-text font-medium truncate">{m.menu_name}</span>
          {m.menu_type === 1 ? <Badge color="muted">按钮</Badge> : <span className="text-xs text-text-muted truncate">{m.menu_url || '—'}</span>}
          {m.menu_type === 1 && m.perm_key && <span className="text-xs text-text-muted">{m.perm_key}</span>}
          {m.is_builtin === 1 && <span className="text-xs text-warning">内置</span>}
          {m.is_enabled === 0 && <Badge color="muted">停用</Badge>}
        </div>
        <div className="flex gap-1.5 shrink-0 ml-2">
          <Button size="sm" variant="secondary" onClick={() => openEdit(m)}>编辑</Button>
          {m.is_builtin !== 1 && <Button size="sm" variant="danger" onClick={() => del(m)}>删除</Button>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">菜单管理</h1>
          <p className="text-sm text-text-muted">管理后台导航菜单与按钮权限。内置菜单（分组/按钮）不可删除。</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ 新增菜单</Button>
      </div>

      {msg && <div className="rounded-lg bg-bg px-3 py-2 text-sm text-text-secondary">{msg}</div>}

      <div className="space-y-2">
        {topMenus.sort((a, b) => a.sort_no - b.sort_no).map((p) => (
          <div key={p.id} className="space-y-2">
            <Row m={p} depth={0} />
            {childrenOf(p.id).map((c) => <Row key={c.id} m={c} depth={1} />)}
          </div>
        ))}
        {!list.length && <p className="text-text-muted text-sm">暂无菜单</p>}
      </div>

      {/* 新增 */}
      <Modal open={createOpen} title="新增菜单" onClose={() => setCreateOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setCreateOpen(false)}>取消</Button><Button onClick={createMenu}>创建</Button></>}>
        <div className="space-y-3">
          <div><label className="text-sm text-text-secondary">名称 *</label><Input value={nf.menu_name} onChange={(e) => setNf({ ...nf, menu_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm text-text-secondary">图标</label><Input value={nf.menu_icon} onChange={(e) => setNf({ ...nf, menu_icon: e.target.value })} /></div>
            <div><label className="text-sm text-text-secondary">排序号</label><Input type="number" value={nf.sort_no} onChange={(e) => setNf({ ...nf, sort_no: Number(e.target.value) })} /></div>
          </div>
          <div><label className="text-sm text-text-secondary">父级</label>
            <select className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text" value={nf.parent_id} onChange={(e) => setNf({ ...nf, parent_id: Number(e.target.value) })}>
              <option value={0}>（一级菜单）</option>
              {topMenus.map((m) => <option key={m.id} value={m.id}>{m.menu_name}</option>)}
            </select>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="radio" checked={nf.menu_type === 0} onChange={() => setNf({ ...nf, menu_type: 0 })} /> 菜单</label>
            <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="radio" checked={nf.menu_type === 1} onChange={() => setNf({ ...nf, menu_type: 1 })} /> 按钮</label>
          </div>
          {nf.menu_type === 0
            ? <div><label className="text-sm text-text-secondary">页面路径 *</label><Input value={nf.menu_url} onChange={(e) => setNf({ ...nf, menu_url: e.target.value })} placeholder="/admin/xxx" /></div>
            : <div><label className="text-sm text-text-secondary">权限标识 *</label><Input value={nf.perm_key} onChange={(e) => setNf({ ...nf, perm_key: e.target.value })} placeholder="user:add" /></div>}
        </div>
      </Modal>

      {/* 编辑 */}
      <Modal open={!!editing} title="编辑菜单" onClose={() => setEditing(null)}
        footer={<><Button variant="secondary" onClick={() => setEditing(null)}>取消</Button><Button onClick={saveEdit}>保存</Button></>}>
        {editing && (
          <div className="space-y-3">
            <div><label className="text-sm text-text-secondary">名称</label><Input value={ef.menu_name} onChange={(e) => setEf({ ...ef, menu_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm text-text-secondary">图标</label><Input value={ef.menu_icon} onChange={(e) => setEf({ ...ef, menu_icon: e.target.value })} /></div>
              <div><label className="text-sm text-text-secondary">排序号</label><Input type="number" value={ef.sort_no} onChange={(e) => setEf({ ...ef, sort_no: Number(e.target.value) })} /></div>
            </div>
            <div><label className="text-sm text-text-secondary">父级</label>
              <select className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text" value={ef.parent_id} onChange={(e) => setEf({ ...ef, parent_id: Number(e.target.value) })}>
                <option value={0}>（一级菜单）</option>
                {topMenus.filter((m) => m.id !== editing.id).map((m) => <option key={m.id} value={m.id}>{m.menu_name}</option>)}
              </select>
            </div>
            {ef.menu_type === 0
              ? <div><label className="text-sm text-text-secondary">页面路径</label><Input value={ef.menu_url} onChange={(e) => setEf({ ...ef, menu_url: e.target.value })} /></div>
              : <div><label className="text-sm text-text-secondary">权限标识</label><Input value={ef.perm_key} onChange={(e) => setEf({ ...ef, perm_key: e.target.value })} /></div>}
            <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={ef.is_enabled === 1} onChange={(e) => setEf({ ...ef, is_enabled: e.target.checked ? 1 : 0 })} /> 启用</label>
          </div>
        )}
      </Modal>

      {ConfirmNode}
    </div>
  );
}
