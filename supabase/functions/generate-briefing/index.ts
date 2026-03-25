import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyAndExtractUser } from '../_shared/auth.ts';
import { orchestrateResearch } from '../_shared/researchOrchestrator.ts';
import {
  insertBriefingRecord,
  insertCitationRows,
  insertResearchRun,
  upsertThesisCard,
} from '../_shared/researchPersistence.ts';

type BriefingType = 'market-morning' | 'company-one-pager' | 'event-flash';

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function preferredLanguageFromBody(body: Record<string, unknown>) {
  const styleProfile =
    body.style_profile && typeof body.style_profile === 'object'
      ? (body.style_profile as Record<string, unknown>)
      : undefined;
  const candidates = [styleProfile?.language, styleProfile?.locale, body.language, body.output_language]
    .map((value) => String(value || '').toLowerCase())
    .filter(Boolean);
  return candidates.some((value) => value.includes('en')) ? 'en' : 'zh';
}

function briefingTypeLabel(briefingType: BriefingType, language: 'zh' | 'en') {
  const zhLabels: Record<BriefingType, string> = {
    'market-morning': '市场晨报',
    'company-one-pager': '公司一页纸',
    'event-flash': '事件快报',
  };
  const enLabels: Record<BriefingType, string> = {
    'market-morning': 'Market Morning',
    'company-one-pager': 'Company One-Pager',
    'event-flash': 'Event Flash',
  };
  return language === 'zh' ? zhLabels[briefingType] : enLabels[briefingType];
}

function inferBriefingQuery(
  briefingType: BriefingType,
  marketScope: string | undefined,
  watchEntities: string[],
  language: 'zh' | 'en',
) {
  const entityText =
    watchEntities.length > 0
      ? watchEntities.join(language === 'zh' ? '、' : ', ')
      : language === 'zh'
        ? '核心市场与关键主题'
        : 'major markets and key themes';

  if (language === 'en') {
    switch (briefingType) {
      case 'company-one-pager':
        return `Build a thesis-first company one-pager on ${entityText}. Focus on judgment, bull case, bear case, key variables, counterargument, and what would change the view.`;
      case 'event-flash':
        return `Update the thesis on ${entityText} with the latest event. Focus only on what changes the investment judgment.`;
      case 'market-morning':
      default:
        return `Build a thesis-first morning note for ${marketScope || 'multi-market'} with focus on ${entityText}.`;
    }
  }

  switch (briefingType) {
    case 'company-one-pager':
      return `请围绕 ${entityText} 生成一份 thesis-first 的公司一页纸，重点给出核心判断、bull case、bear case、关键变量、最强反方和改变观点的条件。`;
    case 'event-flash':
      return `请围绕 ${entityText} 生成一份事件更新快报，只聚焦哪些新信息改变了投资判断。`;
    case 'market-morning':
    default:
      return `请为 ${marketScope || 'multi-market'} 生成一份 thesis-first 市场晨报，重点关注 ${entityText}。`;
  }
}

function taskOverrideForBriefingType(briefingType: BriefingType) {
  return briefingType === 'event-flash' ? 'event_update' : 'initial_thesis';
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
    const body = (await req.json()) as Record<string, unknown>;
    const briefingType = String(body.briefing_type || 'market-morning') as BriefingType;
    const marketScope = String(body.market_scope || 'multi-market');
    const language = preferredLanguageFromBody(body);
    const watchEntities = Array.isArray(body.watch_entities)
      ? (body.watch_entities as unknown[]).map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    const entityContext =
      typeof body.entity_context === 'object' && body.entity_context
        ? (body.entity_context as Record<string, unknown>)
        : {};
    const query = inferBriefingQuery(briefingType, marketScope, watchEntities, language);

    const orchestrated = await orchestrateResearch(supabase, userId, {
      query,
      market_scope: marketScope,
      entity_context: {
        ...entityContext,
        entities: watchEntities,
      },
      output_mode: 'briefing',
      provider_profile: body.provider_profile as Record<string, unknown> | undefined,
      conversation_id: typeof body.conversation_id === 'string' ? body.conversation_id : undefined,
      task_override: taskOverrideForBriefingType(briefingType),
    });

    const researchRun = await insertResearchRun(supabase, {
      userId,
      conversationId: typeof body.conversation_id === 'string' ? body.conversation_id : null,
      query,
      marketScope,
      entityContext: {
        ...entityContext,
        entities: watchEntities,
      },
      outputMode: 'briefing',
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

    const title = `${orchestrated.result.structured_output.subject} · ${briefingTypeLabel(briefingType, language)}`;
    const summary =
      orchestrated.result.structured_output.one_line_takeaway ||
      orchestrated.result.structured_output.core_judgment;

    const briefing = await insertBriefingRecord(supabase, {
      userId,
      conversationId: typeof body.conversation_id === 'string' ? body.conversation_id : null,
      briefingType,
      marketScope,
      watchEntities,
      styleProfile:
        typeof body.style_profile === 'object' && body.style_profile
          ? (body.style_profile as Record<string, unknown>)
          : {},
      title,
      summary,
      content: orchestrated.result.answer,
      stance: orchestrated.result.stance,
      theses: orchestrated.result.theses,
      scenarios: orchestrated.result.scenarios,
      risks: orchestrated.result.risks,
      complianceFlags: orchestrated.result.compliance_flags,
      providerSnapshot: orchestrated.providerSnapshot,
      structuredOutput: orchestrated.result.structured_output,
      citations: orchestrated.citations,
    });
    const briefingId = String((briefing as Record<string, unknown>).id || '');

    await insertCitationRows(supabase, userId, orchestrated.citations, {
      researchRunId: String(researchRun.id),
      conversationId: typeof body.conversation_id === 'string' ? body.conversation_id : null,
      briefingId,
    });

    const thesisCardRecord = orchestrated.result.thesis_card
      ? await upsertThesisCard(supabase, {
          userId,
          card: orchestrated.result.thesis_card,
          query,
          marketScope,
          entityContext: {
            ...entityContext,
            entities: watchEntities,
          },
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
          conversationId: typeof body.conversation_id === 'string' ? body.conversation_id : null,
          researchRunId: String(researchRun.id),
          briefingId,
          cardKind: 'briefing',
        })
      : null;

    return jsonResponse({
      success: true,
      briefing,
      answer: orchestrated.result.answer,
      structured_output: orchestrated.result.structured_output,
      thesis_card: thesisCardRecord?.content || orchestrated.result.thesis_card,
      stance: orchestrated.result.stance,
      theses: orchestrated.result.theses,
      scenarios: orchestrated.result.scenarios,
      risks: orchestrated.result.risks,
      citations: orchestrated.citations,
      compliance_flags: orchestrated.result.compliance_flags,
    });
  } catch (error) {
    console.error('generate-briefing error:', error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
});
