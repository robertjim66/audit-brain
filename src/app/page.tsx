'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/apiClient';
import {
  IconShieldCheck, IconClock, IconLock, IconDocuments, IconFileSpreadsheet,
  IconChat, IconFindings, IconDownload, IconArrowRight,
} from '@/components/ui/icons';

/* ============================================================
   动效原语：JS 门控，避免无脚本 / 爬虫环境内容不可见
   - enhanced：仅当支持 IntersectionObserver 且未开启"减少动效"时为 true
   - Reveal：进入视口淡入上移，错开延迟做出层次
   - CountUp：进入视口从 0 缓出到目标值
   ============================================================ */
function Reveal({
  children, enhanced, delay = 0, className = '',
}: {
  children: React.ReactNode;
  enhanced: boolean;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!enhanced) { setInView(true); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setInView(true); io.disconnect(); }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enhanced]);

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`${className} ${enhanced ? 'transition-all duration-700 ease-smooth' : ''} ${
        enhanced && !inView ? 'opacity-0 translate-y-[18px]' : ''
      }`}
    >
      {children}
    </div>
  );
}

function CountUp({
  value, enhanced, className = '',
}: {
  value: number;
  enhanced: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(enhanced ? 0 : value);

  useEffect(() => {
    if (!enhanced) { setDisplay(value); return; }
    const el = ref.current;
    if (!el) return;
    let started = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          started = true;
          io.disconnect();
          const dur = 1100;
          let start: number | null = null;
          const step = (now: number) => {
            if (start === null) start = now;
            const p = Math.min(1, (now - start) / dur);
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplay(Math.round(value * eased));
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enhanced, value]);

  return (
    <span ref={ref} className={`num ${className}`}>
      {display.toLocaleString('en-US')}
    </span>
  );
}

/* ============================================================
   落地页数据
   ============================================================ */
const FEATURES = [
  {
    icon: IconDocuments,
    title: '资料上传与自动解析',
    desc: '清单、结算、合同、签证、发票、照片分类上传。Excel / Word 本机解析，PDF 与图片走 OCR 识别，全程无需人工录入。',
  },
  {
    icon: IconFileSpreadsheet,
    title: '清单 ↔ 结算勾稽',
    desc: '按 9–13 位清单项目编码配对两侧，逐项比对工程量、综合单价与合价，自动汇总核增核减金额。',
  },
  {
    icon: IconShieldCheck,
    title: '三方签章证据链核对',
    desc: '检查签证与合同的建设、监理、施工三方签章，识别"有栏无章"与"未见该方"，判断能否作为结算依据。',
  },
  {
    icon: IconChat,
    title: '带证据出处的问答',
    desc: '就资料内容直接提问，回答附带证据角标，可回跳到原文位置与页码 —— 每条说法都能自己核一遍。',
  },
  {
    icon: IconFindings,
    title: '疑点台账与处置留痕',
    desc: '量差、签章、凑整金额、连号发票、集中签证、资料缺口六类规则扫描。改状态即记录处理人与时间。',
  },
  {
    icon: IconDownload,
    title: '一键导出成果',
    desc: 'Excel 核对台账作为内部工作底稿（含处理人），Word 疑点发现清单用于对外报告（不含内部责任信息）。',
  },
];

const STEPS = [
  { n: 1, title: '建项目', desc: '确定审计对象与类型，得到一个独立空间' },
  { n: 2, title: '传资料', desc: '上传并标注业务类别，类别决定系统拿它做什么' },
  { n: 3, title: 'AI 识读', desc: '自动解析成可检索、可比对的内容' },
  { n: 4, title: '跑核对', desc: '执行勾稽程序，产出差异清单' },
  { n: 5, title: '沉淀疑点', desc: '差异自动转疑点，按风险分级待你核查' },
  { n: 6, title: '出报告', desc: '导出 Excel 台账或 Word 发现清单' },
];

const MOCK_ROWS = [
  { title: '结算综合单价高于中标清单 12%', sub: '量差异常 · 子目 011001001', level: '高', color: 'danger', amount: '¥1,286,400' },
  { title: '签证单缺监理单位签章', sub: '签章异常 · QZ-2026-037 第 2 页', level: '高', color: 'danger', amount: '¥98,250' },
  { title: '合价为整千数，疑似估算', sub: '凑整金额 · 子目 020502003', level: '中', color: 'warning', amount: '¥250,000' },
  { title: '30 天内集中补办签证 4 份', sub: '集中签证 · 竣工后补单', level: '待处理', color: 'primary', amount: '¥412,600' },
] as const;

/* ============================================================
   页面
   ============================================================ */
export default function Home() {
  const router = useRouter();
  const [enhanced, setEnhanced] = useState(false);

  // 已登录用户直接进工作台；同时判定是否启用动效
  useEffect(() => {
    if (getToken()) {
      router.replace('/cockpit');
      return;
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setEnhanced(reduce ? false : typeof IntersectionObserver !== 'undefined');
  }, [router]);

  return (
    <div className="bg-bg text-text">
      {/* ============ 顶栏 ============ */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex h-[60px] max-w-[1120px] items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-primary text-primary-fg">
              <IconShieldCheck size={20} />
            </span>
            <span className="leading-tight">
              <span className="block text-[15px] font-semibold">审计智脑</span>
              <span className="block text-[10px] tracking-[0.1em] text-text-muted">AUDITBRAIN</span>
            </span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#features" className="hidden text-sm text-text-secondary hover:text-text sm:block">功能</a>
            <a href="#flow" className="hidden text-sm text-text-secondary hover:text-text sm:block">怎么用</a>
            <Link
              href="/login"
              className="rounded-lg bg-primary px-[18px] py-2 text-sm font-medium text-primary-fg transition-colors duration-150 hover:bg-primary-hover"
            >
              登录
            </Link>
          </div>
        </div>
      </header>

      {/* ============ Hero ============ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-[#163C63] to-primary-deep text-white">
        <span aria-hidden className="animate-spin-slow pointer-events-none absolute -right-40 -top-44 h-[520px] w-[520px] rounded-full border-[26px] border-white/[0.055]" />
        <span aria-hidden className="animate-spin-slow pointer-events-none absolute -bottom-56 -left-32 h-[440px] w-[440px] rounded-full border-20 border-white/[0.04]" style={{ borderWidth: 20, animationDirection: 'reverse', animationDuration: '140s' }} />

        <div className="mx-auto grid max-w-[1120px] items-center gap-12 px-6 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          {/* 左：文案 */}
          <div>
            <Reveal enhanced={enhanced} delay={0}>
              <span className="inline-flex items-center gap-2 rounded-full border border-accent/50 px-3 py-1 text-xs text-accent">
                <IconShieldCheck size={13} />
                建设工程审计智能审读平台
              </span>
            </Reveal>
            <Reveal enhanced={enhanced} delay={110}>
              <h1 className="mt-5 text-[40px] font-semibold leading-[1.28] tracking-tight lg:text-[50px]">
                让 AI 承担翻阅与比对，<br />
                <span className="text-accent">人只做判断。</span>
              </h1>
            </Reveal>
            <Reveal enhanced={enhanced} delay={220}>
              <p className="mt-5 max-w-[520px] text-base leading-relaxed text-white/80">
                几百页结算书、几十份签证单，再加合同与发票 —— 系统把资料读成可比对的数据、
                两边自动比对、把可疑之处连同证据整理成清单。合不合理、怎么定性，仍然由你决定。
              </p>
            </Reveal>
            <Reveal enhanced={enhanced} delay={330}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="group inline-flex items-center gap-2 rounded-xl bg-white px-[22px] py-[11px] text-[15px] font-medium text-primary shadow-[0_6px_20px_rgba(0,0,0,0.18)] transition-transform duration-200 hover:-translate-y-px"
                >
                  免费试用
                  <IconArrowRight size={17} className="transition-transform duration-200 ease-smooth group-hover:translate-x-[3px]" />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center rounded-xl border border-white/35 px-[22px] py-[11px] text-[15px] font-medium text-white transition-colors duration-150 hover:bg-white/10"
                >
                  看看它能做什么
                </a>
              </div>
            </Reveal>
            <Reveal enhanced={enhanced} delay={440}>
              <p className="mt-6 text-xs text-white/60">无需信用卡 · 注册即用 · 数据保存在你自己的服务器</p>
            </Reveal>
          </div>

          {/* 右：产品界面示意（疑点台账） */}
          <Reveal enhanced={enhanced} delay={200}>
            <div className="animate-floaty">
              <div className="overflow-hidden rounded-2xl bg-card text-text shadow-pop">
                <div className="flex items-center gap-1.5 border-b border-border bg-surface2 px-3.5 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
                  <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
                  <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
                  <span className="ml-1.5 text-xs font-semibold text-text-secondary">疑点台账</span>
                </div>
                <div className="grid grid-cols-4 border-b border-border">
                  {[
                    { v: 137, label: '疑点总数', c: 'text-text' },
                    { v: 38, label: '高风险', c: 'text-danger' },
                    { v: 61, label: '待处理', c: 'text-primary' },
                    { v: 24, label: '已关闭', c: 'text-success' },
                  ].map((s) => (
                    <div key={s.label} className="border-r border-border px-3 py-2.5 text-center last:border-r-0">
                      <CountUp value={s.v} enhanced={enhanced} className={`block text-[17px] font-semibold leading-none ${s.c}`} />
                      <span className="mt-1 block text-[10.5px] text-text-muted">{s.label}</span>
                    </div>
                  ))}
                </div>
                {MOCK_ROWS.map((r) => (
                  <div key={r.title} className="flex items-center gap-2.5 border-b border-border px-3.5 py-2.5 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{r.title}</p>
                      <p className="truncate text-[11px] text-text-muted">{r.sub}</p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-[1px] text-[11px] font-medium ${
                      r.color === 'danger' ? 'border-danger/20 bg-danger/10 text-danger'
                      : r.color === 'warning' ? 'border-warning/20 bg-warning/10 text-warning'
                      : 'border-primary/20 bg-primary/10 text-primary'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        r.color === 'danger' ? 'bg-danger' : r.color === 'warning' ? 'bg-warning' : 'bg-primary'
                      }`} />
                      {r.level}
                    </span>
                    <span className="num shrink-0 text-[12.5px] text-text-secondary">{r.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ 信任条 ============ */}
      <div className="mx-auto max-w-[1120px] px-6">
        <div className="grid gap-5 border-b border-t border-border py-6 sm:grid-cols-3">
          {[
            { icon: IconShieldCheck, b: '不下审计结论', s: '只回答"哪里可疑、证据在哪"，定性由你来做' },
            { icon: IconClock, b: '处置全程留痕', s: '每条疑点的处理人与时间可追溯，三个月后也答得上来' },
            { icon: IconLock, b: '数据在你自己服务器', s: '自托管部署，Excel / Word 本地解析不出本机' },
          ].map((t, i) => (
            <Reveal key={t.b} enhanced={enhanced} delay={i * 70}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-accent"><t.icon size={20} /></span>
                <div>
                  <p className="text-sm font-semibold">{t.b}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-text-secondary">{t.s}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* ============ 功能 ============ */}
      <section id="features" className="bg-card">
        <div className="mx-auto max-w-[1120px] px-6 py-20 lg:py-24">
          <Reveal enhanced={enhanced}>
            <div className="mb-11 max-w-[640px]">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">核心功能</p>
              <h2 className="mt-2.5 text-[30px] font-semibold leading-[1.35] tracking-tight">六个环节，替你做完翻找和比对</h2>
              <p className="mt-3.5 text-[15px] leading-relaxed text-text-secondary">
                按审计作业的真实顺序设计：资料进来 → 读成数据 → 两边比对 → 可疑成账 → 导出成果。
              </p>
            </div>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} enhanced={enhanced} delay={Math.min(i * 70, 350)}>
                <div className="h-full rounded-xl border border-border bg-card p-6 shadow-card transition-shadow duration-150 ease-smooth hover:shadow-card-hover">
                  <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                    <f.icon size={20} />
                  </span>
                  <h3 className="text-base font-semibold">{f.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-text-secondary">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 流程 ============ */}
      <section id="flow" className="bg-bg">
        <div className="mx-auto max-w-[1120px] px-6 py-20 lg:py-24">
          <Reveal enhanced={enhanced}>
            <div className="mb-11 max-w-[640px]">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">怎么用</p>
              <h2 className="mt-2.5 text-[30px] font-semibold leading-[1.35] tracking-tight">六步走完一个审计项目</h2>
              <p className="mt-3.5 text-[15px] leading-relaxed text-text-secondary">每一步的产出，都是下一步的输入。</p>
            </div>
          </Reveal>

          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-6">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} enhanced={enhanced} delay={Math.min(i * 60, 300)}>
                <div className="h-full rounded-xl border border-border bg-card p-[18px] shadow-card">
                  <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-fg num">{s.n}</span>
                  <p className="mt-3 text-sm font-semibold">{s.title}</p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-secondary">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 边界声明 ============ */}
      <section className="bg-card">
        <div className="mx-auto max-w-[1120px] px-6 py-20 lg:py-24">
          <Reveal enhanced={enhanced}>
            <div className="rounded-xl border border-border border-l-[3px] border-l-accent bg-card p-7">
              <h3 className="text-[17px] font-semibold">先说清楚它不做什么</h3>
              <p className="mt-2.5 text-sm leading-[1.8] text-text-secondary">
                系统<strong className="font-semibold text-text">不产出审计结论</strong>。它只回答"哪里可能有问题、证据在哪里"，
                最终结论由人下。核不到的条目会明确标记为<strong className="font-semibold text-text">"无法确认"</strong>，
                而不是假装"没问题" —— 这是有意的设计，防止把没核到当成已核过。
                智能问答与 OCR 依赖第三方 AI 服务，是否启用由管理员配置决定；
                未配置时相关功能不可用，也不会有任何资料外发。
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ 收尾 CTA ============ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary to-[#12375A] text-center text-white">
        <span aria-hidden className="animate-breathe pointer-events-none absolute left-1/2 top-[-220px] h-[640px] w-[640px] rounded-full border-[26px] border-white/[0.05]" />
        <div className="relative mx-auto max-w-[1120px] px-6 py-20 lg:py-24">
          <h2 className="text-[32px] font-semibold leading-[1.35] tracking-tight">把翻阅和比对交给 AI，<br />把判断留给自己</h2>
          <p className="relative mx-auto mt-4 max-w-[560px] text-[15px] text-white/78">
            注册即可创建第一个审计项目，上传资料、跑核对、导出成果 —— 几分钟走完一遍完整流程。
          </p>
          <div className="relative mt-8 inline-flex">
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 rounded-xl bg-white px-[34px] py-3.5 text-base font-medium text-primary shadow-[0_6px_20px_rgba(0,0,0,0.2)] transition-transform duration-200 hover:-translate-y-px"
            >
              免费试用
              <IconArrowRight size={18} className="transition-transform duration-200 ease-smooth group-hover:translate-x-[3px]" />
            </Link>
          </div>
          <p className="relative mt-4 text-xs text-white/60">点击后进入登录 / 注册页 · 注册即视为同意用户协议与隐私政策</p>
        </div>
      </section>

      {/* ============ Footer ============ */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-6 py-8">
          <span className="text-xs text-text-muted">审计智脑 AuditBrain · 面向建设工程审计的智能审读平台</span>
          <div className="flex gap-5 text-[13px]">
            <Link href="/terms" className="text-text-secondary hover:text-primary">用户协议</Link>
            <Link href="/privacy" className="text-text-secondary hover:text-primary">隐私政策</Link>
            <Link href="/login" className="text-text-secondary hover:text-primary">登录</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
