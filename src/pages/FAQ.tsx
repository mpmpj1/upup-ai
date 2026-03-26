import { useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Database,
  FileStack,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import PublicContentLayout from "@/components/PublicContentLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

interface FAQItem {
  question: string;
  answer: string[];
}

interface FAQSection {
  title: string;
  icon: typeof Sparkles;
  items: FAQItem[];
}

const faqSections: FAQSection[] = [
  {
    title: "产品定位",
    icon: Sparkles,
    items: [
      {
        question: "涨涨AI 和普通聊天助手有什么区别？",
        answer: [
          "涨涨AI 不是通用聊天壳，而是 thesis-first 的 AI 金融研究工作台。",
          "回答会优先给出明确判断，再展开 direct answer、core judgment、bull case、bear case、关键变量、最强反方、mind-change conditions 与 watch list。",
          "高质量研究不会停留在聊天记录里，而会沉淀为 Thesis Card、简报和可继续追踪的归档资产。",
        ],
      },
      {
        question: "它主要回答哪些问题？",
        answer: [
          "产品聚焦股票、基金、财报、公司、行业、宏观与市场研究。",
          "你可以发起 thesis-first 初始研究、围绕既有结论连续追问，或者基于新事件做增量更新。",
          "我们不把体验设计成实时交易终端，也不鼓励把研究结论误读为个性化交易指令。",
        ],
      },
      {
        question: "research-only guardrail 是什么？",
        answer: [
          "当用户直接问“买不买、仓位多少、止损止盈”时，前端和研究链路会把问题拉回研究型分析。",
          "系统会优先讨论 thesis、风险、反方观点与观测变量，而不是输出个性化买卖建议。",
          "这既是产品边界，也是合规护栏的一部分。",
        ],
      },
    ],
  },
  {
    title: "研究流程",
    icon: BookOpen,
    items: [
      {
        question: "什么叫 thesis-first？",
        answer: [
          "thesis-first 的意思是先给判断，再展开论证。",
          "输出不会把最关键结论藏在长段落后面，而是优先暴露 core judgment、direct answer 和 one-line takeaway。",
          "这样你可以先判断是否继续深挖，再阅读支持理由、反方观点和监控变量。",
        ],
      },
      {
        question: "follow-up continuity 如何工作？",
        answer: [
          "连续追问默认承接同一 thesis，而不是把每轮回答都当成全新话题。",
          "这意味着系统会尽量复用前一轮的核心判断、关键变量与反方逻辑，只补充新增信息和新的推演。",
          "产品目标是让研究过程像真正的投研协作，而不是一次次重新生成独立文章。",
        ],
      },
      {
        question: "event update 和重新提问有什么不同？",
        answer: [
          "event update 更强调“旧判断 -> 新信息 -> thesis update”的连续链路。",
          "它不是把整篇研究从头写一遍，而是围绕新事件说明哪些地方被强化、哪些地方被削弱，以及哪些 mind-change conditions 被触发。",
          "如果你只想看增量变化，优先使用 event update 会更合适。",
        ],
      },
      {
        question: "Structured Research View 里最值得先看什么？",
        answer: [
          "建议先看 direct answer、core judgment 和 one-line takeaway，它们代表这一轮最浓缩的结论。",
          "接着看 bull case / bear case、key variables 与 strongest counterargument，快速判断 thesis 的支撑与脆弱点。",
          "最后再看 watch list 和 citations，用于后续持续跟踪与来源校验。",
        ],
      },
    ],
  },
  {
    title: "归档与资产",
    icon: FileStack,
    items: [
      {
        question: "Thesis Card 是什么，为什么重要？",
        answer: [
          "Thesis Card 是高价值研究资产，不是普通 badge。",
          "它会把某次研究的核心判断、关键信号与跟踪要点浓缩成可复用单元，方便在工作台和 Archive 中继续追踪。",
          "如果你经常围绕同一标的或主题迭代研究，Thesis Card 会比单纯翻聊天记录高效很多。",
        ],
      },
      {
        question: "Archive 里会保存什么？",
        answer: [
          "Archive 会统一沉淀历史对话、briefings 和 Thesis Card。",
          "它不是简单的时间线，而是一个可以检索、切换和复用研究资产的知识库界面。",
          "你可以把它理解成研究工作流的长期记忆层。",
        ],
      },
      {
        question: "briefings 和对话、Thesis Card 的关系是什么？",
        answer: [
          "briefings 与研究对话共用同一套 thesis-first 产品逻辑。",
          "它适合把某个判断压缩成晨报、事件快报或一页纸，而不是脱离主工作台另起一套风格或数据流。",
          "因此 briefings、历史对话和 Thesis Card 会在归档页里并行存在，而不是彼此割裂。",
        ],
      },
    ],
  },
  {
    title: "账号、Provider 与数据",
    icon: Database,
    items: [
      {
        question: "为什么要先配置 Provider？",
        answer: [
          "Provider 配置决定了研究工作台调用哪些模型与检索链路。",
          "你可以在设置页读取、保存、删除配置，设置默认项，并控制启用开关。",
          "这部分属于核心控制中心，所以工作台的研究质量和稳定性与它直接相关。",
        ],
      },
      {
        question: "我需要登录后才能使用哪些能力？",
        answer: [
          "登录后才能访问工作台、归档页、设置页以及与个人会话、Provider 配置相关的内容。",
          "未登录时，受保护路由会回到登录页，以避免泄露研究资产或个人配置。",
          "公开页面仍然可以查看产品说明、FAQ、隐私政策与服务条款。",
        ],
      },
      {
        question: "系统会代替我下单或给个性化投资建议吗？",
        answer: [
          "不会。当前活跃主线是研究工作台，而不是自动交易壳。",
          "产品输出面向研究和信息组织，不提供个性化买卖建议、仓位建议、止损止盈指令或收益承诺。",
          "你应当把它视为研究辅助工具，而不是执行交易的代理人。",
        ],
      },
    ],
  },
  {
    title: "合规与边界",
    icon: ShieldCheck,
    items: [
      {
        question: "引用和来源如何使用？",
        answer: [
          "Structured Research View 会展示 citations，帮助你回看研究依据。",
          "引用的存在不等于结论必然正确，但它能提升可追溯性，方便你复核来源与上下文。",
          "对于高风险判断，建议结合原始资料与独立研究做二次确认。",
        ],
      },
      {
        question: "能不能把回答当成正式投资建议？",
        answer: [
          "不能。平台提供的是 research-only 输出，不构成个性化投资建议、法律建议或税务建议。",
          "金融市场变化迅速，模型也会有局限性、偏差和信息滞后。",
          "请把本产品作为研究助手使用，并对自己的判断与行为负责。",
        ],
      },
    ],
  },
];

export default function FAQ() {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set(["0-0", "1-0", "2-0"]));

  const toggleItem = (key: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <PublicContentLayout
      eyebrow="FAQ"
      title="常见问题与产品边界"
      description="把 thesis-first、连续追问、事件增量更新、Thesis Card 资产沉淀和 research-only 护栏放在同一套产品语言里解释清楚。"
      highlights={["thesis-first", "research-only", "archive-ready"]}
    >
      <section className="grid gap-6 xl:grid-cols-2">
        {faqSections.map((section, sectionIndex) => {
          const Icon = section.icon;

          return (
            <Card key={section.title} className="panel-card overflow-hidden border-0 shadow-none">
              <CardHeader className="space-y-3 pb-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="section-kicker">Section {sectionIndex + 1}</p>
                  <CardTitle className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {section.title}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {section.items.map((item, itemIndex) => {
                  const key = `${sectionIndex}-${itemIndex}`;
                  const isOpen = openItems.has(key);

                  return (
                    <Collapsible key={key} open={isOpen}>
                      <div className="rounded-2xl border border-slate-200/80 bg-white/80">
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
                            onClick={() => toggleItem(key)}
                          >
                            <span className="text-sm font-semibold leading-6 text-slate-950">
                              {item.question}
                            </span>
                            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500">
                              {isOpen ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </span>
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="space-y-3 border-t border-slate-100 px-5 pb-5 pt-4 text-sm leading-7 text-slate-600">
                            {item.answer.map((paragraph) => (
                              <p key={paragraph}>{paragraph}</p>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="panel-card-muted rounded-[28px] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="section-kicker">Next Step</p>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              想直接体验 thesis-first 的研究链路？
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              登录后进入工作台，配置 Provider，然后从一个研究问题开始，继续追问，再尝试一次 event update，
              你会最直观地感受到 Thesis Card 和 Archive 的差别。
            </p>
          </div>

          <Button asChild className="w-full sm:w-auto">
            <a href="/login">登录并进入工作台</a>
          </Button>
        </div>
      </section>
    </PublicContentLayout>
  );
}
