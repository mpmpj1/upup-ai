import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ChevronRight,
  FileText,
  Globe2,
  LibraryBig,
  Loader2,
  PanelLeftOpen,
  Plus,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

import Footer from '@/components/Footer';
import Header from '@/components/Header';
import StructuredResearchView from '@/components/research/StructuredResearchView';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import {
  chatResearch,
  generateBriefing,
  getBriefings,
  getConversationMessages,
  getConversations,
  getProviderConfigurations,
  getThesisCards,
} from '@/lib/research';
import {
  getReadableConversationTitle,
  getReadableMessageContent,
  hasStructuredContent,
  structuredOutputFromBriefing,
  structuredOutputFromMessage,
  thesisCardFromBriefing,
  thesisCardFromMessage,
} from '@/lib/research/structuredPayload';
import type {
  BriefingCard,
  ConversationMessage,
  GenerateBriefingRequest,
  ProviderConfiguration,
  ResearchConversation,
  ThesisCardRecord,
} from '@/types/research';

const QUICK_PROMPTS = [
  '你怎么看特斯拉？先给明确判断，再讲 bull case、bear case、关键变量和改变观点的条件。',
  '腾讯现在更像估值修复，还是基本面重新定价？请直接给结论。',
  '宁德时代的 long-term thesis 还成立吗？重点讲竞争力、估值风险和催化剂。',
];

const BRIEFING_TYPES: Array<{
  value: GenerateBriefingRequest['briefing_type'];
  label: string;
}> = [
  { value: 'market-morning', label: '市场晨报' },
  { value: 'company-one-pager', label: '公司一页纸' },
  { value: 'event-flash', label: '事件快报' },
];

const MARKET_OPTIONS = [
  { value: 'multi-market', label: '多市场' },
  { value: 'us', label: '美股 / 宏观' },
  { value: 'hk', label: '港股' },
  { value: 'cn', label: 'A 股' },
];

