import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export interface ProviderProfileRequest {
  configuration_id?: string;
  nickname?: string;
  provider?: string;
  model?: string;
  api_key?: string;
  base_url?: string;
  provider_type?: string;
  extra_headers_json?: Record<string, string> | string | null;
  is_openai_compatible?: boolean;
}

export interface ResolvedProviderProfile {
  id?: string;
  nickname?: string;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  providerType: string;
  extraHeaders: Record<string, string>;
  isOpenAICompatible: boolean;
  isDefault?: boolean;
}

export interface GenerationOptions {
  systemPrompt?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  expectJson?: boolean;
}

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-latest',
  google: 'gemini-2.0-flash',
  deepseek: 'deepseek-chat',
  openrouter: 'openai/gpt-4o-mini',
};

function normalizeBaseUrl(baseUrl?: string | null): string | undefined {
  if (!baseUrl) {
    return undefined;
  }

  return baseUrl.trim().replace(/\/+$/, '');
}

function safeParseHeaders(
  value: Record<string, string> | string | null | undefined
): Record<string, string> {
  if (!value) {
    return {};
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, headerValue]) => [key, String(headerValue)])
    );
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.fromEntries(
          Object.entries(parsed).map(([key, headerValue]) => [key, String(headerValue)])
        );
      }
    } catch (_error) {
      return {};
    }
  }

  return {};
}

function toResolvedProfile(input: any): ResolvedProviderProfile {
  const provider = String(input.provider || 'openai').toLowerCase();

  return {
    id: input.id,
    nickname: input.nickname,
    provider,
    model: input.model || DEFAULT_MODELS[provider] || DEFAULT_MODELS.openai,
    apiKey: input.api_key || input.apiKey || '',
    baseUrl: normalizeBaseUrl(input.base_url || input.baseUrl),
    providerType: input.provider_type || input.providerType || 'direct',
    extraHeaders: safeParseHeaders(input.extra_headers_json || input.extraHeaders),
    isOpenAICompatible:
      Boolean(input.is_openai_compatible || input.isOpenAICompatible) ||
      input.provider_type === 'openai-compatible',
    isDefault: Boolean(input.is_default || input.isDefault),
  };
}

function getDefaultEndpoint(provider: string): string {
  switch (provider) {
    case 'anthropic':
      return 'https://api.anthropic.com/v1/messages';
    case 'google':
      return 'https://generativelanguage.googleapis.com/v1beta/models';
    case 'deepseek':
      return 'https://api.deepseek.com/v1';
    case 'openrouter':
      return 'https://openrouter.ai/api/v1';
    case 'openai':
    default:
      return 'https://api.openai.com/v1';
  }
}

function isOpenAICompatible(profile: ResolvedProviderProfile): boolean {
  return (
    profile.isOpenAICompatible ||
    profile.providerType === 'openai-compatible' ||
    profile.providerType === 'gateway' ||
    ['openai', 'openrouter', 'deepseek'].includes(profile.provider)
  );
}

function buildOpenAICompatibleUrl(profile: ResolvedProviderProfile): string {
  const base = normalizeBaseUrl(profile.baseUrl) || getDefaultEndpoint(profile.provider);

  if (base.endsWith('/chat/completions')) {
    return base;
  }

  if (base.endsWith('/v1') || base.endsWith('/api/v1')) {
    return `${base}/chat/completions`;
  }

  return `${base}/chat/completions`;
}

function buildHeaders(
  profile: ResolvedProviderProfile,
  extra: Record<string, string> = {}
): Record<string, string> {
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...profile.extraHeaders,
    ...extra,
  };

  if (profile.provider === 'anthropic' && !isOpenAICompatible(profile)) {
    return {
      ...baseHeaders,
      'x-api-key': profile.apiKey,
      'anthropic-version': '2023-06-01',
    };
  }

  if (profile.provider === 'openrouter' && !profile.baseUrl) {
    return {
      ...baseHeaders,
      Authorization: `Bearer ${profile.apiKey}`,
      'HTTP-Referer': 'https://tradinggoose-research-poc.local',
      'X-Title': 'TradingGoose Research PoC',
    };
  }

  return {
    ...baseHeaders,
    Authorization: `Bearer ${profile.apiKey}`,
  };
}

function extractTextFromOpenAICompatibleResponse(payload: any): string {
  if (!payload) {
    return '';
  }

  return (
    payload?.choices?.[0]?.message?.content ||
    payload?.choices?.[0]?.message?.reasoning ||
    payload?.choices?.[0]?.text ||
    payload?.output_text ||
    ''
  );
}

function extractJson(text: string): any {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error('Model returned empty content');
  }

  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch?.[1]) {
      return JSON.parse(fenceMatch[1].trim());
    }

    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    }

    throw new Error('Could not parse JSON from model output');
  }
}

