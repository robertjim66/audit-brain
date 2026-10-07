'use client';

/**
 * 顶栏「使用指南」：给第一次使用的人看的操作说明。
 *
 * 内容边界：这里只讲「点哪里、按什么顺序、传什么资料」；
 * 业务逻辑与结论含义见 docs/业务说明书.md，弹窗末尾给出入口。
 * 表内的资料依赖关系从核对程序与疑点扫描的实际取数条件反推，非估算。
 */
import React, { useState } from 'react';
import { Button, Modal } from '@/components/ui/primitives';

const DOC_URL = 'https://github.com/robertjim66/audit-brain/blob/main/docs/%E4%B8%9A%E5%8A%A1%E8%AF%B4%E6%98%8E%E4%B9%A6.md';

// ============ 页签一：快速上手 ============
const STEPS: Array<{ n: number; title: string; where: string; out: string }> = [
  { n: 1, title: '登录系统', where: '本页', out: '进入审计驾驶舱' },
  { n: 2, title: '建项目', where: '审计项目 → 新建项目', out: '一个独立的审计空间' },
  { n: 3, title: '选项目', where: '顶栏项目下拉', out: '后续所有操作都作用于它' },
  { n: 4, title: '传资料并标好类别', where: '资料舱 → 上传并解析', out: '资料变成可比对的内容' },
  { n: 5, title: '核对识别结果', where: '资料舱 → 点「查看」', out: '确认表格识别正常' },
  { n: 6, title: '跑核对程序', where: '核对程序 → 点两个按钮', out: '差异清单' },
  { n: 7, title: '运行疑点扫描', where: '疑点台账 → 运行疑点扫描', out: '待核查的问题清单' },
  { n: 8, title: '逐条处置并导出', where: '疑点台账详情 / 核对程序导出', out: '处置结论 + 台账报告' },
];

// ============ 页签二：界面地图 ============
const NAV_MAP: Array<{ menu: string; when: string; get: string; admin?: boolean }> = [
  { menu: '审计驾驶舱', when: '每次进来先看一眼', get: '项目数、资料数、疑点数概览' },
  { menu: '审计项目', when: '开始一个新审计时', get: '项目空间；也是加成员的地方' },
  { menu: '资料舱', when: '拿到工程资料时', get: '上传资料，系统自动识别成可比对内容' },
  { menu: '智能问答', when: '想知道某个数从哪来时', get: '带证据出处的回答' },
  { menu: '核对程序', when: '资料传完，跑一次', get: '差异清单与核增核减金额' },
  { menu: '疑点台账', when: '核对之后', get: '疑点清单与处置结论' },
  { menu: '个人设置', when: '偶尔', get: '改密码、改昵称、切换主题' },
  { menu: '模型配置', when: '管理员偶尔调整', get: 'AI 模型链配置', admin: true },
  { menu: '用户 / 角色管理', when: '管理员配置人员与权限', get: '账号与权限', admin: true },
];

// ============ 页签三：资料准备 ============
const DEPS: Array<{ fn: string; need: string }> = [
  { fn: '清单 ↔ 结算勾稽', need: '清单类 1 份 +（结算类或控制价类）1 份' },
  { fn: '三方签章核对', need: '合同 / 签证 / 结算 / 支付 任一，且状态为「已解析」' },
  { fn: '量差异常、凑整金额', need: '无额外资料要求，但必须先跑清单 ↔ 结算勾稽' },
  { fn: '连号发票检查', need: '发票类 ≥2 份，且已解析' },
  { fn: '集中签证检查', need: '签证类 ≥2 份，且已解析' },
];

const CATEGORIES: Array<{ code: string; cn: string; sample: string }> = [
  { code: 'boq', cn: '清单', sample: '工程量清单（推荐 Excel）' },
  { code: 'settlement', cn: '结算', sample: '结算审核书' },
  { code: 'control_price', cn: '控制价', sample: '招标控制价' },
  { code: 'contract', cn: '合同', sample: '施工合同、协议' },
  { code: 'visa', cn: '签证', sample: '变更单、洽商单、联系单' },
  { code: 'invoice', cn: '发票', sample: '增值税发票' },
  { code: 'payment', cn: '支付', sample: '付款凭证' },
  { code: 'photo', cn: '照片', sample: '现场照片' },
  { code: 'other', cn: '其他', sample: '不属于以上类别' },
];

const FORMATS: Array<{ f: string; ok: boolean; note: string }> = [
  { f: 'Excel (.xlsx / .xls)', ok: true, note: '本地解析，无需密钥。勾稽依赖表格识别，优先用 Excel' },
  { f: 'Word (.docx)', ok: true, note: '本地解析，无需密钥' },
  { f: 'PDF / 图片', ok: false, note: '需配置 OCR 密钥；识别效果取决于清晰度，扫描件可能识别不全' },
];

