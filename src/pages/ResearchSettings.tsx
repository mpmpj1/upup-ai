import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Loader2, Plus, Save, Trash2 } from 'lucide-react';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
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

function createEmptyProvider(): ProviderConfiguration {
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nickname: '',
    provider: 'openai',
    api_key: '',
    model: 'gpt-4o-mini',
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
        setProviders(providerList.length > 0 ? providerList : [createEmptyProvider()]);
      } catch (error: any) {
        toast({
          title: '加载 Provider 失败',
          description: error?.message || '请检查 settings-proxy 是否已经部署。',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadProviders();
  }, [isAuthenticated, toast]);

  const updateProvider = (id: string, patch: Partial<ProviderConfiguration>) => {
    setProviders((current) =>
      current.map((provider) =>
        provider.id === id
          ? { ...provider, ...patch }
          : patch.is_default
            ? { ...provider, is_default: false }
            : provider
      )
    );
  };

  const handleAddProvider = () => {
    setProviders((current) => [...current, createEmptyProvider()]);
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
    } catch (error: any) {
      toast({
        title: '删除 Provider 失败',
        description: error?.message || '请稍后再试。',
        variant: 'destructive',
      });
    }
  };

  const handleSaveProvider = async (provider: ProviderConfiguration) => {
    try {
      setSavingId(provider.id);
      const savedProvider = await saveProviderConfiguration({
        ...(provider.id.startsWith('draft-') ? {} : { id: provider.id }),
        nickname: provider.nickname,
        provider: provider.provider,
        api_key: provider.api_key,
        model: provider.model || undefined,
        base_url: provider.base_url || undefined,
        provider_type: provider.provider_type || 'direct',
        extra_headers_json: provider.extra_headers_json || {},
        is_openai_compatible: provider.is_openai_compatible,
        description: provider.description || undefined,
        enabled: provider.enabled,
        is_default: provider.is_default,
      });

      const refreshed = await getProviderConfigurations();
      setProviders(refreshed.length > 0 ? refreshed : [savedProvider]);
      toast({
        title: 'Provider 已保存',
        description: `${savedProvider.nickname} 现在可用于对话和简报。`,
      });
    } catch (error: any) {
      toast({
        title: '保存 Provider 失败',
        description: error?.message || '请检查 API Key、Base URL 和 Extra Headers JSON。',
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
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.14),_transparent_28%),linear-gradient(180deg,#f8fafc_0%,#fffef9_36%,#f8fafc_100%)]">
      <Header />

      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="space-y-2">
            <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-950">
              <KeyRound className="h-7 w-7" />
              Provider 设置
            </h1>
            <p className="text-slate-600">
              这里是 PoC 的核心配置页。重点支持
              `provider + model + api_key + base_url + extra_headers_json`，
              可以接官方 API，也可以接 OpenAI-compatible 网关。
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">支持国内中转 / 网关</Badge>
              <Badge variant="secondary">适合 gmncode 这类 OpenAI-compatible 接入</Badge>
            </div>
          </div>

          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6 text-sm leading-7 text-slate-700">
              推荐填写方式：
              <br />
              1. `provider` 一般先选 `openai`
              <br />
              2. 如果你走国内中转或自建代理，把 `provider_type` 改成 `openai-compatible`
              <br />
              3. `base_url` 填你的网关基础地址，例如 `https://gmncode.cn/v1`
              <br />
              4. 如果供应商要求额外 header，再把 JSON 填到 `extra_headers_json`
            </CardContent>
          </Card>

          <div className="space-y-4">
            {providers.map((provider) => (
              <Card key={provider.id} className="border-slate-200 bg-white shadow-sm">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-slate-950">
                        {provider.nickname || '未命名 Provider'}
                      </CardTitle>
                      <CardDescription>
                        一条 Provider 对应一套模型、API Key 和可选的网关配置。
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {provider.is_default && <Badge>默认</Badge>}
                      {provider.enabled === false && <Badge variant="secondary">已停用</Badge>}
                      <Button variant="outline" size="sm" onClick={() => handleDeleteProvider(provider)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        删除
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="grid gap-4 md:grid-cols-2">
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
                      placeholder="例如：gpt-5.4 / gpt-4o-mini / deepseek-chat"
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

                  <div className="space-y-2 md:col-span-2">
                    <Label>API Key</Label>
                    <Input
                      value={provider.api_key}
                      onChange={(event) => updateProvider(provider.id, { api_key: event.target.value })}
                      placeholder="sk-... 或你的中转网关 key"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Base URL</Label>
                    <Input
                      value={provider.base_url || ''}
                      onChange={(event) => updateProvider(provider.id, { base_url: event.target.value })}
                      placeholder="例如：https://gmncode.cn/v1"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Extra Headers JSON</Label>
                    <Textarea
                      value={
                        typeof provider.extra_headers_json === 'string'
                          ? provider.extra_headers_json
                          : JSON.stringify(provider.extra_headers_json || {}, null, 2)
                      }
                      onChange={(event) => {
                        const rawValue = event.target.value;
                        try {
                          updateProvider(provider.id, {
                            extra_headers_json: rawValue ? JSON.parse(rawValue) : {},
                          });
                        } catch {
                          updateProvider(provider.id, {
                            extra_headers_json: rawValue as any,
                          });
                        }
                      }}
                      className="min-h-[110px] font-mono text-xs"
                      placeholder='{"X-App":"research-poc"}'
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Description</Label>
                    <Input
                      value={provider.description || ''}
                      onChange={(event) => updateProvider(provider.id, { description: event.target.value })}
                      placeholder="可选，用于备注用途，例如：主力对话模型 / 备用网关"
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div>
                      <p className="font-medium text-slate-900">OpenAI-compatible</p>
                      <p className="text-sm text-slate-500">
                        对兼容 OpenAI Chat Completions 的网关或中转，建议打开。
                      </p>
                    </div>
                    <Switch
                      checked={provider.is_openai_compatible || false}
                      onCheckedChange={(checked) => updateProvider(provider.id, { is_openai_compatible: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div>
                      <p className="font-medium text-slate-900">设为默认</p>
                      <p className="text-sm text-slate-500">
                        Research Workspace 会优先选中默认 Provider。
                      </p>
                    </div>
                    <Switch
                      checked={provider.is_default || false}
                      onCheckedChange={(checked) => updateProvider(provider.id, { is_default: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div>
                      <p className="font-medium text-slate-900">启用</p>
                      <p className="text-sm text-slate-500">
                        关闭后该 Provider 会保留配置，但不会建议在工作台中使用。
                      </p>
                    </div>
                    <Switch
                      checked={provider.enabled !== false}
                      onCheckedChange={(checked) => updateProvider(provider.id, { enabled: checked })}
                    />
                  </div>

                  <div className="flex justify-end md:col-span-2">
                    <Button onClick={() => handleSaveProvider(provider)} disabled={savingId === provider.id}>
                      {savingId === provider.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      保存 Provider
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button variant="outline" onClick={handleAddProvider}>
            <Plus className="mr-2 h-4 w-4" />
            新增 Provider
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
}
