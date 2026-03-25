import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BookOpen,
  Bot,
  ChevronRight,
  FileText,
  Globe2,
  Loader2,
  MessageSquare,
  Newspaper,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import {
  chatResearch,
  generateBriefing,
  getBriefings,
  getConversationMessages,
  getConversations,
  getProviderConfigurations,
} from '@/lib/research';
import type {
  BriefingCard,
  CitationItem,
  ConversationMessage,
  ProviderConfiguration,
  ResearchConversation,
  ResearchStance,
  RiskItem,
  ScenarioItem,
  ThesisBlock,
} from '@/types/research';

const QUICK_PROMPTS = [
  '你怎么看特斯拉？请给出明确立场、正反 thesis、风险点和情景分析。',
  '你怎么看腾讯？请用研究型回答，不要给交易指令。',
  '你怎么看宁德时代？重点讲竞争力、估值风险和催化剂。',
  '今天美股和宏观最重要的风险点是什么？',
];

const BRIEFING_TYPES = [
  { value: 'market-morning', label: '市场晨报 / 盘前简报' },
  { value: 'company-one-pager', label: '公司一页纸简报' },
  { value: 'event-flash', label: '事件快报' },
];

const MARKET_OPTIONS = [
  { value: 'multi-market', label: '多市场' },
  { value: 'us', label: '美股 / 宏观' },
  { value: 'hk', label: '港股' },
  { value: 'cn', label: 'A 股' },
];

type StructuredPayload = {
  stance?: Partial<ResearchStance> | null;
  theses?: {
    bull?: unknown[];
    bear?: unknown[];
  } | null;
  scenarios?: unknown[];
  risks?: unknown[];
  citations?: unknown[];
  compliance_flags?: string[] | null;
};

function pickFirstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function coerceArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function looksBrokenContent(content?: string | null) {
  if (!content) {
    return true;
  }

  const stripped = content.replace(/\s+/g, '');
  const placeholderRatio =
    stripped.length > 0
      ? (stripped.match(/[?？�]/g)?.length || 0) / stripped.length
      : 0;

  return (
    content.includes('undefined') ||
    content.includes('銆?') ||
    content.includes('?{') ||
    content.includes('浣犳') ||
    content.includes('鍥炵瓟') ||
    content.includes('鏈') ||
    content.includes('�') ||
    placeholderRatio >= 0.45 ||
    /^(\?|\ufffd)+$/.test(stripped)
  );
}

function isLegacyBrokenBriefing(briefing: BriefingCard) {
  const summary = String(briefing.summary || '');
  const flags = briefing.compliance_flags || [];

  return (
    flags.includes('briefing_synthesis_degraded') &&
    !flags.includes('retrieval_degraded') &&
    /无法生成一份.*(?:Tesla|腾讯|宁德时代)|证据.*不匹配|Gmail|Split Rock Lighthouse|2\s*\+\s*5\s*=\s*7|突尼斯/i.test(
      summary
    )
  );
}

function getReadableConversationTitle(title?: string | null, fallback = '未命名会话') {
  const normalized = String(title || '').trim();
  if (!normalized) {
    return fallback;
  }

  const stripped = normalized.replace(/\s+/g, '');
  const placeholderRatio =
    stripped.length > 0
      ? (stripped.match(/[?？�]/g)?.length || 0) / stripped.length
      : 0;

  if (placeholderRatio >= 0.5 || /^(\?|\ufffd)+$/.test(stripped)) {
    return fallback;
  }

  return normalized;
}

function normalizeConfidence(value?: string | null) {
  const normalized = String(value || '').toLowerCase();

  if (normalized.includes('high') || normalized.includes('高')) {
    return '高';
  }

  if (normalized.includes('low') || normalized.includes('低')) {
    return '低';
  }

  return '中';
}

function normalizeProbability(value?: string | null) {
  return normalizeConfidence(value);
}

function normalizeImpact(value?: string | null) {
  return normalizeConfidence(value);
}

function normalizeStance(input?: Partial<ResearchStance> | string | null): ResearchStance | null {
  if (!input) {
    return null;
  }

  if (typeof input === 'string') {
    return {
      label: '研究结论',
      confidence: 'medium',
      summary: input,
    };
  }

  const summary = pickFirstString(input.summary, (input as any).description, (input as any).thesis);
  if (!summary && !pickFirstString(input.label, (input as any).stance)) {
    return null;
  }

  return {
    label: pickFirstString(input.label, (input as any).stance, '研究结论'),
    confidence: (['low', 'medium', 'high'].includes(String(input.confidence))
      ? input.confidence
      : 'medium') as ResearchStance['confidence'],
    summary: summary || '暂无明确立场。',
  };
}

