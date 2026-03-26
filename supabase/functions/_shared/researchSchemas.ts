export type ResearchTaskType =
  | 'initial_thesis'
  | 'follow_up'
  | 'event_update'
  | 'thesis_card'
  | 'out_of_scope';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export type ThesisImpact =
  | 'strengthens'
  | 'weakens'
  | 'unchanged'
  | 'new'
  | 'not_applicable';

export interface CitationItem {
  title: string;
  url: string;
  publisher: string;
  snippet: string;
  source_tier: 1 | 2 | 3;
  source_type: 'filing' | 'media' | 'community' | 'market-data' | 'other';
  source_index: number;
}

export interface ResearchLegacyStance {
  label: string;
  confidence: ConfidenceLevel;
  summary: string;
}

export interface ResearchLegacyThesisPoint {
  title: string;
  summary: string;
  evidence: string[];
}

export interface ResearchLegacyScenarioPoint {
  name: string;
  probability: ConfidenceLevel;
  description: string;
  signals: string[];
}

export interface ResearchLegacyRiskPoint {
  title: string;
  impact: ConfidenceLevel;
  description: string;
}

export interface ResearchStructuredOutput {
  task_type: ResearchTaskType;
  market_scope: string;
  subject: string;
  current_view: string;
  direct_answer: string;
  core_judgment: string;
  bull_case: string[];
  bear_case: string[];
  key_variables: string[];
  strongest_counterargument: string;
  mind_change_conditions: string[];
  one_line_takeaway: string;
  facts: string[];
  inference: string[];
  assumptions: string[];
  short_term_catalysts: string[];
  medium_term_drivers: string[];
  long_term_thesis: string[];
  thesis_change_vs_price_action: string;
  impact_on_current_thesis: ThesisImpact;
  thesis_update: string;
  top_things_to_watch: string[];
  watch_list: string[];
  citations: CitationItem[];
  compliance_flags: string[];
  degraded: boolean;
}

export interface ThesisCardContent {
  subject: string;
  current_view: string;
  core_thesis: string;
  bull_case: string[];
  bear_case: string[];
  top_key_variables: string[];
  strongest_counterargument: string;
  mind_change_conditions: string[];
  watch_list: string[];
  last_updated: string;
}

export interface ResearchConversationContinuity {
  has_prior_thesis: boolean;
  latest_subject: string;
  latest_current_view: string;
  latest_core_judgment: string;
  latest_one_line_takeaway: string;
  latest_structured_output: ResearchStructuredOutput | null;
  recent_messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at?: string;
  }>;
}

const FULL_STRUCTURED_FIELDS = [
  'subject',
  'current_view',
  'direct_answer',
  'core_judgment',
  'bull_case',
  'bear_case',
  'key_variables',
  'strongest_counterargument',
  'mind_change_conditions',
  'one_line_takeaway',
] as const;

const ALL_OPTIONAL_FIELDS = [
  'subject',
  'current_view',
  'direct_answer',
  'core_judgment',
  'bull_case',
  'bear_case',
  'key_variables',
  'strongest_counterargument',
  'mind_change_conditions',
  'one_line_takeaway',
  'facts',
  'inference',
  'assumptions',
  'short_term_catalysts',
  'medium_term_drivers',
  'long_term_thesis',
  'thesis_change_vs_price_action',
  'impact_on_current_thesis',
  'thesis_update',
  'top_things_to_watch',
  'watch_list',
] as const;

const TASK_REQUIRED_FIELDS: Record<ResearchTaskType, string[]> = {
  initial_thesis: [...FULL_STRUCTURED_FIELDS],
  follow_up: [
    'subject',
    'direct_answer',
    'core_judgment',
    'impact_on_current_thesis',
    'thesis_update',
    'one_line_takeaway',
  ],
  event_update: [
    'subject',
    'direct_answer',
    'core_judgment',
    'impact_on_current_thesis',
    'thesis_update',
    'top_things_to_watch',
    'one_line_takeaway',
  ],
  thesis_card: [...FULL_STRUCTURED_FIELDS, 'watch_list'],
  out_of_scope: ['subject', 'current_view', 'direct_answer', 'core_judgment', 'one_line_takeaway'],
};

