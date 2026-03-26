import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Archive, LibraryBig, Loader2, Search } from 'lucide-react';

import Footer from '@/components/Footer';
import Header from '@/components/Header';
import StructuredResearchView from '@/components/research/StructuredResearchView';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { getBriefings, getConversationMessages, getConversations, getThesisCards } from '@/lib/research';
import {
  getReadableConversationTitle,
  getReadableMessageContent,
  hasStructuredContent,
  structuredOutputFromBriefing,
  structuredOutputFromMessage,
  thesisCardFromBriefing,
  thesisCardFromMessage,
} from '@/lib/research/structuredPayload';
import type { BriefingCard, ConversationMessage, ResearchConversation, ThesisCardRecord } from '@/types/research';

function MarkdownFallback({ content }: { content: string }) {
  return (
    <div className="research-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
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

export default function ResearchArchive() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<ResearchConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [briefings, setBriefings] = useState<BriefingCard[]>([]);
  const [thesisCards, setThesisCards] = useState<ThesisCardRecord[]>([]);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, isLoading, navigate]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        const [conversationList, briefingList, thesisCardList] = await Promise.all([
          getConversations(40),
          getBriefings(30),
          getThesisCards(30),
        ]);

        if (cancelled) {
          return;
        }

        setConversations(conversationList);
        setBriefings(briefingList);
        setThesisCards(thesisCardList);

        if (conversationList[0]?.id) {
          startTransition(() => setSelectedConversationId(conversationList[0].id));
        }
      } catch (error: unknown) {
        if (!cancelled) {
          toast({
            title: '加载研究档案失败',
            description: getErrorMessage(error, '请检查数据库连接与研究服务。'),
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
  }, [isAuthenticated, toast]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    getConversationMessages(selectedConversationId)
      .then(setMessages)
      .catch((error: unknown) => {
        toast({
          title: '加载会话内容失败',
          description: getErrorMessage(error, '无法读取历史研究消息。'),
          variant: 'destructive',
        });
      });
  }, [selectedConversationId, toast]);

  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const filteredConversations = useMemo(
    () =>
      conversations.filter(
        (item) =>
          !normalizedQuery ||
          `${item.title} ${item.market_scope || ''}`.toLowerCase().includes(normalizedQuery),
      ),
    [conversations, normalizedQuery],
  );

  const filteredBriefings = useMemo(
    () =>
      briefings.filter(
        (item) =>
          !normalizedQuery ||
          `${item.title} ${item.summary || ''} ${item.market_scope || ''}`
            .toLowerCase()
            .includes(normalizedQuery),
      ),
    [briefings, normalizedQuery],
  );

  const filteredCards = useMemo(
    () =>
      thesisCards.filter(
        (item) =>
          !normalizedQuery ||
          `${item.title} ${item.summary || ''} ${item.market_scope || ''}`
            .toLowerCase()
            .includes(normalizedQuery),
      ),
    [normalizedQuery, thesisCards],
  );

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-amber-600" />
          <p className="text-slate-600">正在加载研究档案...</p>
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
          <section className="surface-card bg-premium-muted px-6 py-7 sm:px-8 sm:py-8">
            <div className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr] xl:items-end">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="premium">Archive-ready</Badge>
                  <Badge variant="outline">research assets</Badge>
                </div>
                <div className="space-y-3">
                  <p className="section-kicker">研究归档</p>
                  <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                    <Archive className="h-7 w-7 text-amber-600" />
                    把研究结论、简报和 Thesis Card 统一沉淀成资产库
                  </h1>
                  <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-[15px]">
                    这里不是简单的历史列表，而是为 follow-up 延续、event update 增量更新和 thesis 复用准备的研究资产库。
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索会话、简报或 Thesis Card"
                    className="pl-11"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 sm:min-w-[250px]">
                  <div className="panel-card-muted p-3 text-center">
                    <p className="metric-label">Conversations</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">{conversations.length}</p>
                  </div>
                  <div className="panel-card-muted p-3 text-center">
                    <p className="metric-label">Briefings</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">{briefings.length}</p>
                  </div>
                  <div className="panel-card-muted p-3 text-center">
                    <p className="metric-label">Cards</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">{thesisCards.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Tabs defaultValue="conversations" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="conversations">历史会话</TabsTrigger>
              <TabsTrigger value="briefings">历史简报</TabsTrigger>
              <TabsTrigger value="thesis-cards">Thesis Cards</TabsTrigger>
            </TabsList>

            <TabsContent value="conversations">
              <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                <Card className="panel-card">
                  <CardHeader>
                    <CardTitle className="text-base">会话列表</CardTitle>
                    <CardDescription>选择一段研究对话，查看完整来龙去脉和 thesis 演进。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {filteredConversations.length === 0 ? (
                      <div className="rounded-[22px] border border-dashed border-border bg-slate-50/82 p-4 text-sm leading-6 text-slate-500">
                        没有匹配的历史会话。
                      </div>
                    ) : (
                      filteredConversations.map((conversation) => (
                        <button
                          key={conversation.id}
                          type="button"
                          onClick={() => startTransition(() => setSelectedConversationId(conversation.id))}
                          className={`w-full rounded-[22px] border p-4 text-left transition-colors ${
                            selectedConversationId === conversation.id
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
                    <CardTitle className="text-base">会话内容</CardTitle>
                    <CardDescription>重点检查 follow-up 延续，以及 thesis 是否被新信息真正改变。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {messages.length === 0 ? (
                      <div className="rounded-[22px] border border-dashed border-border bg-slate-50/82 p-4 text-sm leading-6 text-slate-500">
                        当前没有可展示的消息。
                      </div>
                    ) : (
                      messages.map((message) => {
                        const output = structuredOutputFromMessage(message);
                        const thesisCard = thesisCardFromMessage(message);

                        return (
                          <div key={message.id} className="space-y-3">
                            {message.role === 'user' ? (
                              <div className="ml-auto max-w-2xl rounded-[24px] bg-slate-950 px-5 py-4 text-white shadow-sm">
                                <p className="whitespace-pre-wrap text-[15px] leading-7">
                                  {getReadableMessageContent(message.content)}
                                </p>
                              </div>
                            ) : hasStructuredContent(output) ? (
                              <StructuredResearchView
                                output={output}
                                thesisCard={thesisCard}
                                answer={message.content}
                                compact
                              />
                            ) : (
                              <div className="rounded-[24px] border border-border/70 bg-slate-50/82 p-5">
                                <MarkdownFallback content={getReadableMessageContent(message.content)} />
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="briefings">
              <div className="grid gap-4 xl:grid-cols-2">
                {filteredBriefings.length === 0 ? (
                  <Card className="panel-card xl:col-span-2">
                    <CardContent className="pt-6">
                      <p className="text-lg font-semibold text-slate-950">没有匹配的历史简报</p>
                      <p className="mt-3 text-sm leading-7 text-slate-600">
                        回到工作台生成新的晨报、公司一页纸或事件快报，它们会自动归档到这里。
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredBriefings.map((briefing) => {
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
                              compact
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
            </TabsContent>

            <TabsContent value="thesis-cards">
              <div className="grid gap-4 xl:grid-cols-2">
                {filteredCards.length === 0 ? (
                  <Card className="panel-card xl:col-span-2">
                    <CardContent className="pt-6">
                      <p className="text-lg font-semibold text-slate-950">没有匹配的 Thesis Card</p>
                      <p className="mt-3 text-sm leading-7 text-slate-600">
                        高质量研究对话和简报会自动沉淀到这里，作为后续追问和事件更新的基础资产。
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredCards.map((card) => (
                    <Card key={card.id} className="panel-card">
                      <CardHeader>
                        <div className="flex flex-wrap items-center gap-2">
                          {card.market_scope ? <Badge variant="secondary">{card.market_scope}</Badge> : null}
                          {card.card_kind ? <Badge variant="outline">{card.card_kind}</Badge> : null}
                          <Badge variant="premium">
                            <LibraryBig className="mr-1 h-3.5 w-3.5" />
                            asset
                          </Badge>
                        </div>
                        <CardTitle>{card.title}</CardTitle>
                        <CardDescription>{card.summary || card.content?.core_thesis || '暂无摘要'}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <StructuredResearchView
                          output={{
                            task_type: 'thesis_card',
                            market_scope: card.market_scope || 'multi-market',
                            subject: card.content?.subject || card.title,
                            current_view: card.content?.current_view || '',
                            direct_answer: card.content?.core_thesis || '',
                            core_judgment: card.content?.core_thesis || '',
                            bull_case: card.content?.bull_case || [],
                            bear_case: card.content?.bear_case || [],
                            key_variables: card.content?.top_key_variables || [],
                            strongest_counterargument: card.content?.strongest_counterargument || '',
                            mind_change_conditions: card.content?.mind_change_conditions || [],
                            one_line_takeaway: card.summary || card.content?.core_thesis || '',
                            facts: [],
                            inference: [],
                            assumptions: [],
                            short_term_catalysts: [],
                            medium_term_drivers: [],
                            long_term_thesis: [],
                            thesis_change_vs_price_action: '',
                            impact_on_current_thesis: 'not_applicable',
                            thesis_update: '',
                            top_things_to_watch: [],
                            watch_list: card.content?.watch_list || [],
                            citations: card.citations || [],
                            compliance_flags: card.compliance_flags || [],
                            degraded: false,
                          }}
                          thesisCard={card.content}
                          compact
                        />
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => navigate('/workspace')}>
              返回研究工作台
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
