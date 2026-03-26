import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  FileText,
  LibraryBig,
  LineChart,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BRAND_LOGIN_SUBTITLE,
  BRAND_POSITIONING,
  BRAND_SCOPE_HINT,
  BRAND_SHORT_NAME,
} from '@/lib/brand';
import { useAuth } from '@/lib/auth';

const FEATURE_CARDS = [
  {
    title: 'Thesis-first',
    description: '每轮回答先给明确判断，再展开 bull case、bear case、关键变量和 mind-change conditions。',
    icon: Sparkles,
  },
  {
    title: 'Follow-up continuity',
    description: '连续追问和 event update 会承接旧 thesis，而不是把每轮都做成新会话。',
    icon: LineChart,
  },
  {
    title: 'Archiveable knowledge',
    description: '高质量研究会沉淀成 Thesis Card、简报和可检索的研究资产，方便复用与追踪。',
    icon: LibraryBig,
  },
];

const WORKFLOW_STEPS = [
  '输入研究问题，系统优先给核心判断和 one-line takeaway。',
  '围绕同一 thesis 连续追问，补强反方观点、关键变量与更新条件。',
  '把高质量结论沉淀成 Thesis Card，在工作台和档案页持续复用。',
];

export default function Index() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = searchParams.get('type') ?? hashParams.get('type');
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const hasCode = Boolean(searchParams.get('code'));
    const hasTokenHash = Boolean(searchParams.get('token_hash') ?? hashParams.get('token_hash'));
    const hasAuthError = Boolean(searchParams.get('error_description') ?? hashParams.get('error_description'));
    const callbackSuffix = `${window.location.search}${window.location.hash}`;

    if (type === 'recovery' && (accessToken || hasCode || hasTokenHash)) {
      navigate(`/reset-password${callbackSuffix}`, { replace: true });
      return;
    }

    if (type === 'invite' && (accessToken || refreshToken || hasCode || hasTokenHash)) {
      navigate(`/invitation-setup${callbackSuffix}`, { replace: true });
      return;
    }

    if (
      (type === 'signup' || type === 'email' || type === 'magiclink') &&
      (accessToken || refreshToken || hasCode || hasTokenHash || hasAuthError)
    ) {
      navigate(`/auth/confirm${callbackSuffix}`, { replace: true });
      return;
    }

    if (!isLoading && isAuthenticated) {
      navigate('/workspace');
    }
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 py-8 sm:py-10">
        <div className="page-shell space-y-8">
          <section className="surface-card hero-grid overflow-hidden px-6 py-8 sm:px-8 sm:py-10">
            <div className="grid gap-8 xl:grid-cols-[1.08fr_0.92fr] xl:items-center">
              <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="premium">{BRAND_SHORT_NAME}</Badge>
                  <Badge variant="outline">thesis-first</Badge>
                  <Badge variant="secondary">research-only</Badge>
                </div>

                <div className="space-y-4">
                  <p className="section-kicker">AI Financial Research Workspace</p>
                  <h1 className="max-w-4xl text-balance text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl xl:text-6xl">
                    让 AI 像真正的投研搭档一样，先给判断，再持续更新 thesis。
                  </h1>
                  <p className="max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">
                    {BRAND_POSITIONING}
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button size="lg" onClick={() => navigate('/login')}>
                    进入研究工作台
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => navigate('/faq')}>
                    查看使用说明
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="panel-card-muted p-4">
                    <p className="metric-label">Output shape</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Core judgment, bull / bear case, counterargument, mind-change conditions.
                    </p>
                  </div>
                  <div className="panel-card-muted p-4">
                    <p className="metric-label">Continuity</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Follow-up continuity 与 event update 会围绕旧 thesis 增量修正。
                    </p>
                  </div>
                  <div className="panel-card-muted p-4">
                    <p className="metric-label">Compliance</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{BRAND_SCOPE_HINT}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Card className="bg-premium overflow-hidden border-amber-200/70">
                  <CardHeader className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="default">核心判断</Badge>
                      <Badge variant="outline">Tesla</Badge>
                      <Badge variant="secondary">event update</Badge>
                    </div>
                    <div className="space-y-3">
                      <CardTitle className="text-2xl">短期情绪波动没有推翻长期 thesis，但估值修复节奏要重新下调。</CardTitle>
                      <CardDescription className="text-sm leading-7">
                        先判断，再把结论拆成 bull case、bear case、关键变量、最强反方和需要改观的条件。
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[20px] border border-emerald-200 bg-emerald-50/80 p-4">
                      <p className="section-kicker text-emerald-700">Bull Case</p>
                      <p className="mt-2 text-sm leading-7 text-slate-700">
                        FSD 与储能业务打开估值上限，盈利质量依然领先大多数新能源整车同行。
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-rose-200 bg-rose-50/80 p-4">
                      <p className="section-kicker text-rose-700">Bear Case</p>
                      <p className="mt-2 text-sm leading-7 text-slate-700">
                        汽车业务毛利率和交付预期若继续走弱，市场会重新质疑“平台型科技公司”的估值框架。
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-amber-200 bg-white/90 p-4 lg:col-span-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="section-kicker">Thesis Card</p>
                          <p className="mt-2 text-sm leading-7 text-slate-700">
                            这类研究输出不会停留在聊天里，而是沉淀为可追踪、可复用、可在 Archive 中继续更新的资产。
                          </p>
                        </div>
                        <BookOpen className="h-10 w-10 text-amber-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="panel-card">
                  <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
                    <div>
                      <p className="metric-label">Briefings</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        市场晨报、公司一页纸、事件快报都走同一套 thesis-first 链路。
                      </p>
                    </div>
                    <div>
                      <p className="metric-label">Research archive</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        历史对话、简报和 Thesis Card 被统一归档，方便追问与复盘。
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            {FEATURE_CARDS.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="h-full">
                <CardContent className="flex h-full flex-col gap-4 pt-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-accent/60 text-slate-900">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-semibold text-slate-950">{title}</p>
                    <p className="text-sm leading-7 text-slate-600">{description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
            <Card className="panel-card bg-premium-muted">
              <CardHeader>
                <CardTitle>体验流程</CardTitle>
                <CardDescription>{BRAND_LOGIN_SUBTITLE}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {WORKFLOW_STEPS.map((step, index) => (
                  <div key={step} className="flex gap-4 rounded-[22px] border border-border/70 bg-white/86 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-7 text-slate-700">{step}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="panel-card">
              <CardHeader>
                <CardTitle>为什么它不像普通聊天壳</CardTitle>
                <CardDescription>
                  这不是“搜索结果拼装器”，而是围绕研究结构、连贯更新和资产沉淀来组织体验。
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[22px] border border-border/70 bg-slate-50/80 p-5">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-amber-600" />
                    <p className="font-semibold text-slate-950">Structured research</p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    current view、direct answer、core judgment、watch list 和 citations 都会被清晰展示。
                  </p>
                </div>
                <div className="rounded-[22px] border border-border/70 bg-slate-50/80 p-5">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-amber-600" />
                    <p className="font-semibold text-slate-950">Research-only guardrail</p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    “买不买、仓位多少、止损止盈”这类问题会被自动改写成研究型分析，不误导成交易建议。
                  </p>
                </div>
                <div className="rounded-[22px] border border-border/70 bg-slate-50/80 p-5">
                  <div className="flex items-center gap-2">
                    <LibraryBig className="h-4 w-4 text-amber-600" />
                    <p className="font-semibold text-slate-950">Thesis asset library</p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    档案页不是简单历史列表，而是可以检索、复用、继续跟踪的研究资产库。
                  </p>
                </div>
                <div className="rounded-[22px] border border-border/70 bg-slate-50/80 p-5">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-amber-600" />
                    <p className="font-semibold text-slate-950">Briefings on the same rail</p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    晨报、一页纸和快报不会脱离主工作流，而是与对话和 Thesis Card 共用同一套研究逻辑。
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
