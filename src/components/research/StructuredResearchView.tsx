import type { ReactNode } from 'react';
import {
  ArrowRight,
  CircleAlert,
  LibraryBig,
  Link2,
  Radar,
  Scale,
  ShieldCheck,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type {
  CitationItem,
  ResearchStructuredOutput,
  ThesisCardContent,
} from '@/types/research';

type StructuredResearchViewProps = {
  output: ResearchStructuredOutput;
  thesisCard?: ThesisCardContent | null;
  citations?: CitationItem[];
  answer?: string;
  compact?: boolean;
  className?: string;
};

type LocalizedCopy = {
  sources: string;
  sourceFallback: string;
  thesisCard: string;
  subject: string;
  currentView: string;
  coreThesis: string;
  coreJudgment: string;
  directAnswer: string;
  oneLineTakeaway: string;
  bullCase: string;
  bearCase: string;
  keyVariables: string;
  mindChangeConditions: string;
  topThingsToWatch: string;
  strongestCounterargument: string;
  facts: string;
  inference: string;
  assumptions: string;
  shortTermCatalysts: string;
  mediumTermDrivers: string;
  longTermThesis: string;
  thesisContinuity: string;
  compliance: string;
  renderedAnswer: string;
  watchList: string;
  lastUpdated: string;
  degraded: string;
  priceVsThesis: string;
  emptyLabel: string;
};

function containsChinese(text: string) {
  return /[\u3400-\u9fff]/.test(text);
}

function getLocalizedCopy(zh: boolean): LocalizedCopy {
  if (zh) {
    return {
      sources: '参考来源',
      sourceFallback: '来源',
      thesisCard: 'Thesis Card',
      subject: '主题',
      currentView: '当前判断',
      coreThesis: '核心 Thesis',
      coreJudgment: '核心判断',
      directAnswer: '直接回答',
      oneLineTakeaway: '一句话结论',
      bullCase: '看多逻辑',
      bearCase: '看空逻辑',
      keyVariables: '关键变量',
      mindChangeConditions: '改变观点的条件',
      topThingsToWatch: '接下来要盯的点',
      strongestCounterargument: '最强反方',
      facts: '事实',
      inference: '推断',
      assumptions: '假设',
      shortTermCatalysts: '短期催化',
      mediumTermDrivers: '中期驱动',
      longTermThesis: '长期 Thesis',
      thesisContinuity: 'Thesis 延续',
      compliance: '合规提示',
      renderedAnswer: '完整答案',
      watchList: '观察清单',
      lastUpdated: '最近更新',
      degraded: '降级输出',
      priceVsThesis: '价格波动 vs Thesis',
      emptyLabel: '暂无补充',
    };
  }

  return {
    sources: 'Sources',
    sourceFallback: 'Source',
    thesisCard: 'Thesis Card',
    subject: 'Subject',
    currentView: 'Current View',
    coreThesis: 'Core Thesis',
    coreJudgment: 'Core Judgment',
    directAnswer: 'Direct Answer',
    oneLineTakeaway: 'One-Line Takeaway',
    bullCase: 'Bull Case',
    bearCase: 'Bear Case',
    keyVariables: 'Key Variables',
    mindChangeConditions: 'Mind-Change Conditions',
    topThingsToWatch: 'Top Things To Watch',
    strongestCounterargument: 'Strongest Counterargument',
    facts: 'Facts',
    inference: 'Inference',
    assumptions: 'Assumptions',
    shortTermCatalysts: 'Short-Term Catalysts',
    mediumTermDrivers: 'Medium-Term Drivers',
    longTermThesis: 'Long-Term Thesis',
    thesisContinuity: 'Thesis Continuity',
    compliance: 'Compliance',
    renderedAnswer: 'Rendered Answer',
    watchList: 'Watch List',
    lastUpdated: 'Last updated',
    degraded: 'degraded',
    priceVsThesis: 'price vs thesis',
    emptyLabel: 'No additional details',
  };
}

function FieldList({
  title,
  items,
  emptyLabel,
  tone = 'default',
  icon,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
  tone?: 'default' | 'bull' | 'bear' | 'watch';
  icon?: ReactNode;
}) {
  const toneClasses =
    tone === 'bull'
      ? 'border-emerald-200 bg-emerald-50/90'
      : tone === 'bear'
        ? 'border-rose-200 bg-rose-50/90'
        : tone === 'watch'
          ? 'border-amber-200 bg-amber-50/90'
          : 'border-border/70 bg-slate-50/82';

  return (
    <Card className={cn('rounded-[24px] border shadow-none', toneClasses)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle className="text-sm font-semibold text-slate-900">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm leading-6 text-slate-700">
        {items.length > 0 ? (
          items.map((item, index) => (
            <div
              key={`${title}-${index}-${item.slice(0, 12)}`}
              className="rounded-[18px] border border-white/80 bg-white/80 px-3 py-3"
            >
              {item}
            </div>
          ))
        ) : (
          <div className="rounded-[18px] border border-dashed border-slate-300 bg-white/70 px-3 py-3 text-slate-500">
            {emptyLabel}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CitationList({
  citations,
  copy,
}: {
  citations: CitationItem[];
  copy: LocalizedCopy;
}) {
  if (citations.length === 0) {
    return null;
  }

  return (
    <Card className="rounded-[24px] border-border/70 shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-slate-500" />
          <CardTitle className="text-sm font-semibold text-slate-900">{copy.sources}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {citations.map((citation, index) => (
          <a
            key={`${citation.url}-${index}`}
            href={citation.url}
            target="_blank"
            rel="noreferrer"
            className="block rounded-[20px] border border-border/70 bg-slate-50/82 px-4 py-4 transition-colors hover:border-amber-300 hover:bg-amber-50/70"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">#{citation.source_index || index + 1}</Badge>
              <Badge variant="secondary">{citation.publisher || copy.sourceFallback}</Badge>
              {citation.source_type ? <Badge variant="premium">{citation.source_type}</Badge> : null}
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900">{citation.title}</p>
            {citation.snippet ? (
              <p className="mt-2 text-sm leading-7 text-slate-600">{citation.snippet}</p>
            ) : null}
          </a>
        ))}
      </CardContent>
    </Card>
  );
}

function ThesisCardSummary({
  thesisCard,
  copy,
}: {
  thesisCard?: ThesisCardContent | null;
  copy: LocalizedCopy;
}) {
  if (!thesisCard) {
    return null;
  }

  return (
    <Card className="rounded-[24px] border-amber-200 bg-[linear-gradient(160deg,rgba(255,249,235,0.98),rgba(255,255,255,0.96))] shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <LibraryBig className="h-4 w-4 text-amber-700" />
            <CardTitle className="text-sm font-semibold text-slate-900">{copy.thesisCard}</CardTitle>
          </div>
          <Badge variant="premium">{thesisCard.current_view || copy.currentView}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-6 text-slate-700">
        <div>
          <p className="section-kicker">{copy.subject}</p>
          <p className="mt-2 font-semibold text-slate-950">{thesisCard.subject}</p>
        </div>
        <div>
          <p className="section-kicker">{copy.coreThesis}</p>
          <p className="mt-2">{thesisCard.core_thesis}</p>
        </div>
        {thesisCard.watch_list.length > 0 ? (
          <div>
            <p className="section-kicker">{copy.watchList}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {thesisCard.watch_list.map((item) => (
                <Badge key={item} variant="outline" className="bg-white/88">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
        <p className="text-xs text-slate-500">
          {copy.lastUpdated}: {thesisCard.last_updated}
        </p>
      </CardContent>
    </Card>
  );
}

export function StructuredResearchView({
  output,
  thesisCard,
  citations,
  answer,
  compact = false,
  className,
}: StructuredResearchViewProps) {
  const effectiveCitations = citations && citations.length > 0 ? citations : output.citations;
  const zh = containsChinese(
    [output.subject, output.current_view, output.core_judgment, output.direct_answer, thesisCard?.subject]
      .filter(Boolean)
      .join(' '),
  );
  const copy = getLocalizedCopy(zh);

  return (
    <div className={cn('space-y-4', className)} data-testid="structured-research-view">
      <Card className="overflow-hidden rounded-[28px] border-border/70 bg-white/96">
        <CardContent className={cn('space-y-5', compact ? 'p-4' : 'p-5 sm:p-6')}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">{output.subject}</Badge>
            <Badge variant="outline">{output.market_scope}</Badge>
            <Badge variant="secondary">{output.task_type}</Badge>
            {output.degraded ? (
              <Badge variant="warning" className="text-amber-700">
                {copy.degraded}
              </Badge>
            ) : null}
          </div>

          <div className={cn('grid gap-4', compact ? 'lg:grid-cols-1' : 'lg:grid-cols-[1.15fr_0.85fr]')}>
            <div className="space-y-4">
              <div className="rounded-[24px] border border-border/70 bg-slate-50/85 p-4">
                <p className="section-kicker">{copy.currentView}</p>
                <p className="mt-3 text-lg font-semibold tracking-tight text-slate-950">
                  {output.current_view}
                </p>
              </div>

              <div className="rounded-[24px] border border-amber-200 bg-amber-50/90 p-5">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-amber-700" />
                  <p className="section-kicker text-amber-700">{copy.coreJudgment}</p>
                </div>
                <p className="mt-3 text-[15px] font-medium leading-7 text-slate-900">
                  {output.core_judgment}
                </p>
              </div>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-[linear-gradient(160deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))] p-4">
              <div className="space-y-4">
                <div>
                  <p className="section-kicker">{copy.directAnswer}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    {output.direct_answer || output.core_judgment}
                  </p>
                </div>

                {output.one_line_takeaway ? (
                  <div className="rounded-[20px] bg-slate-950 px-4 py-4 text-white">
                    <p className="section-kicker text-slate-300">{copy.oneLineTakeaway}</p>
                    <p className="mt-2 text-sm leading-7">{output.one_line_takeaway}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <FieldList
              title={copy.bullCase}
              items={output.bull_case}
              emptyLabel={copy.emptyLabel}
              tone="bull"
              icon={<ArrowRight className="h-4 w-4 text-emerald-700" />}
            />
            <FieldList
              title={copy.bearCase}
              items={output.bear_case}
              emptyLabel={copy.emptyLabel}
              tone="bear"
              icon={<CircleAlert className="h-4 w-4 text-rose-700" />}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <FieldList
              title={copy.keyVariables}
              items={output.key_variables}
              emptyLabel={copy.emptyLabel}
              tone="watch"
              icon={<Radar className="h-4 w-4 text-amber-700" />}
            />
            <FieldList
              title={copy.mindChangeConditions}
              items={output.mind_change_conditions}
              emptyLabel={copy.emptyLabel}
              tone="watch"
              icon={<ShieldCheck className="h-4 w-4 text-amber-700" />}
            />
            <FieldList
              title={copy.topThingsToWatch}
              items={output.top_things_to_watch}
              emptyLabel={copy.emptyLabel}
              tone="watch"
              icon={<LibraryBig className="h-4 w-4 text-amber-700" />}
            />
          </div>

          <Card className="rounded-[24px] border-border/70 bg-slate-50/82 shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CircleAlert className="h-4 w-4 text-slate-500" />
                <CardTitle className="text-sm font-semibold text-slate-900">
                  {copy.strongestCounterargument}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-slate-700">
              {output.strongest_counterargument || copy.emptyLabel}
            </CardContent>
          </Card>

          {(output.facts.length > 0 || output.inference.length > 0 || output.assumptions.length > 0) ? (
            <div className="grid gap-4 xl:grid-cols-3">
              <FieldList title={copy.facts} items={output.facts} emptyLabel={copy.emptyLabel} />
              <FieldList title={copy.inference} items={output.inference} emptyLabel={copy.emptyLabel} />
              <FieldList title={copy.assumptions} items={output.assumptions} emptyLabel={copy.emptyLabel} />
            </div>
          ) : null}

          {(output.short_term_catalysts.length > 0 ||
            output.medium_term_drivers.length > 0 ||
            output.long_term_thesis.length > 0) ? (
            <div className="grid gap-4 xl:grid-cols-3">
              <FieldList
                title={copy.shortTermCatalysts}
                items={output.short_term_catalysts}
                emptyLabel={copy.emptyLabel}
              />
              <FieldList
                title={copy.mediumTermDrivers}
                items={output.medium_term_drivers}
                emptyLabel={copy.emptyLabel}
              />
              <FieldList
                title={copy.longTermThesis}
                items={output.long_term_thesis}
                emptyLabel={copy.emptyLabel}
              />
            </div>
          ) : null}

          {(output.impact_on_current_thesis !== 'not_applicable' ||
            output.thesis_update ||
            output.thesis_change_vs_price_action) ? (
            <Card className="rounded-[24px] border-amber-200 bg-amber-50/70 shadow-none">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Radar className="h-4 w-4 text-amber-700" />
                  <CardTitle className="text-sm font-semibold text-slate-900">
                    {copy.thesisContinuity}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-7 text-slate-700">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{output.impact_on_current_thesis}</Badge>
                  {output.thesis_change_vs_price_action ? (
                    <Badge variant="secondary">{copy.priceVsThesis}</Badge>
                  ) : null}
                </div>
                {output.thesis_update ? <p>{output.thesis_update}</p> : null}
                {output.thesis_change_vs_price_action ? <p>{output.thesis_change_vs_price_action}</p> : null}
              </CardContent>
            </Card>
          ) : null}

          {output.watch_list.length > 0 ? (
            <div>
              <p className="section-kicker">{copy.watchList}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {output.watch_list.map((item) => (
                  <Badge key={item} variant="outline" className="bg-white/88">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {output.compliance_flags.length > 0 ? (
            <div className="rounded-[22px] border border-amber-200 bg-amber-50/75 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-700" />
                <p className="section-kicker text-amber-700">{copy.compliance}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {output.compliance_flags.map((flag) => (
                  <Badge key={flag} variant="warning">
                    {flag}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {answer && answer !== output.direct_answer && answer !== output.core_judgment ? (
            <div className="rounded-[24px] border border-border/70 bg-slate-50/82 p-4">
              <p className="section-kicker">{copy.renderedAnswer}</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{answer}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className={cn('grid gap-4', compact ? 'xl:grid-cols-1' : 'xl:grid-cols-[minmax(0,1fr)_320px]')}>
        <CitationList citations={effectiveCitations} copy={copy} />
        <ThesisCardSummary thesisCard={thesisCard} copy={copy} />
      </div>
    </div>
  );
}

export default StructuredResearchView;