const FIELD_DESCRIPTIONS: Record<string, string> = {
  subject: 'string',
  current_view: 'string',
  direct_answer: 'string',
  core_judgment: 'string',
  bull_case: 'string[] (max 4)',
  bear_case: 'string[] (max 4)',
  key_variables: 'string[] (max 4)',
  strongest_counterargument: 'string',
  mind_change_conditions: 'string[] (max 4)',
  one_line_takeaway: 'string',
  facts: 'string[] (max 4)',
  inference: 'string[] (max 4)',
  assumptions: 'string[] (max 4)',
  short_term_catalysts: 'string[] (max 4)',
  medium_term_drivers: 'string[] (max 4)',
  long_term_thesis: 'string[] (max 4)',
  thesis_change_vs_price_action: 'string',
  impact_on_current_thesis:
    'enum(strengthens | weakens | unchanged | new | not_applicable)',
  thesis_update: 'string',
  top_things_to_watch: 'string[] (max 4)',
  watch_list: 'string[] (max 6)',
};

function containsChinese(text: string) {
  return /[\u3400-\u9fff]/.test(text);
}

function sanitizeLineBreaks(value: string) {
  return value.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
}

export function sanitizeText(value: unknown, fallback = '') {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = sanitizeLineBreaks(value);
  const placeholderRatio =
    normalized.length > 0
      ? (normalized.match(/[\uFFFD]/g)?.length || 0) / normalized.length
      : 0;

  if (
    !normalized ||
    normalized.includes('undefined') ||
    normalized.includes('{item.') ||
    normalized.includes('?{') ||
    placeholderRatio >= 0.35
  ) {
    return fallback;
  }

  return normalized;
}

function pickFirstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = sanitizeText(value);
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === 'string') {
        return sanitizeText(item);
      }

      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        return pickFirstString(
          record.summary,
          record.description,
          record.detail,
          record.title,
          record.name,
          record.value,
        );
      }

      return '';
    })
    .filter(Boolean);
}

function firstNonEmptyArray(...values: unknown[]) {
  for (const value of values) {
    const items = coerceStringArray(value);
    if (items.length > 0) {
      return items;
    }
  }

  return [] as string[];
}

function dedupeStrings(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function inferPublisher(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown-source';
  }
}

function normalizeCitationItem(value: unknown, index: number): CitationItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const entry = value as Record<string, unknown>;
  const url = pickFirstString(entry.url);
  if (!url) {
    return null;
  }

  const tier = Number(entry.source_tier);
  const type = String(entry.source_type || '').toLowerCase();

  return {
    title: pickFirstString(entry.title) || `Source ${index + 1}`,
    url,
    publisher: pickFirstString(entry.publisher) || inferPublisher(url),
    snippet: pickFirstString(entry.snippet),
    source_tier: tier === 1 || tier === 2 || tier === 3 ? (tier as 1 | 2 | 3) : 2,
    source_type:
      type === 'filing' ||
      type === 'media' ||
      type === 'community' ||
      type === 'market-data' ||
      type === 'other'
        ? (type as CitationItem['source_type'])
        : 'other',
    source_index: Number(entry.source_index) || index + 1,
  };
}

function defaultViewLabel(language: 'zh' | 'en') {
  return language === 'zh' ? '初步判断' : 'Initial view';
}

function unnamedSubject(language: 'zh' | 'en') {
  return language === 'zh' ? '未命名主题' : 'Unnamed subject';
}

function outOfScopeAnswer(language: 'zh' | 'en') {
  return language === 'zh'
    ? '我可以帮你做股票、基金、上市公司、财报、行业和宏观相关的研究分析，但不能处理餐饮、数学题、翻译或其他非投研任务。你可以直接问我某家公司、某个行业、某份财报、某个估值争议或某条市场事件。'
    : 'I can help with equity, fund, company, earnings, industry, and macro research questions, but not with dining, math, translation, or other unrelated tasks.';
}

