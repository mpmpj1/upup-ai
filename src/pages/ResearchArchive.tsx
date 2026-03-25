import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Archive, Loader2, Search } from 'lucide-react';

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
    <div className="prose prose-slate max-w-none text-slate-800 prose-headings:text-slate-950 prose-p:text-slate-700 prose-li:text-slate-700">
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
            title: '加载研究归档失败',
            description: getErrorMessage(error, '请检查数据库迁移和 Supabase 连接。'),
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
  const filteredConversations = useMemo(() => conversations.filter((item) => !normalizedQuery || `${item.title} ${item.market_scope || ''}`.toLowerCase().includes(normalizedQuery)), [conversations, normalizedQuery]);
  const filteredBriefings = useMemo(() => briefings.filter((item) => !normalizedQuery || `${item.title} ${item.summary || ''} ${item.market_scope || ''}`.toLowerCase().includes(normalizedQuery)), [briefings, normalizedQuery]);
  const filteredCards = useMemo(() => thesisCards.filter((item) => !normalizedQuery || `${item.title} ${item.summary || ''} ${item.market_scope || ''}`.toLowerCase().includes(normalizedQuery)), [thesisCards, normalizedQuery]);

  if (isLoading || loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50"><div className="text-center"><Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-amber-600" /><p className="text-slate-600">正在加载研究归档...</p></div></div>;
  }
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />
      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-950"><Archive className="h-7 w-7 text-amber-600" />研究归档</h1>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">把历史对话、briefings 和 thesis cards 放到同一套结构下复盘，方便继续追问、做事件更新和更新旧 thesis。</p>
              </div>
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索会话、简报或 thesis card" className="pl-9" />
              </div>
            </div>
          </section>

          <Tabs defaultValue="conversations" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3 bg-white">
              <TabsTrigger value="conversations">历史会话</TabsTrigger>
              <TabsTrigger value="briefings">历史简报</TabsTrigger>
              <TabsTrigger value="thesis-cards">Thesis Cards</TabsTrigger>
            </TabsList>

            <TabsContent value="conversations">
              <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                <Card className="border-slate-200 bg-white shadow-sm">
                  <CardHeader><CardTitle className="text-base text-slate-950">会话列表</CardTitle><CardDescription>选择一段研究对话查看完整内容。</CardDescription></CardHeader>
                  <CardContent className="space-y-3">{filteredConversations.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">没有匹配的历史会话。</div> : filteredConversations.map((conversation) => <button key={conversation.id} type="button" onClick={() => startTransition(() => setSelectedConversationId(conversation.id))} className={`w-full rounded-2xl border p-3 text-left transition-colors ${selectedConversationId === conversation.id ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}><p className="font-medium text-slate-900">{getReadableConversationTitle(conversation.title)}</p><p className="mt-1 text-xs uppercase tracking-[0.15em] text-slate-500">{conversation.market_scope || 'multi-market'}</p></button>)}</CardContent>
                </Card>
                <Card className="border-slate-200 bg-white shadow-sm">
                  <CardHeader><CardTitle className="text-base text-slate-950">会话内容</CardTitle><CardDescription>连续追踪 thesis 是否真的被新问题或事件改变。</CardDescription></CardHeader>
                  <CardContent className="space-y-6">{messages.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">当前没有可展示的消息。</div> : messages.map((message) => { const output = structuredOutputFromMessage(message); const thesisCard = thesisCardFromMessage(message); return <div key={message.id} className="space-y-3">{message.role === 'user' ? <div className="ml-auto max-w-2xl rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-sm"><p className="whitespace-pre-wrap text-[15px] leading-7">{getReadableMessageContent(message.content)}</p></div> : hasStructuredContent(output) ? <StructuredResearchView output={output} thesisCard={thesisCard} answer={message.content} compact /> : <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><MarkdownFallback content={getReadableMessageContent(message.content)} /></div>}</div>; })}</CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="briefings">
              <div className="grid gap-4 lg:grid-cols-2">
                {filteredBriefings.length === 0 ? <Card className="border-slate-200 bg-white shadow-sm lg:col-span-2"><CardContent className="pt-6"><p className="font-medium text-slate-900">没有匹配的历史简报。</p><p className="mt-2 text-sm leading-6 text-slate-600">回到工作台生成新的晨报、公司一页纸或事件快报。</p></CardContent></Card> : filteredBriefings.map((briefing) => { const output = structuredOutputFromBriefing(briefing); const thesisCard = thesisCardFromBriefing(briefing); return <Card key={briefing.id} className="border-slate-200 bg-white shadow-sm"><CardHeader><div className="flex items-center gap-2"><Badge variant="outline">{briefing.briefing_type}</Badge><Badge variant="secondary">{briefing.market_scope || 'multi-market'}</Badge></div><CardTitle className="text-slate-950">{briefing.title}</CardTitle><CardDescription>{briefing.summary || '暂无摘要'}</CardDescription></CardHeader><CardContent>{hasStructuredContent(output) ? <StructuredResearchView output={output} thesisCard={thesisCard} answer={briefing.content} compact /> : <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><MarkdownFallback content={briefing.content} /></div>}</CardContent></Card>; })}
              </div>
            </TabsContent>

            <TabsContent value="thesis-cards">
              <div className="grid gap-4 lg:grid-cols-2">
                {filteredCards.length === 0 ? <Card className="border-slate-200 bg-white shadow-sm lg:col-span-2"><CardContent className="pt-6"><p className="font-medium text-slate-900">没有匹配的 thesis card。</p><p className="mt-2 text-sm leading-6 text-slate-600">高质量研究对话和 briefings 会自动沉淀到这里。</p></CardContent></Card> : filteredCards.map((card) => <Card key={card.id} className="border-slate-200 bg-white shadow-sm"><CardHeader><div className="flex items-center gap-2">{card.market_scope && <Badge variant="secondary">{card.market_scope}</Badge>}{card.card_kind && <Badge variant="outline">{card.card_kind}</Badge>}</div><CardTitle className="text-slate-950">{card.title}</CardTitle><CardDescription>{card.summary || card.content?.core_thesis || '暂无摘要'}</CardDescription></CardHeader><CardContent><StructuredResearchView output={{ task_type: 'thesis_card', market_scope: card.market_scope || 'multi-market', subject: card.content?.subject || card.title, current_view: card.content?.current_view || '', direct_answer: card.content?.core_thesis || '', core_judgment: card.content?.core_thesis || '', bull_case: card.content?.bull_case || [], bear_case: card.content?.bear_case || [], key_variables: card.content?.top_key_variables || [], strongest_counterargument: card.content?.strongest_counterargument || '', mind_change_conditions: card.content?.mind_change_conditions || [], one_line_takeaway: card.summary || card.content?.core_thesis || '', facts: [], inference: [], assumptions: [], short_term_catalysts: [], medium_term_drivers: [], long_term_thesis: [], thesis_change_vs_price_action: '', impact_on_current_thesis: 'not_applicable', thesis_update: '', top_things_to_watch: [], watch_list: card.content?.watch_list || [], citations: card.citations || [], compliance_flags: card.compliance_flags || [], degraded: false }} thesisCard={card.content} compact /></CardContent></Card>)}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end"><Button variant="outline" onClick={() => navigate('/workspace')}>返回研究工作台</Button></div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
