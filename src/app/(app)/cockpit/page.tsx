'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/apiClient';
import { useToast } from '@/components/ui/Toast';
import { useProject } from '@/components/layout/Providers';
import {
  StatCard, Badge, Spinner, Table, Tr, Td, PageHeader, Section, EmptyState,
} from '@/components/ui/primitives';
import {
  IconProjects, IconDocuments, IconScan, IconFindings, IconPlus, IconArrowRight, IconChevronRight,
} from '@/components/ui/icons';
import { AUDIT_TYPES, PROJECT_STATUS } from '@/lib/constants';
import type { AuditProject } from '@/types';

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const all = total > 0 && done >= total;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-full min-w-[60px] overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full transition-all duration-300 ${all ? 'bg-success' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="num shrink-0 text-2xs text-text-muted">{pct}%</span>
    </div>
  );
}

export default function CockpitPage() {
  const toast = useToast();
  const { setCurrentProject } = useProject();
  const [list, setList] = useState<AuditProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<AuditProject[]>('/audit/projects')
      .then(setList)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [toast]);

  const stats = useMemo(() => {
    const docs = list.reduce((s, p) => s + (Number(p.doc_count) || 0), 0);
    const parsed = list.reduce((s, p) => s + (Number(p.parsed_count) || 0), 0);
    const failed = list.reduce((s, p) => s + (Number(p.failed_count) || 0), 0);
    const findings = list.reduce((s, p) => s + (Number(p.finding_count) || 0), 0);
    const ongoing = list.filter((p) => p.status === 1).length;
    return { docs, parsed, failed, findings, ongoing, rate: docs ? Math.round((parsed / docs) * 100) : 0 };
  }, [list]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size={26} />
      </div>
    );
  }

  const ongoingList = list.filter((p) => p.status === 1);

  return (
    <div className="space-y-5">
      <PageHeader
        title="审计驾驶舱"
        description="全局概览：项目进度、资料解析情况与疑点分布。所有操作都作用于顶栏当前选中的项目。"
        actions={
          <Link href="/projects">
            <ButtonLike>
              <IconPlus size={15} />
              新建项目
            </ButtonLike>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="审计项目"
          value={list.length}
          hint={`进行中 ${stats.ongoing}`}
          color="primary"
          icon={IconProjects}
        />
        <StatCard
          label="资料总数"
          value={stats.docs}
          hint={stats.failed ? `解析失败 ${stats.failed}` : '份已上传资料'}
          color="muted"
          icon={IconDocuments}
        />
        <StatCard
          label="已解析资料"
          value={stats.parsed}
          hint={`解析率 ${stats.rate}%`}
          color="success"
          icon={IconScan}
        />
        <StatCard
          label="疑点总数"
          value={stats.findings}
          hint="来自核对差异与规则扫描"
          color="danger"
          icon={IconFindings}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ============ 进行中的项目 ============ */}
        <Section
          className="lg:col-span-2"
          bodyClassName="p-0"
          title="进行中的项目"
          description="资料解析进度与疑点数量"
          actions={
            <Link
              href="/projects"
              className="inline-flex items-center gap-1 text-xs text-primary transition-colors hover:text-primary-hover"
            >
              查看全部
              <IconChevronRight size={13} />
            </Link>
          }
        >
          {list.length === 0 ? (
            <EmptyState
              icon={IconProjects}
              title="还没有审计项目"
              hint="一个项目就是一个独立的审计空间，资料、核对结果、疑点都归属在它下面。"
              action={
                <Link href="/projects">
                  <ButtonLike>
                    <IconPlus size={15} />
                    创建第一个项目
                  </ButtonLike>
                </Link>
              }
            />
          ) : ongoingList.length === 0 ? (
            <EmptyState
              icon={IconProjects}
              title="没有进行中的项目"
              hint={`共 ${list.length} 个项目，均已标记完成。`}
              action={
                <Link href="/projects" className="text-xs text-primary hover:underline">
                  前往项目管理
                </Link>
              }
            />
          ) : (
            <div>
              {ongoingList.slice(0, 7).map((p) => {
                const docs = Number(p.doc_count) || 0;
                const parsed = Number(p.parsed_count) || 0;
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    onClick={() => setCurrentProject(String(p.id))}
                    className="group flex items-center gap-4 border-b border-border px-4 py-3 transition-colors last:border-0 hover:bg-surface2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-text">{p.project_name}</span>
                        {p.my_role === 'reviewer' && (
                          <span className="shrink-0 rounded border border-border px-1.5 py-px text-2xs text-text-muted">
                            参与
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-2xs text-text-muted">
                        {p.project_code && <span className="num shrink-0">{p.project_code}</span>}
                        {p.project_code && <span className="text-border-strong">·</span>}
                        <span className="truncate">
                          {AUDIT_TYPES.find((t) => t.value === p.audit_type)?.label || p.audit_type}
                        </span>
                        {p.audit_period && (
                          <>
                            <span className="text-border-strong">·</span>
                            <span className="num shrink-0">{p.audit_period}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="hidden w-40 shrink-0 sm:block">
                      <ProgressBar done={parsed} total={docs} />
                      <div className="num mt-1 text-2xs text-text-muted">
                        已解析 {parsed}/{docs}
                      </div>
                    </div>

                    <div className="w-16 shrink-0 text-right">
                      <div
                        className={`num text-sm font-semibold ${
                          Number(p.finding_count) > 0 ? 'text-danger' : 'text-text-muted'
                        }`}
                      >
                        {p.finding_count || 0}
                      </div>
                      <div className="text-2xs text-text-muted">疑点</div>
                    </div>

                    <IconArrowRight
                      size={15}
                      className="shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </Link>
                );
              })}
            </div>
          )}
        </Section>

        {/* ============ 项目概览 ============ */}
        <Section title="项目概览" description="全部项目的状态与疑点" bodyClassName="p-0">
          {list.length === 0 ? (
            <EmptyState icon={IconDocuments} title="暂无数据" />
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              <Table
                headers={['项目', '状态', '疑点']}
                align={['left', 'left', 'right']}
                className="rounded-none border-0"
                sticky
              >
                {list.slice(0, 12).map((p) => (
                  <Tr key={p.id}>
                    <Td className="max-w-[150px] truncate">{p.project_name}</Td>
                    <Td>
                      <Badge color={p.status === 1 ? 'success' : 'muted'} dot>
                        {PROJECT_STATUS.find((s) => s.value === p.status)?.label || '—'}
                      </Badge>
                    </Td>
                    <Td align="right">
                      <span
                        className={`num ${
                          Number(p.finding_count) > 0 ? 'font-medium text-danger' : 'text-text-muted'
                        }`}
                      >
                        {p.finding_count || 0}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </Table>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

/** 顶栏操作区里的按钮样式（与 Button 保持一致，包在 Link 里避免嵌套 button） */
function ButtonLike({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-[7px] text-sm font-medium text-primary-fg shadow-sm transition-all duration-150 hover:bg-primary-hover active:translate-y-px">
      {children}
    </span>
  );
}
