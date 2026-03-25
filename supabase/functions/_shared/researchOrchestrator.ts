import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { callPerplefina } from './perplefinaClient.ts';
import {
  generateJson,
  providerSnapshot,
  resolveProviderProfile,
  toPerplefinaChatModel,
  type ProviderProfileRequest,
} from './providerProfiles.ts';
import {
  fetchMarketDataSnapshot,
  hasUsableMarketData,
  marketDataSnapshotToCitations,
} from './marketDataAdapter.ts';
import { filterRelevantSources } from './sourceRelevance.ts';
import {
  buildResearchUserPrompt,
  composeResearchSystemPrompt,
  resolveResponseLanguage,
} from './researchPromptRegistry.ts';
import {
  classifyResearchTask,
  type ClassifiedResearchTask,
} from './researchTaskClassifier.ts';
import { loadResearchConversationState } from './researchConversationState.ts';
import { buildFallbackStructuredOutput } from './researchFallbacks.ts';
import {
  buildOutOfScopeStructuredOutput,
  buildThesisCard,
  normalizeStructuredOutput,
  renderStructuredResearchMarkdown,
  renderThesisCardMarkdown,
  structuredOutputToLegacy,
  type CitationItem,
  type ResearchStructuredOutput,
  type ThesisCardContent,
} from './researchSchemas.ts';

interface ResearchLog {
  agent_name: string;
  message: string;
  message_type?: string;
  metadata?: Record<string, unknown>;
}

interface StructuredResearchResult {
  answer: string;
  structured_output: ResearchStructuredOutput;
  thesis_card: ThesisCardContent | null;
  stance: ReturnType<typeof structuredOutputToLegacy>['stance'];
  theses: ReturnType<typeof structuredOutputToLegacy>['theses'];
  scenarios: ReturnType<typeof structuredOutputToLegacy>['scenarios'];
  risks: ReturnType<typeof structuredOutputToLegacy>['risks'];
  compliance_flags: string[];
}

export interface OrchestratedResearchResult {
  result: StructuredResearchResult;
  citations: CitationItem[];
  logs: ResearchLog[];
  classifier: ClassifiedResearchTask & {
    continuity_loaded?: boolean;
    language?: 'zh' | 'en';
  };
  providerSnapshot: Record<string, unknown>;
  marketData: unknown;
}

function addLog(
  logs: ResearchLog[],
  agentName: string,
  message: string,
  metadata?: Record<string, unknown>,
) {
  logs.push({
    agent_name: agentName,
    message,
    message_type: 'analysis',
    metadata,
  });
}

function inferPublisher(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown-source';
  }
}

function inferSourceTier(url: string): 1 | 2 | 3 {
  const publisher = inferPublisher(url);

  if (
    publisher.includes('sec.gov') ||
    publisher.includes('hkex.com') ||
    publisher.includes('nasdaq.com') ||
    publisher.includes('nyse.com') ||
    publisher.includes('investor')
  ) {
    return 1;
  }

  if (
    publisher.includes('reuters.com') ||
    publisher.includes('bloomberg.com') ||
    publisher.includes('wsj.com') ||
    publisher.includes('ft.com') ||
    publisher.includes('cnbc.com')
  ) {
    return 2;
  }

  return 3;
}

function inferSourceType(url: string): CitationItem['source_type'] {
  const tier = inferSourceTier(url);

  if (tier === 1) {
    return 'filing';
  }

  if (tier === 2) {
    return 'media';
  }

  return 'community';
}

function normalizeRetrievalSources(sources: unknown[]): CitationItem[] {
  return (Array.isArray(sources) ? sources : [])
    .map((source, index) => {
      const entry = source as Record<string, unknown>;
      const metadata = (entry.metadata || {}) as Record<string, unknown>;
      const url = String(metadata.url || '').trim();

      if (!url) {
        return null;
      }

      return {
        title: String(metadata.title || `Source ${index + 1}`),
        url,
        publisher: inferPublisher(url),
        snippet: String(entry.pageContent || '').slice(0, 300),
        source_tier: inferSourceTier(url),
        source_type: inferSourceType(url),
        source_index: index + 1,
      } satisfies CitationItem;
    })
    .filter(Boolean) as CitationItem[];
}