function parseEntityList(raw: string) {
  return raw
    .split(/[\n,，；;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}

function formatTimestamp(value?: string | null) {
  if (!value) {
    return '刚刚更新';
  }

  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function MarkdownFallback({ content }: { content: string }) {
  return (
    <div className="research-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

export default function ResearchWorkspace() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'chat' | 'briefings' | 'archive'>('chat');
  const [marketScope, setMarketScope] = useState('multi-market');
  const [providers, setProviders] = useState<ProviderConfiguration[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [conversations, setConversations] = useState<ResearchConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [briefings, setBriefings] = useState<BriefingCard[]>([]);
  const [thesisCards, setThesisCards] = useState<ThesisCardRecord[]>([]);
  const [prompt, setPrompt] = useState('');
  const [briefingType, setBriefingType] =
    useState<GenerateBriefingRequest['briefing_type']>('market-morning');
  const [briefingWatchEntities, setBriefingWatchEntities] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);

  const providerRequest = useMemo(
    () => (selectedProviderId ? { configuration_id: selectedProviderId } : undefined),
    [selectedProviderId],
  );
  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) || null,
    [activeConversationId, conversations],
  );
  const activeProvider = useMemo(
    () => providers.find((item) => item.id === selectedProviderId) || null,
    [providers, selectedProviderId],
  );
  const featuredBriefings = useMemo(() => briefings.slice(0, 4), [briefings]);
  const featuredCards = useMemo(() => thesisCards.slice(0, 5), [thesisCards]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, isLoading, navigate]);

  const loadCollections = useCallback(
    async (preferredConversationId?: string) => {
      const [providerList, conversationList, briefingList, cardList] = await Promise.all([
        getProviderConfigurations(),
        getConversations(24),
        getBriefings(18),
        getThesisCards(18),
      ]);

      setProviders(providerList);
      setConversations(conversationList);
      setBriefings(briefingList);
      setThesisCards(cardList);

      if (!selectedProviderId) {
        setSelectedProviderId(
          (providerList.find((item) => item.is_default) || providerList[0] || { id: '' }).id,
        );
      }

      const nextConversationId =
        preferredConversationId || activeConversationId || conversationList[0]?.id || '';

      if (nextConversationId) {
        startTransition(() => setActiveConversationId(nextConversationId));
      }
    },
    [activeConversationId, selectedProviderId],
  );

  const loadMessages = useCallback(async (conversationId: string) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    try {
      setMessages(await getConversationMessages(conversationId));
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        await loadCollections();
      } catch (error: unknown) {
        if (!cancelled) {
          toast({
            title: '加载研究工作台失败',
            description: getErrorMessage(error, '请检查 Supabase 连接与研究服务是否可用。'),
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, loadCollections, toast]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    loadMessages(activeConversationId).catch((error: unknown) => {
      toast({
        title: '加载历史对话失败',
        description: getErrorMessage(error, '无法读取当前研究会话内容。'),
        variant: 'destructive',
      });
    });
  }, [activeConversationId, loadMessages, toast]);

  const handleSend = async (queryOverride?: string) => {
    const nextPrompt = (queryOverride || prompt).trim();
    if (!nextPrompt || isSending) {
      return;
    }

    try {
      setIsSending(true);
      const response = await chatResearch({
        query: nextPrompt,
        conversation_id: activeConversationId || undefined,
        market_scope: marketScope,
        provider_profile: providerRequest,
      });

      setPrompt('');
      setActiveTab('chat');
      await Promise.all([
        loadMessages(response.conversation.id),
        loadCollections(response.conversation.id),
      ]);
    } catch (error: unknown) {
      toast({
        title: '生成研究回答失败',
        description: getErrorMessage(error, '模型或检索链路暂时不可用，请稍后再试。'),
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleGenerateBriefing = async () => {
    try {
      setIsGeneratingBriefing(true);
      await generateBriefing({
        briefing_type: briefingType,
        market_scope: marketScope,
        watch_entities: parseEntityList(briefingWatchEntities),
        provider_profile: providerRequest,
        style_profile: { language: 'zh-CN', tone: 'thesis-first' },
      });
      setBriefingWatchEntities('');
      setActiveTab('briefings');
      await loadCollections(activeConversationId);
    } catch (error: unknown) {
      toast({
        title: '生成简报失败',
        description: getErrorMessage(error, '请稍后再试。'),
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingBriefing(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-amber-600" />
          <p className="text-slate-600">正在加载 thesis-first 研究工作台...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 py-6 sm:py-8">
        <div className="page-shell space-y-6">
          <section className="surface-card bg-premium hero-grid overflow-hidden px-6 py-7 sm:px-8 sm:py-8">
            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-end">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="premium">thesis-first</Badge>
                  <Badge variant="outline">research-only</Badge>
                  <Badge variant="secondary">{MARKET_OPTIONS.find((item) => item.value === marketScope)?.label}</Badge>
                </div>

                <div className="space-y-3">
                  <p className="section-kicker">研究工作台</p>
                  <h1 className="max-w-4xl text-balance text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                    先给核心判断，再围绕同一 thesis 做连续追问、事件更新和资产沉淀。
                  </h1>
                  <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-[15px]">
                    当前工作台已经围绕核心判断、看多 / 看空逻辑、关键变量、最强反方、改变观点的条件、
                    观察清单和 Thesis Card 来组织，而不是简单堆聊天记录。
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="panel-card-muted p-4">
                  <p className="metric-label">Provider</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">
                    {activeProvider?.nickname || '未配置'}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {providers.length} 个可用模型配置
                  </p>
                </div>
                <div className="panel-card-muted p-4">
                  <p className="metric-label">Conversations</p>
                  <p className="mt-2 metric-value">{conversations.length}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">支持连续追问与 thesis 延续</p>
                </div>
                <div className="panel-card-muted p-4">
                  <p className="metric-label">Thesis Cards</p>
                  <p className="mt-2 metric-value">{thesisCards.length}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">高质量观点会自动沉淀</p>
                </div>
              </div>
            </div>
          </section>

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as typeof activeTab)}
            className="space-y-4"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="chat">研究对话</TabsTrigger>
              <TabsTrigger value="briefings">简报</TabsTrigger>
              <TabsTrigger value="archive">资产预览</TabsTrigger>
            </TabsList>

            <TabsContent value="chat">
              <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                <div className="space-y-4 xl:sticky xl:top-28 xl:self-start">
                  <Card className="panel-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <PanelLeftOpen className="h-4 w-4" />
                        研究控制面板
                      </CardTitle>
                      <CardDescription>切换市场范围、Provider 和当前研究会话。</CardDescription>
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

                      <div className="grid gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-center"
                          onClick={() => {
                            setActiveConversationId('');
                            setMessages([]);
                            setPrompt('');
                          }}
                        >
                          <Plus className="h-4 w-4" />
                          开始新会话
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full justify-center"
                          onClick={() => navigate('/settings')}
                        >
                          配置 Provider
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="panel-card">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">会话连续性</CardTitle>
                          <CardDescription>保留旧 thesis，持续承接新问题和事件变化。</CardDescription>
                        </div>
                        <Badge variant="secondary">{conversations.length}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {conversations.length === 0 ? (
                        <div className="rounded-[22px] border border-dashed border-border bg-slate-50/80 p-4 text-sm leading-6 text-slate-500">
                          还没有研究对话。发起一轮 thesis-first 问答后，会自动在这里形成可追踪会话。
                        </div>
                      ) : (
                        conversations.map((conversation) => (
                          <button
                            key={conversation.id}
                            type="button"
                            onClick={() => startTransition(() => setActiveConversationId(conversation.id))}
                            className={`w-full rounded-[22px] border p-4 text-left transition-colors ${
                              activeConversationId === conversation.id
                                ? 'border-amber-300 bg-amber-50/80'
                                : 'border-border/70 bg-white hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <p className="font-medium text-slate-900">
                              {getReadableConversationTitle(conversation.title)}
                            </p>
                            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                              <span className="uppercase tracking-[0.18em]">
                                {conversation.market_scope || 'multi-market'}
                              </span>
                              <span>{formatTimestamp(conversation.updated_at || conversation.created_at)}</span>
                            </div>
                          </button>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card className="panel-card">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">Featured Thesis Cards</CardTitle>
                          <CardDescription>优先展示最近沉淀的高价值研究资产。</CardDescription>
                        </div>
                        <Badge variant="outline">{featuredCards.length}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {featuredCards.length === 0 ? (
                        <div className="rounded-[22px] border border-dashed border-border bg-slate-50/80 p-4 text-sm leading-6 text-slate-500">
                          当回答足够结构化、可复用时，系统会自动生成 Thesis Card。
                        </div>
                      ) : (
                        featuredCards.map((card) => (
                          <div key={card.id} className="rounded-[22px] border border-border/70 bg-slate-50/88 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <p className="font-medium text-slate-900">{card.title}</p>
                              {card.market_scope ? <Badge variant="outline">{card.market_scope}</Badge> : null}
                            </div>
                            <p className="mt-2 text-sm leading-7 text-slate-600">
                              {card.summary || card.content?.core_thesis || '暂无摘要'}
                            </p>
                            <p className="mt-3 text-xs text-slate-500">
                              更新于 {formatTimestamp(card.updated_at || card.created_at)}
                            </p>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <Card className="panel-card bg-premium-muted">
                    <CardHeader>
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <CardTitle className="text-base">快速提问</CardTitle>
                          <CardDescription>
                            用这些问题检查 thesis-first 输出、追问连续性和合规护栏是否稳定。
                          </CardDescription>
                        </div>
                        <div className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                          research-only guardrail 开启
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {QUICK_PROMPTS.map((quickPrompt) => (
                        <Button
                          key={quickPrompt}
                          variant="outline"
                          size="sm"
                          onClick={() => void handleSend(quickPrompt)}
                          disabled={isSending}
                          className="max-w-full justify-start whitespace-normal text-left leading-6"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          {quickPrompt}
                        </Button>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="panel-card overflow-hidden">
                    <CardHeader>
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Globe2 className="h-4 w-4" />
                            研究对话
                          </CardTitle>
                          <CardDescription>
                            {activeConversation
                              ? `${getReadableConversationTitle(activeConversation.title)} · 最近更新 ${formatTimestamp(
                                  activeConversation.updated_at || activeConversation.created_at,
                                )}`
                              : '新会话 · 从一个 thesis-first 问题开始'}
                          </CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{activeProvider?.nickname || '未配置 Provider'}</Badge>
                          <Badge variant="secondary">
                            {MARKET_OPTIONS.find((item) => item.value === marketScope)?.label}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <ScrollArea className="h-[560px] rounded-[24px] border border-border/70 bg-slate-50/82 p-4 sm:p-5">
                        <div className="space-y-5">
                          {loadingMessages ? (
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              正在加载对话...
                            </div>
                          ) : null}

                          {!loadingMessages && messages.length === 0 ? (
                            <div className="rounded-[24px] border border-dashed border-border bg-white/86 p-6 text-center">
                              <p className="text-lg font-semibold text-slate-950">开始第一轮研究对话</p>
                              <p className="mt-3 text-sm leading-7 text-slate-600">
                                直接提问标的、行业、主题、财报或宏观事件。系统会优先给核心判断，而不是把搜索结果堆在你面前。
                              </p>
                            </div>
                          ) : null}

                          {messages.map((message) => {
                            const output = structuredOutputFromMessage(message);
                            const thesisCard = thesisCardFromMessage(message);
                            const readableContent = getReadableMessageContent(message.content);

                            return (
                              <div key={message.id} className="space-y-3">
                                {message.role === 'user' ? (
                                  <div className="ml-auto max-w-2xl rounded-[24px] bg-slate-950 px-5 py-4 text-white shadow-sm">
                                    <p className="whitespace-pre-wrap text-[15px] leading-7">{readableContent}</p>
                                  </div>
                                ) : hasStructuredContent(output) ? (
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                                      <span>Research update</span>
                                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                                      <span>{formatTimestamp(message.created_at)}</span>
                                    </div>
                                    <StructuredResearchView
                                      output={output}
                                      thesisCard={thesisCard}
                                      answer={message.content}
                                    />
                                  </div>
                                ) : (
                                  <div className="rounded-[24px] border border-border/70 bg-white px-5 py-4 text-slate-900 shadow-sm">
                                    <MarkdownFallback content={readableContent} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>

                      <div className="space-y-4 rounded-[24px] border border-border/70 bg-white/88 p-4 sm:p-5">
                        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">继续当前 thesis</p>
                            <p className="mt-1 text-sm leading-6 text-slate-500">
                              你可以直接追问，也可以给出事件更新。系统会自动把“买不买、仓位多少、止损止盈”等问题改写为研究型输出。
                            </p>
                          </div>
                          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            合规护栏
                          </div>
                        </div>

                        <Textarea
                          placeholder="例如：如果下季度交付继续低于预期，你会怎么调整当前 thesis？请明确说明哪些变量会先被推翻。"
                          value={prompt}
                          onChange={(event) => setPrompt(event.target.value)}
                        />

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs leading-6 text-slate-500">
                            建议直接要求明确判断、最强反方、关键变量和改变观点的条件，输出会更稳定。
                          </p>
                          <Button onClick={() => void handleSend()} disabled={isSending || !prompt.trim()}>
                            {isSending ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                生成中
                              </>
                            ) : (
                              <>
                                生成研究回答
                                <ChevronRight className="h-4 w-4" />
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="briefings">
              <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
                <Card className="panel-card xl:sticky xl:top-28 xl:self-start">
                  <CardHeader>
                    <CardTitle className="text-base">简报生成</CardTitle>
                    <CardDescription>
                      用同一条 thesis-first 研究链路生成晨报、公司一页纸和事件快报。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-800">简报类型</p>
                      <Select
                        value={briefingType}
                        onValueChange={(value) =>
                          setBriefingType(value as GenerateBriefingRequest['briefing_type'])
                        }
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BRIEFING_TYPES.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
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
                        placeholder="例如：Tesla，腾讯，宁德时代，AI 算力"
                      />
                    </div>

                    <div className="rounded-[22px] border border-border/70 bg-slate-50/82 p-4 text-sm leading-7 text-slate-600">
                      建议把标的、主题或事件目标写得更具体。这样更利于工作台生成可复用的 Thesis Card。
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => void handleGenerateBriefing()}
                      disabled={isGeneratingBriefing}
                    >
                      {isGeneratingBriefing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          生成中
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4" />
                          生成简报
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  {featuredBriefings.length === 0 ? (
                    <Card className="panel-card">
                      <CardContent className="pt-6">
                        <p className="text-lg font-semibold text-slate-950">还没有简报</p>
                        <p className="mt-3 text-sm leading-7 text-slate-600">
                          先生成一份晨报、公司一页纸或事件快报，看看结构化研究输出和 Thesis Card 沉淀效果。
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    featuredBriefings.map((briefing) => {
                      const output = structuredOutputFromBriefing(briefing);
                      const thesisCard = thesisCardFromBriefing(briefing);

                      return (
                        <Card key={briefing.id} className="panel-card">
                          <CardHeader>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">{briefing.briefing_type}</Badge>
                              <Badge variant="secondary">{briefing.market_scope || 'multi-market'}</Badge>
                              <Badge variant="premium">{formatTimestamp(briefing.created_at)}</Badge>
                            </div>
                            <CardTitle>{briefing.title}</CardTitle>
                            <CardDescription>{briefing.summary || '暂无摘要'}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            {hasStructuredContent(output) ? (
                              <StructuredResearchView
                                output={output}
                                thesisCard={thesisCard}
                                answer={briefing.content}
                              />
                            ) : (
                              <div className="rounded-[24px] border border-border/70 bg-slate-50/82 p-5">
                                <MarkdownFallback content={briefing.content} />
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="archive">
              <div className="grid gap-4 xl:grid-cols-3">
                <Card className="panel-card">
                  <CardHeader>
                    <CardTitle className="text-base">Conversation Archive</CardTitle>
                    <CardDescription>继续追问同一 thesis，而不是从零开始一轮新问答。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {conversations.slice(0, 6).map((conversation) => (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => {
                          setActiveTab('chat');
                          startTransition(() => setActiveConversationId(conversation.id));
                        }}
                        className="w-full rounded-[22px] border border-border/70 bg-slate-50/82 px-4 py-4 text-left transition-colors hover:border-slate-300 hover:bg-white"
                      >
                        <p className="font-medium text-slate-900">
                          {getReadableConversationTitle(conversation.title)}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                          <span className="uppercase tracking-[0.18em]">
                            {conversation.market_scope || 'multi-market'}
                          </span>
                          <span>{formatTimestamp(conversation.updated_at || conversation.created_at)}</span>
                        </div>
                      </button>
                    ))}
                    <Button variant="outline" className="w-full" onClick={() => navigate('/analysis-records')}>
                      查看完整档案
                    </Button>
                  </CardContent>
                </Card>

                <Card className="panel-card">
                  <CardHeader>
                    <CardTitle className="text-base">Recent Briefings</CardTitle>
                    <CardDescription>简报不是孤立产物，而是与 Thesis Card 和会话共用同一条研究轨道。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {featuredBriefings.map((briefing) => (
                      <div key={briefing.id} className="rounded-[22px] border border-border/70 bg-slate-50/82 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{briefing.briefing_type}</Badge>
                          <Badge variant="secondary">{briefing.market_scope || 'multi-market'}</Badge>
                        </div>
                        <p className="mt-3 font-medium text-slate-900">{briefing.title}</p>
                        <p className="mt-2 text-sm leading-7 text-slate-600">
                          {briefing.summary || '暂无摘要'}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="panel-card">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <LibraryBig className="h-4 w-4 text-amber-600" />
                      <CardTitle className="text-base">Thesis Cards</CardTitle>
                    </div>
                    <CardDescription>高质量观点会沉淀成研究资产，方便继续跟踪、更新和复用。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {featuredCards.length === 0 ? (
                      <div className="rounded-[22px] border border-dashed border-border bg-slate-50/82 p-4 text-sm leading-6 text-slate-500">
                        当前还没有 Thesis Card。先做一轮高质量研究对话，系统会自动沉淀。
                      </div>
                    ) : (
                      featuredCards.map((card) => (
                        <div key={card.id} className="rounded-[22px] border border-border/70 bg-slate-50/82 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-medium text-slate-900">{card.title}</p>
                            {card.market_scope ? <Badge variant="outline">{card.market_scope}</Badge> : null}
                          </div>
                          <p className="mt-2 text-sm leading-7 text-slate-600">
                            {card.summary || card.content?.core_thesis || '暂无摘要'}
                          </p>
                          <p className="mt-3 text-xs text-slate-500">
                            更新于 {formatTimestamp(card.updated_at || card.created_at)}
                          </p>
                        </div>
                      ))
                    )}
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
