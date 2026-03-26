import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Loader2, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';

import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import {
  deleteProviderConfiguration,
  getProviderConfigurations,
  saveProviderConfiguration,
} from '@/lib/research';
import { BRAND_SETTINGS_SUBTITLE } from '@/lib/brand';
import type { ProviderConfiguration } from '@/types/research';

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'openrouter', label: 'OpenRouter' },
];

const PROVIDER_TYPE_OPTIONS = [
  { value: 'direct', label: '官方直连' },
  { value: 'gateway', label: '网关 / 中转' },
  { value: 'openai-compatible', label: 'OpenAI-compatible' },
];

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function serializeExtraHeaders(provider: ProviderConfiguration) {
  if (typeof provider.extra_headers_json === 'string') {
    return provider.extra_headers_json;
  }

  return JSON.stringify(provider.extra_headers_json || {}, null, 2);
}

function buildHeaderDrafts(providerList: ProviderConfiguration[]) {
  return Object.fromEntries(
    providerList.map((provider) => [provider.id, serializeExtraHeaders(provider)]),
  );
}

function createEmptyProvider(): ProviderConfiguration {
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nickname: '',
    provider: 'openai',
    api_key: '',
    model: 'gpt-5.4',
    base_url: '',
    provider_type: 'direct',
    extra_headers_json: {},
    is_openai_compatible: false,
    description: '',
    enabled: true,
    is_default: false,
  };
}