function normalizeImpact(value: unknown): ThesisImpact {
  const normalized = String(value || '').toLowerCase();

  if (
    normalized.includes('strength') ||
    normalized.includes('强化') ||
    normalized.includes('增强') ||
    normalized.includes('更强')
  ) {
    return 'strengthens';
  }

  if (
    normalized.includes('weak') ||
    normalized.includes('削弱') ||
    normalized.includes('减弱') ||
    normalized.includes('转弱')
  ) {
    return 'weakens';
  }

  if (
    normalized.includes('unchanged') ||
    normalized.includes('no change') ||
    normalized.includes('不变') ||
    normalized.includes('没有变化') ||
    normalized.includes('无变化')
  ) {
    return 'unchanged';
  }

  if (normalized.includes('new') || normalized.includes('新增') || normalized.includes('新的')) {
    return 'new';
  }

  return 'not_applicable';
}

function normalizeConfidence(value: unknown): ConfidenceLevel {
  const normalized = String(value || '').toLowerCase();

  if (normalized.includes('low') || normalized.includes('低')) {
    return 'low';
  }

  if (normalized.includes('high') || normalized.includes('高')) {
    return 'high';
  }

  return 'medium';
}

export function getStructuredOutputContract(taskType: ResearchTaskType) {
  const required = Array.from(new Set(TASK_REQUIRED_FIELDS[taskType]));
  const optional = ALL_OPTIONAL_FIELDS.filter((field) => !required.includes(field));

  return {
    required,
    optional,
  };
}

export function getStructuredOutputFieldGuide(taskType: ResearchTaskType) {
  const contract = getStructuredOutputContract(taskType);

  return {
    required: contract.required.map((field) => `${field}: ${FIELD_DESCRIPTIONS[field]}`),
    optional: contract.optional.map((field) => `${field}: ${FIELD_DESCRIPTIONS[field]}`),
  };
}

export function buildStructuredOutputJsonSchema(taskType: ResearchTaskType) {
  const contract = getStructuredOutputContract(taskType);

  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      subject: { type: 'string' },
      current_view: { type: 'string' },
      direct_answer: { type: 'string' },
      core_judgment: { type: 'string' },
      bull_case: { type: 'array', items: { type: 'string' }, maxItems: 4 },
      bear_case: { type: 'array', items: { type: 'string' }, maxItems: 4 },
      key_variables: { type: 'array', items: { type: 'string' }, maxItems: 4 },
      strongest_counterargument: { type: 'string' },
      mind_change_conditions: { type: 'array', items: { type: 'string' }, maxItems: 4 },
      one_line_takeaway: { type: 'string' },
      facts: { type: 'array', items: { type: 'string' }, maxItems: 4 },
      inference: { type: 'array', items: { type: 'string' }, maxItems: 4 },
      assumptions: { type: 'array', items: { type: 'string' }, maxItems: 4 },
      short_term_catalysts: { type: 'array', items: { type: 'string' }, maxItems: 4 },
      medium_term_drivers: { type: 'array', items: { type: 'string' }, maxItems: 4 },
      long_term_thesis: { type: 'array', items: { type: 'string' }, maxItems: 4 },
      thesis_change_vs_price_action: { type: 'string' },
      impact_on_current_thesis: {
        type: 'string',
        enum: ['strengthens', 'weakens', 'unchanged', 'new', 'not_applicable'],
      },
      thesis_update: { type: 'string' },
      top_things_to_watch: { type: 'array', items: { type: 'string' }, maxItems: 4 },
      watch_list: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    },
    required: contract.required,
  };
}

function isFilledString(value: unknown) {
  return Boolean(sanitizeText(value));
}

function isFilledStringArray(value: unknown) {
  return Array.isArray(value) && value.some((item) => Boolean(sanitizeText(item)));
}

export function validateStructuredOutputDraft(
  raw: unknown,
  taskType: ResearchTaskType,
) {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const { required } = getStructuredOutputContract(taskType);

  const missing = required.filter((field) => {
    if (
      field === 'bull_case' ||
      field === 'bear_case' ||
      field === 'key_variables' ||
      field === 'mind_change_conditions' ||
      field === 'top_things_to_watch'
    ) {
      return !isFilledStringArray(source[field]);
    }

    if (field === 'impact_on_current_thesis') {
      return !isFilledString(source[field]) || normalizeImpact(source[field]) === 'not_applicable';
    }

    return !isFilledString(source[field]);
  });

  return {
    ok: missing.length === 0,
    missing,
  };
}

