import type {
  BriefingCard,
  CitationItem,
  ConversationMessage,
  ResearchStructuredOutput,
  StructuredMessagePayload,
  ThesisCardContent,
  ThesisCardRecord,
} from '@/types/research';

function containsChinese(text: string) {
  return /[\u3400-\u9fff]/.test(text);
}

export function pickFirstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

export function coerceArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function looksBrokenContent(content?: string | null) {
  if (!content?.trim()) {
    return true;
  }

  const stripped = content.replace(/\s+/g, '');
  const replacementRatio =
    stripped.length > 0
      ? (stripped.match(/[\uFFFD]/g)?.length || 0) / stripped.length
      : 0;

  return (
    content.includes('undefined') ||
    content.includes('{item.') ||
    content.includes('?{') ||
    replacementRatio >= 0.4 ||
    /^(\?|\ufffd)+$/.test(stripped)
  );
}

function uniqueStrings(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function normalizeCitationItems(items: unknown): CitationItem[] {
  return coerceArray(items)
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const entry = item as Record<string, unknown>;
      const url = pickFirstString(entry.url);
      if (!url) {
        return null;
      }

      return {
        title: pickFirstString(entry.title) || `Source ${index + 1}`,
        url,
        publisher: pickFirstString(entry.publisher),
        snippet: pickFirstString(entry.snippet),
        source_tier: Number(entry.source_tier || 2) as 1 | 2 | 3,
        source_type:
          (pickFirstString(entry.source_type) as CitationItem['source_type']) || 'other',
        source_index: Number(entry.source_index || index + 1),
      } satisfies CitationItem;
    })
    .filter(Boolean) as CitationItem[];
}

function defaultStructuredOutput(): ResearchStructuredOutput {
  return {
    task_type: 'initial_thesis',
    market_scope: 'multi-market',
    subject: '未命名主题',
    current_view: '初步判断',
    direct_answer: '',
    core_judgment: '',
    bull_case: [],
    bear_case: [],
    key_variables: [],
    strongest_counterargument: '',
    mind_change_conditions: [],
    one_line_takeaway: '',
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
    watch_list: [],
    citations: [],
    compliance_flags: [],
    degraded: false,
  };
}

export function normalizeStructuredOutput(input: unknown): ResearchStructuredOutput {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const nested =
    source.structured_output && typeof source.structured_output === 'object'
      ? (source.structured_output as Record<string, unknown>)
      : source;
  const legacyTheses =
    source.theses && typeof source.theses === 'object'
      ? (source.theses as Record<string, unknown>)
      : {};
  const legacyStance =
    source.stance && typeof source.stance === 'object'
      ? (source.stance as Record<string, unknown>)
      : {};
  const output = defaultStructuredOutput();

  const bullCase =
    coerceArray<string>(nested.bull_case).length > 0
      ? coerceArray<string>(nested.bull_case)
      : coerceArray<Record<string, unknown>>(legacyTheses.bull).map((item) =>
          pickFirstString(item.summary, item.description, item.title),
        );
  const bearCase =
    coerceArray<string>(nested.bear_case).length > 0
      ? coerceArray<string>(nested.bear_case)
      : coerceArray<Record<string, unknown>>(legacyTheses.bear).map((item) =>
          pickFirstString(item.summary, item.description, item.title),
        );
  const keyVariables =
    coerceArray<string>(nested.key_variables).length > 0
      ? coerceArray<string>(nested.key_variables)
      : uniqueStrings([
          ...coerceArray<Record<string, unknown>>(source.scenarios).map((item) =>
            pickFirstString(item.name, item.description),
          ),
          ...coerceArray<Record<string, unknown>>(source.risks).map((item) =>
            pickFirstString(item.title),
          ),
        ]).slice(0, 3);

  output.task_type =
    (pickFirstString(nested.task_type) as ResearchStructuredOutput['task_type']) ||
    'initial_thesis';
  output.market_scope = pickFirstString(nested.market_scope, source.market_scope) || 'multi-market';
  output.subject =
    pickFirstString(nested.subject, nested.entity, nested.company, source.title) || output.subject;
  output.current_view =
    pickFirstString(nested.current_view, nested.view, legacyStance.label, legacyStance.summary) ||
    output.current_view;
  output.direct_answer =
    pickFirstString(nested.direct_answer, nested.answer, legacyStance.summary) ||
    output.direct_answer;
  output.core_judgment =
    pickFirstString(nested.core_judgment, nested.updated_judgment, legacyStance.summary) ||
    output.direct_answer;
  output.bull_case = bullCase.filter(Boolean).slice(0, 4);
  output.bear_case = bearCase.filter(Boolean).slice(0, 4);
  output.key_variables = keyVariables.filter(Boolean).slice(0, 4);
  output.strongest_counterargument =
    pickFirstString(nested.strongest_counterargument, nested.counterargument) ||
    output.bear_case[0] ||
    '';
  output.mind_change_conditions =
    coerceArray<string>(nested.mind_change_conditions).length > 0
      ? coerceArray<string>(nested.mind_change_conditions).slice(0, 4)
      : coerceArray<Record<string, unknown>>(source.risks)
          .map((item) => pickFirstString(item.description, item.summary, item.title))
          .filter(Boolean)
          .slice(0, 4);
  output.one_line_takeaway =
    pickFirstString(nested.one_line_takeaway, nested.takeaway) ||
    output.core_judgment ||
    output.direct_answer;
  output.facts = coerceArray<string>(nested.facts).slice(0, 4);
  output.inference = coerceArray<string>(nested.inference).slice(0, 4);
  output.assumptions = coerceArray<string>(nested.assumptions).slice(0, 4);
  output.short_term_catalysts = coerceArray<string>(nested.short_term_catalysts).slice(0, 4);
  output.medium_term_drivers = coerceArray<string>(nested.medium_term_drivers).slice(0, 4);
  output.long_term_thesis = coerceArray<string>(nested.long_term_thesis).slice(0, 4);
  output.thesis_change_vs_price_action = pickFirstString(nested.thesis_change_vs_price_action);
  output.impact_on_current_thesis =
    (pickFirstString(
      nested.impact_on_current_thesis,
    ) as ResearchStructuredOutput['impact_on_current_thesis']) || 'not_applicable';
  output.thesis_update = pickFirstString(nested.thesis_update);
  output.top_things_to_watch = coerceArray<string>(nested.top_things_to_watch).slice(0, 4);
  output.watch_list = uniqueStrings([
    ...coerceArray<string>(nested.watch_list),
    ...output.key_variables.slice(0, 3),
    ...output.top_things_to_watch.slice(0, 3),
  ]).slice(0, 6);
  output.citations = normalizeCitationItems(
    Array.isArray(source.citations) && source.citations.length > 0
      ? source.citations
      : nested.citations,
  );
  output.compliance_flags = uniqueStrings(
    coerceArray<string>(source.compliance_flags).concat(
      coerceArray<string>(nested.compliance_flags),
    ),
  );
  output.degraded = Boolean(nested.degraded);

  if (!output.direct_answer) {
    output.direct_answer = output.core_judgment || output.one_line_takeaway;
  }

  if (!output.core_judgment) {
    output.core_judgment = output.direct_answer || output.one_line_takeaway;
  }

  if (!output.one_line_takeaway) {
    output.one_line_takeaway = output.core_judgment;
  }

  return output;
}