// ============ 页签四：操作流程 ============
const FLOW: Array<{ step: string; at: string; act: string; ok: string; bad: string }> = [
  {
    step: '1 建项目', at: '审计项目', act: '填项目名称，选审计类型（造价/结算、工程、竣工决算）',
    ok: '卡片出现在列表里', bad: '—',
  },
  {
    step: '2 选项目', at: '顶栏下拉', act: '选中刚建的项目',
    ok: '顶栏显示项目名', bad: '各页提示「请先选择项目」→ 说明没选或选错',
  },
  {
    step: '3 传资料', at: '资料舱', act: '先选业务类别，再选文件，点「上传并解析」',
    ok: '状态变成「已解析」', bad: '状态停在「待解析」→ 点该行「重试」',
  },
  {
    step: '4 核对识别', at: '资料舱 → 查看', act: '打开解析结果，确认表格里有内容',
    ok: '能看到列名与数据', bad: '表格空白 → 勾稽会全判「无法确认」，建议改用 Excel',
  },
  {
    step: '5 跑核对', at: '核对程序', act: '点「清单↔结算勾稽」和「三方签章核对」',
    ok: '出现四张统计卡', bad: '报「未识别到清单表」→ 检查类别标注与解析状态',
  },
  {
    step: '6 扫疑点', at: '疑点台账', act: '点「运行疑点扫描」',
    ok: '疑点列表出来', bad: '出 0 条 → 多半是类别不对或还没跑核对',
  },
  {
    step: '7 处置疑点', at: '疑点台账详情', act: '改状态、填处置备注',
    ok: '记录了处理人与时间', bad: '已处置的疑点不能删除，这是有意限制',
  },
  {
    step: '8 导出', at: '核对程序', act: '导出 Excel 台账（内部）或 Word 清单（对外）',
    ok: '文件下载成功', bad: '—',
  },
];

// ============ 页签五：常见问题 ============
const FAQ: Array<{ q: string; why: string; fix: string }> = [
  { q: '各页显示「请先选择项目」', why: '顶栏没有选中项目', fix: '用顶栏下拉选一个项目' },
  { q: '核对报「未识别到清单表」', why: '业务类别没标对，或资料没解析成功', fix: '在资料舱检查类别与状态列' },
  { q: '核对结果全是「无法确认」', why: '表格没被识别出来，或只有单侧资料', fix: '点「查看」确认表格是否空白；缺的那一侧补传' },
  { q: '疑点扫描出 0 条', why: '资料类别不对，或还没跑核对程序', fix: '先跑核对，再回来扫疑点' },
  { q: 'PDF 解析失败', why: '未配置 OCR 识别密钥', fix: '同一份资料改用 Excel 格式上传' },
  { q: '智能问答报错', why: '模型密钥无效或未配置', fix: '联系管理员检查模型配置' },
  { q: '上传后看不到资料', why: '没选项目就上传了', fix: '顶栏选好项目后重新上传' },
  { q: '想删一条疑点删不掉', why: '它已被处置，属于审计结论记录', fix: '确认不需要后，先改回「待处理」再删' },
];

const TABS = ['快速上手', '界面地图', '资料准备', '操作流程', '常见问题'] as const;

