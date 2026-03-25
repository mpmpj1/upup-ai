import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BookOpen,
  ChevronRight,
  FileText,
  Globe2,
  Loader2,
  PanelLeftOpen,
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
import { Separator } from '@/components/ui/separator';
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
  '你怎么看特斯拉？先给明确判断，再讲 bull case、bear case、关键变量和 change-my-mind 条件。',
  '腾讯现在更像估值修复还是基本面重估？请像投研同事一样直接说判断。',
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
  return raw.split(/[\n,，；、]/).map((item) => item.trim()).filter(Boolean);
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

function MarkdownFallback({ content }: { content: string }) {
  return (
    <div className="prose prose-slate max-w-none text-slate-800 prose-headings:text-slate-950 prose-p:text-slate-700 prose-li:text-slate-700">
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
  const [briefingType, setBriefingType] = useState<GenerateBriefingRequest['briefing_type']>('market-morning');
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
  const featuredBriefings = useMemo(() => briefings.slice(0, 4), [briefings]);
  const featuredCards = useMemo(() => thesisCards.slice(0, 5), [thesisCards]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, isLoading, navigate]);

  const loadCollections = useCallback(async (preferredConversationId?: string) => {
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
  }, [activeConversationId, selectedProviderId]);

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
            description: getErrorMessage(error, '请检查 Supabase 连接和研究迁移是否已生效。'),
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
        description: getErrorMessage(error, '无法读取研究会话内容。'),
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
      await Promise.all([loadMessages(response.conversation.id), loadCollections(response.conversation.id)]);
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
    return <div className="flex min-h-screen items-center justify-center bg-slate-50"><div className="text-center"><Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-amber-600" /><p className="text-slate-600">正在加载 thesis-first 研究工作台...</p></div></div>;
  }
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[linear-gradient(180deg,#fff9ef_0%,#f8fafc_24%,#f8fafc_100%)]">
      <Header />
      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="rounded-[28px] border border-amber-200 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.16),_transparent_36%),linear-gradient(135deg,#fffaf2_0%,#ffffff_58%,#f8fafc_100%)] px-6 py-6 shadow-sm">
            <div className="flex items-center gap-2 text-amber-700">
              <BookOpen className="h-5 w-5" />
              <span className="text-sm font-medium uppercase tracking-[0.22em]">
                Thesis-First Research
              </span>
            </div>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              先给判断，再给论证、反方和 change-my-mind 条件
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-[15px]">
              这里不再输出像搜索引擎一样的堆料答案，而是围绕核心 thesis、bull case、bear
              case、关键变量、最强反方和 thesis card 做连续对话。
            </p>
          </section>

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as typeof activeTab)}
            className="space-y-4"
          >
            <TabsList className="grid w-full grid-cols-3 bg-white">
              <TabsTrigger value="chat">研究对话</TabsTrigger>
              <TabsTrigger value="briefings">简报</TabsTrigger>
              <TabsTrigger value="archive">Archive</TabsTrigger>
            </TabsList>

            <TabsContent value="chat">
              <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                <Card className="h-fit border-slate-200 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base text-slate-950">
                      <PanelLeftOpen className="h-4 w-4" />
                      Research Controls
                    </CardTitle>
                    <CardDescription>切换市场、Provider 和当前研究会话。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-800">市场范围</p>
                      <Select value={marketScope} onValueChange={setMarketScope}>
                        <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MARKET_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-800">模型 Provider</p>
                      <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                        <SelectTrigger className="bg-white"><SelectValue placeholder="选择 Provider" /></SelectTrigger>
                        <SelectContent>
                          {providers.map((provider) => <SelectItem key={provider.id} value={provider.id}>{provider.nickname}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="button" variant="outline" className="w-full" onClick={() => { setActiveConversationId(''); setMessages([]); setPrompt(''); }}>
                      开始新会话
                    </Button>
                    <Separator />
                    <div className="space-y-2">
                      {conversations.length === 0 ? <p className="text-sm text-slate-500">还没有研究对话记录。</p> : conversations.map((conversation) => <button key={conversation.id} type="button" onClick={() => startTransition(() => setActiveConversationId(conversation.id))} className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${activeConversationId === conversation.id ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}><p className="font-medium text-slate-900">{getReadableConversationTitle(conversation.title)}</p><p className="mt-1 text-xs uppercase tracking-[0.15em] text-slate-500">{conversation.market_scope || 'multi-market'}</p></button>)}
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-800">Latest Thesis Cards</p>
                        <Badge variant="secondary">{featuredCards.length}</Badge>
                      </div>
                      {featuredCards.length === 0 ? <p className="text-sm text-slate-500">高质量对话会自动沉淀成 thesis card。</p> : featuredCards.map((card) => <div key={card.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"><p className="font-medium text-slate-900">{card.title}</p><p className="mt-1 text-sm leading-6 text-slate-600">{card.summary || card.content?.core_thesis || '暂无摘要'}</p></div>)}
                    </div>
                    <Button variant="outline" className="w-full" onClick={() => navigate('/settings')}>去设置 Provider</Button>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card className="border-slate-200 bg-white shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base text-slate-950">快速提问</CardTitle>
                      <CardDescription>快速检查 thesis-first 输出、连续追问和 guardrail 是否稳定。</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {QUICK_PROMPTS.map((quickPrompt) => <Button key={quickPrompt} variant="outline" size="sm" onClick={() => { void handleSend(quickPrompt); }} disabled={isSending} className="border-slate-200 bg-white text-slate-800 hover:bg-amber-50"><Sparkles className="mr-2 h-3.5 w-3.5" />{quickPrompt}</Button>)}
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 bg-white shadow-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base text-slate-950"><Globe2 className="h-4 w-4" />研究对话</CardTitle>
                      <CardDescription>{activeConversation ? getReadableConversationTitle(activeConversation.title) : '新会话'}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ScrollArea className="h-[520px] rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="space-y-5">
                          {loadingMessages && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />正在加载对话...</div>}
                          {!loadingMessages && messages.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center"><p className="font-medium text-slate-900">开始第一轮研究对话</p><p className="mt-2 text-sm leading-6 text-slate-600">直接问标的、行业、主题、宏观或财报事件。系统会优先给出 thesis 级判断，而不是把搜索结果堆在你面前。</p></div>}
                          {messages.map((message) => { const output = structuredOutputFromMessage(message); const thesisCard = thesisCardFromMessage(message); const readableContent = getReadableMessageContent(message.content); return <div key={message.id} className="space-y-3">{message.role === 'user' ? <div className="ml-auto max-w-2xl rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-sm"><p className="whitespace-pre-wrap text-[15px] leading-7">{readableContent}</p></div> : hasStructuredContent(output) ? <StructuredResearchView output={output} thesisCard={thesisCard} answer={message.content} /> : <div className="max-w-4xl rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 shadow-sm"><MarkdownFallback content={readableContent} /></div>}</div>; })}
                        </div>
                      </ScrollArea>
                      <Textarea placeholder="例如：你怎么看特斯拉？先给明确判断，再讲 bull case、bear case、关键变量、最强反方和什么会让我改变看法。" value={prompt} onChange={(event) => setPrompt(event.target.value)} className="min-h-[120px] bg-white text-slate-900 placeholder:text-slate-400" />
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-6 text-slate-500">系统会自动回避个性化买卖建议、仓位、止损止盈和收益承诺，统一改写成 thesis 分析框架。</p><Button onClick={() => { void handleSend(); }} disabled={isSending || !prompt.trim()}>{isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ChevronRight className="mr-2 h-4 w-4" />}生成研究回答</Button></div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="briefings">
              <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
                <Card className="h-fit border-slate-200 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base text-slate-950">简报生成</CardTitle>
                    <CardDescription>用同一套 thesis-agent 链路生成晨报、公司一页纸和事件快报。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-800">简报类型</p>
                      <Select value={briefingType} onValueChange={(value) => setBriefingType(value as GenerateBriefingRequest['briefing_type'])}>
                        <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BRIEFING_TYPES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-800">重点标的 / 主题</p>
                      <Input value={briefingWatchEntities} onChange={(event) => setBriefingWatchEntities(event.target.value)} placeholder="例如：Tesla，腾讯，宁德时代，AI 算力" className="bg-white text-slate-900 placeholder:text-slate-400" />
                    </div>
                    <Button className="w-full" onClick={() => { void handleGenerateBriefing(); }} disabled={isGeneratingBriefing}>{isGeneratingBriefing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}生成简报</Button>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  {featuredBriefings.length === 0 ? <Card className="border-slate-200 bg-white shadow-sm"><CardContent className="pt-6"><p className="font-medium text-slate-900">还没有简报</p><p className="mt-2 text-sm leading-6 text-slate-600">先生成一份晨报或公司一页纸，看看结构化观点和 thesis card 沉淀效果。</p></CardContent></Card> : featuredBriefings.map((briefing) => { const output = structuredOutputFromBriefing(briefing); const thesisCard = thesisCardFromBriefing(briefing); return <Card key={briefing.id} className="border-slate-200 bg-white shadow-sm"><CardHeader><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{briefing.briefing_type}</Badge><Badge variant="secondary">{briefing.market_scope || 'multi-market'}</Badge></div><CardTitle className="text-slate-950">{briefing.title}</CardTitle><CardDescription className="text-sm leading-6">{briefing.summary || '暂无摘要'}</CardDescription></CardHeader><CardContent>{hasStructuredContent(output) ? <StructuredResearchView output={output} thesisCard={thesisCard} answer={briefing.content} /> : <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><MarkdownFallback content={briefing.content} /></div>}</CardContent></Card>; })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="archive">
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="border-slate-200 bg-white shadow-sm">
                  <CardHeader><CardTitle className="text-base text-slate-950">Conversation Archive</CardTitle><CardDescription>继续追问，保持 thesis continuity。</CardDescription></CardHeader>
                  <CardContent className="space-y-3">
                    {conversations.slice(0, 6).map((conversation) => <button key={conversation.id} type="button" onClick={() => { setActiveTab('chat'); startTransition(() => setActiveConversationId(conversation.id)); }} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition-colors hover:bg-amber-50"><p className="font-medium text-slate-900">{getReadableConversationTitle(conversation.title)}</p><p className="mt-1 text-xs uppercase tracking-[0.15em] text-slate-500">{conversation.market_scope || 'multi-market'}</p></button>)}
                    <Button variant="outline" className="w-full" onClick={() => navigate('/analysis-records')}>查看完整归档</Button>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 bg-white shadow-sm">
                  <CardHeader><CardTitle className="text-base text-slate-950">Recent Briefings</CardTitle><CardDescription>晨报、公司一页纸和事件快报都会沉淀在这里。</CardDescription></CardHeader>
                  <CardContent className="space-y-3">
                    {featuredBriefings.map((briefing) => <div key={briefing.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"><div className="flex items-center gap-2"><Badge variant="outline">{briefing.briefing_type}</Badge><Badge variant="secondary">{briefing.market_scope || 'multi-market'}</Badge></div><p className="mt-2 font-medium text-slate-900">{briefing.title}</p><p className="mt-1 text-sm leading-6 text-slate-600">{briefing.summary || '暂无摘要'}</p></div>)}
                  </CardContent>
                </Card>
                <Card className="border-slate-200 bg-white shadow-sm">
                  <CardHeader><CardTitle className="text-base text-slate-950">Thesis Cards</CardTitle><CardDescription>高质量观点会沉淀成内部研究卡片，方便连续跟踪。</CardDescription></CardHeader>
                  <CardContent className="space-y-3">
                    {featuredCards.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">当前还没有 thesis card，先做一轮高质量研究对话。</div> : featuredCards.map((card) => <div key={card.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"><div className="flex items-center justify-between gap-2"><p className="font-medium text-slate-900">{card.title}</p>{card.market_scope && <Badge variant="outline">{card.market_scope}</Badge>}</div><p className="mt-1 text-sm leading-6 text-slate-600">{card.summary || card.content?.core_thesis || '暂无摘要'}</p><p className="mt-2 text-xs text-slate-500">{card.updated_at || card.created_at}</p></div>)}
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
