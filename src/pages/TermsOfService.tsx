import { AlertTriangle, BookCheck, FileWarning, Scale, ShieldAlert } from "lucide-react";

import PublicContentLayout from "@/components/PublicContentLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const sections = [
  {
    title: "仅供研究与信息组织使用",
    icon: BookCheck,
    paragraphs: [
      "涨涨AI 的活跃主线是 thesis-first AI 金融研究工作台。产品围绕结构化研究、连续追问、事件更新与研究资产沉淀来组织体验。",
      "你应将其理解为研究辅助工具，而不是经纪服务、自动交易系统、投资顾问或收益承诺工具。",
    ],
  },
  {
    title: "不提供个性化投资建议",
    icon: ShieldAlert,
    paragraphs: [
      "产品不会向你提供个性化买卖建议、仓位建议、止损止盈指令，亦不会替代持牌专业人士的判断。",
      "research-only guardrail 会尽量把高风险请求改写回研究型分析，但这不意味着所有输出都适合直接用于真实投资决策。",
    ],
  },
  {
    title: "模型与研究输出的局限",
    icon: FileWarning,
    paragraphs: [
      "AI 模型可能出现遗漏、误读、过时信息、幻觉或不完整推理。Structured Research View、citations 与 Thesis Card 只是帮助你更高效地复核，而不是替你承担判断责任。",
      "金融市场变化迅速，过去正确的 thesis 也可能因新事件而失效。你有责任自行验证关键事实、来源和结论。",
    ],
  },
  {
    title: "账号、Provider 与内容责任",
    icon: Scale,
    paragraphs: [
      "你需要对自己的账号安全、Provider 选择、API 成本、研究输入内容以及基于研究结果作出的行为负责。",
      "如果你接入第三方 Provider 或检索服务，该服务的可用性、价格、保留策略和合规要求也可能影响你的使用体验。",
    ],
  },
];

export default function TermsOfService() {
  const lastUpdated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <PublicContentLayout
      eyebrow="Terms"
      title="服务条款与使用边界"
      description="这些条款用于说明 thesis-first 研究工作台的使用范围、责任边界与风险提醒，避免将研究产品误读为交易执行或个性化投顾服务。"
      lastUpdated={lastUpdated}
      highlights={["research-only", "no trade execution", "user responsibility"]}
    >
      <section className="panel-card rounded-[28px] border border-rose-200/70 bg-rose-50/80 px-6 py-6 sm:px-8">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-sm">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-3">
            <p className="section-kicker text-rose-700">Important</p>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              使用本产品前，请先确认你理解它是研究工具，而不是交易代理。
            </h2>
            <p className="text-sm leading-7 text-slate-700">
              涨涨AI 不执行交易、不提供经纪服务、不提供个性化投资建议，也不保证研究输出的完整性、准确性或盈利结果。
              如果你继续使用产品，即表示你接受这些边界，并愿意对自己的判断与行为负责。
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <Card key={section.title} className="panel-card overflow-hidden border-0 shadow-none">
              <CardHeader className="space-y-3 pb-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-2xl font-semibold tracking-tight text-slate-950">
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-7 text-slate-600">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="panel-card-muted rounded-[28px] px-6 py-6 sm:px-8">
        <p className="section-kicker">Additional Terms</p>
        <div className="mt-3 space-y-4 text-sm leading-7 text-slate-600">
          <p>
            你应当遵守适用于自己所在司法辖区的法律法规，并确保自身使用 AI 研究工具、市场数据、外部 Provider 和相关研究资料的方式合法合规。
          </p>
          <p>
            你不应使用本产品从事违法活动、规避限制、侵犯他人权利、上传恶意内容或试图破坏服务可用性。对于异常使用、滥用或安全风险，我们保留采取限制措施的权利。
          </p>
          <p>
            我们可能在产品演进、合规要求或服务边界变化时更新这些条款。若你在更新后继续使用产品，通常意味着你接受更新后的版本。
          </p>
        </div>
      </section>
    </PublicContentLayout>
  );
}
