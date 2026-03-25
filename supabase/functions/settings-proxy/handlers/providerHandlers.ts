import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { createSuccessResponse, createErrorResponse } from '../utils/responseHelpers.ts';
import { maskCredential, isMaskedValue } from '../utils/credentialHelpers.ts';
import { getUserProviderConfigurations } from '../utils/dbHelpers.ts';
import { validateApiKey } from '../../_shared/apiValidator.ts';

function parseExtraHeaders(value: any): Record<string, string> {
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

export async function handleGetProviderConfigurations(
  supabase: SupabaseClient,
  userId: string
): Promise<Response> {
  const { configurations, error } = await getUserProviderConfigurations(supabase, userId);

  if (error) {
    console.error('Error fetching provider configurations:', error);
    return createSuccessResponse({ configurations: [] });
  }

  const maskedConfigurations = configurations.map((config) => ({
    ...config,
    api_key: maskCredential(config.api_key),
  }));

  return createSuccessResponse({ configurations: maskedConfigurations });
}

export async function handleSaveProviderConfiguration(
  supabase: SupabaseClient,
  userId: string,
  body: any
): Promise<Response> {
  const { provider } = body;

  if (!provider) {
    return createErrorResponse('Provider configuration required');
  }

  let currentConfig = null;
  if (provider.id) {
    const { data } = await supabase
      .from('provider_configurations')
      .select('*')
      .eq('id', provider.id)
      .eq('user_id', userId)
      .single();
    currentConfig = data;
  }

  let finalApiKey = provider.api_key;
  let isNewApiKey = false;

  if (isMaskedValue(provider.api_key)) {
    if (currentConfig?.api_key) {
      const currentMasked = maskCredential(currentConfig.api_key);
      if (provider.api_key === currentMasked) {
        finalApiKey = currentConfig.api_key;
      } else {
        return createErrorResponse('Invalid masked API key provided. Please enter a new API key.');
      }
    } else {
      return createErrorResponse('Cannot use masked API key for a new configuration.');
    }
  } else if (provider.api_key) {
    isNewApiKey = true;
  } else if (!provider.api_key && currentConfig) {
    finalApiKey = currentConfig.api_key;
  } else {
    return createErrorResponse('API key is required');
  }

  const normalizedExtraHeaders = parseExtraHeaders(provider.extra_headers_json);
  const shouldSkipRemoteValidation =
    Boolean(provider.base_url) ||
    provider.provider_type === 'openai-compatible' ||
    provider.provider_type === 'gateway' ||
    Boolean(provider.is_openai_compatible);

  if (isNewApiKey && finalApiKey && !shouldSkipRemoteValidation) {
    try {
      const validation = await validateApiKey(
        provider.provider,
        finalApiKey,
        provider.model,
        undefined,
        {
          baseUrl: provider.base_url,
          extraHeaders: normalizedExtraHeaders,
          isOpenAICompatible: provider.is_openai_compatible,
          providerType: provider.provider_type,
        }
      );

      if (!validation.valid) {
        return createErrorResponse(`API key validation failed: ${validation.message}`);
      }
    } catch (error: any) {
      console.error('API validation error:', error);
      return createErrorResponse(`API key validation failed: ${error.message}`);
    }
  } else if (isNewApiKey && finalApiKey && shouldSkipRemoteValidation) {
    console.log(
      `Skipping remote API validation for gateway/openai-compatible provider: ${provider.provider}`
    );
  }

  if (provider.is_default) {
    await supabase
      .from('provider_configurations')
      .update({ is_default: false })
      .eq('user_id', userId);
  }

  const configData = {
    user_id: userId,
    nickname: provider.nickname,
    provider: provider.provider,
    api_key: finalApiKey,
    model: provider.model || null,
    base_url: provider.base_url || null,
    provider_type: provider.provider_type || 'direct',
    extra_headers_json: normalizedExtraHeaders,
    is_openai_compatible: Boolean(provider.is_openai_compatible),
    description: provider.description || null,
    enabled: provider.enabled !== false,
    is_default: Boolean(provider.is_default),
    updated_at: new Date().toISOString(),
  };

  let result;
  if (provider.id && currentConfig) {
    const { data, error } = await supabase
      .from('provider_configurations')
      .update(configData)
      .eq('id', provider.id)
      .eq('user_id', userId)
      .select()
      .single();
    result = { data, error };
  } else {
    const { data, error } = await supabase
      .from('provider_configurations')
      .insert(configData)
      .select()
      .single();
    result = { data, error };
  }

  if (result.error) {
    console.error('Error saving provider configuration:', result.error);
    return createErrorResponse(result.error.message);
  }

  const savedConfig = {
    ...result.data,
    api_key: maskCredential(result.data.api_key),
  };

  return createSuccessResponse({ success: true, configuration: savedConfig });
}
