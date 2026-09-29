# 审计智脑 AuditBrain

面向建设工程审计的智能化审读平台。围绕「资料上传 → AI 解析 → 证据溯源问答 → 自动核对 → 疑点沉淀」构建完整闭环，把审计人员从大量重复性的翻阅、勾稽、比对工作中解放出来，让 AI 承担"眼睛"与"大脑"，人只做最终判断。

技术栈：**Next.js 14（App Router） + TypeScript + Tailwind CSS + MySQL**，AI 能力由 **PaddleOCR-VL（资料识别）** 与 **火山方舟大模型（审计推理）** 提供。

## 技术栈

- 前端：Next.js 14 App Router、React 18、TypeScript、Tailwind CSS（深浅色主题）
- 后端：Next.js Route Handlers（`src/app/api/**`），统一 `/api` 契约
- 数据库：MySQL + `mysql2`（雪花 ID 主键）
- 认证：JWT（Bearer + 密码哈希）+ RBAC（角色 / 菜单权限键）
- AI：PaddleOCR-VL（资料"眼睛"）、火山方舟大模型（审计"大脑"，含模型链故障转移）
- 导出：`docx` / `xlsx` 服务端生成

## 目录结构

```
src/
  app/
    (app)/            # 受保护的后台布局（侧边栏 + 顶栏）
      cockpit/ projects/ documents/ chat/ checks/ findings/ admin/ profile/
    api/              # Route Handlers（auth / audit/* / version）
  lib/audit/member.ts # 项目成员（owner/reviewer）可见性判定
    login/ page.tsx   # 登录 / 注册
  components/         # UI 原子组件 + 布局（AppShell / Providers / Toast）
  lib/                # db / auth / snowflake / configStore / apiClient / constants
  types/              # 实体 TS 类型
sql/                  # 数据库初始化脚本（v1.0.x / v1.1.x）
uploads/              # 运行时上传目录（gitignore）
```

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env，至少填好 DB_* 与 JWT_SECRET（openssl rand -base64 48 生成）
```

### 3. 初始化数据库（需本地 / 远程 MySQL）
```bash
# 先手动创建库：CREATE DATABASE ai_audit CHARACTER SET utf8mb4;
node scripts/migrate.mjs      # 按 v1.0.x → v1.1.x 顺序执行全部 SQL
```

### 4. 启动
```bash
npm run dev      # 开发（http://localhost:3003）
# 或生产
npm run build && npm run start
```

### 5. 首次使用
打开 `http://localhost:3003` → 注册第一个账号（自动成为管理员）→ 进入「审计项目」创建项目 → 进入「资料舱」上传资料。

## 部署（生产）

### 1. 启动 Node 服务
```bash
npm ci
npm run build
NODE_ENV=production npm run start     # 端口取自 .env 的 PORT（默认 3003）
```
建议用 `systemd` / `pm2` 托管，监听 `127.0.0.1:3003`，由反向代理对外暴露。

### 2. 反向代理（OpenResty）
配置样例见 [`deploy/openresty/audit-brain.conf`](deploy/openresty/audit-brain.conf)，语法与 nginx 兼容。放到 `/usr/local/openresty/nginx/conf/conf.d/` 下，改好域名、证书路径与上游端口后：
```bash
openresty -t && openresty -s reload
```

需要重点关注的几处（样例中已配好）：

| 场景 | 关键配置 | 原因 |
| --- | --- | --- |
| SSE 流式问答 `/api/audit/chat/` | `proxy_buffering off`、`gzip off` | 否则令牌被缓冲，整段结束才吐给前端 |
| 文档解析 `/api/audit/documents/` | `proxy_read_timeout 1800s` | PaddleOCR-VL 轮询耗时长（`OCR_TIMEOUT_MS` 默认 600s） |
| 核对执行 `/api/audit/checks/` | `proxy_read_timeout 1800s` | 避免长任务中途 504 |
| 资料上传 | `client_max_body_size 200m`、`proxy_request_buffering off` | 扫描件 / 大 PDF 直传后端 |
| 上传原件 `/uploads/` | `return 404` | 审计原件含敏感信息，禁止匿名直链 |