export function createEmptyStructuredOutput(params: {
  taskType: ResearchTaskType;
  marketScope?: string;
  subject?: string;
  language?: 'zh' | 'en';
}): ResearchStructuredOutput {
  const language = params.language || 'en';

  return {
    task_type: params.taskType,
    market_scope: params.marketScope || 'multi-market',
    subject: sanitizeText(params.subject, unnamedSubject(language)),
    current_view: defaultViewLabel(language),
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
    impact_on_current_thesis: params.taskType === 'initial_thesis' ? 'new' : 'not_applicable',
    thesis_update: '',
    top_things_to_watch: [],
    watch_list: [],
    citations: [],
    compliance_flags: [],
    degraded: false,
  };
}

export function normalizeStructuredOutput(
  raw: unknown,
  params: {
    taskType: ResearchTaskType;
    marketScope?: string;
    subject?: string;
    language?: 'zh' | 'en';
    citations?: CitationItem[];
    complianceFlags?: string[];
    degraded?: boolean;
  },
): ResearchStructuredOutput {
  const language = params.language || 'en';
  const output = createEmptyStructuredOutput({
    taskType: params.taskType,
    marketScope: params.marketScope,
    subject: params.subject,
    language,
  });

  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const bullCase = firstNonEmptyArray(
    source.bull_case,
    source.bullCase,
    (source.theses as Record<string, unknown> | undefined)?.bull,
  );
  const bearCase = firstNonEmptyArray(
    source.bear_case,
    source.bearCase,
    (source.theses as Record<string, unknown> | undefined)?.bear,
  );
  const keyVariables = firstNonEmptyArray(
    source.key_variables,
    source.keyVariables,
    source.top_key_variables,
    source.watch_list,
  ).slice(0, 4);
  const topWatch = firstNonEmptyArray(
    source.top_things_to_watch,
    source.topThingsToWatch,
    source.watch_list,
  ).slice(0, 4);

  const mergedCitations = [
    ...(Array.isArray(params.citations) ? params.citations : []),
    ...(Array.isArray(source.citations)
      ? source.citations
          .map((item, index) => normalizeCitationItem(item, index))
          .filter(Boolean)
      : []),
  ].slice(0, 8) as CitationItem[];

  output.subject =
    pickFirstString(source.subject, source.entity, source.company, source.title) || output.subject;
  output.current_view =
    pickFirstString(source.current_view, source.view, source.stance, source.label) ||
    output.current_view;
  output.direct_answer = pickFirstString(source.direct_answer, source.answer, source.summary);
  output.core_judgment =
    pickFirstString(source.core_judgment, source.updated_judgment, source.updated_view) ||
    output.direct_answer;
  output.bull_case = bullCase.slice(0, 4);
  output.bear_case = bearCase.slice(0, 4);
  output.key_variables = keyVariables;
  output.strongest_counterargument =
    pickFirstString(source.strongest_counterargument, source.counterargument) ||
    output.bear_case[0] ||
    '';
  output.mind_change_conditions = firstNonEmptyArray(
    source.mind_change_conditions,
    source.what_would_change_my_mind,
  ).slice(0, 4);
  output.one_line_takeaway =
    pickFirstString(source.one_line_takeaway, source.takeaway) ||
    output.core_judgment ||
    output.direct_answer;
  output.facts = coerceStringArray(source.facts).slice(0, 4);
  output.inference = coerceStringArray(source.inference).slice(0, 4);
  output.assumptions = coerceStringArray(source.assumptions).slice(0, 4);
  output.short_term_catalysts = coerceStringArray(source.short_term_catalysts).slice(0, 4);
  output.medium_term_drivers = coerceStringArray(source.medium_term_drivers).slice(0, 4);
  output.long_term_thesis = coerceStringArray(source.long_term_thesis).slice(0, 4);
  output.thesis_change_vs_price_action = pickFirstString(
    source.thesis_change_vs_price_action,
    source.price_action_vs_thesis,
  );
  output.impact_on_current_thesis = normalizeImpact(
    source.impact_on_current_thesis || source.impact,
  );
  output.thesis_update = pickFirstString(
    source.thesis_update,
    source.updated_judgment,
    source.updated_view,
  );
  output.top_things_to_watch = topWatch;
  output.watch_list = dedupeStrings([
    ...coerceStringArray(source.watch_list),
    ...output.key_variables.slice(0, 3),
    ...output.top_things_to_watch.slice(0, 3),
  ]).slice(0, 6);
  output.citations = mergedCitations.map((item, index) => ({
    ...item,
    source_index: index + 1,
  }));
  output.compliance_flags = dedupeStrings([
    ...coerceStringArray(source.compliance_flags),
    ...(params.complianceFlags || []),
  ]);
  output.degraded = Boolean(source.degraded || params.degraded);

  if (!output.direct_answer) {
    output.direct_answer = output.core_judgment || output.one_line_takeaway;
  }

  if (!output.core_judgment) {
    output.core_judgment = output.direct_answer || output.one_line_takeaway;
  }

  if (!output.one_line_takeaway) {
    output.one_line_takeaway = output.core_judgment;
  }

  if (!output.mind_change_conditions.length && output.bear_case.length) {
    output.mind_change_conditions = output.bear_case.slice(0, 2);
  }

  if (!output.top_things_to_watch.length && output.key_variables.length) {
    output.top_things_to_watch = output.key_variables.slice(0, 3);
  }

  if (output.task_type === 'event_update' && output.impact_on_current_thesis === 'not_applicable') {
    output.impact_on_current_thesis = 'unchanged';
  }

  return output;
}

