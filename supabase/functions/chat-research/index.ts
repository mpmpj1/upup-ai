import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyAndExtractUser } from '../_shared/auth.ts';
import { orchestrateResearch } from '../_shared/researchOrchestrator.ts';

function jsonResponse(payload: Record<string, any>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

async function ensureConversation(
  supabase: any,
  userId: string,
  query: string,
  conversationId?: string,
  marketScope?: string,
  entityContext?: Record<string, any>
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
  supabase: any,
  userId: string,
  query: string,
  marketScope?: string
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
      body.entity_context
    );

    await supabase.from('conversation_messages').insert({
      conversation_id: conversation.id,
      user_id: userId,
      role: 'user',
      content: body.query,
      market_scope: body.market_scope || 'multi-market',
      entity_context: body.entity_context || {},
    });

    const analysisLog = await createAnalysisLog(supabase, userId, body.query, body.market_scope);

    const orchestrated = await orchestrateResearch(supabase, userId, {
      query: body.query,
      market_scope: body.market_scope,
      entity_context: body.entity_context,
      output_mode: body.output_mode,
      provider_profile: body.provider_profile,
    });

    const { data: researchRun, error: researchRunError } = await supabase
      .from('research_runs')
      .insert({
        user_id: userId,
        conversation_id: conversation.id,
        query: body.query,
        market_scope: body.market_scope || 'multi-market',
        entity_context: body.entity_context || {},
        output_mode: body.output_mode || 'research-note',
        answer: orchestrated.result.answer,
        stance: orchestrated.result.stance,
        theses: orchestrated.result.theses,
        scenarios: orchestrated.result.scenarios,
        risks: orchestrated.result.risks,
        compliance_flags: orchestrated.result.compliance_flags,
        provider_snapshot: orchestrated.providerSnapshot,
        source_summary: {
          classifier: orchestrated.classifier,
          market_data: orchestrated.marketData,
        },
        analysis_history_id: analysisLog.id,
        status: 'completed',
      })
      .select()
      .single();

    if (researchRunError) {
      throw new Error(`Failed to store research run: ${researchRunError.message}`);
    }

    if (orchestrated.citations.length > 0) {
      await supabase.from('citations').insert(
        orchestrated.citations.map((citation) => ({
          user_id: userId,
          conversation_id: conversation.id,
          research_run_id: researchRun.id,
          title: citation.title,
          url: citation.url,
          publisher: citation.publisher,
          snippet: citation.snippet,
          source_tier: citation.source_tier,
          source_type: citation.source_type,
          metadata: {
            source_index: citation.source_index,
          },
        }))
      );
    }

    const { data: assistantMessage, error: assistantMessageError } = await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: conversation.id,
        user_id: userId,
        role: 'assistant',
        content: orchestrated.result.answer,
        structured_answer: {
          stance: orchestrated.result.stance,
          theses: orchestrated.result.theses,
          scenarios: orchestrated.result.scenarios,
          risks: orchestrated.result.risks,
          citations: orchestrated.citations,
          compliance_flags: orchestrated.result.compliance_flags,
        },
        market_scope: body.market_scope || 'multi-market',
        entity_context: body.entity_context || {},
        research_run_id: researchRun.id,
      })
      .select()
      .single();

    if (assistantMessageError) {
      throw new Error(`Failed to store assistant message: ${assistantMessageError.message}`);
    }

    if (orchestrated.logs.length > 0) {
      await supabase.from('analysis_messages').insert(
        orchestrated.logs.map((log) => ({
          analysis_id: analysisLog.id,
          agent_name: log.agent_name,
          message: log.message,
          message_type: log.message_type || 'analysis',
          metadata: log.metadata || {},
        }))
      );
    }

    await supabase
      .from('analysis_history')
      .update({
        decision:
          orchestrated.result.stance.label.toLowerCase().includes('bear') ? 'SELL' :
          orchestrated.result.stance.label.toLowerCase().includes('bull') ? 'BUY' :
          'HOLD',
        confidence:
          orchestrated.result.stance.confidence === 'high' ? 78 :
          orchestrated.result.stance.confidence === 'low' ? 42 :
          60,
        analysis_status: 'completed',
        full_analysis: {
          answer: orchestrated.result.answer,
          stance: orchestrated.result.stance,
          theses: orchestrated.result.theses,
          scenarios: orchestrated.result.scenarios,
          risks: orchestrated.result.risks,
          citations: orchestrated.citations,
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
      stance: orchestrated.result.stance,
      theses: orchestrated.result.theses,
      scenarios: orchestrated.result.scenarios,
      risks: orchestrated.result.risks,
      citations: orchestrated.citations,
      compliance_flags: orchestrated.result.compliance_flags,
      research_run_id: researchRun.id,
    });
  } catch (error: any) {
    console.error('chat-research error:', error);
    return jsonResponse(
      {
        error: error?.message || 'Unknown error',
      },
      500
    );
  }
});
