import { supabase } from '@/lib/supabase';
import type {
  BriefingCard,
  ChatResearchResponse,
  ConversationMessage,
  GenerateBriefingResponse,
  ProviderConfiguration,
  ResearchConversation,
} from '@/types/research';

function localizeFunctionErrorMessage(message: string) {
  const trimmed = String(message || '').trim();
  if (!trimmed) {
    return trimmed;
  }

  const timeoutMatch = trimmed.match(/timed out after (\d+)ms/i);
  if (timeoutMatch) {
    const milliseconds = Number(timeoutMatch[1]);
    const seconds = Number.isFinite(milliseconds)
      ? (milliseconds / 1000).toFixed(milliseconds % 1000 === 0 ? 0 : 1)
      : null;

    if (/perplefina/i.test(trimmed)) {
      return `实时检索服务超时（${seconds || '?'} 秒）。系统可能正在走降级链路，请稍后刷新查看结果。`;
    }

    if (/briefing-synthesis/i.test(trimmed)) {
      return `简报综合阶段超时（${seconds || '?'} 秒）。系统已尽量保留可用结果，请稍后刷新查看。`;
    }

    return `请求超时（${seconds || '?'} 秒），请稍后重试。`;
  }

  return trimmed;
}

async function unwrapFunctionError(error: any, fallbackMessage: string): Promise<Error> {
  if (!error) {
    return new Error(fallbackMessage);
  }

  if (error.name === 'FunctionsFetchError') {
    return new Error('请求等待超时。系统可能仍在后台生成，请稍后刷新会话列表查看结果。');
  }

  const context = error.context;
  if (context && typeof context.text === 'function') {
    try {
      const rawText = await context.text();
      if (rawText) {
        try {
          const parsed = JSON.parse(rawText);
          if (parsed?.error) {
            return new Error(localizeFunctionErrorMessage(parsed.error));
          }
          if (parsed?.message) {
            return new Error(localizeFunctionErrorMessage(parsed.message));
          }
        } catch {
          return new Error(localizeFunctionErrorMessage(rawText));
        }
      }
    } catch {
      // Ignore parsing errors and fall through.
    }
  }

  return new Error(localizeFunctionErrorMessage(error?.message || fallbackMessage));
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
  }
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

export async function chatResearch(body: Record<string, any>): Promise<ChatResearchResponse> {
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
  body: Record<string, any>
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
  conversationId: string
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

  return (data || []) as BriefingCard[];
}
