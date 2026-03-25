import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  createEmptyStructuredOutput,
  normalizeStructuredOutput,
  sanitizeText,
  type ResearchConversationContinuity,
  type ResearchStructuredOutput,
} from './researchSchemas.ts';

function toRecentMessage(message: Record<string, unknown>) {
  const role = String(message.role || 'user');
  const normalizedRole =
    role === 'assistant' || role === 'system' ? role : 'user';

  return {
    role: normalizedRole as 'user' | 'assistant' | 'system',
    content: sanitizeText(message.content, ''),
    created_at: typeof message.created_at === 'string' ? message.created_at : undefined,
  };
}

export function extractStructuredOutputFromMessage(
  value: unknown,
  marketScope?: string,
): ResearchStructuredOutput | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const structured = value as Record<string, unknown>;
  const base =
    structured.structured_output && typeof structured.structured_output === 'object'
      ? (structured.structured_output as Record<string, unknown>)
      : structured;

  const normalized = normalizeStructuredOutput(base, {
    taskType:
      typeof base.task_type === 'string'
        ? (base.task_type as ResearchStructuredOutput['task_type'])
        : 'initial_thesis',
    marketScope,
    subject:
      typeof base.subject === 'string'
        ? base.subject
        : typeof (structured.stance as Record<string, unknown> | undefined)?.label === 'string'
          ? String((structured.stance as Record<string, unknown>).label)
          : undefined,
    language: 'zh',
    citations: Array.isArray(structured.citations) ? (structured.citations as unknown[]) : [],
    complianceFlags: Array.isArray(structured.compliance_flags)
      ? (structured.compliance_flags as string[])
      : [],
  });

  if (!normalized.core_judgment && !normalized.direct_answer) {
    return null;
  }

  return normalized;
}

function createEmptyContinuity(): ResearchConversationContinuity {
  return {
    has_prior_thesis: false,
    latest_subject: '',
    latest_current_view: '',
    latest_core_judgment: '',
    latest_one_line_takeaway: '',
    latest_structured_output: null,
    recent_messages: [],
  };
}

export function buildConversationContinuity(params: {
  messages?: Array<Record<string, unknown>>;
  thesisCardContent?: Record<string, unknown> | null;
  marketScope?: string;
}): ResearchConversationContinuity {
  const recentMessages = (params.messages || [])
    .map((message) => toRecentMessage(message))
    .filter((message) => message.content)
    .slice(-6);

  const latestAssistantWithStructure = [...(params.messages || [])]
    .reverse()
    .find((message) => message.role === 'assistant' && message.structured_answer);

  let latestStructuredOutput: ResearchStructuredOutput | null = null;

  if (params.thesisCardContent && typeof params.thesisCardContent === 'object') {
    const card = params.thesisCardContent as Record<string, unknown>;
    latestStructuredOutput = normalizeStructuredOutput(
      {
        task_type: 'initial_thesis',
        subject: card.subject,
        current_view: card.current_view,
        direct_answer: card.core_thesis,
        core_judgment: card.core_thesis,
        bull_case: card.bull_case,
        bear_case: card.bear_case,
        key_variables: card.top_key_variables,
        strongest_counterargument: card.strongest_counterargument,
        mind_change_conditions: card.mind_change_conditions,
        one_line_takeaway: card.core_thesis,
        watch_list: card.watch_list,
      },
      {
        taskType: 'initial_thesis',
        marketScope: params.marketScope,
        subject: typeof card.subject === 'string' ? card.subject : undefined,
        language: 'zh',
      },
    );
  }

  if (!latestStructuredOutput && latestAssistantWithStructure?.structured_answer) {
    latestStructuredOutput = extractStructuredOutputFromMessage(
      latestAssistantWithStructure.structured_answer,
      params.marketScope,
    );
  }

  if (!latestStructuredOutput) {
    return {
      ...createEmptyContinuity(),
      recent_messages: recentMessages,
    };
  }

  return {
    has_prior_thesis: true,
    latest_subject: latestStructuredOutput.subject,
    latest_current_view: latestStructuredOutput.current_view,
    latest_core_judgment: latestStructuredOutput.core_judgment,
    latest_one_line_takeaway: latestStructuredOutput.one_line_takeaway,
    latest_structured_output: latestStructuredOutput,
    recent_messages: recentMessages,
  };
}

export async function loadResearchConversationState(
  supabase: SupabaseClient,
  userId: string,
  conversationId?: string,
  marketScope?: string,
) {
  if (!conversationId) {
    return createEmptyContinuity();
  }

  const { data: messages, error: messageError } = await supabase
    .from('conversation_messages')
    .select('role, content, structured_answer, created_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(12);

  if (messageError) {
    throw new Error(`Failed to load conversation state: ${messageError.message}`);
  }

  let thesisCardContent: Record<string, unknown> | null = null;

  try {
    const { data: thesisCardRows } = await supabase
      .from('thesis_cards')
      .select('content')
      .eq('user_id', userId)
      .eq('conversation_id', conversationId)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (Array.isArray(thesisCardRows) && thesisCardRows[0]?.content) {
      thesisCardContent = thesisCardRows[0].content as Record<string, unknown>;
    }
  } catch {
    thesisCardContent = null;
  }

  return buildConversationContinuity({
    messages: (messages || []) as Array<Record<string, unknown>>,
    thesisCardContent,
    marketScope,
  });
}

export function fallbackConversationContinuity(subject?: string, marketScope?: string) {
  const fallback = createEmptyStructuredOutput({
    taskType: 'initial_thesis',
    marketScope,
    subject,
    language: 'zh',
  });

  return {
    has_prior_thesis: false,
    latest_subject: fallback.subject,
    latest_current_view: '',
    latest_core_judgment: '',
    latest_one_line_takeaway: '',
    latest_structured_output: null,
    recent_messages: [],
  } satisfies ResearchConversationContinuity;
}