export default function ResearchSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderConfiguration[]>([]);
  const [headerDrafts, setHeaderDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, isLoading, navigate]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const loadProviders = async () => {
      try {
        setLoading(true);
        const providerList = await getProviderConfigurations();
        const nextProviders = providerList.length > 0 ? providerList : [createEmptyProvider()];
        setProviders(nextProviders);
        setHeaderDrafts(buildHeaderDrafts(nextProviders));
      } catch (error: unknown) {
        toast({
          title: '加载 Provider 失败',
          description: getErrorMessage(error, '请检查 settings-proxy 是否已经部署。'),
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    void loadProviders();
  }, [isAuthenticated, toast]);

  const enabledProviders = useMemo(
    () => providers.filter((provider) => provider.enabled !== false).length,
    [providers],
  );

  const defaultProvider = useMemo(
    () => providers.find((provider) => provider.is_default) || null,
    [providers],
  );

  const updateProvider = (id: string, patch: Partial<ProviderConfiguration>) => {
    setProviders((current) =>
      current.map((provider) =>
        provider.id === id
          ? { ...provider, ...patch }
          : patch.is_default
            ? { ...provider, is_default: false }
            : provider,
      ),
    );
  };

  const handleAddProvider = () => {
    const draftProvider = createEmptyProvider();
    setProviders((current) => [...current, draftProvider]);
    setHeaderDrafts((current) => ({
      ...current,
      [draftProvider.id]: serializeExtraHeaders(draftProvider),
    }));
  };

  const handleDeleteProvider = async (provider: ProviderConfiguration) => {
    try {
      if (!provider.id.startsWith('draft-')) {
        await deleteProviderConfiguration(provider.id);
      }

      setProviders((current) => {
        const next = current.filter((item) => item.id !== provider.id);
        return next.length > 0 ? next : [createEmptyProvider()];
      });
      setHeaderDrafts((current) => {
        const next = { ...current };
        delete next[provider.id];
        return next;
      });
    } catch (error: unknown) {
      toast({
        title: '删除 Provider 失败',
        description: getErrorMessage(error, '请稍后再试。'),
        variant: 'destructive',
      });
    }
  };

  const handleSaveProvider = async (provider: ProviderConfiguration) => {
    try {
      setSavingId(provider.id);
      const headerDraft = headerDrafts[provider.id] ?? serializeExtraHeaders(provider);
      const parsedHeaders = headerDraft.trim() ? JSON.parse(headerDraft) : {};

      const savedProvider = await saveProviderConfiguration({
        ...(provider.id.startsWith('draft-') ? {} : { id: provider.id }),
        nickname: provider.nickname,
        provider: provider.provider,
        api_key: provider.api_key,
        model: provider.model || undefined,
        base_url: provider.base_url || undefined,
        provider_type: provider.provider_type || 'direct',
        extra_headers_json: parsedHeaders,
        is_openai_compatible: provider.is_openai_compatible,
        description: provider.description || undefined,
        enabled: provider.enabled,
        is_default: provider.is_default,
      });

      const refreshed = await getProviderConfigurations();
      const nextProviders = refreshed.length > 0 ? refreshed : [savedProvider];
      setProviders(nextProviders);
      setHeaderDrafts(buildHeaderDrafts(nextProviders));

      toast({
        title: 'Provider 已保存',
        description: `${savedProvider.nickname} 现在可用于对话和简报。`,
      });
    } catch (error: unknown) {
      toast({
        title: '保存 Provider 失败',
        description: getErrorMessage(error, '请检查 API Key、Base URL 和 Extra Headers JSON。'),
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-amber-600" />
          <p className="text-slate-600">正在加载 Provider 设置...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 py-6 sm:py-8">
        <div className="page-shell-narrow space-y-6">
          <section className="surface-card bg-premium-muted px-6 py-7 sm:px-8 sm:py-8">
            <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr] xl:items-end">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="premium">Provider control center</Badge>
                  <Badge variant="outline">OpenAI-compatible</Badge>
                  <Badge variant="secondary">research workspace</Badge>
                </div>
                <div className="space-y-3">
                  <p className="section-kicker">Model settings</p>
                  <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                    <KeyRound className="h-7 w-7" />
                    把模型、网关和请求头配置成稳定的研究链路
                  </h1>
                  <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-[15px]">
                    {BRAND_SETTINGS_SUBTITLE}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="panel-card-muted p-4 text-center">
                  <p className="metric-label">Providers</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{providers.length}</p>
                </div>
                <div className="panel-card-muted p-4 text-center">
                  <p className="metric-label">Enabled</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{enabledProviders}</p>
                </div>
                <div className="panel-card-muted p-4 text-center">
                  <p className="metric-label">Default</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">
                    {defaultProvider?.nickname || '未设置'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <Card className="panel-card bg-premium">
            <CardContent className="pt-6 text-sm leading-7 text-slate-700">
              推荐填写方式：
              <br />
              1. `provider` 一般先选 `openai`
              <br />
              2. 如需通过国内中转或自建代理，改成 `openai-compatible`
              <br />
              3. `base_url` 填网关基础地址，例如 `https://example.com/v1`
              <br />
              4. 如需额外请求头，再把 JSON 放入 `extra_headers_json`
            </CardContent>
          </Card>

          <div className="space-y-4">
            {providers.map((provider) => (
              <Card key={provider.id} className="panel-card">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle>{provider.nickname || '未命名 Provider'}</CardTitle>
                        {provider.is_default ? <Badge variant="premium">默认</Badge> : null}
                        {provider.enabled === false ? <Badge variant="secondary">已停用</Badge> : null}
                      </div>
                      <CardDescription>
                        一套 Provider 对应一条模型、API Key、可选网关和请求头配置。
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteProvider(provider)}>
                      <Trash2 className="h-4 w-4" />
                      删除
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Nickname</Label>
                      <Input
                        value={provider.nickname}
                        onChange={(event) => updateProvider(provider.id, { nickname: event.target.value })}
                        placeholder="例如：Main Gateway / OpenAI Direct"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Provider</Label>
                      <Select
                        value={provider.provider}
                        onValueChange={(value) => updateProvider(provider.id, { provider: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROVIDER_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Model</Label>
                      <Input
                        value={provider.model || ''}
                        onChange={(event) => updateProvider(provider.id, { model: event.target.value })}
                        placeholder="例如：gpt-5.4 / gpt-4o / deepseek-chat"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Provider Type</Label>
                      <Select
                        value={provider.provider_type || 'direct'}
                        onValueChange={(value) => updateProvider(provider.id, { provider_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROVIDER_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input
                      value={provider.api_key}
                      onChange={(event) => updateProvider(provider.id, { api_key: event.target.value })}
                      placeholder="sk-... 或网关 key"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Base URL</Label>
                    <Input
                      value={provider.base_url || ''}
                      onChange={(event) => updateProvider(provider.id, { base_url: event.target.value })}
                      placeholder="例如：https://example.com/v1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Extra Headers JSON</Label>
                    <Textarea
                      value={headerDrafts[provider.id] ?? serializeExtraHeaders(provider)}
                      onChange={(event) => {
                        const rawValue = event.target.value;
                        setHeaderDrafts((current) => ({
                          ...current,
                          [provider.id]: rawValue,
                        }));

                        try {
                          updateProvider(provider.id, {
                            extra_headers_json: rawValue ? JSON.parse(rawValue) : {},
                          });
                        } catch {
                          // Keep the last valid parsed value in provider state and let the raw draft stay editable.
                        }
                      }}
                      className="min-h-[128px] font-mono text-xs"
                      placeholder='{"X-App":"research-workspace"}'
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={provider.description || ''}
                      onChange={(event) => updateProvider(provider.id, { description: event.target.value })}
                      placeholder="可选备注，例如：主力模型 / 备用网关 / 海外节点"
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-[22px] border border-border/70 bg-slate-50/82 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">OpenAI-compatible</p>
                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            适配 OpenAI Chat Completions 的网关或中转。
                          </p>
                        </div>
                        <Switch
                          checked={provider.is_openai_compatible || false}
                          onCheckedChange={(checked) =>
                            updateProvider(provider.id, { is_openai_compatible: checked })
                          }
                        />
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-border/70 bg-slate-50/82 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">设为默认</p>
                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            工作台会优先选中默认 Provider。
                          </p>
                        </div>
                        <Switch
                          checked={provider.is_default || false}
                          onCheckedChange={(checked) => updateProvider(provider.id, { is_default: checked })}
                        />
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-border/70 bg-slate-50/82 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">启用</p>
                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            关闭后配置会保留，但不会在工作台中使用。
                          </p>
                        </div>
                        <Switch
                          checked={provider.enabled !== false}
                          onCheckedChange={(checked) => updateProvider(provider.id, { enabled: checked })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      建议保存前确认 JSON 可解析、Base URL 正确、默认配置唯一
                    </div>
                    <Button onClick={() => handleSaveProvider(provider)} disabled={savingId === provider.id}>
                      {savingId === provider.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          保存中
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          保存 Provider
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-between gap-3">
            <Button variant="outline" onClick={() => navigate('/workspace')}>
              返回工作台
            </Button>
            <Button variant="premium" onClick={handleAddProvider}>
              <Plus className="h-4 w-4" />
              新增 Provider
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