export function normalizeThesisCardContent(input: unknown): ThesisCardContent | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const source = input as Record<string, unknown>;
  const nested =
    source.thesis_card && typeof source.thesis_card === 'object'
      ? (source.thesis_card as Record<string, unknown>)
      : source;

  const subject = pickFirstString(nested.subject, source.title);
  const coreThesis = pickFirstString(
    nested.core_thesis,
    nested.core_judgment,
    source.summary,
  );

  if (!subject && !coreThesis) {
    return null;
  }

  return {
    subject: subject || '未命名主题',
    current_view: pickFirstString(nested.current_view) || '初步判断',
    core_thesis: coreThesis || '',
    bull_case: coerceArray<string>(nested.bull_case).slice(0, 4),
    bear_case: coerceArray<string>(nested.bear_case).slice(0, 4),
    top_key_variables: coerceArray<string>(nested.top_key_variables).slice(0, 3),
    strongest_counterargument: pickFirstString(nested.strongest_counterargument),
    mind_change_conditions: coerceArray<string>(nested.mind_change_conditions).slice(0, 4),
    watch_list: coerceArray<string>(nested.watch_list).slice(0, 6),
    last_updated:
      pickFirstString(nested.last_updated, source.updated_at, source.created_at) ||
      new Date().toISOString(),
  };
}

export function structuredOutputFromMessage(message: ConversationMessage) {
  return normalizeStructuredOutput(message.structured_answer || {});
}

export function structuredOutputFromBriefing(briefing: BriefingCard) {
  return normalizeStructuredOutput(briefing.structured_output || briefing);
}

export function thesisCardFromMessage(message: ConversationMessage) {
  return normalizeThesisCardContent(message.structured_answer || null);
}

export function thesisCardFromBriefing(briefing: BriefingCard) {
  return normalizeThesisCardContent(briefing.thesis_card || briefing.provider_snapshot || null);
}

export function thesisCardFromRecord(record: ThesisCardRecord | null | undefined) {
  return record?.content ? normalizeThesisCardContent(record.content) : null;
}

export function hasStructuredContent(output: ResearchStructuredOutput | null | undefined) {
  if (!output) {
    return false;
  }

  return Boolean(
    output.core_judgment ||
      output.direct_answer ||
      output.bull_case.length ||
      output.bear_case.length ||
      output.key_variables.length,
  );
}

export function getReadableConversationTitle(title?: string | null) {
  const normalized = pickFirstString(title);
  if (!normalized || looksBrokenContent(normalized)) {
    return '未命名会话';
  }

  return normalized;
}

export function getReadableMessageContent(content?: string | null) {
  if (!content || looksBrokenContent(content)) {
    return '';
  }

  return content;
}

export function preferredCardDate(card?: ThesisCardContent | null) {
  if (!card?.last_updated) {
    return '';
  }

  return new Date(card.last_updated).toLocaleString(
    containsChinese(card.last_updated) ? 'zh-CN' : undefined,
  );
}

export type { StructuredMessagePayload };
