import { MarketOverlayKey, PROMPT_COMPOSITION_ORDER, RESEARCH_PROMPT_ASSETS } from './researchPrompts/promptAssets.ts';
import {
  getStructuredOutputFieldGuide,
  type CitationItem,
  type ResearchConversationContinuity,
  type ResearchTaskType,
} from './researchSchemas.ts';
import type { ClassifiedResearchTask } from './researchTaskClassifier.ts';

function containsChinese(text: string) {
  return /[\u3400-\u9fff]/.test(text);
}

export function resolveResponseLanguage(query: string, marketScope?: string): 'zh' | 'en' {
  if (containsChinese(query)) {
    return 'zh';
  }

  if (/[a-z]/i.test(query)) {
    return 'en';
  }

  const normalized = String(marketScope || '').toLowerCase();
  if (normalized === 'cn' || normalized === 'hk') {
    return 'zh';
  }

  return 'en';
}

export function resolveMarketOverlayKey(marketScope?: string): MarketOverlayKey {
  const normalized = String(marketScope || '').toLowerCase();

  if (normalized === 'cn') {
    return 'cn_a';
  }

  if (normalized === 'hk') {
    return 'hk';
  }

  return 'us';
}

function resolveTaskPrompt(taskType: ResearchTaskType) {
  switch (taskType) {
    case 'follow_up':
      return RESEARCH_PROMPT_ASSETS.developer.follow_up;
    case 'event_update':
      return RESEARCH_PROMPT_ASSETS.developer.event_update;
    case 'thesis_card':
      return RESEARCH_PROMPT_ASSETS.developer.thesis_card;
    case 'out_of_scope':
      return RESEARCH_PROMPT_ASSETS.developer.follow_up;
    case 'initial_thesis':
    default:
      return RESEARCH_PROMPT_ASSETS.developer.initial_thesis;
  }
}

export function composeResearchSystemPrompt(params: {
  taskType: ResearchTaskType;
  marketScope?: string;
}) {
  const overlayKey = resolveMarketOverlayKey(params.marketScope);

  const layerMap = {
    compliance_guardrail: RESEARCH_PROMPT_ASSETS.system.compliance_guardrail,
    thesis_agent_base: RESEARCH_PROMPT_ASSETS.system.thesis_agent_base,
    market_overlay: RESEARCH_PROMPT_ASSETS.marketOverlays[overlayKey],
    task_prompt: resolveTaskPrompt(params.taskType),
    output_review: RESEARCH_PROMPT_ASSETS.system.output_review,
  } as const;

  return PROMPT_COMPOSITION_ORDER.map((key) => {
    const sectionKey = key === 'market_overlay' ? 'market_overlay' : key;
    return `### ${sectionKey}\n${layerMap[key]}`;
  }).join('\n\n');
}

function formatContinuity(continuity?: ResearchConversationContinuity) {
  if (!continuity?.has_prior_thesis || !continuity.latest_structured_output) {
    return 'No prior thesis is available.';
  }

  const latest = continuity.latest_structured_output;
  const lines = [
    `Latest subject: ${continuity.latest_subject}`,
    `Latest current view: ${continuity.latest_current_view}`,
    `Latest core judgment: ${continuity.latest_core_judgment}`,
    `Latest takeaway: ${continuity.latest_one_line_takeaway}`,
  ];

  if (latest.key_variables.length > 0) {
    lines.push(`Latest key variables: ${latest.key_variables.join(' | ')}`);
  }

  if (latest.mind_change_conditions.length > 0) {
    lines.push(`Mind-change conditions: ${latest.mind_change_conditions.join(' | ')}`);
  }

  if (continuity.recent_messages.length > 0) {
    lines.push('Recent messages:');
    lines.push(
      ...continuity.recent_messages
        .slice(-4)
        .map((message) => `- ${message.role}: ${String(message.content || '').slice(0, 220)}`),
    );
  }

  return lines.join('\n');
}

function formatMarketDataSnapshot(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== 'object') {
    return 'No market-data snapshot available.';
  }

  const entities = Array.isArray((snapshot as Record<string, unknown>).entities)
    ? ((snapshot as Record<string, unknown>).entities as Array<Record<string, unknown>>)
    : [];

  if (entities.length === 0) {
    return 'No market-data snapshot available.';
  }

  return entities
    .slice(0, 4)
    .map((entity) => {
      const name = String(entity.shortName || entity.longName || entity.symbol || 'Unknown');
      const price = entity.regularMarketPrice ?? 'N/A';
      const change = entity.changePercent ?? 'N/A';
      return `- ${name}: price=${price}, changePercent=${change}`;
    })
    .join('\n');
}

function formatSources(citations: CitationItem[]) {
  if (citations.length === 0) {
    return 'No retrieval sources available.';
  }

  return citations
    .slice(0, 6)
    .map((citation, index) => {
      const snippet = citation.snippet ? ` | ${citation.snippet.slice(0, 180)}` : '';
      return `[${index + 1}] ${citation.title} | ${citation.publisher}${snippet}`;
    })
    .join('\n');
}

export function buildResearchUserPrompt(params: {
  query: string;
  classifier: ClassifiedResearchTask;
  continuity?: ResearchConversationContinuity;
  marketDataSnapshot?: unknown;
  citations: CitationItem[];
  language: 'zh' | 'en';
}) {
  const languageInstruction =
    params.language === 'zh'
      ? 'Respond in Simplified Chinese, but keep JSON keys in English.'
      : 'Respond in English.';

  const directActionInstruction = params.classifier.direct_action_request
    ? 'The user is asking for direct trading action. You must convert the request into research framing and not give personalized trading instructions.'
    : 'No direct trading-action conversion is required beyond the standing guardrail.';

  const subjectLine =
    params.classifier.entity_hints.length > 0
      ? params.classifier.entity_hints
          .map((item) => `${item.display_name} (${item.symbol})`)
          .join(', ')
      : params.classifier.subject_hint;
  const fieldGuide = getStructuredOutputFieldGuide(params.classifier.task_type);

  return [
    `Task type: ${params.classifier.task_type}`,
    `Requested market scope: ${params.classifier.market_scope}`,
    `Detected subject: ${subjectLine}`,
    languageInstruction,
    directActionInstruction,
    '',
    'User question:',
    params.query,
    '',
    'Conversation continuity:',
    formatContinuity(params.continuity),
    '',
    'Market-data snapshot:',
    formatMarketDataSnapshot(params.marketDataSnapshot),
    '',
    'Retrieval sources:',
    formatSources(params.citations),
    '',
    'Return only valid JSON that matches this contract.',
    'Required keys:',
    ...fieldGuide.required.map((line) => `- ${line}`),
    'Optional keys:',
    ...fieldGuide.optional.map((line) => `- ${line}`),
  ].join('\n');
}