export function buildOutOfScopeStructuredOutput(language: 'zh' | 'en'): ResearchStructuredOutput {
  const output = createEmptyStructuredOutput({
    taskType: 'out_of_scope',
    marketScope: 'multi-market',
    subject: language === 'zh' ? '投研范围限制' : 'Scope restriction',
    language,
  });

  output.direct_answer = outOfScopeAnswer(language);
  output.core_judgment = output.direct_answer;
  output.one_line_takeaway = output.direct_answer;
  output.compliance_flags = ['out_of_scope_blocked'];

  return output;
}

export function buildThesisCard(
  output: ResearchStructuredOutput,
  updatedAtIso = new Date().toISOString(),
): ThesisCardContent {
  return {
    subject: output.subject,
    current_view: output.current_view,
    core_thesis: output.core_judgment,
    bull_case: output.bull_case.slice(0, 4),
    bear_case: output.bear_case.slice(0, 4),
    top_key_variables: output.key_variables.slice(0, 3),
    strongest_counterargument: output.strongest_counterargument,
    mind_change_conditions: output.mind_change_conditions.slice(0, 4),
    watch_list: output.watch_list.slice(0, 6),
    last_updated: updatedAtIso,
  };
}

export function renderThesisCardMarkdown(card: ThesisCardContent) {
  return [
    `[Subject] ${card.subject}`,
    `[Current View] ${card.current_view}`,
    `[Core Thesis] ${card.core_thesis}`,
    `[Bull Case] ${card.bull_case.join(' | ') || 'N/A'}`,
    `[Bear Case] ${card.bear_case.join(' | ') || 'N/A'}`,
    `[Top 3 Key Variables] ${card.top_key_variables.join(' | ') || 'N/A'}`,
    `[Strongest Counterargument] ${card.strongest_counterargument || 'N/A'}`,
    `[Mind-Change Conditions] ${card.mind_change_conditions.join(' | ') || 'N/A'}`,
    `[Watch List] ${card.watch_list.join(' | ') || 'N/A'}`,
    `[Last Updated] ${card.last_updated}`,
  ].join('\n');
}