function mergeCitations(primary: CitationItem[], secondary: CitationItem[], maxItems = 8) {
  const seen = new Set<string>();
  const merged: CitationItem[] = [];

  for (const citation of [...primary, ...secondary]) {
    const key = `${citation.url}::${citation.title}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push({
      ...citation,
      source_index: merged.length + 1,
    });

    if (merged.length >= maxItems) {
      break;
    }
  }

  return merged;
}

function buildStructuredResult(
  structuredOutput: ResearchStructuredOutput,
  language: 'zh' | 'en',
  answerOverride?: string,
): StructuredResearchResult {
  const legacy = structuredOutputToLegacy(structuredOutput);
  const thesisCard =
    structuredOutput.task_type === 'out_of_scope'
      ? null
      : buildThesisCard(structuredOutput);

  return {
    answer: answerOverride || renderStructuredResearchMarkdown(structuredOutput, language),
    structured_output: structuredOutput,
    thesis_card: thesisCard,
    stance: legacy.stance,
    theses: legacy.theses,
    scenarios: legacy.scenarios,
    risks: legacy.risks,
    compliance_flags: legacy.compliance_flags,
  };
}

function selectRetrievalFocus(
  taskType: ResearchStructuredOutput['task_type'],
  marketScope: string,
) {
  if (taskType === 'event_update') {
    return 'news' as const;
  }

  if (marketScope === 'multi-market') {
    return 'macroEconomy' as const;
  }

  return 'fundamentals' as const;
}

export async function orchestrateResearch(
  supabase: SupabaseClient,
  userId: string,
  request: {
    query: string;
    market_scope?: string;
    entity_context?: Record<string, unknown>;
    output_mode?: string;
    provider_profile?: ProviderProfileRequest;
    conversation_id?: string;
    task_override?: ResearchStructuredOutput['task_type'];
  },
): Promise<OrchestratedResearchResult> {
  const logs: ResearchLog[] = [];

  const continuity = await loadResearchConversationState(
    supabase,
    userId,
    request.conversation_id,
    request.market_scope,
  );
  addLog(logs, 'continuity', 'Loaded conversation continuity.', {
    has_prior_thesis: continuity.has_prior_thesis,
    latest_subject: continuity.latest_subject,
  });

  const classifier = classifyResearchTask({
    query: request.query,
    market_scope: request.market_scope,
    entity_context: request.entity_context,
    continuity,
    task_override: request.task_override,
  });
  addLog(
    logs,
    'classifier',
    'Classified research task.',
    classifier as unknown as Record<string, unknown>,
  );

  const language = resolveResponseLanguage(request.query, classifier.market_scope);

  if (classifier.out_of_scope) {
    const structuredOutput = buildOutOfScopeStructuredOutput(language);
    addLog(logs, 'guardrail', 'Blocked out-of-scope request.');

    return {
      result: buildStructuredResult(structuredOutput, language),
      citations: [],
      logs,
      classifier,
      providerSnapshot: {},
      marketData: null,
    };
  }

  if (classifier.task_type === 'thesis_card' && continuity.latest_structured_output) {
    const structuredOutput = normalizeStructuredOutput(continuity.latest_structured_output, {
      taskType: 'thesis_card',
      marketScope: classifier.market_scope,
      subject: continuity.latest_subject,
      language,
      citations: continuity.latest_structured_output.citations,
      complianceFlags: continuity.latest_structured_output.compliance_flags,
    });
    const thesisCard = buildThesisCard(structuredOutput);
    const answer = renderThesisCardMarkdown(thesisCard);
    addLog(logs, 'thesis-card', 'Built thesis card from continuity state.');

    return {
      result: {
        ...buildStructuredResult(structuredOutput, language, answer),
        thesis_card: thesisCard,
      },
      citations: structuredOutput.citations,
      logs,
      classifier,
      providerSnapshot: {},
      marketData: null,
    };
  }

  const profile = await resolveProviderProfile(supabase, userId, request.provider_profile);
  const snapshot = providerSnapshot(profile);
  addLog(logs, 'provider', 'Resolved provider profile.', snapshot);

  const explicitEntities = classifier.entity_hints.map((item) => ({
    name: item.display_name,
    symbol: item.symbol,
    aliases: item.search_terms,
  }));
  const contextEntities =
    request.entity_context &&
    Array.isArray((request.entity_context as Record<string, unknown>).entities)
      ? (request.entity_context.entities as Array<Record<string, unknown> | string>)
      : undefined;

  const marketDataResult = await fetchMarketDataSnapshot({
    marketScope: classifier.market_scope,
    entities: explicitEntities.length > 0 ? explicitEntities : contextEntities,
    query: request.query,
    preferredLanguage: language,
  });
  const marketDataSnapshot = marketDataResult.available ? marketDataResult.snapshot : null;
  addLog(logs, 'market-data', 'Fetched market-data snapshot.', {
    available: marketDataResult.available,
    source: marketDataResult.source,
  });

  let retrievalCitations: CitationItem[] = [];
  try {
    const retrievalResponse = await callPerplefina({
      focusMode: selectRetrievalFocus(classifier.task_type, classifier.market_scope),
      query: request.query,
      optimizationMode: 'balanced',
      maxSources: 8,
      maxTokens: 800,
      chatModel: toPerplefinaChatModel(profile),
      systemInstructions:
        'Retrieve high-signal finance sources and concise evidence relevant to the current investment question.',
      timeoutMs: 45000,
    });

    const rawCitations = normalizeRetrievalSources(retrievalResponse.sources || []);
    const filtered = filterRelevantSources(rawCitations, {
      query: request.query,
      classifier: {
        primary_entities: classifier.entity_hints.map((item) => item.display_name),
        query_type: classifier.task_type,
      },
      explicitEntities,
      maxItems: 6,
    });

    retrievalCitations = filtered.sources.map((citation, index) => ({
      ...citation,
      source_index: index + 1,
    }));

    addLog(logs, 'retrieval', 'Retrieved and filtered external sources.', {
      total_sources: rawCitations.length,
      kept_sources: retrievalCitations.length,
      applied_strict_filter: filtered.appliedStrictFilter,
    });
  } catch (error) {
    addLog(logs, 'retrieval', 'Retrieval degraded.', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const marketDataCitations =
    marketDataSnapshot && hasUsableMarketData(marketDataSnapshot)
      ? marketDataSnapshotToCitations(marketDataSnapshot).map((citation, index) => ({
          ...citation,
          source_type: 'market-data' as const,
          source_index: index + 1,
        }))
      : [];

  const citations = mergeCitations(retrievalCitations, marketDataCitations);
  const complianceFlags = classifier.direct_action_request
    ? ['personalized_advice_blocked']
    : [];

  const degraded = citations.length === 0;
  if (degraded) {
    complianceFlags.push('retrieval_degraded');
  }

  let structuredOutput: ResearchStructuredOutput;

  try {
    const systemPrompt = composeResearchSystemPrompt({
      taskType: classifier.task_type,
      marketScope: classifier.market_scope,
    });
    const userPrompt = buildResearchUserPrompt({
      query: request.query,
      classifier,
      continuity,
      marketDataSnapshot,
      citations,
      language,
    });

    const rawModelOutput = await generateJson<Record<string, unknown>>(profile, {
      systemPrompt,
      prompt: userPrompt,
      temperature: 0.2,
      maxTokens: 1800,
    });

    structuredOutput = normalizeStructuredOutput(rawModelOutput, {
      taskType: classifier.task_type,
      marketScope: classifier.market_scope,
      subject: classifier.subject_hint,
      language,
      citations,
      complianceFlags,
      degraded,
    });
    addLog(logs, 'synthesis', 'Generated structured thesis output.', {
      task_type: structuredOutput.task_type,
      subject: structuredOutput.subject,
    });
  } catch (error) {
    structuredOutput = buildFallbackStructuredOutput({
      query: request.query,
      subject: classifier.subject_hint,
      marketScope: classifier.market_scope,
      taskType: classifier.task_type,
      continuity,
      language,
      citations,
      complianceFlags: [...complianceFlags, 'model_fallback'],
    });
    addLog(logs, 'fallback', 'Used deterministic fallback thesis.', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const result = buildStructuredResult(structuredOutput, language);

  return {
    result,
    citations: structuredOutput.citations,
    logs,
    classifier: {
      ...classifier,
      continuity_loaded: continuity.has_prior_thesis,
      language,
    },
    providerSnapshot: snapshot,
    marketData: marketDataSnapshot,
  };
}
