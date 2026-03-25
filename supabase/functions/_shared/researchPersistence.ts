import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import type {
  CitationItem,
  ResearchLegacyRiskPoint,
  ResearchLegacyScenarioPoint,
  ResearchLegacyStance,
  ResearchLegacyThesisPoint,
  ResearchStructuredOutput,
  ThesisCardContent,
} from './researchSchemas.ts';

export async function insertCitationRows(
  supabase: SupabaseClient,
  userId: string,
  citations: CitationItem[],
  ids: {
    researchRunId?: string | null;
    conversationId?: string | null;
    briefingId?: string | null;
  },
) {
  if (citations.length === 0) {
    return;
  }

  const payload = citations.map((citation) => ({
    user_id: userId,
    research_run_id: ids.researchRunId || null,
    conversation_id: ids.conversationId || null,
    briefing_id: ids.briefingId || null,
    title: citation.title,
    url: citation.url,
    publisher: citation.publisher,
    snippet: citation.snippet,
    source_tier: citation.source_tier,
    source_type: citation.source_type,
    metadata: {
      source_index: citation.source_index,
    },
  }));

  await supabase.from('citations').insert(payload);
}

export async function insertResearchRun(
  supabase: SupabaseClient,
  params: {
    userId: string;
    conversationId?: string | null;
    briefingId?: string | null;
    analysisHistoryId?: string | null;
    query: string;
    marketScope: string;
    entityContext?: Record<string, unknown> | null;
    outputMode?: string;
    answer: string;
    stance: ResearchLegacyStance;
    theses: {
      bull: ResearchLegacyThesisPoint[];
      bear: ResearchLegacyThesisPoint[];
    };
    scenarios: ResearchLegacyScenarioPoint[];
    risks: ResearchLegacyRiskPoint[];
    complianceFlags: string[];
    providerSnapshot: Record<string, unknown>;
    sourceSummary: Record<string, unknown>;
    structuredOutput: ResearchStructuredOutput;
  },
) {
  const { data, error } = await supabase
    .from('research_runs')
    .insert({
      user_id: params.userId,
      conversation_id: params.conversationId || null,
      briefing_id: params.briefingId || null,
      analysis_history_id: params.analysisHistoryId || null,
      query: params.query,
      market_scope: params.marketScope,
      entity_context: params.entityContext || {},
      output_mode: params.outputMode || 'research-note',
      answer: params.answer,
      stance: params.stance,
      theses: params.theses,
      scenarios: params.scenarios,
      risks: params.risks,
      compliance_flags: params.complianceFlags,
      provider_snapshot: params.providerSnapshot,
      source_summary: {
        ...params.sourceSummary,
        task_type: params.structuredOutput.task_type,
        structured_output: params.structuredOutput,
      },
      status: 'completed',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to store research run: ${error.message}`);
  }

  return data as Record<string, unknown>;
}

export async function insertAssistantMessage(
  supabase: SupabaseClient,
  params: {
    conversationId: string;
    userId: string;
    content: string;
    structuredOutput: ResearchStructuredOutput;
    stance: ResearchLegacyStance;
    theses: {
      bull: ResearchLegacyThesisPoint[];
      bear: ResearchLegacyThesisPoint[];
    };
    scenarios: ResearchLegacyScenarioPoint[];
    risks: ResearchLegacyRiskPoint[];
    citations: CitationItem[];
    complianceFlags: string[];
    researchRunId: string;
    marketScope: string;
    entityContext?: Record<string, unknown> | null;
    thesisCard?: ThesisCardContent | null;
  },
) {
  const { data, error } = await supabase
    .from('conversation_messages')
    .insert({
      conversation_id: params.conversationId,
      user_id: params.userId,
      role: 'assistant',
      content: params.content,
      structured_answer: {
        structured_output: params.structuredOutput,
        stance: params.stance,
        theses: params.theses,
        scenarios: params.scenarios,
        risks: params.risks,
        citations: params.citations,
        compliance_flags: params.complianceFlags,
        thesis_card: params.thesisCard || null,
      },
      market_scope: params.marketScope,
      entity_context: params.entityContext || {},
      research_run_id: params.researchRunId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to store assistant message: ${error.message}`);
  }

  return data as Record<string, unknown>;
}

