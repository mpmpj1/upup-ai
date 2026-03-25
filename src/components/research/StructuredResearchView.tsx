import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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

function FieldList({
  title,
  items,
  emptyLabel = '暂无补充',
  tone = 'default',
}: {
  title: string;
  items: string[];
  emptyLabel?: string;
  tone?: 'default' | 'bull' | 'bear' | 'watch';
}) {
  const toneClasses =
    tone === 'bull'
      ? 'border-emerald-200 bg-emerald-50'
      : tone === 'bear'
        ? 'border-rose-200 bg-rose-50'
        : tone === 'watch'
          ? 'border-amber-200 bg-amber-50'
          : 'border-slate-200 bg-slate-50';

  return (
    <Card className={cn('border shadow-none', toneClasses)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-900">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm leading-6 text-slate-700">
        {items.length > 0 ? (
          items.map((item, index) => (
            <div
              key={`${title}-${index}-${item.slice(0, 12)}`}
              className="rounded-xl border border-white/70 bg-white/70 px-3 py-2"
            >
              {item}
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-3 py-2 text-slate-500">
            {emptyLabel}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CitationList({ citations }: { citations: CitationItem[] }) {
  if (citations.length === 0) {
    return null;
  }

  return (
    <Card className="border-slate-200 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-900">Sources</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {citations.map((citation, index) => (
          <a
            key={`${citation.url}-${index}`}
            href={citation.url}
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 transition-colors hover:border-amber-300 hover:bg-amber-50"
          >
            <div className="flex items-center gap-2">
              <Badge variant="outline">#{citation.source_index || index + 1}</Badge>
              <Badge variant="secondary">{citation.publisher || 'Source'}</Badge>
            </div>
            <p className="mt-2 text-sm font-medium text-slate-900">{citation.title}</p>
            {citation.snippet && (
              <p className="mt-1 text-sm leading-6 text-slate-600">{citation.snippet}</p>
            )}
          </a>
        ))}
      </CardContent>
    </Card>
  );
}

function ThesisCardSummary({ thesisCard }: { thesisCard?: ThesisCardContent | null }) {
  if (!thesisCard) {
    return null;
  }

  return (
    <Card className="border-slate-200 bg-slate-50 shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold text-slate-900">Thesis Card</CardTitle>
          <Badge className="bg-slate-900 text-white hover:bg-slate-900">
            {thesisCard.current_view || 'Current View'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-6 text-slate-700">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Subject</p>
          <p className="mt-1 font-medium text-slate-900">{thesisCard.subject}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Core Thesis</p>
          <p className="mt-1">{thesisCard.core_thesis}</p>
        </div>
        {thesisCard.watch_list.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Watch List</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {thesisCard.watch_list.map((item) => (
                <Badge key={item} variant="outline" className="bg-white">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-slate-500">Last updated: {thesisCard.last_updated}</p>
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

  return (
    <div className={cn('space-y-4', className)} data-testid="structured-research-view">
      <Card className="border-slate-200 shadow-sm">
        <CardContent className={cn('space-y-4', compact ? 'p-4' : 'p-5')}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-slate-950 text-white hover:bg-slate-950">{output.subject}</Badge>
            <Badge variant="outline">{output.market_scope}</Badge>
            <Badge variant="secondary">{output.task_type}</Badge>
            {output.degraded && (
              <Badge variant="destructive" className="bg-amber-500 text-white hover:bg-amber-500">
                degraded
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Current View</p>
            <p className="text-lg font-semibold text-slate-950">{output.current_view}</p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.22em] text-amber-700">Core Judgment</p>
            <p className="mt-2 text-[15px] font-medium leading-7 text-slate-900">
              {output.core_judgment}
            </p>
          </div>

          {output.direct_answer && output.direct_answer !== output.core_judgment && (
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Direct Answer</p>
              <p className="mt-2 text-[15px] leading-7 text-slate-700">{output.direct_answer}</p>
            </div>
          )}

          {answer && answer !== output.direct_answer && answer !== output.core_judgment && (
            <>
              <Separator />
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Rendered Answer</p>
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7 text-slate-700">
                  {answer}
                </p>
              </div>
            </>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <FieldList title="Bull Case" items={output.bull_case} tone="bull" />
            <FieldList title="Bear Case" items={output.bear_case} tone="bear" />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <FieldList title="Key Variables" items={output.key_variables} tone="watch" />
            <FieldList
              title="Mind-Change Conditions"
              items={output.mind_change_conditions}
              tone="watch"
            />
            <FieldList title="Top Things To Watch" items={output.top_things_to_watch} tone="watch" />
          </div>

          <Card className="border-slate-200 bg-white shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-900">
                Strongest Counterargument
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-slate-700">
              {output.strongest_counterargument || '暂无补充'}
            </CardContent>
          </Card>

          {(output.facts.length > 0 ||
            output.inference.length > 0 ||
            output.assumptions.length > 0) && (
            <div className="grid gap-4 xl:grid-cols-3">
              <FieldList title="Facts" items={output.facts} />
              <FieldList title="Inference" items={output.inference} />
              <FieldList title="Assumptions" items={output.assumptions} />
            </div>
          )}

          {(output.short_term_catalysts.length > 0 ||
            output.medium_term_drivers.length > 0 ||
            output.long_term_thesis.length > 0) && (
            <div className="grid gap-4 xl:grid-cols-3">
              <FieldList title="Short-Term Catalysts" items={output.short_term_catalysts} />
              <FieldList title="Medium-Term Drivers" items={output.medium_term_drivers} />
              <FieldList title="Long-Term Thesis" items={output.long_term_thesis} />
            </div>
          )}

          {(output.impact_on_current_thesis !== 'not_applicable' ||
            output.thesis_update ||
            output.thesis_change_vs_price_action) && (
            <Card className="border-slate-200 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-900">
                  Thesis Continuity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-slate-700">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{output.impact_on_current_thesis}</Badge>
                  {output.thesis_change_vs_price_action && (
                    <Badge variant="secondary">price vs thesis</Badge>
                  )}
                </div>
                {output.thesis_update && <p>{output.thesis_update}</p>}
                {output.thesis_change_vs_price_action && (
                  <p>{output.thesis_change_vs_price_action}</p>
                )}
              </CardContent>
            </Card>
          )}

          {output.watch_list.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Watch List</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {output.watch_list.map((item) => (
                  <Badge key={item} variant="outline">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {output.one_line_takeaway && (
            <div className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-4 text-white">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-300">One-Line Takeaway</p>
              <p className="mt-2 text-[15px] leading-7">{output.one_line_takeaway}</p>
            </div>
          )}

          {output.compliance_flags.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Compliance</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {output.compliance_flags.map((flag) => (
                  <Badge key={flag} variant="outline" className="border-amber-300 bg-amber-50">
                    {flag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className={cn('grid gap-4', compact ? 'xl:grid-cols-1' : 'xl:grid-cols-[minmax(0,1fr)_320px]')}>
        <CitationList citations={effectiveCitations} />
        <ThesisCardSummary thesisCard={thesisCard} />
      </div>
    </div>
  );
}

export default StructuredResearchView;