function normalizeTheses(items: unknown[]): ThesisBlock[] {
  return coerceArray(items)
    .map((item, index) => {
      if (typeof item === 'string') {
        return {
          title: `要点 ${index + 1}`,
          summary: item,
          evidence: [],
        };
      }

      if (!item || typeof item !== 'object') {
        return null;
      }

      const title = pickFirstString(
        (item as any).title,
        (item as any).name,
        (item as any).thesis,
        (item as any).claim,
        `要点 ${index + 1}`
      );
      const summary = pickFirstString(
        (item as any).summary,
        (item as any).description,
        (item as any).detail,
        (item as any).reasoning,
        (item as any).content
      );
      const evidence = coerceArray<string>((item as any).evidence).filter(Boolean);

      if (!summary && !title) {
        return null;
      }

      return {
        title,
        summary: summary || title,
        evidence,
      };
    })
    .filter(Boolean) as ThesisBlock[];
}

function normalizeRisks(items: unknown[]): RiskItem[] {
  return coerceArray(items)
    .map((item, index) => {
      if (typeof item === 'string') {
        return {
          title: `风险 ${index + 1}`,
          impact: 'medium',
          description: item,
        };
      }

      if (!item || typeof item !== 'object') {
        return null;
      }

      const title = pickFirstString((item as any).title, (item as any).name, (item as any).risk);
      const description = pickFirstString(
        (item as any).description,
        (item as any).summary,
        (item as any).detail,
        (item as any).content
      );

      if (!title && !description) {
        return null;
      }

      return {
        title: title || `风险 ${index + 1}`,
        impact: (['low', 'medium', 'high'].includes(String((item as any).impact))
          ? (item as any).impact
          : 'medium') as RiskItem['impact'],
        description: description || title || `风险 ${index + 1}`,
      };
    })
    .filter(Boolean) as RiskItem[];
}

function normalizeScenarios(items: unknown[]): ScenarioItem[] {
  return coerceArray(items)
    .map((item, index) => {
      if (typeof item === 'string') {
        return {
          name: `情景 ${index + 1}`,
          probability: 'medium',
          description: item,
          signals: [],
        };
      }

      if (!item || typeof item !== 'object') {
        return null;
      }

      const name = pickFirstString((item as any).name, (item as any).title, (item as any).scenario);
      const description = pickFirstString(
        (item as any).description,
        (item as any).summary,
        (item as any).detail,
        (item as any).content
      );
      const signals = coerceArray<string>((item as any).signals).filter(Boolean);

      if (!name && !description) {
        return null;
      }

      return {
        name: name || `情景 ${index + 1}`,
        probability: (['low', 'medium', 'high'].includes(String((item as any).probability))
          ? (item as any).probability
          : 'medium') as ScenarioItem['probability'],
        description: description || name || `情景 ${index + 1}`,
        signals,
      };
    })
    .filter(Boolean) as ScenarioItem[];
}

function normalizeCitations(items: unknown[]): CitationItem[] {
  return coerceArray(items)
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const citation = item as any;
      const url = pickFirstString(citation.url, citation.link);
      const title = pickFirstString(citation.title, citation.name, citation.publisher, `来源 ${index + 1}`);

      return {
        id: citation.id,
        title,
        url,
        publisher: pickFirstString(citation.publisher, citation.source, citation.domain),
        snippet: pickFirstString(citation.snippet, citation.summary, citation.description),
        source_tier: [1, 2, 3].includes(Number(citation.source_tier))
          ? Number(citation.source_tier) as 1 | 2 | 3
          : 2,
        source_type: ['filing', 'media', 'community', 'market-data', 'other'].includes(String(citation.source_type))
          ? citation.source_type
          : 'other',
        source_index: Number(citation.source_index) || index + 1,
        created_at: citation.created_at,
      };
    })
    .filter(Boolean) as CitationItem[];
}

function toStructuredPayloadFromMessage(message: ConversationMessage): StructuredPayload {
  return message.structured_answer || {};
}

function toStructuredPayloadFromBriefing(briefing: BriefingCard): StructuredPayload {
  return {
    stance: briefing.stance,
    theses: briefing.theses,
    scenarios: briefing.scenarios,
    risks: briefing.risks,
    citations: briefing.citations,
    compliance_flags: briefing.compliance_flags,
  };
}

function hasStructuredContent(payload: StructuredPayload) {
  return Boolean(
    normalizeStance(payload.stance) ||
    normalizeTheses(payload.theses?.bull || []).length ||
    normalizeTheses(payload.theses?.bear || []).length ||
    normalizeRisks(payload.risks || []).length ||
    normalizeScenarios(payload.scenarios || []).length ||
    normalizeCitations(payload.citations || []).length ||
    (payload.compliance_flags || []).length
  );
}

