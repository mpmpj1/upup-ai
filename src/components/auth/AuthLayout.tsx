import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { BRAND_NAME, BRAND_POSITIONING_SHORT, BRAND_SCOPE_HINT, BRAND_TAGLINE } from '@/lib/brand';

type AuthLayoutProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  highlights?: Array<{
    title: string;
    description: string;
  }>;
  compact?: boolean;
};

const DEFAULT_HIGHLIGHTS = [
  {
    title: 'Thesis-first output',
    description: '先给核心判断，再展开 bull case、bear case、关键变量和反方观点。',
  },
  {
    title: 'Continuous research',
    description: '连续追问和事件更新会承接上一轮 thesis，而不是每轮重写。',
  },
  {
    title: 'Archiveable assets',
    description: '高质量回答会沉淀成 Thesis Card、简报和可复用的研究档案。',
  },
];

export default function AuthLayout({
  eyebrow,
  title,
  description,
  children,
  footer,
  highlights = DEFAULT_HIGHLIGHTS,
  compact = false,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.12),_transparent_22%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.08),_transparent_24%),linear-gradient(180deg,#fffdf8_0%,#f8fafc_100%)] px-4 py-8 sm:px-6 lg:py-12">
      <div
        className={`mx-auto grid w-full gap-8 ${
          compact ? 'max-w-5xl lg:grid-cols-[0.95fr_1.05fr]' : 'max-w-6xl lg:grid-cols-[1.05fr_0.95fr]'
        }`}
      >
        <section className="surface-card hero-grid relative overflow-hidden px-6 py-7 sm:px-8 sm:py-9">
          <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.18),_transparent_60%)]" />
          <div className="relative space-y-8">
            <div className="flex items-center justify-between gap-4">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-white/85 px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 hover:text-slate-950"
              >
                <ArrowLeft className="h-4 w-4" />
                返回首页
              </Link>
              <Badge variant="premium" className="hidden sm:inline-flex">
                research-only
              </Badge>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{BRAND_NAME}</Badge>
                <Badge variant="secondary">{BRAND_POSITIONING_SHORT}</Badge>
              </div>
              <div className="space-y-3">
                <p className="section-kicker">{eyebrow}</p>
                <h1 className="max-w-xl text-balance text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  {title}
                </h1>
                <p className="max-w-xl text-sm leading-7 text-slate-600 sm:text-[15px]">
                  {description}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {highlights.map((highlight) => (
                <div key={highlight.title} className="panel-card-muted h-full p-4">
                  <p className="text-sm font-semibold text-slate-900">{highlight.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{highlight.description}</p>
                </div>
              ))}
            </div>

            <div className="panel-card bg-premium p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-slate-950 p-2 text-white">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-semibold text-slate-950">{BRAND_TAGLINE}</p>
                  </div>
                  <p className="text-sm leading-6 text-slate-600">{BRAND_SCOPE_HINT}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="surface-card bg-premium-muted self-stretch px-6 py-7 sm:px-8 sm:py-9">
          <div className="mx-auto flex h-full max-w-lg flex-col justify-center gap-6">
            {children}
            {footer ? <div className="subtle-divider" /> : null}
            {footer}
          </div>
        </section>
      </div>
    </div>
  );
}
