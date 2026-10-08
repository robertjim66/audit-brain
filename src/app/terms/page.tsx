import Link from 'next/link';
import { PageHeader, Section } from '@/components/ui/primitives';
import { IconShieldCheck, IconSparkles, IconClose, IconInfo } from '@/components/ui/icons';

export const metadata = {
  title: '用户协议',
  description: '审计智脑 AuditBrain 的服务内容、账号与权限、上传内容的权利与义务、AI 功能的特别约定、禁止行为与责任限制。',
};

const TOC = [
  { id: 'accept', label: '协议的接受与适用' },
  { id: 'service', label: '我们提供什么服务' },
  { id: 'account', label: '账号与权限' },
  { id: 'content', label: '你的内容：上传与使用' },
  { id: 'ai', label: 'AI 功能的特别约定' },
  { id: 'prohibit', label: '使用规范与禁止行为' },
  { id: 'fee', label: '费用与付费' },
  { id: 'change', label: '服务变更、中断与终止' },
  { id: 'ip', label: '知识产权' },
  { id: 'liability', label: '免责与责任限制' },
  { id: 'misc', label: '协议变更、法律适用与联系' },
];

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-text-muted" />
      <span className="text-sm leading-relaxed text-text-secondary">{children}</span>
    </li>
  );
}

