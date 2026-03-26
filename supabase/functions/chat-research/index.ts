import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyAndExtractUser } from '../_shared/auth.ts';
import { orchestrateResearch } from '../_shared/researchOrchestrator.ts';
import {
  insertAssistantMessage,
  insertCitationRows,
  insertResearchRun,
  upsertThesisCard,
} from '../_shared/researchPersistence.ts';

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

async function ensureConversation(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  conversationId?: string,
  marketScope?: string,
  entityContext?: Record<string, unknown>,
) {
  if (conversationId) {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (data) {
      return data;
    }
  }

  const title = query.length > 60 ? `${query.slice(0, 57)}...` : query;
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: userId,
      title,
      market_scope: marketScope || 'multi-market',
      entity_context: entityContext || {},
      status: 'active',
      last_message_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create conversation: ${error.message}`);
  }

  return data;
}

async function createAnalysisLog(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  marketScope?: string,
) {
  const ticker = query.match(/[A-Z]{1,5}(?:\.[A-Z]{2})?/)?.[0] || 'RESEARCH';
  const { data, error } = await supabase
    .from('analysis_history')
    .insert({
      user_id: userId,
      ticker,
      analysis_date: new Date().toISOString().slice(0, 10),
      decision: 'PENDING',
      confidence: 0,
      analysis_status: 'running',
      metadata: {
        research_only: true,
        market_scope: marketScope || 'multi-market',
        query,
      },
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create analysis log: ${error.message}`);
  }

  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const { userId, error: authError } = await verifyAndExtractUser(authHeader);

    if (authError || !userId) {
      return jsonResponse({ error: authError || 'Authentication failed' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ error: 'Server configuration missing' }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();

    if (!body?.query) {
      return jsonResponse({ error: 'query is required' }, 400);
    }

    const conversation = await ensureConversation(
      supabase,
      userId,
      body.query,
      body.conversation_id,
      body.market_scope,
      body.entity_context,
    );

    await supabase.from('conversation_messages').insert({
      conversation_id: conversation.id,
      user_id: userId,
      role: 'user',
      content: body.query,
      market_scope: body.market_scope || 'multi-market',
      entity_context: body.entity_context || {},
    });

    const analysisLog = await createAnalysisLog(
      supabase,
      userId,
      body.query,
      body.market_scope,
    );

    const orchestrated = await orchestrateResearch(supabase, userId, {
      query: body.query,
      market_scope: body.market_scope,
      entity_context: body.entity_context,
      output_mode: body.output_mode,
      provider_profile: body.provider_profile,
      conversation_id: conversation.id,
    });

    const researchRun = await insertResearchRun(supabase, {
      userId,
      conversationId: conversation.id,
      analysisHistoryId: analysisLog.id,
      query: body.query,
      marketScope: body.market_scope || orchestrated.result.structured_output.market_scope,
      entityContext: body.entity_context || {},
      outputMode: body.output_mode || 'research-note',
      answer: orchestrated.result.answer,
      stance: orchestrated.result.stance,
      theses: orchestrated.result.theses,
      scenarios: orchestrated.result.scenarios,
      risks: orchestrated.result.risks,
      complianceFlags: orchestrated.result.compliance_flags,
      providerSnapshot: orchestrated.providerSnapshot,
      sourceSummary: {
        classifier: orchestrated.classifier,
        market_data: orchestrated.marketData,
      },
      structuredOutput: orchestrated.result.structured_output,
    });

    await insertCitationRows(supabase, userId, orchestrated.citations, {
      researchRunId: String(researchRun.id),
      conversationId: conversation.id,
    });

    const assistantMessage = await insertAssistantMessage(supabase, {
      conversationId: conversation.id,
      userId,
      content: orchestrated.result.answer,
      structuredOutput: orchestrated.result.structured_output,
      stance: orchestrated.result.stance,
      theses: orchestrated.result.theses,
      scenarios: orchestrated.result.scenarios,
      risks: orchestrated.result.risks,
      citations: orchestrated.citations,
      complianceFlags: orchestrated.result.compliance_flags,
      researchRunId: String(researchRun.id),
      marketScope: body.market_scope || orchestrated.result.structured_output.market_scope,
      entityContext: body.entity_context || {},
      thesisCard: orchestrated.result.thesis_card,
    });

    const thesisCardRecord = orchestrated.result.thesis_card
      ? await upsertThesisCard(supabase, {
          userId,
          card: orchestrated.result.thesis_card,
          query: body.query,
          marketScope: body.market_scope || orchestrated.result.structured_output.market_scope,
          entityContext: body.entity_context || {},
          stance: orchestrated.result.stance,
          theses: orchestrated.result.theses,
          scenarios: orchestrated.result.scenarios,
          risks: orchestrated.result.risks,
          citations: orchestrated.citations,
          complianceFlags: orchestrated.result.compliance_flags,
          providerSnapshot: orchestrated.providerSnapshot,
          sourceSummary: {
            classifier: orchestrated.classifier,
            market_data: orchestrated.marketData,
          },
          conversationId: conversation.id,
          researchRunId: String(researchRun.id),
          sourceMessageId: String(assistantMessage.id),
          cardKind: 'chat',
        })
      : null;

    if (orchestrated.logs.length > 0) {
      await supabase.from('analysis_messages').insert(
        orchestrated.logs.map((log) => ({
          analysis_id: analysisLog.id,
          agent_name: log.agent_name,
          message: log.message,
          message_type: log.message_type || 'analysis',
          metadata: log.metadata || {},
        })),
      );
    }

    await supabase
      .from('analysis_history')
      .update({
        decision: 'PENDING',
        confidence: orchestrated.result.structured_output.degraded ? 45 : 70,
        analysis_status: 'completed',
        full_analysis: {
          answer: orchestrated.result.answer,
          structured_output: orchestrated.result.structured_output,
          stance: orchestrated.result.stance,
          theses: orchestrated.result.theses,
          scenarios: orchestrated.result.scenarios,
          risks: orchestrated.result.risks,
          citations: orchestrated.citations,
          research_only: true,
        },
        metadata: {
          research_only: true,
          market_scope: body.market_scope || orchestrated.result.structured_output.market_scope,
          query: body.query,
          result_mode: 'research_only',
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', analysisLog.id);

    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        entity_context: body.entity_context || {},
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation.id);

    return jsonResponse({
      success: true,
      conversation,
      message: assistantMessage,
      answer: orchestrated.result.answer,
      structured_output: orchestrated.result.structured_output,
      thesis_card: thesisCardRecord?.content || orchestrated.result.thesis_card,
      stance: orchestrated.result.stance,
      theses: orchestrated.result.theses,
      scenarios: orchestrated.result.scenarios,
      risks: orchestrated.result.risks,
      citations: orchestrated.citations,
      compliance_flags: orchestrated.result.compliance_flags,
      research_run_id: researchRun.id,
    });
  } catch (error) {
    console.error('chat-research error:', error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
});
