/**
 * Real API validation by making actual test calls to providers.
 * Extended to support custom base URLs and OpenAI-compatible gateways.
 */

const TEST_PROMPT = 'Hello';
const TEST_SYSTEM_PROMPT = "You are a helpful assistant. Respond with just 'OK' to confirm the API is working.";

export interface ValidationOptions {
  baseUrl?: string;
  extraHeaders?: Record<string, string> | string | null;
  isOpenAICompatible?: boolean;
  providerType?: string;
}

export interface ValidationResult {
  valid: boolean;
  message: string;
  responseTime?: number;
  error?: string;
}

function normalizeBaseUrl(baseUrl?: string | null): string | undefined {
  if (!baseUrl) {
    return undefined;
  }

  return baseUrl.trim().replace(/\/+$/, '');
}

function parseExtraHeaders(value: Record<string, string> | string | null | undefined): Record<string, string> {
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

function isOpenAICompatible(provider: string, options?: ValidationOptions): boolean {
  return (
    Boolean(options?.isOpenAICompatible) ||
    options?.providerType === 'openai-compatible' ||
    options?.providerType === 'gateway' ||
    ['openai', 'openrouter', 'deepseek'].includes(provider)
  );
}

function getDefaultModel(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'gpt-4o-mini';
    case 'anthropic':
      return 'claude-3-5-sonnet-latest';
    case 'google':
      return 'gemini-2.0-flash';
    case 'deepseek':
      return 'deepseek-chat';
    case 'openrouter':
      return 'openai/gpt-4o-mini';
    default:
      return 'gpt-4o-mini';
  }
}

function validateApiKeyFormat(provider: string, apiKey: string, options?: ValidationOptions): ValidationResult {
  if (isOpenAICompatible(provider, options) && normalizeBaseUrl(options?.baseUrl)) {
    const validGatewayKey = apiKey.trim().length >= 8;
    return {
      valid: validGatewayKey,
      message: validGatewayKey ? 'Valid gateway API key format' : 'Gateway API key looks too short',
    };
  }

  switch (provider) {
    case 'openai':
      return {
        valid: apiKey.startsWith('sk-') && apiKey.length > 20,
        message: apiKey.startsWith('sk-') && apiKey.length > 20
          ? 'Valid OpenAI API key format'
          : 'Invalid OpenAI API key format (should start with sk-)',
      };
    case 'anthropic':
      return {
        valid: apiKey.startsWith('sk-ant-') && apiKey.length > 20,
        message: apiKey.startsWith('sk-ant-') && apiKey.length > 20
          ? 'Valid Anthropic API key format'
          : 'Invalid Anthropic API key format (should start with sk-ant-)',
      };
    case 'google':
      return {
        valid: apiKey.length >= 20,
        message: apiKey.length >= 20 ? 'Valid Google API key format' : 'Invalid Google API key format',
      };
    case 'deepseek':
      return {
        valid: apiKey.startsWith('sk-') && apiKey.length > 20,
        message: apiKey.startsWith('sk-') && apiKey.length > 20
          ? 'Valid DeepSeek API key format'
          : 'Invalid DeepSeek API key format',
      };
    case 'openrouter':
      return {
        valid: apiKey.startsWith('sk-or-') && apiKey.length > 20,
        message: apiKey.startsWith('sk-or-') && apiKey.length > 20
          ? 'Valid OpenRouter API key format'
          : 'Invalid OpenRouter API key format (should start with sk-or-)',
      };
    case 'alpaca_paper':
    case 'alpaca_live':
      return {
        valid: apiKey.length > 10 && /^[A-Za-z0-9]+$/.test(apiKey),
        message: apiKey.length > 10 && /^[A-Za-z0-9]+$/.test(apiKey)
          ? 'Valid Alpaca key format'
          : 'Invalid Alpaca key format',
      };
    default:
      return { valid: apiKey.length > 8, message: 'Unknown provider format fallback applied' };
  }
}

function getOpenAICompatibleEndpoint(provider: string, options?: ValidationOptions): string {
  const baseUrl = normalizeBaseUrl(options?.baseUrl);

  if (baseUrl) {
    if (baseUrl.endsWith('/chat/completions')) {
      return baseUrl;
    }
    if (baseUrl.endsWith('/v1') || baseUrl.endsWith('/api/v1')) {
      return `${baseUrl}/chat/completions`;
    }
    return `${baseUrl}/chat/completions`;
  }

  switch (provider) {
    case 'deepseek':
      return 'https://api.deepseek.com/v1/chat/completions';
    case 'openrouter':
      return 'https://openrouter.ai/api/v1/chat/completions';
    case 'openai':
    default:
      return 'https://api.openai.com/v1/chat/completions';
  }
}

