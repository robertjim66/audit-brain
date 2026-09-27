'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/apiClient';
import { useToast } from '@/components/ui/Toast';
import { Card, StatCard, Badge, Spinner, Table } from '@/components/ui/primitives';
import { AUDIT_TYPES, PROJECT_STATUS } from '@/lib/constants';
import type { AuditProject } from '@/types';

export default function CockpitPage() {
  const toast = useToast();
  const [list, setList] = useState<AuditProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<AuditProject[]>('/audit/projects')
      .then(setList)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [toast]);

  const stats = useMemo(() => {
    const totalProjects = list.length;
    const totalDocs = list.reduce((s, p) => s + (Number(p.doc_count) || 0), 0);
    const parsed = list.reduce((s, p) => s + (Number(p.parsed_count) || 0), 0);
    const findings = list.reduce((s, p) => s + (Number(p.finding_count) || 0), 0);
    return { totalProjects, totalDocs, parsed, findings };
  }, [list]);

  const recent = list.slice(0, 6);

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size={28} /></div>;
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-text mb-1">审计驾驶舱</h1>
      <p className="text-sm text-text-muted mb-5">工程审计全局概览</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="审计项目" value={stats.totalProjects} color="primary" />
        <StatCard label="资料总数" value={stats.totalDocs} color="warning" />
        <StatCard label="已解析资料" value={stats.parsed} color="success" />
        <StatCard label="疑点总数" value={stats.findings} color="danger" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-text">最近项目</h2>
            <Link href="/projects" className="text-sm text-primary hover:underline">查看全部</Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-text-muted py-8 text-center">暂无项目，<Link href="/projects" className="text-primary">去创建</Link></p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recent.map((p) => (
                <Link key={p.id} href="/documents" className="block">
                  <div className="border border-border rounded-lg p-3 hover:border-primary transition-colors">
                    <div className="font-medium text-text truncate">{p.project_name}</div>
                    <div className="text-xs text-text-muted mt-1">
                      {AUDIT_TYPES.find((t) => t.value === p.audit_type)?.label} · 资料 {p.doc_count || 0}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-text mb-3">项目核对状态</h2>
          {list.length === 0 ? (
            <p className="text-sm text-text-muted">暂无数据</p>
          ) : (
            <Table headers={['项目', '状态', '疑点']}>
              {list.slice(0, 8).map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2 text-text truncate max-w-[140px]">{p.project_name}</td>
                  <td className="px-3 py-2"><Badge color={p.status === 1 ? 'success' : 'primary'}>{PROJECT_STATUS.find((s) => s.value === p.status)?.label}</Badge></td>
                  <td className="px-3 py-2 text-danger">{p.finding_count || 0}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
