import Link from 'next/link';
import { PageHeader, Section } from '@/components/ui/primitives';
import { IconShieldCheck, IconSparkles, IconCheck, IconClose, IconInfo } from '@/components/ui/icons';

export const metadata = {
  title: '隐私政策',
  description: '审计智脑 AuditBrain 收集哪些数据、使用哪些第三方 AI 服务、数据存放在哪里、你有哪些权利。',
};

const TOC = [
  { id: 'scope', label: '适用范围与重要说明' },
  { id: 'collect', label: '我们收集哪些信息' },
  { id: 'not-collect', label: '我们不收集哪些信息' },
  { id: 'third-party', label: '第三方服务（AI 能力）' },
  { id: 'storage', label: '数据存储与安全' },
  { id: 'retention', label: '信息保留期限' },
  { id: 'rights', label: '你的权利' },
  { id: 'local', label: '浏览器本地存储与 Cookie' },
  { id: 'update', label: '政策更新与联系方式' },
];

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-text-muted" />
      <span className="text-sm leading-relaxed text-text-secondary">{children}</span>
    </li>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto max-w-3xl">
        {/* 品牌头 */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-fg shadow-sm">
              <IconShieldCheck size={24} />
            </span>
            <span className="leading-tight">
              <span className="block text-base font-semibold text-text">审计智脑</span>
              <span className="block text-2xs tracking-[0.1em] text-text-muted">AUDITBRAIN</span>
            </span>
          </div>
          <Link href="/login" className="text-sm text-primary transition-colors hover:text-primary-hover">
            返回登录
          </Link>
        </div>

        <PageHeader
          title="隐私政策"
          description="本政策说明本系统收集哪些信息、为何收集、存放在哪里，以及你可以如何处理这些信息。内容依据系统实际实现编写，不含未实现的功能。"
        />
        <p className="mt-2 text-xs text-text-muted">生效日期：2026 年 10 月 8 日</p>

        {/* 目录 */}
        <Section className="mt-5" title="目录" bodyClassName="p-4">
          <ol className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {TOC.map((t, i) => (
              <li key={t.id} className="flex gap-2 text-sm">
                <span className="num w-5 shrink-0 text-right text-text-muted">{i + 1}.</span>
                <a href={`#${t.id}`} className="text-primary transition-colors hover:text-primary-hover hover:underline">
                  {t.label}
                </a>
              </li>
            ))}
          </ol>
        </Section>

        {/* 1 */}
        <Section id="scope" className="mt-4 scroll-mt-6" title="一、适用范围与重要说明">
          <div className="space-y-3">
            <div className="flex gap-2.5 rounded-lg border-l-2 border-accent bg-accent/[0.07] px-3 py-2.5">
              <IconInfo size={15} className="mt-0.5 shrink-0 text-accent" />
              <p className="text-sm leading-relaxed text-text-secondary">
                审计智脑是一套<strong className="font-medium text-text">自托管部署</strong>的软件系统。
                它由使用本系统的单位（下称"部署方"）安装在自己的服务器上运行，
                所有业务数据保存在部署方自有的数据库中，<strong className="font-medium text-text">不归本软件的开发者所有或控制</strong>。
                本政策中的"我们"指部署方，即你所在单位中负责运维本系统的部门。
              </p>
            </div>
            <p className="text-sm leading-relaxed text-text-secondary">
              本政策覆盖你在使用本系统（含网页端全部功能）过程中产生的信息处理活动。
              如果你同时受所在单位内部信息管理制度约束，以较严格者为准。
            </p>
          </div>
        </Section>

        {/* 2 */}
        <Section id="collect" className="mt-4 scroll-mt-6" title="二、我们收集哪些信息">
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-medium text-text">1. 注册与账号信息</h3>
              <ul className="space-y-1.5">
                <Item><strong className="font-medium text-text">登录用户名</strong>：必填，创建后不可修改。</Item>
                <Item>
                  <strong className="font-medium text-text">密码</strong>：仅以 bcrypt 单向哈希形式存储，
                  系统<strong className="font-medium text-text">不保存明文密码</strong>，管理员也无法查看你的密码。
                </Item>
                <Item><strong className="font-medium text-text">昵称</strong>：用于界面显示，会记录在疑点处置记录中。</Item>
                <Item><strong className="font-medium text-text">邮箱</strong>：选填，可留空或清除。</Item>
                <Item><strong className="font-medium text-text">注册时间</strong>与账号状态。</Item>
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-text">2. 审计业务数据（系统核心数据）</h3>
              <ul className="space-y-1.5">
                <Item>
                  <strong className="font-medium text-text">你上传的资料文件</strong>：工程量清单、结算书、合同、
                  签证单、发票、付款凭证、现场照片等。文件以二进制形式存入部署方自有数据库。
                </Item>
                <Item>
                  <strong className="font-medium text-text">解析结果</strong>：系统从资料中识别出的文本、表格、
                  金额与要素，以及用于证据定位的元素索引。
                </Item>
                <Item>
                  <strong className="font-medium text-text">核对与疑点记录</strong>：勾稽比对结果、疑点条目、
                  你填写的处置备注、每次状态变更的<strong className="font-medium text-text">处理人与时间</strong>（用于审计留痕，不可匿名）。
                </Item>
                <Item><strong className="font-medium text-text">问答会话</strong>：你在智能问答中提出的问题与系统返回的回答及证据引用。</Item>
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-text">3. 系统运行记录</h3>
              <ul className="space-y-1.5">
                <Item>
                  <strong className="font-medium text-text">AI 调用日志</strong>：记录调用时间、调用者、所用模型、
                  请求参数与返回结果，用于排查问题与成本核算。其中的图片内容在进入日志前已被脱敏处理。
                </Item>
                <Item>资料的上传、解析、删除等操作在业务数据中有对应的创建与更新时间记录。</Item>
              </ul>
            </div>
          </div>
        </Section>

        {/* 3 */}
        <Section id="not-collect" className="mt-4 scroll-mt-6" title="三、我们不收集哪些信息">
          <div className="space-y-3">
            <ul className="space-y-1.5">
              {[
                '不收集你的 IP 地址，也不记录浏览器类型、操作系统或设备型号',
                '不收集你的通讯录、相册、地理位置等任何设备权限信息',
                '不使用第三方网站统计工具，不埋点，不做用户行为分析',
                '不投放广告，不接入任何广告或营销追踪 SDK',
                '不收集任何支付或银行卡信息 —— 本系统不涉及交易与付款功能',
                '不向任何数据中介出售或共享你的信息',
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <IconClose size={14} className="mt-0.5 shrink-0 text-text-muted" />
                  <span className="text-sm leading-relaxed text-text-secondary">{t}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs leading-relaxed text-text-muted">
              说明：系统数据库结构中虽保留了登录日志等预留表，但当前版本并未写入其中，
              因此不存在与之对应的实际收集行为。
            </p>
          </div>
        </Section>

        {/* 4 */}
        <Section
          id="third-party"
          className="mt-4 scroll-mt-6"
          title="四、第三方服务（AI 能力）"
          description="这是本政策中最需要你留意的部分"
        >
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-text-secondary">
              本系统的 AI 能力依赖外部大模型服务。<strong className="font-medium text-text">
                只有在部署方配置了相应密钥时，这些功能才会启用；未配置时功能不可用，也不会有任何数据外发。
              </strong>
              是否启用由部署方决定，你可在系统内询问管理员当前配置状态。
            </p>

            <div className="rounded-lg border border-border">
              <div className="border-b border-border px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <IconSparkles size={14} className="shrink-0 text-accent" />
                  <span className="text-sm font-medium text-text">火山方舟（字节跳动）</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">
                  用于智能问答与审计推理。启用后，你的<strong className="text-text-secondary">提问内容</strong>、
                  以及系统为作答而检索出的<strong className="text-text-secondary">资料片段与证据文本</strong>，
                  会被发送至该服务进行处理。服务地址：ark.cn-beijing.volces.com
                </p>
              </div>
              <div className="px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <IconSparkles size={14} className="shrink-0 text-accent" />
                  <span className="text-sm font-medium text-text">PaddleOCR-VL（百度 AI Studio）</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">
                  用于 PDF 与图片的识别。<strong className="text-text-secondary">
                    启用后，你上传的文件原件会被发送至该服务
                  </strong>
                  以完成文字与表格识别。服务地址：paddleocr.aistudio-app.com
                </p>
              </div>
            </div>

            <div className="flex gap-2.5 rounded-lg bg-surface2 px-3.5 py-2.5">
              <IconCheck size={15} className="mt-0.5 shrink-0 text-success" />
              <p className="text-sm leading-relaxed text-text-secondary">
                <strong className="font-medium text-text">完全本地处理的部分</strong>：
                Excel 与 Word 资料由系统在本机解析，不经任何外部服务；清单与结算的勾稽比对、
                疑点规则扫描、核增核减计算均为本地确定性算法，不调用 AI。
              </p>
            </div>

            <p className="text-xs leading-relaxed text-text-muted">
              上述第三方服务如何处理其接收到的数据，受其各自的服务条款与隐私政策约束。
              若你所在单位对资料外发有合规限制，请勿启用相关密钥，或改用本地可解析的 Excel / Word 格式。
            </p>
          </div>
        </Section>

        {/* 5 */}
        <Section id="storage" className="mt-4 scroll-mt-6" title="五、数据存储与安全">
          <ul className="space-y-1.5">
            <Item>
              <strong className="font-medium text-text">存放位置</strong>：全部数据保存在部署方自有的 MySQL 数据库中，
              上传的文件同样以二进制形式存于该数据库，不依赖第三方云存储。
            </Item>
            <Item><strong className="font-medium text-text">传输</strong>：请通过 HTTPS 访问本系统；是否启用 HTTPS 由部署方在反向代理层配置。</Item>
            <Item><strong className="font-medium text-text">密码</strong>：bcrypt 哈希存储，系统不保存明文。</Item>
            <Item>
              <strong className="font-medium text-text">资料访问控制</strong>：上传的原件只能通过带身份鉴权的接口读取，
              匿名直接访问文件链接会被拒绝（返回 401 或 404）。
            </Item>
            <Item>
              <strong className="font-medium text-text">项目可见性</strong>：审计资料与疑点按项目隔离，
              仅项目归属人与被分配的复核人可见。
            </Item>
          </ul>
        </Section>

        {/* 6 */}
        <Section id="retention" className="mt-4 scroll-mt-6" title="六、信息保留期限">
          <p className="text-sm leading-relaxed text-text-secondary">
            系统未设置自动清理机制。你的账号信息与业务数据会一直保留，
            <strong className="font-medium text-text">直至你主动删除、项目被管理员删除，或部署方整体下线本系统</strong>。
            疑点处置记录属于审计工作底稿性质，为保障可追溯性，已处置的记录不提供删除（需先改回"待处理"状态）。
          </p>
        </Section>

        {/* 7 */}
        <Section id="rights" className="mt-4 scroll-mt-6" title="七、你的权利">
          <ul className="space-y-1.5">
            <Item>
              <strong className="font-medium text-text">查看与修改</strong>：在「个人设置」中可修改昵称、邮箱，并可修改登录密码。
            </Item>
            <Item>
              <strong className="font-medium text-text">删除已上传资料</strong>：在「资料舱」中可删除自己上传的资料及其解析结果。
            </Item>
            <Item>
              <strong className="font-medium text-text">清除本地数据</strong>：清除浏览器数据即可移除登录令牌与界面偏好（见第八节）。
            </Item>
            <Item>
              <strong className="font-medium text-text">注销账号</strong>：系统未提供自助注销入口。
              如需删除账号，请联系本单位系统管理员；管理员可在「用户管理」中执行删除。
            </Item>
            <Item>
              <strong className="font-medium text-text">拒绝 AI 处理</strong>：不使用智能问答、不上传 PDF / 图片，
              即可避免资料被发送至第三方 AI 服务 —— 本地解析与核对功能不受影响。
            </Item>
          </ul>
        </Section>

        {/* 8 */}
        <Section id="local" className="mt-4 scroll-mt-6" title="八、浏览器本地存储与 Cookie">
          <p className="text-sm leading-relaxed text-text-secondary">
            本系统<strong className="font-medium text-text">不使用 Cookie</strong>。
            为保证登录状态与界面偏好，我们仅在你的浏览器本地存储（localStorage）中保存以下信息：
          </p>
          <ul className="mt-2 space-y-1.5">
            <Item>登录令牌（用于保持会话，退出登录或清除浏览器数据即失效）</Item>
            <Item>深浅色主题偏好</Item>
            <Item>当前选中的审计项目</Item>
          </ul>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            这些数据仅保存在你的设备上，不会随页面请求上传至服务器，也不会被第三方读取。
          </p>
        </Section>

        {/* 9 */}
        <Section id="update" className="mt-4 scroll-mt-6" title="九、政策更新与联系方式">
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-text-secondary">
              本政策可能随系统功能调整而更新，更新后生效日期会同步调整。
              如涉及数据处理方式的实质变化，部署方应另行告知。
            </p>
            <p className="text-sm leading-relaxed text-text-secondary">
              如你对本政策或你的数据有疑问、需要行使上述权利，请联系
              <strong className="font-medium text-text">本单位的系统管理员</strong>
              （联系方式由部署方填写：__________）。
            </p>
          </div>
        </Section>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xs leading-relaxed text-text-muted">
            本政策依据系统实际实现编写，不含未实现的功能。相关文件：
            <Link href="/terms" className="ml-1 text-primary underline underline-offset-4 hover:text-primary-hover">
              用户协议
            </Link>
          </p>
          <Link href="/login" className="text-sm text-primary transition-colors hover:text-primary-hover">
            返回登录
          </Link>
        </div>
      </div>
    </div>
  );
}
