import { supabase } from '@/lib/supabase';
import type {
  BriefingCard,
  ChatResearchRequest,
  ChatResearchResponse,
  ConversationMessage,
  GenerateBriefingRequest,
  GenerateBriefingResponse,
  JsonObject,
  ProviderConfiguration,
  ResearchConversation,
  ThesisCardRecord,
} from '@/types/research';

type FunctionInvokeError = {
  name?: string;
  message?: string;
  context?: {
    text?: () => Promise<string>;
  };
};

function localizeFunctionErrorMessage(message: string) {
  const trimmed = String(message || '').trim();
  if (!trimmed) {
    return '请求失败，请稍后重试。';
  }

  const timeoutMatch = trimmed.match(/timed out after (\d+)ms/i);
  if (timeoutMatch) {
    const milliseconds = Number(timeoutMatch[1]);
    const seconds = Number.isFinite(milliseconds)
      ? (milliseconds / 1000).toFixed(milliseconds % 1000 === 0 ? 0 : 1)
      : '?';

    if (/perplefina/i.test(trimmed)) {
      return `实时检索超时（${seconds} 秒）。系统已尝试走降级链路，请稍后刷新结果。`;
    }

    return `请求超时（${seconds} 秒），请稍后重试。`;
  }

  return trimmed;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }

  return '';
}

async function unwrapFunctionError(
  error: unknown,
  fallbackMessage: string,
): Promise<Error> {
  if (!error) {
    return new Error(fallbackMessage);
  }

  const invokeError = error as FunctionInvokeError;
  if (invokeError.name === 'FunctionsFetchError') {
    return new Error('请求超时。系统可能仍在后台处理，请稍后刷新页面查看结果。');
  }

  const context = invokeError.context;
  if (context && typeof context.text === 'function') {
    try {
      const rawText = await context.text();
      if (rawText) {
        try {
          const parsed = JSON.parse(rawText) as { error?: string; message?: string };
          if (parsed.error) {
            return new Error(localizeFunctionErrorMessage(parsed.error));
          }
          if (parsed.message) {
            return new Error(localizeFunctionErrorMessage(parsed.message));
          }
        } catch {
          return new Error(localizeFunctionErrorMessage(rawText));
        }
      }
    } catch {
      return new Error(localizeFunctionErrorMessage(getErrorMessage(error) || fallbackMessage));
    }
  }

  return new Error(localizeFunctionErrorMessage(getErrorMessage(error) || fallbackMessage));
}

function hydrateBriefingCard(row: JsonObject): BriefingCard {
  const providerSnapshot =
    row.provider_snapshot && typeof row.provider_snapshot === 'object'
      ? (row.provider_snapshot as JsonObject)
      : {};

  return {
    ...(row as unknown as BriefingCard),
    citations: Array.isArray(row.citations)
      ? (row.citations as BriefingCard['citations'])
      : Array.isArray(providerSnapshot.citations)
        ? (providerSnapshot.citations as BriefingCard['citations'])
        : [],
    structured_output:
      (row.structured_output as BriefingCard['structured_output']) ||
      (providerSnapshot.structured_output as BriefingCard['structured_output']) ||
      null,
    thesis_card:
      (providerSnapshot.thesis_card as BriefingCard['thesis_card']) || null,
  };
}

function hydrateThesisCardRecord(row: JsonObject): ThesisCardRecord {
  return {
    ...(row as unknown as ThesisCardRecord),
    content:
      (row.content as ThesisCardRecord['content']) || {
        subject: typeof row.title === 'string' ? row.title : '未命名主题',
        current_view: '',
        core_thesis: typeof row.summary === 'string' ? row.summary : '',
        bull_case: [],
        bear_case: [],
        top_key_variables: [],
        strongest_counterargument: '',
        mind_change_conditions: [],
        watch_list: [],
        last_updated:
          (typeof row.updated_at === 'string' && row.updated_at) ||
          (typeof row.created_at === 'string' && row.created_at) ||
          new Date().toISOString(),
      },
  };
}

export async function getProviderConfigurations(): Promise<ProviderConfiguration[]> {
  const { data, error } = await supabase.functions.invoke('settings-proxy', {
    body: {
      action: 'get_provider_configurations',
    },
  });

  if (error) {
    throw await unwrapFunctionError(error, '加载 Provider 配置失败');
  }

  return data?.configurations || [];
}

export async function saveProviderConfiguration(
  provider: Partial<ProviderConfiguration> & {
    nickname: string;
    provider: string;
    api_key: string;
  },
) {
  const { data, error } = await supabase.functions.invoke('settings-proxy', {
    body: {
      action: 'save_provider_configuration',
      provider,
    },
  });

  if (error) {
    throw await unwrapFunctionError(error, '保存 Provider 配置失败');
  }

  if (!data?.success) {
    throw new Error(data?.error || '保存 Provider 配置失败');
  }

  return data.configuration as ProviderConfiguration;
}

export async function deleteProviderConfiguration(providerId: string) {
  const { error } = await supabase
    .from('provider_configurations')
    .delete()
    .eq('id', providerId);

  if (error) {
    throw error;
  }
}

export async function chatResearch(
  body: ChatResearchRequest,
): Promise<ChatResearchResponse> {
  const { data, error } = await supabase.functions.invoke('chat-research', {
    body,
  });

  if (error) {
    throw await unwrapFunctionError(error, '生成研究回答失败');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as ChatResearchResponse;
}

export async function generateBriefing(
  body: GenerateBriefingRequest,
): Promise<GenerateBriefingResponse> {
  const { data, error } = await supabase.functions.invoke('generate-briefing', {
    body,
  });

  if (error) {
    throw await unwrapFunctionError(error, '生成简报失败');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as GenerateBriefingResponse;
}

export async function getConversations(limit = 20): Promise<ResearchConversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .order('last_message_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data || []) as ResearchConversation[];
}

export async function getConversationMessages(
  conversationId: string,
): Promise<ConversationMessage[]> {
  const { data, error } = await supabase
    .from('conversation_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []) as ConversationMessage[];
}

export async function getBriefings(limit = 20): Promise<BriefingCard[]> {
  const { data, error } = await supabase
    .from('briefings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data || []).map((row) => hydrateBriefingCard(row as JsonObject));
}

export async function getThesisCards(limit = 20): Promise<ThesisCardRecord[]> {
  const { data, error } = await supabase
    .from('thesis_cards')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    return [];
  }

  return (data || []).map((row) => hydrateThesisCardRecord(row as JsonObject));
}
