'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/apiClient';
import { Button, Card, Modal, Input, Badge, Table, useConfirm } from '@/components/ui/primitives';

type DictItem = {
  id: string;
  dict_type: string;
  dict_code: string;
  dict_label: string;
  dict_icon: string | null;
  sort_order: number;
  status: number;
  remark?: string;
};

export default function DictAdminPage() {
  const { confirm, ConfirmNode } = useConfirm();
  const [types, setTypes] = useState<string[]>([]);
  const [active, setActive] = useState<string>('');
  const [items, setItems] = useState<DictItem[]>([]);
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState<DictItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newType, setNewType] = useState('');

  const loadTypes = useCallback(async () => {
    try { const r = await api.get<string[]>('/admin/dict/types'); setTypes(r); if (!active && r.length) setActive(r[0]); }
    catch (e: any) { setMsg(e.message); }
  }, [active]);

  const loadItems = useCallback(async () => {
    if (!active) return;
    try { const r = await api.get<DictItem[]>('/admin/dict?type=' + encodeURIComponent(active)); setItems(r); }
    catch (e: any) { setMsg(e.message); }
  }, [active]);

  useEffect(() => { loadTypes(); }, [loadTypes]);
  useEffect(() => { loadItems(); }, [loadItems]);

  async function addType() {
    const t = newType.trim();
    if (!t) return;
    if (types.includes(t)) { setMsg('该类型已存在'); return; }
    // 用一个空项触发类型创建（POST 校验 type/code/label 必填，故用占位码）
    try {
      await api.post('/admin/dict', { dict_type: t, dict_code: '_init', dict_label: '初始化项', status: 1 });
      setTypes((p) => [...p, t].sort()); setActive(t); setNewType('');
      await loadItems();
    } catch (e: any) { setMsg('创建类型失败：' + e.message); }
  }

  // 新增
  const [nf, setNf] = useState({ dict_code: '', dict_label: '', dict_icon: '', sort_order: 0, status: 1 });
  async function createItem() {
    try {
      await api.post('/admin/dict', { ...nf, dict_type: active });
      setMsg('已添加'); setCreateOpen(false); setNf({ dict_code: '', dict_label: '', dict_icon: '', sort_order: 0, status: 1 }); await loadItems();
    } catch (e: any) { setMsg('添加失败：' + e.message); }
  }

  // 编辑
  const [ef, setEf] = useState({ dict_label: '', dict_icon: '', sort_order: 0, status: 1 });
  function openEdit(d: DictItem) { setEditing(d); setEf({ dict_label: d.dict_label, dict_icon: d.dict_icon || '', sort_order: d.sort_order, status: d.status }); }
  async function saveEdit() {
    if (!editing) return;
    try { await api.put(`/admin/dict/${editing.id}`, ef); setMsg('已保存'); setEditing(null); await loadItems(); }
    catch (e: any) { setMsg('保存失败：' + e.message); }
  }

  async function del(d: DictItem) {
    const ok = await confirm(`确认删除字典项「${d.dict_label}」(${d.dict_code})？`);
    if (!ok) return;
    try { await api.del(`/admin/dict/${d.id}`); setMsg('已删除'); await loadItems(); }
    catch (e: any) { setMsg('删除失败：' + e.message); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-text">字典管理</h1>
        <p className="text-sm text-text-muted">维护各业务模块的下拉/标签字典项，按类型分组管理。</p>
      </div>

      {msg && <div className="rounded-lg bg-bg px-3 py-2 text-sm text-text-secondary">{msg}</div>}

      <div className="grid gap-5 md:grid-cols-[220px_1fr]">
        {/* 类型列 */}
        <Card className="p-3 space-y-2 self-start">
          <div className="text-sm font-medium text-text-secondary">字典类型</div>
          <div className="space-y-1">
            {types.map((t) => (
              <button key={t} onClick={() => setActive(t)}
                className={`block w-full text-left rounded-lg px-3 py-1.5 text-sm ${active === t ? 'bg-primary/10 text-primary font-medium' : 'text-text-secondary hover:bg-bg'}`}>
                {t}
              </button>
            ))}
            {!types.length && <p className="text-xs text-text-muted px-3">暂无类型</p>}
          </div>
          <div className="flex gap-1.5 pt-2 border-t border-border">
            <Input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="新类型" className="text-xs py-1" />
            <Button size="sm" onClick={addType}>+</Button>
          </div>
        </Card>

        {/* 项列表 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-text-secondary">当前类型：<span className="text-text">{active || '—'}</span>（{items.length} 项）</h2>
            <Button size="sm" disabled={!active} onClick={() => setCreateOpen(true)}>+ 新增项</Button>
          </div>

          <Card className="overflow-hidden">
            <Table headers={['编码', '名称', '图标', '排序', '状态', '操作']}>
              {items.map((d) => (
                <tr key={d.id} className="border-t border-border hover:bg-bg">
                  <td className="px-3 py-2.5 text-text-muted text-xs">{d.dict_code}</td>
                  <td className="px-3 py-2.5 text-text">{d.dict_label}</td>
                  <td className="px-3 py-2.5 text-text-secondary">{d.dict_icon || '—'}</td>
                  <td className="px-3 py-2.5 text-text-muted text-xs">{d.sort_order}</td>
                  <td className="px-3 py-2.5">{d.status === 1 ? <Badge color="success">启用</Badge> : <Badge color="muted">停用</Badge>}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(d)}>编辑</Button>
                      <Button size="sm" variant="danger" onClick={() => del(d)}>删除</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!!active && !items.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-text-muted">该类型暂无字典项，点击右上角新增。</td></tr>}
              {!active && <tr><td colSpan={6} className="px-3 py-8 text-center text-text-muted">请先在左侧选择或新增字典类型。</td></tr>}
            </Table>
          </Card>
        </div>
      </div>

      {/* 新增 */}
      <Modal open={createOpen} title={`新增字典项（${active}）`} onClose={() => setCreateOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setCreateOpen(false)}>取消</Button><Button onClick={createItem}>添加</Button></>}>
        <div className="space-y-3">
          <div><label className="text-sm text-text-secondary">编码 *</label><Input value={nf.dict_code} onChange={(e) => setNf({ ...nf, dict_code: e.target.value })} placeholder="如 high / pending" /></div>
          <div><label className="text-sm text-text-secondary">名称 *</label><Input value={nf.dict_label} onChange={(e) => setNf({ ...nf, dict_label: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm text-text-secondary">图标</label><Input value={nf.dict_icon} onChange={(e) => setNf({ ...nf, dict_icon: e.target.value })} placeholder="emoji" /></div>
            <div><label className="text-sm text-text-secondary">排序</label><Input type="number" value={nf.sort_order} onChange={(e) => setNf({ ...nf, sort_order: Number(e.target.value) })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={nf.status === 1} onChange={(e) => setNf({ ...nf, status: e.target.checked ? 1 : 0 })} /> 启用</label>
        </div>
      </Modal>

      {/* 编辑 */}
      <Modal open={!!editing} title="编辑字典项" onClose={() => setEditing(null)}
        footer={<><Button variant="secondary" onClick={() => setEditing(null)}>取消</Button><Button onClick={saveEdit}>保存</Button></>}>
        {editing && (
          <div className="space-y-3">
            <div className="text-xs text-text-muted">类型 {editing.dict_type} · 编码 {editing.dict_code}</div>
            <div><label className="text-sm text-text-secondary">名称</label><Input value={ef.dict_label} onChange={(e) => setEf({ ...ef, dict_label: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm text-text-secondary">图标</label><Input value={ef.dict_icon} onChange={(e) => setEf({ ...ef, dict_icon: e.target.value })} /></div>
              <div><label className="text-sm text-text-secondary">排序</label><Input type="number" value={ef.sort_order} onChange={(e) => setEf({ ...ef, sort_order: Number(e.target.value) })} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={ef.status === 1} onChange={(e) => setEf({ ...ef, status: e.target.checked ? 1 : 0 })} /> 启用</label>
          </div>
        )}
      </Modal>

      {ConfirmNode}
    </div>
  );
}