> **上传原件的访问路径**：原件落在 `public/uploads/`，但一律通过带鉴权的 `/api/files/*` 读取
> （应用侧用 `beforeFiles` rewrite 把 `/uploads/*` 转发过去，OpenResty 样例里再显式 `return 404` 兜底）。
> 前端以 `fetch` + Bearer 取回 blob 后再打开，直接 `<a href>` 不带鉴权头会被 401。
> 部署后请确认 `GET /uploads/<任意路径>` 返回 401 或 404，而非文件内容。

> 注：`.env` 中的 `TRUST_PROXY`、`ALLOWED_ORIGINS` 目前尚未被代码消费，配置里的真实 IP 透传为后续启用预留。

## 外部 AI 能力（可选）
- 资料解析需要 PaddleOCR-VL（AI Studio）密钥：`OCR_KEY`
- 智能问答 / 核对需要火山方舟密钥：`ARK_API_KEY`
- 未配置时，相关功能在界面给出"未配置密钥"提示，其余功能正常。

## 功能模块

**基础能力（已完成，生产构建通过）**
- 脚手架、Tailwind 设计令牌、深浅色主题、响应式 AppShell（侧边栏 / 顶栏 / 项目上下文）
- 基础设施：db / snowflake / auth(JWT+RBAC) / configStore（统一配置中心，密钥脱敏）/ apiClient / 类型
- 认证：登录 / 注册 / 改密 / me + 登录页 + 路由守卫
- 个人设置：资料维护（昵称 / 邮箱，`PUT /api/auth/me`）+ 改密 + 主题偏好 + 当前项目上下文
- 审计项目：列表 / 新建 / 详情 / 更新 / 删除 API + 卡片页 + 项目详情页 + 驾驶舱统计
- 项目协作：`audit_project_member` 成员表（owner 归属人 / reviewer 复核人）+ 成员分配 UI + 顶栏项目切换器
- 资料舱：上传 + 解析（PaddleOCR-VL 管线）+ 原件查看（Excel / Word / OCR bbox 框线）
- 智能问答：SSE 流式 + 证据溯源角标 / 抽屉 + Agent 取证工具（模型链故障转移）
- 核对程序 + 疑点台账：确定性核对逻辑 + 规则扫描 + 处置 + 导出
- 疑点处置留痕：`audit_finding_dispose` 记录每次状态变更的处理人，按「项目+类型+标题」归档（兼容疑点扫描重建新 ID）；详情面板展示最近处理人 + 完整变更历史；已处置疑点禁止删除
- 后台 RBAC：用户 / 角色管理页 + 对应 API（幂等建表 + 种子数据）；菜单数据由 SQL 种子维护，仅提供只读接口供角色页分配权限
- 模型配置：审计大脑模型链配置页 + `/api/audit/ai-config`（GET / PUT / test / reload，故障转移编排）
- UI 原子组件库（Button / Card / Badge / Modal / Table / Input 等）

**已知限制**
1. 核对程序只实现了 2 种（清单↔结算、三方签章）；`contract_payment`（合同付款核对）与 `summary_tie`（汇总勾稽）在 `constants.ts` 中已声明枚举但无实现
2. 疑点规则产出 6 类；`no_photo`（缺少影像资料）、`duplicate`（重复计量）已声明枚举但暂无规则生成
3. 疑点台账无手工录入入口（`source='manual'` 不可达）——状态变更已通过 `audit_finding_dispose` 留痕并展示处理人，但疑点本身仍不能手工创建
4. 核对程序每次重跑会软删同类型历史记录（每种类型仅保留最近一次）
5. 列表接口未分页：疑点全量返回、资料硬上限 500、核对项硬上限 2000
6. 角色权限（`perm_key`）在 `sl_sys_menu` 中维护并可按角色分配，但审计域接口尚未按权限键校验；侧边栏菜单由前端硬编码，未读取 `/api/admin/menus/my`
7. OCR 页面底图未本地化（`localImage` 恒空），`bbox` 坐标已入库但前端未渲染框线
8. 头像字段（`avatar`）已在用户表预留，个人设置页暂未提供上传
9. 项目成员变更无留痕表（谁在何时把谁加为/移出项目），成员管理页不展示操作历史；疑点处置留痕已实现，成员变更尚未跟进

**待完善**
1. 外部 AI 集成**全链路联调**（需配置 MySQL + `ARK_API_KEY` + `OCR_KEY`）：`npm run build && npm run start` 后按自测指引冒烟（注册 → 建项目 → 上传 → 问答 → 核对 → 疑点）