async function testOpenAICompatible(
  provider: string,
  apiKey: string,
  model: string,
  options?: ValidationOptions
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...parseExtraHeaders(options?.extraHeaders),
    };

    if (provider === 'openrouter' && !options?.baseUrl) {
      headers['HTTP-Referer'] = 'https://tradinggoose-research-poc.local';
      headers['X-Title'] = 'TradingGoose Research PoC';
    }

    const response = await fetch(getOpenAICompatibleEndpoint(provider, options), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: TEST_SYSTEM_PROMPT },
          { role: 'user', content: TEST_PROMPT },
        ],
        temperature: 0,
        max_tokens: 10,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`${provider} API error: ${response.status} - ${await response.text()}`);
    }

    const result = await response.json();
    return (
      result?.choices?.[0]?.message?.content ||
      result?.choices?.[0]?.message?.reasoning ||
      result?.choices?.[0]?.text ||
      ''
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

async function testAnthropic(
  apiKey: string,
  model: string,
  options?: ValidationOptions
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const endpoint = normalizeBaseUrl(options?.baseUrl) || 'https://api.anthropic.com/v1/messages';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        ...parseExtraHeaders(options?.extraHeaders),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: TEST_PROMPT }],
        system: TEST_SYSTEM_PROMPT,
        max_tokens: 10,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} - ${await response.text()}`);
    }

    const result = await response.json();
    return result?.content?.[0]?.text || '';
  } finally {
    clearTimeout(timeoutId);
  }
}

async function testGoogle(
  apiKey: string,
  model: string,
  options?: ValidationOptions
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const endpointBase = normalizeBaseUrl(options?.baseUrl) || 'https://generativelanguage.googleapis.com/v1beta/models';
    const endpoint = `${endpointBase}/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...parseExtraHeaders(options?.extraHeaders),
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${TEST_SYSTEM_PROMPT}\n\n${TEST_PROMPT}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 10,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Google API error: ${response.status} - ${await response.text()}`);
    }

    const result = await response.json();
    return result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } finally {
    clearTimeout(timeoutId);
  }
}

async function testAlpaca(provider: string, apiKey: string, secretKey: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const baseUrl = provider === 'alpaca_paper'
      ? 'https://paper-api.alpaca.markets'
      : 'https://api.alpaca.markets';

    const response = await fetch(`${baseUrl}/v2/account`, {
      method: 'GET',
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': secretKey,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Alpaca API error: ${response.status} - ${await response.text()}`);
    }

    const result = await response.json();
    return `Account validated: ${result.id || 'Unknown'}`;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function validateApiKey(
  provider: string,
  apiKey: string,
  model?: string,
  secretKey?: string,
  options?: ValidationOptions
): Promise<ValidationResult> {
  const startTime = Date.now();

  try {
    const formatResult = validateApiKeyFormat(provider, apiKey, options);
    if (!formatResult.valid) {
      return formatResult;
    }

    const resolvedModel = model || getDefaultModel(provider);

    let response = '';
    if (provider === 'alpaca_paper' || provider === 'alpaca_live') {
      if (!secretKey) {
        return { valid: false, message: 'Alpaca validation requires both API key and secret key' };
      }
      response = await testAlpaca(provider, apiKey, secretKey);
    } else if (isOpenAICompatible(provider, options)) {
      response = await testOpenAICompatible(provider, apiKey, resolvedModel, options);
    } else if (provider === 'anthropic') {
      response = await testAnthropic(apiKey, resolvedModel, options);
    } else if (provider === 'google') {
      response = await testGoogle(apiKey, resolvedModel, options);
    } else {
      response = await testOpenAICompatible(provider, apiKey, resolvedModel, options);
    }

    const responseTime = Date.now() - startTime;
    if (response && response.trim().length > 0) {
      return {
        valid: true,
        message: `${provider} API key is valid and working`,
        responseTime,
      };
    }

    return {
      valid: false,
      message: `${provider} API returned empty response`,
      responseTime,
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error?.message || 'Unknown error';

    if (errorMessage.includes('401')) {
      return {
        valid: false,
        message: `Invalid ${provider} API key - authentication failed`,
        responseTime,
        error: errorMessage,
      };
    }

    if (errorMessage.includes('403')) {
      return {
        valid: false,
        message: `${provider} API key lacks required permissions`,
        responseTime,
        error: errorMessage,
      };
    }

    if (errorMessage.includes('429')) {
      return {
        valid: false,
        message: `${provider} API rate limit exceeded - key might be valid but currently throttled`,
        responseTime,
        error: errorMessage,
      };
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
      return {
        valid: false,
        message: `${provider} API request timed out - network or server issue`,
        responseTime,
        error: errorMessage,
      };
    }

    return {
      valid: false,
      message: `${provider} API validation failed: ${errorMessage}`,
      responseTime,
      error: errorMessage,
    };
  }
}