/** 小表格：按传入的表头列数自适应 */
function MiniTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="bg-bg">
          {head.map((h, i) => (
            <th key={i} className="text-left px-2 py-1.5 font-medium text-text-secondary border border-border whitespace-nowrap">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((cell, j) => (
              <td key={j} className="px-2 py-1.5 text-text-secondary border border-border align-top">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function GuideButton() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => { setOpen(true); setTab(0); }} title="查看使用指南">
        📖 使用指南
      </Button>

      <Modal open={open} title="使用指南" onClose={() => setOpen(false)} width="max-w-4xl">
        <div className="space-y-4">
          {/* 页签 */}
          <div className="flex flex-wrap gap-1 border-b border-border pb-2">
            {TABS.map((t, i) => (
              <button
                key={t}
                onClick={() => setTab(i)}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  tab === i ? 'bg-primary text-primary-fg' : 'text-text-secondary hover:bg-bg'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* 页签一：快速上手 */}
          {tab === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">
                第一次使用照着这八步走一遍，之后每个新项目重复 2 到 8 步。
              </p>
              <ol className="space-y-1.5">
                {STEPS.map((s) => (
                  <li key={s.n} className="flex gap-3 items-start rounded-lg bg-bg px-3 py-2">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-primary text-primary-fg text-xs flex items-center justify-center font-medium mt-0.5">
                      {s.n}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text">{s.title}</div>
                      <div className="text-xs text-text-muted">
                        在「{s.where}」操作 · 产出：{s.out}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="rounded-lg bg-bg px-3 py-2 text-xs text-text-secondary">
                <span className="font-medium text-text">注意：</span>
                第 3 步「选项目」最容易被忽略。没选项目时，资料舱、问答、核对、疑点四个页面都会提示「请先选择项目」。
              </div>
            </div>
          )}

          {/* 页签二：界面地图 */}
          {tab === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">左侧菜单从上到下，大致就是工作的先后顺序。</p>
              <MiniTable
                head={['功能', '什么时候用', '能得到什么']}
                rows={NAV_MAP.map((m) => [
                  `${m.menu}${m.admin ? '（管理员）' : ''}`,
                  m.when,
                  m.get,
                ])}
              />
              <div className="rounded-lg bg-bg px-3 py-2 text-xs text-text-secondary space-y-1">
                <div>
                  <span className="font-medium text-text">权限区别：</span>
                  归属人可编辑项目、管理成员、删除项目；复核人只能参与资料、核对、疑点处置，管不了成员。
                </div>
                <div>
                  <span className="font-medium text-text">最终产出：</span>
                  Excel 核对台账（内部工作底稿，含处理人）与 Word 疑点发现清单（对外报告，不含内部责任信息）。
                </div>
              </div>
            </div>
          )}

          {/* 页签三：资料准备 */}
          {tab === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-text mb-1.5">想用某个功能，至少要传什么</h3>
                <MiniTable
                  head={['功能', '最少资料要求']}
                  rows={DEPS.map((d) => [d.fn, d.need])}
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-text mb-1.5">类别怎么选</h3>
                <MiniTable
                  head={['类别', '典型资料']}
                  rows={CATEGORIES.map((c) => [`${c.cn}（${c.code}）`, c.sample])}
                />
                <p className="text-xs text-text-muted mt-1.5">
                  不选则由系统按文件名自动猜测，但建议人工确认——类别决定系统「拿哪份资料做什么」。
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-text mb-1.5">支持哪些格式</h3>
                <div className="space-y-1">
                  {FORMATS.map((f) => (
                    <div key={f.f} className="flex items-start gap-2 text-xs">
                      <span className={f.ok ? 'text-success shrink-0' : 'text-warning shrink-0'}>{f.ok ? '✓' : '⚠'}</span>
                      <span className="text-text font-medium shrink-0">{f.f}</span>
                      <span className="text-text-secondary">{f.note}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-bg px-3 py-2 text-xs text-text-secondary">
                <span className="font-medium text-text">最关键的一条：</span>
                资料类别标错，核对会直接跑不出结果。清单 ↔ 结算勾稽靠 9 到 13 位的清单项目编码配对两侧数据，
                类别不对就取不到表。另外勾稽依赖表格识别，同一份资料用 Excel 比 PDF 可靠得多。
              </div>
            </div>
          )}

          {/* 页签四：操作流程 */}
          {tab === 3 && (
            <div className="space-y-2">
              <p className="text-sm text-text-secondary">
                每一步都标了「成功标志」和「常见问题」，卡住时先看最后一列。
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-bg">
                      {['步骤', '在哪', '怎么做', '成功标志', '卡住了怎么办'].map((h) => (
                        <th key={h} className="text-left px-2 py-1.5 font-medium text-text-secondary border border-border whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {FLOW.map((f) => (
                      <tr key={f.step}>
                        <td className="px-2 py-1.5 text-text border border-border font-medium whitespace-nowrap">{f.step}</td>
                        <td className="px-2 py-1.5 text-text-secondary border border-border whitespace-nowrap">{f.at}</td>
                        <td className="px-2 py-1.5 text-text-secondary border border-border">{f.act}</td>
                        <td className="px-2 py-1.5 text-text-secondary border border-border">{f.ok}</td>
                        <td className="px-2 py-1.5 text-text-secondary border border-border">{f.bad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-lg bg-bg px-3 py-2 text-xs text-text-secondary">
                <span className="font-medium text-text">「无法确认」不等于「没问题」：</span>
                它表示这项<span className="text-text">没核到</span>（资料不全或表格没识别出来），而不是核过了没问题。
                报告里需要按这个口径说明审计范围与限制。
              </div>
            </div>
          )}

          {/* 页签五：常见问题 */}
          {tab === 4 && (
            <div className="space-y-3">
              <MiniTable
                head={['现象', '原因', '怎么办']}
                rows={FAQ.map((f) => [f.q, f.why, f.fix])}
              />
              <div className="rounded-lg bg-bg px-3 py-2 text-xs text-text-secondary">
                <span className="font-medium text-text">还没解决的问题？</span>{' '}
                项目地址：
                <a href={DOC_URL} target="_blank" rel="noreferrer" className="text-primary underline ml-1">
                  业务说明书
                </a>
                <span className="text-text-muted">（讲业务逻辑与各类疑点的含义）</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-xs text-text-muted">
              想深入了解业务逻辑与各类疑点含义，请看
              <a href={DOC_URL} target="_blank" rel="noreferrer" className="text-primary underline mx-1">
                业务说明书
              </a>
            </span>
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
              关闭
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}