export async function insertBriefingRecord(
  supabase: SupabaseClient,
  params: {
    userId: string;
    conversationId?: string | null;
    briefingType: string;
    marketScope: string;
    watchEntities?: unknown;
    styleProfile?: Record<string, unknown> | null;
    title: string;
    summary: string;
    content: string;
    stance: ResearchLegacyStance;
    theses: {
      bull: ResearchLegacyThesisPoint[];
      bear: ResearchLegacyThesisPoint[];
    };
    scenarios: ResearchLegacyScenarioPoint[];
    risks: ResearchLegacyRiskPoint[];
    complianceFlags: string[];
    providerSnapshot: Record<string, unknown>;
    structuredOutput: ResearchStructuredOutput;
    citations: CitationItem[];
  },
) {
  const providerSnapshot = {
    ...params.providerSnapshot,
    structured_output: params.structuredOutput,
    citations: params.citations,
  };

  const { data, error } = await supabase
    .from('briefings')
    .insert({
      user_id: params.userId,
      conversation_id: params.conversationId || null,
      briefing_type: params.briefingType,
      market_scope: params.marketScope,
      watch_entities: params.watchEntities || [],
      style_profile: params.styleProfile || {},
      title: params.title,
      summary: params.summary,
      content: params.content,
      stance: params.stance,
      theses: params.theses,
      scenarios: params.scenarios,
      risks: params.risks,
      compliance_flags: params.complianceFlags,
      provider_snapshot: providerSnapshot,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to store briefing: ${error.message}`);
  }

  return {
    ...(data as Record<string, unknown>),
    citations: params.citations,
    structured_output: params.structuredOutput,
  };
}

export async function upsertThesisCard(
  supabase: SupabaseClient,
  params: {
    userId: string;
    card: ThesisCardContent;
    query: string;
    marketScope: string;
    entityContext?: Record<string, unknown> | null;
    stance: ResearchLegacyStance;
    theses: {
      bull: ResearchLegacyThesisPoint[];
      bear: ResearchLegacyThesisPoint[];
    };
    scenarios: ResearchLegacyScenarioPoint[];
    risks: ResearchLegacyRiskPoint[];
    citations: CitationItem[];
    complianceFlags: string[];
    providerSnapshot: Record<string, unknown>;
    sourceSummary: Record<string, unknown>;
    conversationId?: string | null;
    researchRunId?: string | null;
    briefingId?: string | null;
    sourceMessageId?: string | null;
    cardKind: 'chat' | 'briefing' | 'manual';
  },
) {
  const payload = {
    user_id: params.userId,
    research_run_id: params.researchRunId || null,
    conversation_id: params.conversationId || null,
    source_message_id: params.sourceMessageId || null,
    legacy_briefing_id: params.briefingId || null,
    card_kind: params.cardKind,
    title: params.card.subject,
    summary: params.card.core_thesis,
    query: params.query,
    market_scope: params.marketScope,
    entity_context: params.entityContext || {},
    content: params.card,
    stance: params.stance,
    theses: params.theses,
    scenarios: params.scenarios,
    risks: params.risks,
    citations: params.citations,
    compliance_flags: params.complianceFlags,
    provider_snapshot: params.providerSnapshot,
    source_summary: params.sourceSummary,
    status: 'active',
    pinned: false,
  };

  try {
    const queryBuilder = supabase.from('thesis_cards');

    if (params.conversationId) {
      const { data, error } = await queryBuilder
        .upsert(payload, {
          onConflict: 'conversation_id',
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data as Record<string, unknown>;
    }

    const { data, error } = await queryBuilder.insert(payload).select().single();
    if (error) {
      throw error;
    }

    return data as Record<string, unknown>;
  } catch {
    return null;
  }
}
