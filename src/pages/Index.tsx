import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileText, MessageSquareText, ShieldAlert } from 'lucide-react';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';

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
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-12">
          <section className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr] lg:items-center">
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <Badge>涨涨AI / UpUp AI</Badge>
                <Badge variant="outline">只答金融</Badge>
                <Badge variant="secondary">研究优先</Badge>
              </div>

              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
                  强自主意识、强观点的 AI 投资伙伴
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  这个版本专注验证产品力，不做交易执行。用户进入后直接对话，目标是得到明确立场、正反 thesis、风险点、情景分析和来源，而不是空泛摘要。
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="lg" onClick={() => navigate('/login')}>
                  进入内测工作台
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate('/faq')}>
                  查看使用说明
                </Button>
              </div>
            </div>

            <Card className="border-yellow-300/40 bg-[radial-gradient(circle_at_top_left,_rgba(250,204,21,0.18),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,1),_rgba(248,250,252,0.96))]">
              <CardContent className="space-y-5 p-6">
                <div>
                  <p className="text-sm font-medium text-yellow-700">核心原则</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    允许研究结论、正反 thesis、风险点、情景分析。拒绝个性化买卖建议、仓位、止盈止损、自动调仓和收益承诺。
                  </p>
                </div>
                <div className="grid gap-3">
                  <div className="rounded-xl border border-border/60 bg-white/80 p-4">
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="h-4 w-4 text-yellow-600" />
                      <p className="font-medium">对话优先</p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      直接问“你怎么看特斯拉？”而不是先走 ticker workflow。
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-white/80 p-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-yellow-600" />
                      <p className="font-medium">简报与沉淀</p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      市场晨报、公司一页纸和事件快报都可以直接生成。
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-white/80 p-4">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-yellow-600" />
                      <p className="font-medium">合规边界</p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      自动改写成研究型输出，避免触碰投顾和交易执行红线。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="font-medium">Thesis-first</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  每次回答默认追求清晰立场，不满足于信息堆砌。
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="font-medium">Source-ranked</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  优先公司公告、监管文件、交易所披露、主流财经媒体，再到辅助性社区信息。
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="font-medium">Gateway-ready</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Provider 设置支持 `base_url` 和额外 headers，可接 OpenAI-compatible 国内中转。
                </p>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