export function renderStructuredResearchMarkdown(
  output: ResearchStructuredOutput,
  language: 'zh' | 'en',
) {
  if (output.task_type === 'out_of_scope') {
    return output.direct_answer;
  }

  const zh = language === 'zh';
  const lines: string[] = [];

  if (output.direct_answer) {
    lines.push(zh ? '## 直接回答' : '## Direct Answer');
    lines.push(output.direct_answer);
    lines.push('');
  }

  if (output.task_type !== 'thesis_card') {
    lines.push(zh ? '## 核心判断' : '## Core Judgment');
    lines.push(output.core_judgment || output.one_line_takeaway);
    lines.push('');
  }

  if (output.task_type !== 'initial_thesis') {
    lines.push(zh ? '## 对当前 Thesis 的影响' : '## Impact on Current Thesis');
    lines.push(output.impact_on_current_thesis);
    if (output.thesis_update) {
      lines.push('');
      lines.push(output.thesis_update);
    }
    lines.push('');
  }

  lines.push(zh ? '## 看多逻辑' : '## Bull Case');
  lines.push(...(output.bull_case.length ? output.bull_case.map((item) => `- ${item}`) : ['- N/A']));
  lines.push('');

  lines.push(zh ? '## 看空逻辑' : '## Bear Case');
  lines.push(...(output.bear_case.length ? output.bear_case.map((item) => `- ${item}`) : ['- N/A']));
  lines.push('');

  lines.push(zh ? '## 关键变量' : '## Key Variables');
  lines.push(
    ...(output.key_variables.length ? output.key_variables.map((item) => `- ${item}`) : ['- N/A']),
  );
  lines.push('');

  lines.push(zh ? '## 最强反方观点' : '## Strongest Counterargument');
  lines.push(output.strongest_counterargument || 'N/A');
  lines.push('');

  lines.push(zh ? '## 改变我观点的条件' : '## Mind-Change Conditions');
  lines.push(
    ...(output.mind_change_conditions.length
      ? output.mind_change_conditions.map((item) => `- ${item}`)
      : ['- N/A']),
  );

  if (output.top_things_to_watch.length) {
    lines.push('');
    lines.push(zh ? '## 接下来重点观察' : '## What To Watch Next');
    lines.push(...output.top_things_to_watch.map((item) => `- ${item}`));
  }

  if (output.facts.length || output.inference.length || output.assumptions.length) {
    lines.push('');
    lines.push(zh ? '## 事实 / 推断 / 假设' : '## Facts / Inference / Assumptions');

    if (output.facts.length) {
      lines.push(zh ? '### 事实' : '### Facts');
      lines.push(...output.facts.map((item) => `- ${item}`));
    }

    if (output.inference.length) {
      lines.push(zh ? '### 推断' : '### Inference');
      lines.push(...output.inference.map((item) => `- ${item}`));
    }

    if (output.assumptions.length) {
      lines.push(zh ? '### 假设' : '### Assumptions');
      lines.push(...output.assumptions.map((item) => `- ${item}`));
    }
  }

  lines.push('');
  lines.push(zh ? '## 一句话收口' : '## One-Line Takeaway');
  lines.push(output.one_line_takeaway || output.core_judgment);

  return lines.join('\n');
}

export function structuredOutputToLegacy(output: ResearchStructuredOutput) {
  const stance: ResearchLegacyStance = {
    label: output.current_view,
    confidence: normalizeConfidence(output.degraded ? 'low' : 'medium'),
    summary: output.core_judgment,
  };

  const theses = {
    bull: output.bull_case.slice(0, 4).map((item, index) => ({
      title: `Bull ${index + 1}`,
      summary: item,
      evidence: [],
    })),
    bear: output.bear_case.slice(0, 4).map((item, index) => ({
      title: `Bear ${index + 1}`,
      summary: item,
      evidence: [],
    })),
  };

  const scenarios: ResearchLegacyScenarioPoint[] = output.top_things_to_watch
    .slice(0, 3)
    .map((item, index) => ({
      name: `Watch ${index + 1}`,
      probability: 'medium',
      description: item,
      signals: [],
    }));

  const risks: ResearchLegacyRiskPoint[] =
    output.mind_change_conditions.length > 0
      ? output.mind_change_conditions.slice(0, 3).map((item, index) => ({
          title: `Risk ${index + 1}`,
          impact: 'high',
          description: item,
        }))
      : output.bear_case.slice(0, 3).map((item, index) => ({
          title: `Risk ${index + 1}`,
          impact: 'medium',
          description: item,
        }));

  return {
    answer: output.direct_answer || output.core_judgment,
    stance,
    theses,
    scenarios,
    risks,
    citations: output.citations,
    compliance_flags: output.compliance_flags,
  };
}

export function formatLocalizedDateTime(value: string, language: 'zh' | 'en') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(language === 'zh' || containsChinese(value) ? 'zh-CN' : 'en-US');
}
