'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card } from '@/components/ui/primitives';

export default function ModulePlaceholder({ title, desc }: { title: string; desc?: string }) {
  const router = useRouter();
  return (
    <div>
      <h1 className="text-xl font-bold text-text mb-1">{title}</h1>
      <p className="text-sm text-text-muted mb-5">{desc || '该模块正在建设中'}</p>
      <Card className="py-16 text-center">
        <div className="text-5xl mb-3">🚧</div>
        <p className="text-text-secondary">模块建设中</p>
        <p className="text-sm text-text-muted mt-1">已完成模块：认证 · 审计项目 · 驾驶舱。其余模块正在持续完善中。</p>
        <Button variant="secondary" className="mt-4" onClick={() => router.push('/projects')}>返回项目列表</Button>
      </Card>
    </div>
  );
}
