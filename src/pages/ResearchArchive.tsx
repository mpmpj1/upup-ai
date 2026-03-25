import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookOpen, Loader2 } from 'lucide-react';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { getBriefings, getConversations, getConversationMessages } from '@/lib/research';
import type { BriefingCard, ConversationMessage, ResearchConversation } from '@/types/research';

type StructuredPayload = {
  stance?: Record<string, any> | null;
  theses?: {
    bull?: unknown[];
    bear?: unknown[];
  } | null;
  scenarios?: unknown[] | null;
  risks?: unknown[] | null;
  citations?: unknown[] | null;
  compliance_flags?: string[] | null;
};

function pickFirstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function coerceArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function looksBrokenContent(content?: string | null) {
  if (!content?.trim()) {
    return true;
  }

  const stripped = content.replace(/\s+/g, '');
  const placeholderRatio =
    stripped.length > 0
      ? (stripped.match(/[?？�]/g)?.length || 0) / stripped.length
      : 0;

  return (
    content.includes('undefined') ||
    content.includes('{item.') ||
    content.includes('銆') ||
    content.includes('鍥') ||
    content.includes('浣犳') ||
    placeholderRatio >= 0.45 ||
    /^(\?|\ufffd)+$/.test(stripped)
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

function buildReadableMarkdown(payload: StructuredPayload) {
  const stance = payload.stance;
  const bull = coerceArray<any>(payload.theses?.bull);
  const bear = coerceArray<any>(payload.theses?.bear);
  const scenarios = coerceArray<any>(payload.scenarios);
  const risks = coerceArray<any>(payload.risks);
  const citations = coerceArray<any>(payload.citations);
  const complianceFlags = payload.compliance_flags || [];

  return [
    '## 结论立场',
    stance
      ? `**${pickFirstString(stance.label, stance.stance, '研究结论')}**\n\n${pickFirstString(stance.summary, stance.description, '暂无明确立场。')}`
      : '暂无明确立场。',
    '',
    '## 核心 Thesis',
    ...(bull.length > 0
      ? bull.map((item, index) => `${index + 1}. **${pickFirstString(item?.title, item?.name, `要点 ${index + 1}`)}**: ${pickFirstString(item?.summary, item?.description, item?.detail, '暂无补充说明。')}`)
      : ['暂无核心 thesis。']),
    '',
    '## 反方 Thesis',
    ...(bear.length > 0
      ? bear.map((item, index) => `${index + 1}. **${pickFirstString(item?.title, item?.name, `反方要点 ${index + 1}`)}**: ${pickFirstString(item?.summary, item?.description, item?.detail, '暂无补充说明。')}`)
      : ['暂无反方 thesis。']),
    '',
    '## 风险点',
    ...(risks.length > 0
      ? risks.map((item, index) => `${index + 1}. **${pickFirstString(item?.title, item?.name, `风险 ${index + 1}`)}**: ${pickFirstString(item?.description, item?.summary, item?.detail, '暂无补充说明。')}`)
      : ['暂无额外风险点。']),
    '',
    '## 情景分析',
    ...(scenarios.length > 0
      ? scenarios.map((item, index) => `${index + 1}. **${pickFirstString(item?.name, item?.title, `情景 ${index + 1}`)}**: ${pickFirstString(item?.description, item?.summary, item?.detail, '暂无补充说明。')}`)
      : ['暂无情景分析。']),
    '',
    ...(citations.length > 0
      ? [
          '## 来源',
          ...citations.map(
            (item, index) =>
              `[${Number(item?.source_index) || index + 1}] ${pickFirstString(item?.title, item?.publisher, `来源 ${index + 1}`)}${pickFirstString(item?.publisher) ? ` - ${pickFirstString(item?.publisher)}` : ''}`
          ),
          '',
        ]
      : []),
    '## 免责声明',
    complianceFlags.includes('personalized_advice_blocked')
      ? '本内容仅提供研究观点与论证，不构成个性化买卖建议、仓位建议、止盈止损建议或收益承诺。'
      : '本内容仅用于研究与讨论，不构成投资建议。',
  ].join('\n');
}

function getMessageMarkdown(message: ConversationMessage) {
  if (!looksBrokenContent(message.content)) {
    return message.content;
  }

  return buildReadableMarkdown(toStructuredPayloadFromMessage(message));
}

function getBriefingMarkdown(briefing: BriefingCard) {
  if (!looksBrokenContent(briefing.content)) {
    return briefing.content;
  }

  return buildReadableMarkdown(toStructuredPayloadFromBriefing(briefing));
}

export default function ResearchArchive() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<ResearchConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [briefings, setBriefings] = useState<BriefingCard[]>([]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, isLoading, navigate]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const loadArchive = async () => {
      try {
        setLoading(true);
        const [conversationList, briefingList] = await Promise.all([
          getConversations(30),
          getBriefings(30),
        ]);

        setConversations(conversationList);
        setBriefings(briefingList);

        if (conversationList[0]?.id) {
          setSelectedConversationId(conversationList[0].id);
          const conversationMessages = await getConversationMessages(conversationList[0].id);
          setMessages(conversationMessages);
        } else {
          setMessages([]);
        }
      } catch (error: any) {
        toast({
          title: '加载分析记录失败',
          description: error?.message || '请检查数据库迁移和 Supabase 连接。',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadArchive();
  }, [isAuthenticated, toast]);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    getConversationMessages(selectedConversationId)
      .then(setMessages)
      .catch((error: any) => {
        toast({
          title: '加载会话内容失败',
          description: error?.message || '无法读取历史消息。',
          variant: 'destructive',
        });
      });
  }, [selectedConversationId, toast]);

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-amber-600" />
          <p className="text-slate-600">正在加载分析记录...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />
      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-950">
              <BookOpen className="h-7 w-7 text-amber-600" />
              分析记录
            </h1>
            <p className="mt-2 text-slate-600">
              这里会沉淀历史对话和历史简报，方便复看、追问和继续打磨 thesis。
            </p>
          </div>

          <Tabs defaultValue="conversations" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="conversations">历史会话</TabsTrigger>
              <TabsTrigger value="briefings">历史简报</TabsTrigger>
            </TabsList>

            <TabsContent value="conversations">
              <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                <Card className="border-slate-200 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base text-slate-950">会话列表</CardTitle>
                    <CardDescription>选择一段研究对话查看完整内容。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {conversations.length === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                        还没有历史会话。
                      </div>
                    )}

                    {conversations.map((conversation) => (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => setSelectedConversationId(conversation.id)}
                        className={`w-full rounded-xl border p-3 text-left transition-colors ${
                          selectedConversationId === conversation.id
                            ? 'border-amber-300 bg-amber-50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <p className="font-medium text-slate-900">
                          {getReadableConversationTitle(conversation.title)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {conversation.market_scope || 'multi-market'}
                        </p>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base text-slate-950">会话内容</CardTitle>
                    <CardDescription>这里保留研究回答和结构化观点。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {messages.length === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                        还没有可展示的消息。
                      </div>
                    )}

                    {messages.map((message) => (
                      <div key={message.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Badge variant={message.role === 'assistant' ? 'default' : 'secondary'}>
                            {message.role === 'assistant' ? 'AI 研究回答' : '用户问题'}
                          </Badge>
                        </div>
                        <div className="prose prose-slate max-w-none text-slate-800 prose-headings:text-slate-900 prose-p:text-slate-700 prose-li:text-slate-700">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {getMessageMarkdown(message)}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="briefings">
              <div className="grid gap-4 lg:grid-cols-2">
                {briefings.length === 0 && (
                  <Card className="border-slate-200 bg-white shadow-sm lg:col-span-2">
                    <CardContent className="pt-6">
                      <p className="font-medium text-slate-900">还没有历史简报</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        先回到工作台生成一份市场晨报、公司一页纸或事件快报。
                      </p>
                    </CardContent>
                  </Card>
                )}

                {briefings.map((briefing) => (
                  <Card key={briefing.id} className="border-slate-200 bg-white shadow-sm">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{briefing.briefing_type}</Badge>
                        <Badge variant="secondary">{briefing.market_scope || 'multi-market'}</Badge>
                      </div>
                      <CardTitle className="text-slate-950">{briefing.title}</CardTitle>
                      <CardDescription>{pickFirstString(briefing.summary, '暂无摘要。')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-slate max-w-none text-slate-800 prose-headings:text-slate-900 prose-p:text-slate-700 prose-li:text-slate-700">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {getBriefingMarkdown(briefing)}
                        </ReactMarkdown>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}