async function callOpenAICompatible(
  profile: ResolvedProviderProfile,
  options: GenerationOptions
): Promise<string> {
  const payload: Record<string, unknown> = {
    model: profile.model,
    messages: [
      {
        role: 'system',
        content:
          options.systemPrompt ||
          'You are a disciplined financial research assistant that outputs evidence-based analysis.',
      },
      {
        role: 'user',
        content: options.prompt,
      },
    ],
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 1800,
  };

  if (options.expectJson) {
    payload.response_format = { type: 'json_object' };
  }

  const response = await fetch(buildOpenAICompatibleUrl(profile), {
    method: 'POST',
    headers: buildHeaders(profile),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Provider request failed (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  const content = extractTextFromOpenAICompatibleResponse(data);

  if (!content) {
    throw new Error('Provider returned an empty response');
  }

  return content;
}

async function callAnthropic(
  profile: ResolvedProviderProfile,
  options: GenerationOptions
): Promise<string> {
  const endpoint = profile.baseUrl || getDefaultEndpoint('anthropic');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: buildHeaders(profile),
    body: JSON.stringify({
      model: profile.model,
      system:
        options.systemPrompt ||
        'You are a disciplined financial research assistant that outputs evidence-based analysis.',
      messages: [{ role: 'user', content: options.prompt }],
      max_tokens: options.maxTokens ?? 1800,
      temperature: options.temperature ?? 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic request failed (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  return data?.content?.[0]?.text || '';
}

async function callGoogle(
  profile: ResolvedProviderProfile,
  options: GenerationOptions
): Promise<string> {
  const endpointBase = normalizeBaseUrl(profile.baseUrl) || getDefaultEndpoint('google');
  const endpoint = `${endpointBase}/${profile.model}:generateContent?key=${profile.apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...profile.extraHeaders,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `${
                options.systemPrompt ||
                'You are a disciplined financial research assistant that outputs evidence-based analysis.'
              }\n\n${options.prompt}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: options.temperature ?? 0.2,
        maxOutputTokens: options.maxTokens ?? 1800,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Google request failed (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('') || '';
}

export async function resolveProviderProfile(
  supabase: SupabaseClient,
  userId: string,
  requestProfile?: ProviderProfileRequest
): Promise<ResolvedProviderProfile> {
  if (requestProfile?.api_key) {
    return toResolvedProfile(requestProfile);
  }

  let query = supabase
    .from('provider_configurations')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (requestProfile?.configuration_id) {
    const { data, error } = await query.eq('id', requestProfile.configuration_id).limit(1).single();
    if (error || !data) {
      throw new Error('Requested provider configuration was not found');
    }
    return toResolvedProfile(data);
  }

  if (requestProfile?.nickname) {
    const { data, error } = await query.eq('nickname', requestProfile.nickname).limit(1).single();
    if (error || !data) {
      throw new Error('Requested provider nickname was not found');
    }
    return toResolvedProfile(data);
  }

  const { data: providers } = await query.limit(1);
  if (providers && providers.length > 0) {
    return toResolvedProfile(providers[0]);
  }

  const { data: apiSettings } = await supabase
    .from('api_settings')
    .select('ai_provider, ai_api_key, ai_model')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (apiSettings?.ai_api_key) {
    return toResolvedProfile({
      provider: apiSettings.ai_provider,
      api_key: apiSettings.ai_api_key,
      model: apiSettings.ai_model,
      provider_type: 'direct',
      is_openai_compatible: ['openai', 'openrouter', 'deepseek'].includes(apiSettings.ai_provider),
      nickname: 'Legacy Default Provider',
      is_default: true,
    });
  }

  throw new Error('No provider configuration found. Please save at least one model provider first.');
}

export function toPerplefinaChatModel(profile: ResolvedProviderProfile) {
  return {
    provider: isOpenAICompatible(profile) && !['openai', 'openrouter', 'deepseek'].includes(profile.provider)
      ? 'openai'
      : profile.provider,
    model: profile.model,
    apiKey: profile.apiKey,
    ...(profile.baseUrl ? { baseUrl: profile.baseUrl } : {}),
  };
}

export function providerSnapshot(profile: ResolvedProviderProfile) {
  return {
    id: profile.id,
    nickname: profile.nickname,
    provider: profile.provider,
    model: profile.model,
    base_url: profile.baseUrl,
    provider_type: profile.providerType,
    is_openai_compatible: profile.isOpenAICompatible,
    api_key_last4: profile.apiKey ? profile.apiKey.slice(-4) : null,
  };
}

export async function generateText(
  profile: ResolvedProviderProfile,
  options: GenerationOptions
): Promise<string> {
  if (!profile.apiKey) {
    throw new Error('Provider API key is missing');
  }

  if (isOpenAICompatible(profile)) {
    return callOpenAICompatible(profile, options);
  }

  switch (profile.provider) {
    case 'anthropic':
      return callAnthropic(profile, options);
    case 'google':
      return callGoogle(profile, options);
    default:
      return callOpenAICompatible(profile, options);
  }
}

export async function generateJson<T = any>(
  profile: ResolvedProviderProfile,
  options: GenerationOptions
): Promise<T> {
  const raw = await generateText(profile, {
    ...options,
    expectJson: true,
  });

  return extractJson(raw) as T;
}
