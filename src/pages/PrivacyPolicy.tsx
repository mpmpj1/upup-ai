import { Database, KeyRound, LockKeyhole, Shield, Waypoints } from "lucide-react";

import PublicContentLayout from "@/components/PublicContentLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const sections = [
  {
    title: "我们处理哪些信息",
    icon: Database,
    points: [
      "账号基础信息，例如邮箱、用户名和身份验证所需的会话信息。",
      "你在工作台中主动创建的研究内容，例如对话、briefings、Thesis Card 与相关归档元数据。",
      "Provider 配置相关信息，以及让模型或检索链路正常工作的必要设置。",
      "必要的运行日志与错误日志，用于保障稳定性、排查故障和改进体验。",
    ],
  },
  {
    title: "这些信息如何被使用",
    icon: Waypoints,
    points: [
      "用于登录鉴权、恢复会话、保护受限页面以及同步你的研究资产。",
      "用于保存工作台状态，让你可以回到已有 thesis、follow-up 与 event update 上继续研究。",
      "用于读取与应用 Provider 配置，确保研究链路按照你的选择运行。",
      "用于监控系统健康、处理错误和提升产品质量。",
    ],
  },
  {
    title: "Provider 与模型调用",
    icon: KeyRound,
    points: [
      "当你启用某个 Provider 时，相关研究请求会被发送到你选择的模型或检索服务。",
      "你提交的研究问题、必要上下文以及用于生成结果的最小范围内容，可能会被转发给对应 Provider 处理。",
      "不同 Provider 可能有各自的隐私政策与数据保留规则，请在使用前一并评估。",
      "如果你删除或停用某个 Provider 配置，工作台会停止继续通过该配置发起新请求。",
    ],
  },
  {
    title: "研究资产与归档",
    icon: Shield,
    points: [
      "工作台中的历史对话、briefings 和 Thesis Card 属于你的研究资产，用于支持连续追问与复盘。",
      "Archive 的目标是提升可检索性与复用效率，而不是把研究流程退回成一次性聊天记录。",
      "我们不会把产品定位为个性化交易建议服务；研究资产的保存是为了信息组织与知识沉淀。",
      "如果你在研究内容中输入敏感信息，应自行评估其必要性并谨慎提交。",
    ],
  },
  {
    title: "安全与访问控制",
    icon: LockKeyhole,
    points: [
      "我们使用身份验证、受保护路由和访问控制来限制未授权访问。",
      "系统会尽量以最小必要权限处理账号、Provider 和研究归档信息。",
      "公开页面与受限页面会分开处理，未登录用户会被导向登录页，而不是直接看到个人工作台数据。",
      "没有任何系统是零风险的，请同时使用强密码、受信设备和你认为合适的内部安全流程。",
    ],
  },
];

export default function PrivacyPolicy() {
  const lastUpdated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <PublicContentLayout
      eyebrow="Privacy"
      title="隐私说明与研究数据处理方式"
      description="这份说明聚焦 thesis-first 研究工作台中账号信息、Provider 配置、研究归档和模型调用的处理边界，帮助你明确哪些数据会参与产品运行。"
      lastUpdated={lastUpdated}
      highlights={["provider-aware", "archive-aware", "research-only"]}
    >
      <section className="panel-card-muted rounded-[28px] px-6 py-6 sm:px-8">
        <p className="section-kicker">Privacy Commitment</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          我们把研究资产视为长期工作流的一部分，而不是一次性表单输入。
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          涨涨AI 的核心体验依赖连续追问、事件增量更新、Thesis Card 沉淀和 Archive 复用，因此会保存与你账号绑定的研究资产与必要配置。
          这些信息用于支撑 thesis-first 工作流，不意味着我们向你提供个性化投资建议或代你执行交易。
        </p>
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
              <CardContent>
                <ul className="space-y-3 text-sm leading-7 text-slate-600">
                  {section.points.map((point) => (
                    <li
                      key={point}
                      className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3"
                    >
                      {point}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="panel-card rounded-[28px] px-6 py-6 sm:px-8">
        <p className="section-kicker">Your Choices</p>
        <div className="mt-3 space-y-4 text-sm leading-7 text-slate-600">
          <p>
            你可以通过设置页管理 Provider 配置，包括新增、编辑、删除、启用、停用和设置默认项。
            如果某项配置不再需要，删除或停用它通常是限制后续调用范围的第一步。
          </p>
          <p>
            对于研究归档、账号数据或其他隐私相关问题，请通过官方支持渠道联系。我们会在适用规则和系统能力范围内处理访问、校正或删除请求。
          </p>
          <p>
            如果未来产品的数据处理边界发生重大变化，我们会通过更新本页内容或在产品内作出合理提示来说明。
          </p>
        </div>
      </section>
    </PublicContentLayout>
  );
}