export default function TermsPage() {
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
          title="用户协议"
          description="本协议说明本系统提供什么服务、你可以做什么、上传内容时需要承担什么责任，以及 AI 功能的使用边界。请在注册前完整阅读。"
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

        {/* 一 */}
        <Section id="accept" className="mt-4 scroll-mt-6" title="一、协议的接受与适用">
          <div className="space-y-3">
            <div className="flex gap-2.5 rounded-lg border-l-2 border-accent bg-accent/[0.07] px-3 py-2.5">
              <IconInfo size={15} className="mt-0.5 shrink-0 text-accent" />
              <p className="text-sm leading-relaxed text-text-secondary">
                审计智脑是一套<strong className="font-medium text-text">自托管部署</strong>的软件系统，
                由使用本系统的单位（下称"部署方"）在自己的服务器上运行。
                本协议是你与<strong className="font-medium text-text">部署方</strong>之间的约定，
                本软件的开发者不是本协议的一方。
              </p>
            </div>
            <p className="text-sm leading-relaxed text-text-secondary">
              当你注册账号、勾选同意本协议并开始使用本系统，即视为你已完整阅读并同意本协议全部条款。
              若你不同意，请勿注册或使用本系统。
            </p>
            <p className="text-sm leading-relaxed text-text-secondary">
              若你代表所在单位使用本系统，你应确保已获得相应授权，并使所在单位同样受本协议约束。
            </p>
          </div>
        </Section>

        {/* 二 */}
        <Section id="service" className="mt-4 scroll-mt-6" title="二、我们提供什么服务">
          <p className="mb-3 text-sm leading-relaxed text-text-secondary">
            本系统是面向建设工程审计的<strong className="font-medium text-text">辅助审读工具</strong>，
            提供以下功能：
          </p>
          <ul className="space-y-1.5">
            <Item>创建审计项目（造价/结算审计、工程审计、竣工决算），并邀请复核人协作</Item>
            <Item>上传工程资料并标注业务类别（清单、结算、控制价、合同、签证、发票、支付、照片等）</Item>
            <Item>对资料进行自动解析：Excel / Word 本地解析，PDF 与图片经 OCR 识别（需管理员配置）</Item>
            <Item>智能问答：就资料内容提问，系统返回回答并附带证据出处与位置</Item>
            <Item>核对程序：清单与结算的工程量/单价/合价勾稽、签证与合同三方签章证据链核对</Item>
            <Item>疑点台账：按经验规则扫描可疑项，支持逐条处置、填写处置意见并全程留痕</Item>
            <Item>导出成果：Excel 核对台账（内部工作底稿）与 Word 疑点发现清单（对外报告）</Item>
            <Item>管理员功能：用户与角色管理、AI 模型与密钥配置</Item>
          </ul>
          <div className="mt-3 flex gap-2.5 rounded-lg border-l-2 border-danger bg-danger/[0.06] px-3 py-2.5">
            <IconInfo size={15} className="mt-0.5 shrink-0 text-danger" />
            <p className="text-sm leading-relaxed text-text-secondary">
              <strong className="font-medium text-text">本系统不提供、也不会出具审计结论或审计意见。</strong>
              系统只指出"哪里可能有问题、证据在哪里"，是否构成问题、如何定性、如何出具报告，
              均由使用本系统的审计人员自行判断与负责。
            </p>
          </div>
        </Section>

        {/* 三 */}
        <Section id="account" className="mt-4 scroll-mt-6" title="三、账号与权限">
          <ul className="space-y-1.5">
            <Item>
              <strong className="font-medium text-text">注册信息</strong>：你应提供真实、准确的注册信息，
              并及时更新。用户名创建后不可修改。
            </Item>
            <Item>
              <strong className="font-medium text-text">账号保管</strong>：账号与密码由你自行保管。
              <strong className="font-medium text-text">请勿与他人共用账号</strong>——
              系统会将疑点处置、资料操作与你本人绑定并记录处理人与时间，账号出借将导致责任无法厘清。
              因密码泄露造成的损失由你自行承担。
            </Item>
            <Item>
              <strong className="font-medium text-text">管理员权限</strong>：系统初始化后创建的第一个账号
              自动获得管理员权限。管理员可创建与停用账号、重置他人密码、分配角色、
              配置 AI 服务与密钥，并可查看和删除系统内的数据。
            </Item>
            <Item>
              <strong className="font-medium text-text">操作留痕</strong>：你对疑点的每次处置
              （状态变更、处置意见）都会记录你的身份与时间，该记录<strong className="font-medium text-text">不可匿名、不可事后抹除</strong>。
            </Item>
          </ul>
        </Section>

        {/* 四 */}
        <Section id="content" className="mt-4 scroll-mt-6" title="四、你的内容：上传与使用">
          <div className="space-y-3">
            <div>
              <h3 className="mb-2 text-sm font-medium text-text">1. 你可以上传什么</h3>
              <ul className="space-y-1.5">
                <Item>
                  支持 PDF、Word（.doc/.docx）、Excel（.xls/.xlsx）以及常见图片格式（PNG/JPG/WebP/BMP/TIFF/GIF 等）。
                </Item>
                <Item>
                  单个项目的资料数量存在上限（当前为 500 份），单文件大小受部署方服务器配置限制。
                </Item>
                <Item>
                  上传时需标注资料的<strong className="font-medium text-text">业务类别</strong>——
                  类别标注错误会直接导致核对程序无法得出正确结果，请务必人工确认。
                </Item>
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-text">2. 你对上传内容的责任</h3>
              <ul className="space-y-1.5">
                <Item>
                  你应确保对上传的资料<strong className="font-medium text-text">拥有合法权利或已获授权</strong>，
                  且不侵犯他人的著作权、商业秘密或其他合法权益。
                </Item>
                <Item>
                  <strong className="font-medium text-text">不得上传依法不得传播的内容</strong>：
                  包括但不限于涉及国家秘密、工作秘密的材料，以及违反法律法规或侵犯第三方权益的内容。
                  若你所在单位对资料外发有保密或合规限制，应在上传前确认不使用第三方 AI 解析功能
                  （详见第五条）。
                </Item>
                <Item>你上传的资料仅用于本单位审计工作，不得用于本协议约定之外的目的。</Item>
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-text">3. 内容的可见范围与处理授权</h3>
              <ul className="space-y-1.5">
                <Item>
                  <strong className="font-medium text-text">本系统没有对外公开发布功能。</strong>
                  你上传的资料、创建的疑点与填写的处置意见，
                  <strong className="font-medium text-text">仅对你本人、项目归属人及被分配的复核人可见</strong>，
                  不对外公开，也不对互联网开放。
                </Item>
                <Item>
                  为向你提供解析、问答、核对与疑点扫描等服务，你授权系统在必要范围内
                  <strong className="font-medium text-text">存储、解析、比对、检索你上传的内容</strong>，
                  包括在管理员已配置相应服务时将其发送至第三方 AI 服务（详见第五条及《隐私政策》）。
                </Item>
                <Item>
                  <strong className="font-medium text-text">删除与保留</strong>：你可随时删除自己上传的资料及其解析结果。
                  但<strong className="font-medium text-text">疑点处置记录具有审计工作底稿属性</strong>，
                  已处置（已确认 / 已判误报 / 已关闭）的疑点不提供直接删除，需先改回"待处理"状态，
                  以保障审计轨迹的完整与可追溯。
                </Item>
              </ul>
            </div>
          </div>
        </Section>

        {/* 五 */}
        <Section id="ai" className="mt-4 scroll-mt-6" title="五、AI 功能的特别约定" description="使用 AI 功能前请务必阅读">
          <div className="space-y-3">
            <div className="flex gap-2.5 rounded-lg border-l-2 border-danger bg-danger/[0.06] px-3 py-2.5">
              <IconSparkles size={15} className="mt-0.5 shrink-0 text-danger" />
              <p className="text-sm leading-relaxed text-text-secondary">
                <strong className="font-medium text-text">AI 输出不是审计结论。</strong>
                受模型能力与资料质量限制，AI 的识别、比对与回答可能<strong className="font-medium text-text">出现遗漏、偏差甚至错误</strong>。
                你<strong className="font-medium text-text">必须</strong>对系统给出的每一条差异、疑点与回答进行人工复核，
                并以原始资料为准。未经复核即采信系统输出所导致的后果，由使用者自行承担。
              </p>
            </div>
            <ul className="space-y-1.5">
              <Item>
                <strong className="font-medium text-text">功能依赖第三方服务</strong>：智能问答依赖火山方舟大模型，
                PDF 与图片的识别依赖 PaddleOCR-VL。
                <strong className="font-medium text-text">仅在管理员配置了相应密钥后才会启用</strong>；
                未配置时相关功能不可用，也不会有任何数据外发。
              </Item>
              <Item>
                <strong className="font-medium text-text">启用后内容会外发</strong>：启用 OCR 后，
                <strong className="font-medium text-text">你上传的文件原件会发送至第三方服务</strong>进行识别；
                启用问答后，你的提问与系统检索出的资料片段会发送至大模型服务。
                详见《隐私政策》第四节。
              </Item>
              <Item>
                <strong className="font-medium text-text">不使用 AI 的替代方式</strong>：
                Excel 与 Word 由系统在本机解析；清单与结算勾稽、疑点规则扫描、核增核减计算
                均为本地确定性算法，<strong className="font-medium text-text">不调用任何 AI，也不外发数据</strong>。
              </Item>
              <Item>
                <strong className="font-medium text-text">"无法确认"不等于"没问题"</strong>：
                因资料缺失或表格未识别而无法核对的条目，系统会明确标记为"无法确认"，
                表示该项<strong className="font-medium text-text">未核到</strong>，而非核对通过。
              </Item>
            </ul>
          </div>
        </Section>

        {/* 六 */}
        <Section id="prohibit" className="mt-4 scroll-mt-6" title="六、使用规范与禁止行为">
          <ul className="space-y-1.5">
            {[
              '上传违反法律法规、涉及国家秘密或侵犯他人合法权益的内容',
              '未经授权访问他人项目、他人资料，或冒用他人身份使用本系统',
              '对系统进行扫描、渗透、批量抓取、压力测试或任何可能影响其正常运行的行为',
              '利用本系统从事违法犯罪活动，或将其输出用于伪造、变造审计证据',
              '对系统软件进行反向工程、破解、复制或二次分发',
              '故意规避系统配额、权限或审计留痕机制',
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <IconClose size={14} className="mt-0.5 shrink-0 text-danger/70" />
                <span className="text-sm leading-relaxed text-text-secondary">{t}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            违反上述约定的，部署方有权视情节采取限制功能、停用账号、删除相关内容等措施；
            涉嫌违法的，将依法向有关部门报告。
          </p>
        </Section>

        {/* 七 */}
        <Section id="fee" className="mt-4 scroll-mt-6" title="七、费用与付费">
          <div className="flex gap-2.5 rounded-lg bg-surface2 px-3.5 py-2.5">
            <IconInfo size={15} className="mt-0.5 shrink-0 text-text-muted" />
            <p className="text-sm leading-relaxed text-text-secondary">
              <strong className="font-medium text-text">本系统不含任何付费功能。</strong>
              系统内没有会员等级、订阅套餐、充值或在线支付模块，
              <strong className="font-medium text-text">也不会向你收取任何费用</strong>。
              如有人以本系统名义向你收费，请立即向部署方核实。
              使用第三方 AI 服务所产生的费用由部署方承担。
            </p>
          </div>
        </Section>

        {/* 八 */}
        <Section id="change" className="mt-4 scroll-mt-6" title="八、服务变更、中断与终止">
          <ul className="space-y-1.5">
            <Item>
              <strong className="font-medium text-text">服务变更</strong>：部署方可根据需要对功能进行调整、
              升级或下线，并会尽可能提前告知。
            </Item>
            <Item>
              <strong className="font-medium text-text">可用性</strong>：本系统由部署方自行运维，
              <strong className="font-medium text-text">不提供明确的服务可用性承诺（SLA）</strong>。
              可能因服务器维护、网络故障、第三方服务中断等原因暂时不可用。
              建议你定期导出重要成果，做好本地备份。
            </Item>
            <Item>
              <strong className="font-medium text-text">终止使用</strong>：你可随时停止使用本系统，
              并要求管理员删除你的账号。管理员亦可依据单位管理规定停用或删除账号。
              账号删除后，系统内你的个人信息将随之移除，
              但已形成的审计留痕记录作为工作底稿可能依规保留。
            </Item>
          </ul>
        </Section>

        {/* 九 */}
        <Section id="ip" className="mt-4 scroll-mt-6" title="九、知识产权">
          <ul className="space-y-1.5">
            <Item>
              <strong className="font-medium text-text">你的数据归你或你所在单位所有</strong>：
              你上传的资料、填写的处置意见、导出的成果，权利均归你或你所在单位。
              本系统不对这些内容主张任何权利。
            </Item>
            <Item>
              <strong className="font-medium text-text">系统软件的权利归开发者所有</strong>：
              本系统的程序代码、界面设计、文档及其组成部分的著作权与其他知识产权
              归软件开发者或部署方所有。你仅获得在本单位内部使用本系统的许可，
              不得复制、修改、分发、出租或用于商业转售。
            </Item>
          </ul>
        </Section>

        {/* 十 */}
        <Section id="liability" className="mt-4 scroll-mt-6" title="十、免责与责任限制">
          <ul className="space-y-1.5">
            <Item>
              <strong className="font-medium text-text">AI 输出的准确性</strong>：系统输出仅供参考，
              不构成审计意见、鉴定结论或任何专业建议。因未履行人工复核义务、
              或对系统输出的误读误用所造成的损失，由使用者自行承担。
            </Item>
            <Item>
              <strong className="font-medium text-text">第三方服务</strong>：因第三方 AI 服务故障、
              限流、中断或其输出错误导致的后果，在系统已尽合理提示义务的前提下，部署方不承担责任。
            </Item>
            <Item>
              <strong className="font-medium text-text">不可抗力</strong>：因自然灾害、战争、
              政府行为、基础电信故障等不可抗力导致的服务中断或数据损失，部署方不承担责任。
            </Item>
            <Item>
              本条约定<strong className="font-medium text-text">不免除</strong>法律法规规定不可排除的责任。
            </Item>
          </ul>
        </Section>

        {/* 十一 */}
        <Section id="misc" className="mt-4 scroll-mt-6" title="十一、协议变更、法律适用与联系">
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-text-secondary">
              本协议可能随系统功能与运营管理需要而更新，更新后的版本将在本页面公布并调整生效日期。
              若变更涉及你的实质权利义务，部署方应另行告知。你继续使用本系统，视为接受更新后的协议。
            </p>
            <p className="text-sm leading-relaxed text-text-secondary">
              本协议的订立、执行与解释均适用<strong className="font-medium text-text">中华人民共和国法律</strong>。
              因本协议产生的争议，应首先友好协商解决；协商不成的，
              可向部署方所在地有管辖权的人民法院提起诉讼。
            </p>
            <p className="text-sm leading-relaxed text-text-secondary">
              如你对本协议有疑问，请联系<strong className="font-medium text-text">本单位的系统管理员</strong>
              （联系方式由部署方填写：__________）。
            </p>
          </div>
        </Section>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xs leading-relaxed text-text-muted">
            相关文件：
            <Link href="/privacy" className="ml-1 text-primary underline underline-offset-4 hover:text-primary-hover">
              隐私政策
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