function getReadableMessageContent(content?: string | null, fallback = '历史消息编码异常，请参考下方结构化结果。') {
  if (!looksBrokenContent(content)) {
    return String(content || '');
  }

  return fallback;
}

function buildMarkdownFromStructured(payload: StructuredPayload) {
  const stance = normalizeStance(payload.stance);
  const bull = normalizeTheses(payload.theses?.bull || []);
  const bear = normalizeTheses(payload.theses?.bear || []);
  const risks = normalizeRisks(payload.risks || []);
  const scenarios = normalizeScenarios(payload.scenarios || []);
  const citations = normalizeCitations(payload.citations || []);
  const complianceFlags = payload.compliance_flags || [];

  return [
    '## 结论立场',
    stance ? `**${stance.label}**\n\n${stance.summary}` : '暂无明确立场。',
    '',
    '## 核心 Thesis',
    ...(bull.length > 0
      ? bull.map((item, index) => `${index + 1}. **${item.title}**：${item.summary}`)
      : ['暂无核心 thesis。']),
    '',
    '## 反方 Thesis',
    ...(bear.length > 0
      ? bear.map((item, index) => `${index + 1}. **${item.title}**：${item.summary}`)
      : ['暂无反方 thesis。']),
    '',
    '## 风险点',
    ...(risks.length > 0
      ? risks.map((item, index) => `${index + 1}. **${item.title}**：${item.description}`)
      : ['暂无额外风险点。']),
    '',
    '## 情景分析',
    ...(scenarios.length > 0
      ? scenarios.map(
          (item, index) =>
            `${index + 1}. **${item.name}**（概率：${normalizeProbability(item.probability)}）：${item.description}`
        )
      : ['暂无情景分析。']),
    '',
    citations.length > 0 ? '## 来源' : '',
    ...citations.map((item) => `[${item.source_index}] ${item.title}${item.publisher ? ` - ${item.publisher}` : ''}`),
    '',
    '## 免责声明',
    complianceFlags.includes('personalized_advice_blocked')
      ? '本回答仅提供研究观点与论证，不构成个性化买卖建议、仓位建议、止盈止损或收益承诺。'
      : '本回答仅用于研究与讨论，不构成投资建议。',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildReadableMarkdownFromStructured(payload: StructuredPayload) {
  const stance = normalizeStance(payload.stance);
  const bull = normalizeTheses(payload.theses?.bull || []);
  const bear = normalizeTheses(payload.theses?.bear || []);
  const risks = normalizeRisks(payload.risks || []);
  const scenarios = normalizeScenarios(payload.scenarios || []);
  const citations = normalizeCitations(payload.citations || []);
  const complianceFlags = payload.compliance_flags || [];

  return [
    '## 结论立场',
    stance ? `**${stance.label}**\n\n${stance.summary}` : '暂无明确立场。',
    '',
    '## 核心 Thesis',
    ...(bull.length > 0
      ? bull.map((item, index) => `${index + 1}. **${item.title}**: ${item.summary}`)
      : ['暂无核心 thesis。']),
    '',
    '## 反方 Thesis',
    ...(bear.length > 0
      ? bear.map((item, index) => `${index + 1}. **${item.title}**: ${item.summary}`)
      : ['暂无反方 thesis。']),
    '',
    '## 风险点',
    ...(risks.length > 0
      ? risks.map((item, index) => `${index + 1}. **${item.title}**: ${item.description}`)
      : ['暂无额外风险点。']),
    '',
    '## 情景分析',
    ...(scenarios.length > 0
      ? scenarios.map(
          (item, index) =>
            `${index + 1}. **${item.name}**（概率：${normalizeProbability(item.probability)}）：${item.description}`
        )
      : ['暂无情景分析。']),
    '',
    ...(citations.length > 0
      ? [
          '## 来源',
          ...citations.map(
            (item) =>
              `[${item.source_index}] ${item.title}${item.publisher ? ` - ${item.publisher}` : ''}`
          ),
          '',
        ]
      : []),
    '## 免责声明',
    complianceFlags.includes('personalized_advice_blocked')
      ? '本回答仅提供研究观点与论证，不构成个性化买卖建议、仓位建议、止盈止损建议或收益承诺。'
      : '本回答仅用于研究与讨论，不构成投资建议。',
  ].join('\n');
}

function getMessageMarkdown(message: ConversationMessage) {
  if (!looksBrokenContent(message.content)) {
    return message.content;
  }

  return buildReadableMarkdownFromStructured(toStructuredPayloadFromMessage(message));
}

function getBriefingMarkdown(briefing: BriefingCard) {
  if (!looksBrokenContent(briefing.content)) {
    return briefing.content;
  }

  return buildReadableMarkdownFromStructured(toStructuredPayloadFromBriefing(briefing));
}

function StructuredSections({ payload }: { payload: StructuredPayload }) {
  const stance = normalizeStance(payload.stance);
  const bull = normalizeTheses(payload.theses?.bull || []);
  const bear = normalizeTheses(payload.theses?.bear || []);
  const risks = normalizeRisks(payload.risks || []);
  const scenarios = normalizeScenarios(payload.scenarios || []);
  const citations = normalizeCitations(payload.citations || []);
  const complianceFlags = payload.compliance_flags || [];

  return (
    <div className="space-y-4">
      {stance && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 text-slate-900">
            <div className="flex items-center gap-2">
              <Badge className="bg-slate-900 text-amber-100 hover:bg-slate-900">{stance.label}</Badge>
              <Badge variant="outline">置信度：{normalizeConfidence(stance.confidence)}</Badge>
            </div>
            <p className="mt-3 text-[15px] leading-7 text-slate-700">{stance.summary}</p>
          </CardContent>
        </Card>
      )}

      {bull.length > 0 && (
        <Card className="border-slate-200 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-900">核心 Thesis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-slate-900">
            {bull.map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[15px] font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-[15px] leading-7 text-slate-700">{item.summary}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {bear.length > 0 && (
        <Card className="border-slate-200 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-900">反方 Thesis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-slate-900">
            {bear.map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-xl border border-slate-200 bg-rose-50/60 px-4 py-3">
                <p className="text-[15px] font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-[15px] leading-7 text-slate-700">{item.summary}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {risks.length > 0 && (
        <Card className="border-slate-200 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-900">风险点</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {risks.map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-semibold text-slate-900">{item.title}</p>
                  <Badge variant="outline">影响：{normalizeImpact(item.impact)}</Badge>
                </div>
                <p className="mt-1 text-[15px] leading-7 text-slate-700">{item.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {scenarios.length > 0 && (
        <Card className="border-slate-200 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-900">情景分析</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {scenarios.map((item, index) => (
              <div key={`${item.name}-${index}`} className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-semibold text-slate-900">{item.name}</p>
                  <Badge variant="outline">概率：{normalizeProbability(item.probability)}</Badge>
                </div>
                <p className="mt-1 text-[15px] leading-7 text-slate-700">{item.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {citations.length > 0 && (
        <Card className="border-slate-200 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-900">来源</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {citations.map((citation, index) => (
              <a
                key={`${citation.url}-${index}`}
                href={citation.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition-colors hover:bg-slate-100"
              >
                <div className="flex items-center gap-2">
                  <Badge variant={citation.source_tier === 1 ? 'default' : 'secondary'}>
                    Tier {citation.source_tier}
                  </Badge>
                  <span className="text-sm font-medium text-slate-800">
                    {citation.publisher || '来源'}
                  </span>
                </div>
                <p className="mt-2 text-[15px] font-semibold text-slate-900">{citation.title}</p>
                {citation.snippet && (
                  <p className="mt-1 text-sm leading-6 text-slate-600">{citation.snippet}</p>
                )}
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      {complianceFlags.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-orange-700" />
              <p className="text-sm font-semibold text-orange-900">合规提醒</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-orange-900/80">
              系统会自动回避个性化买卖建议、仓位建议、止盈止损、自动调仓和收益承诺，统一改写成研究型回答。
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MarkdownBlock({ content }: { content: string }) {
  return (
    <div className="prose prose-slate max-w-none text-[15px] leading-8 text-slate-800 prose-headings:scroll-m-20 prose-headings:font-semibold prose-headings:text-slate-950 prose-h2:mt-6 prose-h2:text-xl prose-h3:mt-5 prose-h3:text-lg prose-p:leading-7 prose-p:text-slate-700 prose-li:leading-7 prose-li:text-slate-700 prose-li:marker:text-amber-600 prose-strong:text-slate-950 prose-a:text-slate-900 hover:prose-a:text-amber-700">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

export default function ResearchWorkspace() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  const [activeTab, setActiveTab] = useState('chat');
  const [providers, setProviders] = useState<ProviderConfiguration[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [conversations, setConversations] = useState<ResearchConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [briefings, setBriefings] = useState<BriefingCard[]>([]);
  const [marketScope, setMarketScope] = useState('multi-market');
  const [prompt, setPrompt] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [briefingType, setBriefingType] = useState('market-morning');
  const [briefingWatchEntities, setBriefingWatchEntities] = useState('');
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId),
    [conversations, activeConversationId]
  );
  const visibleBriefings = useMemo(
    () => briefings.filter((briefing) => !isLegacyBrokenBriefing(briefing)),
    [briefings]
  );
  const featuredBriefings = useMemo(() => visibleBriefings.slice(0, 3), [visibleBriefings]);
  const hiddenBriefingsCount = Math.max(visibleBriefings.length - featuredBriefings.length, 0);
  const filteredLegacyBriefingsCount = Math.max(briefings.length - visibleBriefings.length, 0);

  const recoverBackgroundAnswer = async (sentAtIso: string) => {
    const sentAt = new Date(sentAtIso).getTime();

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 4000));

      const refreshedConversations = await getConversations();
      const candidateConversation =
        refreshedConversations.find((conversation) => {
          const ts = conversation.last_message_at || conversation.created_at;
          return ts ? new Date(ts).getTime() >= sentAt - 3000 : false;
        }) ||
        refreshedConversations.find((conversation) => conversation.id === activeConversationId) ||
        refreshedConversations[0];

      if (!candidateConversation) {
        continue;
      }

      const refreshedMessages = await getConversationMessages(candidateConversation.id);
      const hasFreshAssistantReply = refreshedMessages.some(
        (message) =>
          message.role === 'assistant' && new Date(message.created_at).getTime() >= sentAt - 3000
      );

      if (!hasFreshAssistantReply) {
        continue;
      }

      setConversations(refreshedConversations);
      setActiveConversationId(candidateConversation.id);
      setMessages(refreshedMessages);
      return true;
    }

    return false;
  };

  const createLocalMessage = (
    role: ConversationMessage['role'],
    content: string,
    overrides: Partial<ConversationMessage> = {}
  ): ConversationMessage => ({
    id: overrides.id || `local-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    conversation_id: overrides.conversation_id || activeConversationId || 'local',
    user_id: overrides.user_id || 'local-user',
    role,
    content,
    structured_answer: overrides.structured_answer ?? null,
    market_scope: overrides.market_scope || marketScope,
    entity_context: overrides.entity_context || activeConversation?.entity_context || {},
    research_run_id: overrides.research_run_id || null,
    created_at: overrides.created_at || new Date().toISOString(),
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, isLoading, navigate]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const loadWorkspace = async () => {
      try {
        setIsBootstrapping(true);
        const [providerList, conversationList, briefingList] = await Promise.all([
          getProviderConfigurations(),
          getConversations(),
          getBriefings(),
        ]);

        setProviders(providerList);
        setSelectedProviderId(
          providerList.find((provider) => provider.is_default)?.id || providerList[0]?.id || ''
        );
        setConversations(conversationList);
        setBriefings(briefingList);
        setActiveConversationId('');
        setMessages([]);
      } catch (error: any) {
        toast({
          title: '工作台初始化失败',
          description: error?.message || '请检查 Provider 配置、数据库迁移和 Supabase 连接。',
          variant: 'destructive',
        });
      } finally {
        setIsBootstrapping(false);
      }
    };

    loadWorkspace();
  }, [isAuthenticated, toast]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      try {
        const conversationMessages = await getConversationMessages(activeConversationId);
        setMessages(conversationMessages);
      } catch (error: any) {
        toast({
          title: '加载会话失败',
          description: error?.message || '无法读取历史消息。',
          variant: 'destructive',
        });
      }
    };

    loadMessages();
  }, [activeConversationId, toast]);

  const handleSend = async (overridePrompt?: string) => {
    const query = (overridePrompt || prompt).trim();

    if (!query) {
      return;
    }

    if (!selectedProviderId) {
      toast({
        title: '请先配置模型 Provider',
        description: '先去设置页保存至少一个可用 Provider，然后回到工作台选择它。',
        variant: 'destructive',
      });
      return;
    }

    const sentAtIso = new Date().toISOString();
    const loadingMessageId = `local-assistant-${Date.now()}`;
    const optimisticUserMessage = createLocalMessage('user', query, {
      created_at: sentAtIso,
    });
    const loadingMessage = createLocalMessage(
      'assistant',
      '正在生成研究回答，请先不要重复点击。当前链路通常需要 30 到 90 秒。',
      {
        id: loadingMessageId,
      }
    );

    try {
      setIsSending(true);
      setMessages((current) => [...current, optimisticUserMessage, loadingMessage]);

      const result = await chatResearch({
        query,
        market_scope: marketScope,
        entity_context: activeConversation?.entity_context || {},
        output_mode: 'chat-first',
        conversation_id: activeConversationId || undefined,
        provider_profile: {
          configuration_id: selectedProviderId,
        },
      });

      setPrompt('');
      setActiveConversationId(result.conversation.id);

      const [conversationList, conversationMessages] = await Promise.all([
        getConversations(),
        getConversationMessages(result.conversation.id),
      ]);

      setConversations(conversationList);
      setMessages(conversationMessages);
    } catch (error: any) {
      const errorMessage = error?.message || '';
      const shouldAttemptRecovery =
        errorMessage.includes('请求等待超时') || errorMessage.includes('后台生成');

      if (shouldAttemptRecovery) {
        setMessages((current) =>
          current.map((message) =>
            message.id === loadingMessageId
              ? {
                  ...message,
                  content:
                    '前端等待超时了，但后台可能还在继续生成。我现在会自动刷新最近会话，尽量把已经写回数据库的答案补捞回来。',
                }
              : message
          )
        );

        toast({
          title: '回答仍在后台生成',
          description: '这次请求超过了前端等待时间，我会自动刷新最近会话，看看结果是否已经写回。',
        });

        try {
          const recovered = await recoverBackgroundAnswer(sentAtIso);
          if (recovered) {
            toast({
              title: '回答已补回',
              description: '后台已经完成生成，结果已自动刷新到当前会话。',
            });
            setPrompt('');
            return;
          }
        } catch {
          // Ignore and continue to the generic fallback below.
        }
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === loadingMessageId
            ? {
                ...message,
                content: shouldAttemptRecovery
                  ? '这次回答没有在前端等待时间内成功回到页面。请等 10 到 30 秒后点开最近会话，或直接刷新页面；如果后台已完成，答案通常已经写进历史记录了。'
                  : `本次生成失败：${errorMessage || '请检查 Provider、Perplefina 和当前 tunnel。'}`,
              }
            : message
        )
      );

      toast({
        title: '研究回答生成失败',
        description: errorMessage || '请检查 Edge Function、Provider 配置和当前检索链路。',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleGenerateBriefing = async () => {
    if (!selectedProviderId) {
      toast({
        title: '请先选择 Provider',
        description: '没有可用模型时无法生成简报。',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsGeneratingBriefing(true);
      const watchEntities = briefingWatchEntities
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      const result = await generateBriefing({
        briefing_type: briefingType,
        market_scope: marketScope,
        watch_entities: watchEntities,
        style_profile: {
          tone: 'fund-manager',
          focus: 'thesis-first',
          language: 'zh-CN',
        },
        provider_profile: {
          configuration_id: selectedProviderId,
        },
      });

      setBriefings((current) => [{ ...result.briefing, citations: result.citations }, ...current]);
      setActiveTab('briefings');
      toast({
        title: '简报已生成',
        description: '你可以直接阅读，也可以继续追问，把它展开成更深的研究。',
      });
    } catch (error: any) {
      toast({
        title: '简报生成失败',
        description: error?.message || '请检查 Provider、Perplefina 和当前检索服务。',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingBriefing(false);
    }
  };

  if (isLoading || isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-amber-600" />
          <p className="text-slate-600">正在加载 Research Workspace...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_30%),linear-gradient(180deg,#f8fafc_0%,#fffdf7_35%,#f8fafc_100%)] text-slate-900">
      <Header />

      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <Card className="overflow-hidden border-amber-200 bg-white/95 shadow-lg shadow-amber-100/40">
            <CardContent className="grid gap-6 px-6 py-8 lg:grid-cols-[1.5fr_1fr]">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-slate-950 text-amber-100 hover:bg-slate-950">涨涨AI / UpUp AI</Badge>
                  <Badge variant="outline">只答金融</Badge>
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                    强观点 AI 投资伙伴
                  </h1>
                  <p className="max-w-2xl text-sm leading-7 text-slate-700 sm:text-base">
                    主入口就是研究对话。每次输出都会尽量固定为明确立场、正反 thesis、风险点、
                    情景分析和来源，而不是空洞摘要。
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">多市场研究优先</Badge>
                  <Badge variant="secondary">引用优先于空话</Badge>
                  <Badge variant="secondary">合规拒绝个性化建议</Badge>
                  <Badge variant="secondary">简报与分析沉淀</Badge>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Card className="border-slate-200 bg-white">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-amber-600" />
                      <p className="font-medium text-slate-700">已加载 Provider</p>
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{providers.length}</p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 bg-white">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-amber-600" />
                      <p className="font-medium text-slate-700">历史会话</p>
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{conversations.length}</p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 bg-white sm:col-span-2">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Newspaper className="h-4 w-4 text-amber-600" />
                      <p className="font-medium text-slate-700">最新简报</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {briefings[0]?.title || '还没有生成简报，先试一次市场晨报或公司一页纸。'}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3 bg-white">
              <TabsTrigger value="chat" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                对话
              </TabsTrigger>
              <TabsTrigger value="briefings" className="gap-2">
                <FileText className="h-4 w-4" />
                简报
              </TabsTrigger>
              <TabsTrigger value="archive" className="gap-2">
                <BookOpen className="h-4 w-4" />
                分析记录
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat">
              <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
                <Card className="h-fit border-slate-200 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base text-slate-950">研究上下文</CardTitle>
                    <CardDescription>选择市场、Provider 和最近会话。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-800">市场范围</p>
                      <Select value={marketScope} onValueChange={setMarketScope}>
                        <SelectTrigger className="bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MARKET_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-800">模型 Provider</p>
                      <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="选择 Provider" />
                        </SelectTrigger>
                        <SelectContent>
                          {providers.map((provider) => (
                            <SelectItem key={provider.id} value={provider.id}>
                              {provider.nickname}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-800">最近会话</p>
                        <Badge variant="outline">{conversations.length}</Badge>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setActiveConversationId('');
                          setMessages([]);
                          setPrompt('');
                        }}
                      >
                        开始新会话
                      </Button>

                      <div className="space-y-2">
                        {conversations.length === 0 && (
                          <p className="text-sm text-slate-500">还没有历史会话。</p>
                        )}
                        {conversations.map((conversation) => (
                          <button
                            key={conversation.id}
                            type="button"
                            onClick={() => setActiveConversationId(conversation.id)}
                            className={`w-full rounded-xl border p-3 text-left transition-colors ${
                              activeConversationId === conversation.id
                                ? 'border-amber-300 bg-amber-50'
                                : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                              <p className="font-medium text-slate-900">
                                {getReadableConversationTitle(conversation.title)}
                              </p>
                            <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                              {conversation.market_scope || 'multi-market'}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button variant="outline" className="w-full" onClick={() => navigate('/settings')}>
                      去设置 Provider
                    </Button>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card className="border-slate-200 bg-white shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base text-slate-950">快速提问</CardTitle>
                      <CardDescription>
                        先试这些问题，快速检查 thesis 输出、引用质量和响应速度。
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {QUICK_PROMPTS.map((quickPrompt) => (
                        <Button
                          key={quickPrompt}
                          variant="outline"
                          size="sm"
                          onClick={() => handleSend(quickPrompt)}
                          disabled={isSending}
                          className="border-slate-200 bg-white text-slate-800 hover:bg-amber-50"
                        >
                          <Sparkles className="mr-2 h-3.5 w-3.5" />
                          {quickPrompt}
                        </Button>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="min-h-[640px] border-slate-200 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base text-slate-950">
                          <Globe2 className="h-4 w-4" />
                          研究对话
                        </CardTitle>
                        <CardDescription>
                          {getReadableConversationTitle(activeConversation?.title, '新对话')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ScrollArea className="h-[450px] rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="space-y-5">
                          {messages.length === 0 && (
                            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
                              <p className="font-medium text-slate-900">开始第一轮研究对话</p>
                              <p className="mt-2 text-sm leading-6 text-slate-600">
                                直接问标的、行业、主题、宏观或财报事件。系统会尽量自动识别实体并输出
                                thesis、风险点、情景分析和来源。
                              </p>
                            </div>
                          )}

                          {messages.map((message) => {
                            const markdown = getMessageMarkdown(message);
                            const structuredPayload = toStructuredPayloadFromMessage(message);
                            const structuredAvailable = hasStructuredContent(structuredPayload);

                            return (
                              <div key={message.id} className="space-y-3">
                                {message.role === 'user' ? (
                                  <div className="ml-auto max-w-2xl rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-sm">
                                    <p className="whitespace-pre-wrap text-[15px] leading-7">
                                      {getReadableMessageContent(message.content, '历史提问文本编码异常。')}
                                    </p>
                                  </div>
                                ) : structuredAvailable ? (
                                  <StructuredSections payload={structuredPayload} />
                                ) : (
                                  <div className="max-w-4xl rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 shadow-sm">
                                    <MarkdownBlock content={markdown} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>

                      <div className="space-y-3">
                        <Textarea
                          placeholder="例如：你怎么看特斯拉？请给出明确结论、正反 thesis、风险点、情景分析和来源。"
                          value={prompt}
                          onChange={(event) => setPrompt(event.target.value)}
                          className="min-h-[120px] bg-white text-slate-900 placeholder:text-slate-400"
                        />
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs leading-6 text-slate-500">
                            系统会自动回避个性化买卖建议、仓位、止盈止损和收益承诺。
                          </p>
                          <Button onClick={() => handleSend()} disabled={isSending}>
                            {isSending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <ChevronRight className="mr-2 h-4 w-4" />
                            )}
                            生成研究回答
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="briefings">
              <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
                <Card className="h-fit border-slate-200 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base text-slate-950">生成简报</CardTitle>
                    <CardDescription>
                      用同一套 Provider 和检索链路，生成团队内部可读的中文简报。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-800">简报类型</p>
                      <Select value={briefingType} onValueChange={setBriefingType}>
                        <SelectTrigger className="bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BRIEFING_TYPES.map((briefingOption) => (
                            <SelectItem key={briefingOption.value} value={briefingOption.value}>
                              {briefingOption.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-800">重点标的 / 主题</p>
                      <Input
                        value={briefingWatchEntities}
                        onChange={(event) => setBriefingWatchEntities(event.target.value)}
                        placeholder="例如：Tesla, 腾讯, 宁德时代, AI 算力"
                        className="bg-white text-slate-900 placeholder:text-slate-400"
                      />
                    </div>

                    <Button className="w-full" onClick={handleGenerateBriefing} disabled={isGeneratingBriefing}>
                      {isGeneratingBriefing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="mr-2 h-4 w-4" />
                      )}
                      生成简报
                    </Button>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  {briefings.length === 0 && (
                    <Card className="border-slate-200 bg-white shadow-sm">
                      <CardContent className="pt-6">
                        <p className="font-medium text-slate-900">还没有简报</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          先生成一份市场晨报，看看最新消息、重点标的和风险提醒是否符合预期。
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {featuredBriefings.map((briefing, index) => {
                    const briefingPayload = toStructuredPayloadFromBriefing(briefing);
                    const markdown = getBriefingMarkdown(briefing);
                    const structuredAvailable = hasStructuredContent(briefingPayload);

                    return (
                      <Card key={briefing.id} className="border-slate-200 bg-white shadow-sm">
                        <CardHeader>
                          <div className="flex flex-wrap items-center gap-2">
                            {index === 0 && (
                              <Badge className="bg-amber-500 text-white hover:bg-amber-500">最新结果</Badge>
                            )}
                            <Badge variant="outline">{briefing.briefing_type}</Badge>
                            <Badge variant="secondary">{briefing.market_scope || 'multi-market'}</Badge>
                          </div>
                          <CardTitle className="text-slate-950">{briefing.title}</CardTitle>
                          <CardDescription className="text-sm leading-6">
                            {briefing.summary || '暂无摘要。'}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {structuredAvailable ? (
                            <StructuredSections payload={briefingPayload} />
                          ) : (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                              <MarkdownBlock content={markdown} />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}

                  {hiddenBriefingsCount > 0 && (
                    <Card className="border-dashed border-slate-300 bg-slate-50 shadow-sm">
                      <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium text-slate-900">已折叠更早的历史简报</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            为了避免旧版脏数据干扰工作台，这里默认只展示最近 3 份简报。其余 {hiddenBriefingsCount}{' '}
                            份历史记录请到“分析记录”里查看。
                          </p>
                          {filteredLegacyBriefingsCount > 0 && (
                            <p className="mt-1 text-sm leading-6 text-amber-700">
                              另有 {filteredLegacyBriefingsCount} 份旧版异常简报已从工作台列表中自动隐藏，避免继续干扰判断。
                            </p>
                          )}
                        </div>
                        <Button variant="outline" onClick={() => setActiveTab('archive')}>
                          查看全部历史
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                  {hiddenBriefingsCount === 0 && filteredLegacyBriefingsCount > 0 && (
                    <Card className="border-dashed border-amber-200 bg-amber-50 shadow-sm">
                      <CardContent className="pt-6">
                        <p className="font-medium text-amber-900">旧版异常简报已自动降噪</p>
                        <p className="mt-1 text-sm leading-6 text-amber-800">
                          检测到 {filteredLegacyBriefingsCount} 份历史坏数据卡片，工作台默认不再展示它们；如需复查原始记录，请到“分析记录”页查看。
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="archive">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-slate-200 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base text-slate-950">会话归档</CardTitle>
                    <CardDescription>把高质量对话继续追问，或沉淀成新的简报。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {conversations.map((conversation) => (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => {
                          setActiveConversationId(conversation.id);
                          setActiveTab('chat');
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                        <p className="font-medium text-slate-900">
                          {getReadableConversationTitle(conversation.title)}
                        </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {conversation.market_scope || 'multi-market'}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base text-slate-950">简报记录</CardTitle>
                    <CardDescription>沉淀公司一页纸、市场晨报和事件快报。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {briefings.map((briefing) => (
                      <div key={briefing.id} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{briefing.briefing_type}</Badge>
                          <p className="font-medium text-slate-900">{briefing.title}</p>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {briefing.summary || '暂无摘要。'}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
}
