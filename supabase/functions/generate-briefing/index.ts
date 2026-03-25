import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyAndExtractUser } from '../_shared/auth.ts';
import { callPerplefina } from '../_shared/perplefinaClient.ts';
import {
  ProviderProfileRequest,
  generateJson,
  providerSnapshot,
  resolveProviderProfile,
  toPerplefinaChatModel,
} from '../_shared/providerProfiles.ts';
import {
  fetchMarketDataSnapshot,
  hasUsableMarketData,
  marketDataSnapshotToCitations,
} from '../_shared/marketDataAdapter.ts';
import { filterRelevantSources } from '../_shared/sourceRelevance.ts';
import { getFallbackResearchTemplate } from '../_shared/fallbackResearchTemplates.ts';

type ConfidenceLevel = 'low' | 'medium' | 'high';
type BriefingType = 'market-morning' | 'company-one-pager' | 'event-flash';

type ThesisItem = {
  title: string;
  summary: string;
  evidence: string[];
};

type ScenarioItem = {
  name: string;
  probability: ConfidenceLevel;
  description: string;
  signals: string[];
};

type RiskItem = {
  title: string;
  impact: ConfidenceLevel;
  description: string;
};

type CitationItem = {
  title: string;
  url: string;
  publisher: string;
  snippet: string;
  source_tier: 1 | 2 | 3;
  source_type: 'filing' | 'media' | 'community';
  source_index: number;
};

type NormalizedBriefing = {
  title: string;
  summary: string;
  stance: {
    label: string;
    confidence: ConfidenceLevel;
    summary: string;
  };
  bullTheses: ThesisItem[];
  bearTheses: ThesisItem[];
  scenarios: ScenarioItem[];
  risks: RiskItem[];
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function pickFirstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function coerceArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function containsChinese(text: string) {
  return /[\u3400-\u9fff]/.test(text);
}

function toConfidenceLevel(value: unknown, fallback: ConfidenceLevel = 'medium'): ConfidenceLevel {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'low' || normalized.includes('low')) {
    return 'low';
  }
  if (normalized === 'high' || normalized.includes('high')) {
    return 'high';
  }
  return fallback;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: number | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs) as unknown as number;
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function preferredLanguageFromBody(body: Record<string, any>): 'zh' | 'en' {
  const candidates = [
    body?.style_profile?.language,
    body?.style_profile?.locale,
    body?.language,
    body?.output_language,
  ]
    .map((value) => String(value || '').toLowerCase())
    .filter(Boolean);

  if (candidates.some((value) => value.includes('en'))) {
    return 'en';
  }

  return 'zh';
}

function briefingTypeLabel(briefingType: string, preferredLanguage: 'zh' | 'en') {
  const zhLabels: Record<string, string> = {
    'market-morning': '市场晨报',
    'company-one-pager': '公司一页纸简报',
    'event-flash': '事件快报',
  };

  const enLabels: Record<string, string> = {
    'market-morning': 'Market Morning Briefing',
    'company-one-pager': 'Company One-Pager',
    'event-flash': 'Event Flash Briefing',
  };

  return preferredLanguage === 'zh'
    ? zhLabels[briefingType] || '研究简报'
    : enLabels[briefingType] || 'Research Briefing';
}

function inferBriefingQuery(
  briefingType: string,
  marketScope: string | undefined,
  watchEntities: string[],
  preferredLanguage: 'zh' | 'en'
) {
  const entityText =
    watchEntities.length > 0
      ? watchEntities.join(preferredLanguage === 'zh' ? '、' : ', ')
      : preferredLanguage === 'zh'
        ? '主要市场与关键主题'
        : 'major markets and key themes';

  if (preferredLanguage === 'en') {
    switch (briefingType) {
      case 'company-one-pager':
        return `Build a company one-pager on ${entityText}. Focus on thesis, catalysts, risks, and the latest evidence.`;
      case 'event-flash':
        return `Build an event flash briefing on ${entityText}. Focus on the catalyst, transmission path, likely market impact, and key risks.`;
      case 'market-morning':
      default:
        return `Build a market morning briefing for ${marketScope || 'multi-market'}, with emphasis on ${entityText}.`;
    }
  }

  switch (briefingType) {
    case 'company-one-pager':
      return `请围绕 ${entityText} 生成一份公司一页纸简报，重点覆盖核心 thesis、催化剂、风险点和最新证据。`;
    case 'event-flash':
      return `请围绕 ${entityText} 生成一份事件快报，重点覆盖最新催化剂、影响路径、潜在市场影响和关键风险。`;
    case 'market-morning':
    default:
      return `请为 ${marketScope || 'multi-market'} 生成一份市场晨报/盘前简报，重点关注 ${entityText}。`;
  }
}

function inferSourceTier(url: string): 1 | 2 | 3 {
  let hostname = '';

  try {
    hostname = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 3;
  }

  if (
    hostname.includes('sec.gov') ||
    hostname.includes('hkex.com') ||
    hostname.includes('nasdaq.com') ||
    hostname.includes('nyse.com') ||
    hostname.includes('investor')
  ) {
    return 1;
  }

  if (
    hostname.includes('reuters.com') ||
    hostname.includes('bloomberg.com') ||
    hostname.includes('wsj.com') ||
    hostname.includes('ft.com') ||
    hostname.includes('cnbc.com') ||
    hostname.includes('yahoo.com')
  ) {
    return 2;
  }

  return 3;
}

function inferSourceType(url: string): CitationItem['source_type'] {
  const tier = inferSourceTier(url);

  if (tier === 1) {
    return 'filing';
  }

  if (tier === 2) {
    return 'media';
  }

  return 'community';
}

function normalizeTheses(items: unknown[], preferredLanguage: 'zh' | 'en'): ThesisItem[] {
  return coerceArray(items)
    .map((item, index) => {
      const fallbackTitle =
        preferredLanguage === 'zh' ? `要点 ${index + 1}` : `Key Point ${index + 1}`;

      if (typeof item === 'string') {
        return {
          title: fallbackTitle,
          summary: item,
          evidence: [],
        };
      }

      if (!item || typeof item !== 'object') {
        return null;
      }

      const title = pickFirstString(
        (item as any).title,
        (item as any).name,
        (item as any).thesis,
        fallbackTitle
      );
      const summary = pickFirstString(
        (item as any).summary,
        (item as any).description,
        (item as any).detail,
        (item as any).content
      );

      return {
        title,
        summary: summary || title,
        evidence: coerceArray<string>((item as any).evidence).filter(Boolean),
      };
    })
    .filter(Boolean) as ThesisItem[];
}

function normalizeRisks(items: unknown[], preferredLanguage: 'zh' | 'en'): RiskItem[] {
  return coerceArray(items)
    .map((item, index) => {
      const fallbackTitle =
        preferredLanguage === 'zh' ? `风险 ${index + 1}` : `Risk ${index + 1}`;

      if (typeof item === 'string') {
        return {
          title: fallbackTitle,
          impact: 'medium',
          description: item,
        };
      }

      if (!item || typeof item !== 'object') {
        return null;
      }

      return {
        title: pickFirstString((item as any).title, (item as any).name, fallbackTitle),
        impact: toConfidenceLevel((item as any).impact, 'medium'),
        description:
          pickFirstString(
            (item as any).description,
            (item as any).summary,
            (item as any).detail,
            (item as any).content
          ) || pickFirstString((item as any).title, (item as any).name, fallbackTitle),
      };
    })
    .filter(Boolean) as RiskItem[];
}

function normalizeScenarios(items: unknown[], preferredLanguage: 'zh' | 'en'): ScenarioItem[] {
  return coerceArray(items)
    .map((item, index) => {
      const fallbackName =
        preferredLanguage === 'zh' ? `情景 ${index + 1}` : `Scenario ${index + 1}`;

      if (typeof item === 'string') {
        return {
          name: fallbackName,
          probability: 'medium',
          description: item,
          signals: [],
        };
      }

      if (!item || typeof item !== 'object') {
        return null;
      }

      return {
        name: pickFirstString((item as any).name, (item as any).title, fallbackName),
        probability: toConfidenceLevel((item as any).probability, 'medium'),
        description:
          pickFirstString(
            (item as any).description,
            (item as any).summary,
            (item as any).detail,
            (item as any).content
          ) || pickFirstString((item as any).name, (item as any).title, fallbackName),
        signals: coerceArray<string>((item as any).signals).filter(Boolean),
      };
    })
    .filter(Boolean) as ScenarioItem[];
}

function normalizeStance(input: unknown, preferredLanguage: 'zh' | 'en') {
  const defaultLabel = preferredLanguage === 'zh' ? '研究结论' : 'Research View';
  const defaultSummary =
    preferredLanguage === 'zh' ? '暂无明确立场。' : 'No clear stance yet.';

  if (typeof input === 'string') {
    return {
      label: defaultLabel,
      confidence: 'medium' as ConfidenceLevel,
      summary: input,
    };
  }

  const source = input as Record<string, unknown> | null | undefined;

  return {
    label: pickFirstString(source?.label, source?.stance, defaultLabel),
    confidence: toConfidenceLevel(source?.confidence, 'medium'),
    summary: pickFirstString(source?.summary, source?.description, defaultSummary) || defaultSummary,
  };
}

function normalizeBriefing(
  raw: Record<string, unknown> | null | undefined,
  briefingType: string,
  watchEntities: string[],
  preferredLanguage: 'zh' | 'en'
): NormalizedBriefing {
  const fallbackTitleBase = briefingTypeLabel(briefingType, preferredLanguage);
  const fallbackTitle =
    watchEntities.length > 0 && briefingType !== 'market-morning'
      ? preferredLanguage === 'zh'
        ? `${watchEntities.join('、')} ${fallbackTitleBase}`
        : `${watchEntities.join(', ')} ${fallbackTitleBase}`
      : fallbackTitleBase;

  return {
    title:
      pickFirstString(raw?.title, raw?.headline, raw?.name) ||
      fallbackTitle,
    summary:
      pickFirstString(raw?.summary, raw?.overview, raw?.abstract) ||
      (preferredLanguage === 'zh' ? '暂无摘要。' : 'No summary available.'),
    stance: normalizeStance(raw?.stance, preferredLanguage),
    bullTheses: normalizeTheses(
      (raw as any)?.bull_theses || (raw as any)?.theses?.bull || [],
      preferredLanguage
    ).slice(0, 5),
    bearTheses: normalizeTheses(
      (raw as any)?.bear_theses || (raw as any)?.theses?.bear || [],
      preferredLanguage
    ).slice(0, 5),
    scenarios: normalizeScenarios((raw as any)?.scenarios || [], preferredLanguage).slice(0, 4),
    risks: normalizeRisks((raw as any)?.risks || [], preferredLanguage).slice(0, 5),
  };
}

function normalizeCitations(sources: unknown[]): CitationItem[] {
  return coerceArray(sources)
    .slice(0, 10)
    .map((source, index) => {
      const entry = (source || {}) as any;
      const url = pickFirstString(entry?.metadata?.url);

      return {
        title: pickFirstString(entry?.metadata?.title) || `Source ${index + 1}`,
        url,
        publisher: (() => {
          try {
            return new URL(url).hostname.replace(/^www\./, '');
          } catch {
            return 'unknown-source';
          }
        })(),
        snippet: String(entry?.pageContent || '').slice(0, 400),
        source_tier: inferSourceTier(url),
        source_type: inferSourceType(url),
        source_index: index + 1,
      };
    });
}

function mergeCitations(primary: CitationItem[], secondary: CitationItem[], maxItems = 6) {
  const merged: CitationItem[] = [];
  const seen = new Set<string>();

  for (const citation of [...primary, ...secondary]) {
    const key = `${citation.url || ''}::${citation.title || ''}`.trim();
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push({
      ...citation,
      source_index: merged.length + 1,
    });

    if (merged.length >= maxItems) {
      break;
    }
  }

  return merged;
}

function summaryShowsSourceMismatch(text: string) {
  const normalized = text.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return (
    /\bunrelated to\b/.test(normalized) ||
    /\bnot related to\b/.test(normalized) ||
    /\boff-topic\b/.test(normalized) ||
    /\binsufficient evidence\b/.test(normalized) ||
    /\bcannot (generate|build|provide)\b/.test(normalized) ||
    /\bsource(?:s)? (?:do|does) not match\b/.test(normalized) ||
    /\b(?:all|these|given|provided) sources?\b/.test(normalized) ||
    /\bnone of (?:the )?sources\b/.test(normalized) ||
    /\bno source(?:s)? (?:about|for|on|mentions?)\b/.test(normalized) ||
    /无法生成/.test(text) ||
    /不匹配/.test(text) ||
    /无关/.test(text) ||
    /没有任何.*相关/.test(text) ||
    /证据不足/.test(text) ||
    /缺乏.*信息/.test(text) ||
    /(所给|给定|提供的).{0,10}来源/.test(text)
  );
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeEntityKeywords(entities: string[]) {
  const keywords = new Set<string>();

  for (const entity of entities) {
    const trimmed = String(entity || '').trim();
    if (!trimmed) {
      continue;
    }

    keywords.add(trimmed);

    for (const token of trimmed.split(/[\s,，/|()（）\-]+/)) {
      const normalized = token.trim();
      if (normalized.length >= 2) {
        keywords.add(normalized);
      }
    }
  }

  return Array.from(keywords);
}

function matchEntityKeyword(text: string, keyword: string) {
  const haystack = text.toLowerCase();
  const needle = keyword.trim().toLowerCase();

  if (!needle) {
    return false;
  }

  if (containsChinese(needle)) {
    return haystack.includes(needle);
  }

  if (haystack.includes(`/${needle}`) || haystack.includes(`=${needle}`)) {
    return true;
  }

  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle)}([^a-z0-9]|$)`, 'i').test(haystack);
}

function citationDirectlyMatchesEntity(citation: CitationItem, entityKeywords: string[]) {
  const displayText = `${citation.title || ''} ${citation.publisher || ''} ${citation.url || ''}`.toLowerCase();
  const snippetText = `${citation.snippet || ''}`.toLowerCase();

  return entityKeywords.some((keyword) => {
    if (matchEntityKeyword(displayText, keyword)) {
      return true;
    }

    if ((citation.source_tier || 3) <= 2 && matchEntityKeyword(snippetText, keyword)) {
      return true;
    }

    return false;
  });
}

function gateEntityFocusedCitations(citations: CitationItem[], entities: string[]) {
  const entityKeywords = normalizeEntityKeywords(entities);

  if (entityKeywords.length === 0) {
    return {
      citations,
      entityKeywords,
      rawCount: citations.length,
      removedForMismatch: false,
    };
  }

  const matched = citations.filter((citation) => citationDirectlyMatchesEntity(citation, entityKeywords));

  return {
    citations: matched,
    entityKeywords,
    rawCount: citations.length,
    removedForMismatch: citations.length > 0 && matched.length === 0,
  };
}

function normalizeFallbackSummary(
  retrievalSummary: string,
  preferredLanguage: 'zh' | 'en'
) {
  const trimmed = retrievalSummary.trim().replace(/\s+/g, ' ');

  if (!trimmed) {
    return preferredLanguage === 'zh'
      ? '实时检索暂时不可用，当前简报已自动降级为可读的研究摘要版本。'
      : 'Real-time retrieval is temporarily unavailable, so this briefing was automatically downgraded to a readable research summary.';
  }

  if (preferredLanguage === 'zh' && !containsChinese(trimmed)) {
    return '系统拿到了部分英文证据摘要，但当前中文简报综合未完成。请先参考下方来源，并稍后重试。';
  }

  if (summaryShowsSourceMismatch(trimmed)) {
    return preferredLanguage === 'zh'
      ? '本轮检索返回的来源与目标标的明显不匹配，系统已放弃继续拼接错误简报，并切换为降级研究输出。'
      : 'The retrieved sources were clearly mismatched to the requested entity, so the system downgraded instead of forcing a misleading briefing.';
  }

  return trimmed.slice(0, 220);
}

function buildBriefingMarkdown(input: {
  title: string;
  summary: string;
  stance: NormalizedBriefing['stance'];
  bullTheses: ThesisItem[];
  bearTheses: ThesisItem[];
  risks: RiskItem[];
  scenarios: ScenarioItem[];
  citations: Array<{
    title: string;
    publisher: string;
    source_index: number;
  }>;
  preferredLanguage: 'zh' | 'en';
}) {
  const isChinese = input.preferredLanguage === 'zh';

  return [
    `## ${input.title}`,
    input.summary,
    '',
    `## ${isChinese ? '结论立场' : 'Stance'}`,
    input.stance.summary || (isChinese ? '暂无明确立场。' : 'No clear stance yet.'),
    '',
    `## ${isChinese ? '核心 Thesis' : 'Core Thesis'}`,
    ...(input.bullTheses.length > 0
      ? input.bullTheses.map((item, index) => `${index + 1}. ${item.title}: ${item.summary}`)
      : [isChinese ? '暂无核心 thesis。' : 'No core thesis yet.']),
    '',
    `## ${isChinese ? '反方 Thesis' : 'Bear Thesis'}`,
    ...(input.bearTheses.length > 0
      ? input.bearTheses.map((item, index) => `${index + 1}. ${item.title}: ${item.summary}`)
      : [isChinese ? '暂无反方 thesis。' : 'No bear thesis yet.']),
    '',
    `## ${isChinese ? '风险点' : 'Risks'}`,
    ...(input.risks.length > 0
      ? input.risks.map((item, index) => `${index + 1}. ${item.title}: ${item.description}`)
      : [isChinese ? '暂无额外风险点。' : 'No additional risks yet.']),
    '',
    `## ${isChinese ? '情景分析' : 'Scenarios'}`,
    ...(input.scenarios.length > 0
      ? input.scenarios.map((item, index) => `${index + 1}. ${item.name}: ${item.description}`)
      : [isChinese ? '暂无情景分析。' : 'No scenario analysis yet.']),
    '',
    `## ${isChinese ? '来源' : 'Sources'}`,
    ...(input.citations.length > 0
      ? input.citations.map(
          (item) => `[${item.source_index}] ${item.title} - ${item.publisher || (isChinese ? '来源' : 'source')}`
        )
      : [isChinese ? '暂无引用来源。' : 'No citations available.']),
    '',
    `## ${isChinese ? '免责声明' : 'Disclaimer'}`,
    isChinese
      ? '本简报仅用于研究和讨论，不构成个性化买卖建议、仓位建议、止盈止损建议或收益承诺。'
      : 'This briefing is for research and discussion only and does not constitute personalized trading advice, sizing guidance, stop-loss guidance, or return promises.',
  ].join('\n');
}

function buildMarketDataSummary(
  marketData: { available: boolean; snapshot: Record<string, unknown> | null; error?: string },
  preferredLanguage: 'zh' | 'en'
) {
  if (!marketData.available || !marketData.snapshot) {
    return preferredLanguage === 'zh'
      ? `结构化市场数据暂不可用${marketData.error ? `：${marketData.error}` : '。'}`
      : `Structured market data is unavailable${marketData.error ? `: ${marketData.error}` : '.'}`;
  }

  const snapshot = marketData.snapshot as any;
  const entities = Array.isArray(snapshot?.entities)
    ? (() => {
        const preferredEntities = snapshot.entities.filter(
          (item: Record<string, any>) => String(item?.market || '').toUpperCase() !== 'INDEX'
        );
        return (preferredEntities.length > 0 ? preferredEntities : snapshot.entities).slice(0, 3);
      })()
    : [];
  const news = Array.isArray(snapshot?.news) ? snapshot.news.slice(0, 3) : [];

  const quoteSummary = entities
    .map((item: any) => {
      const name = pickFirstString(item?.shortName, item?.longName, item?.symbol);
      const price =
        typeof item?.regularMarketPrice === 'number'
          ? `${item.regularMarketPrice}${item?.currency ? ` ${item.currency}` : ''}`
          : preferredLanguage === 'zh'
            ? '暂无报价'
            : 'price unavailable';
      const changePercent =
        typeof item?.changePercent === 'number'
          ? `${item.changePercent >= 0 ? '+' : ''}${item.changePercent.toFixed(2)}%`
          : preferredLanguage === 'zh'
            ? '涨跌幅未知'
            : 'change unavailable';

      return preferredLanguage === 'zh'
        ? `${name}（${item?.symbol || ''}）最新价 ${price}，较前收 ${changePercent}`
        : `${name} (${item?.symbol || ''}) last ${price}, vs previous close ${changePercent}`;
    })
    .join(preferredLanguage === 'zh' ? '；' : '; ');

  const newsSummary = news
    .map((item: any) => `[${item?.publisher || 'Google News'}] ${item?.title || ''}`)
    .join(preferredLanguage === 'zh' ? '；' : '; ');

  const combined = [quoteSummary, newsSummary ? (preferredLanguage === 'zh' ? `最新新闻：${newsSummary}` : `Latest news: ${newsSummary}`) : '']
    .filter(Boolean)
    .join(preferredLanguage === 'zh' ? '。' : '. ');

  return combined ||
    (preferredLanguage === 'zh'
      ? '已拿到结构化市场数据快照，但暂时无法整理出可读摘要。'
      : 'Structured market data is available, but a readable summary is not yet available.');
}

function localizeOperationalMessage(message: string, preferredLanguage: 'zh' | 'en') {
  if (!message.trim()) {
    return message;
  }

  if (preferredLanguage === 'en') {
    return message;
  }

  const timeoutMatch = message.match(/timed out after (\d+)ms/i);
  if (timeoutMatch) {
    const seconds = (Number(timeoutMatch[1]) / 1000).toFixed(
      Number(timeoutMatch[1]) % 1000 === 0 ? 0 : 1
    );

    if (/perplefina/i.test(message)) {
      return `实时检索服务超时（${seconds} 秒）`;
    }

    if (/briefing-synthesis/i.test(message)) {
      return `简报综合阶段超时（${seconds} 秒）`;
    }

    if (/market-data/i.test(message)) {
      return `结构化数据查询超时（${seconds} 秒）`;
    }

    return `服务请求超时（${seconds} 秒）`;
  }

  if (/MARKET_DATA_ADAPTER_URL not configured/i.test(message)) {
    return '未配置结构化数据适配器';
  }

  return message;
}

function buildFallbackBriefing(params: {
  briefingType: string;
  watchEntities: string[];
  preferredLanguage: 'zh' | 'en';
  retrievalSummary: string;
  citations: CitationItem[];
  retrievalWarning?: string;
  marketDataSummary: string;
  synthesisWarning?: string;
}): NormalizedBriefing {
  const {
    briefingType,
    watchEntities,
    preferredLanguage,
    retrievalSummary,
    citations,
    retrievalWarning,
    marketDataSummary,
    synthesisWarning,
  } = params;

  const isChinese = preferredLanguage === 'zh';
  const titleBase = briefingTypeLabel(briefingType, preferredLanguage);
  const entityText = watchEntities.length > 0 ? watchEntities.join(isChinese ? '、' : ', ') : '';
  const title = entityText && briefingType !== 'market-morning' ? `${entityText} ${titleBase}` : titleBase;

  const summary = normalizeFallbackSummary(retrievalSummary, preferredLanguage);
  const shouldEchoRetrievalSummary =
    retrievalSummary.trim().length > 0 && !summaryShowsSourceMismatch(retrievalSummary);

  const stanceSummary = isChinese
    ? `当前给出的是降级版研究判断：可先用来把握问题框架、潜在催化剂与风险，但仍需要继续补充最新公告、财报电话会或主流媒体验证。`
    : `This is a degraded research view that can frame the problem, catalysts, and risks, but still needs confirmation from fresh filings, earnings calls, or top-tier media.`;

  const bullTheses: ThesisItem[] = [];

  if (shouldEchoRetrievalSummary) {
    bullTheses.push({
      title: isChinese ? '最新证据线索' : 'Latest Evidence',
      summary,
      evidence: citations.slice(0, 3).map((item) => item.title),
    });
  }

  bullTheses.push({
    title: isChinese ? '当前研究价值' : 'Current Research Value',
    summary: isChinese
      ? '即使实时链路不稳定，这份简报仍能沉淀核心问题、可能的多空论点，以及下一步最值得验证的方向。'
      : 'Even with an unstable real-time chain, this briefing still captures the core question, likely bull/bear arguments, and the highest-priority next checks.',
    evidence: [],
  });

  if (marketDataSummary.trim()) {
    bullTheses.push({
      title: isChinese ? '结构化数据补充' : 'Structured Data Support',
      summary: marketDataSummary,
      evidence: [],
    });
  }

  const bearTheses: ThesisItem[] = [
    {
      title: isChinese ? '时效性不足' : 'Timeliness Gap',
      summary:
        retrievalWarning ||
        (isChinese
          ? '由于实时检索链路不稳定，当前版本可能漏掉最关键的最新催化剂或反证。'
          : 'Because the real-time retrieval chain is unstable, this version may miss the most important new catalyst or counter-evidence.'),
      evidence: [],
    },
    {
      title: isChinese ? '结论仍需二次验证' : 'Needs Secondary Validation',
      summary: isChinese
        ? '在没有稳定一级/二级来源补充之前，不应把这份降级结果视为完整简报终稿。'
        : 'Without stable tier-1 and tier-2 source support, this degraded output should not be treated as a final briefing.',
      evidence: [],
    },
  ];

  const scenarios: ScenarioItem[] = [
    {
      name: isChinese ? '基准情景' : 'Base Case',
      probability: 'medium',
      description: isChinese
        ? '后续检索恢复后，当前摘要中的主要线索能够被一级/二级来源部分确认，简报可以快速升级为正式版本。'
        : 'Once retrieval recovers, the main leads in this summary are partially confirmed by tier-1 and tier-2 sources and the briefing can be upgraded quickly.',
      signals: [],
    },
    {
      name: isChinese ? '风险情景' : 'Risk Case',
      probability: 'medium',
      description: isChinese
        ? '如果最新消息与当前线索冲突，结论立场、多空 thesis 和风险排序都可能显著改写。'
        : 'If the latest news conflicts with the current leads, the stance, bull/bear thesis, and risk ranking may need material revision.',
      signals: [],
    },
  ];

  const risks: RiskItem[] = [
    {
      title: isChinese ? '实时检索不可用' : 'Real-Time Retrieval Unavailable',
      impact: 'high',
      description:
        retrievalWarning ||
        (isChinese
          ? 'Perplefina 或公网隧道当前不可用，因此这份简报缺少稳定的实时新闻和网页证据。'
          : 'Perplefina or the public tunnel is unavailable, so this briefing lacks stable real-time news and web evidence.'),
    },
    {
      title: isChinese ? '综合链路降级' : 'Synthesis Downgraded',
      impact: 'medium',
      description:
        synthesisWarning ||
        (isChinese
          ? '为了保证可交付性，系统输出了降级版本，表达强度与完整度弱于正常链路。'
          : 'To guarantee deliverability, the system emitted a downgraded version with lower strength and completeness than the normal chain.'),
    },
  ];

  return {
    title,
    summary,
    stance: {
      label: isChinese ? '初步研究判断' : 'Preliminary Research View',
      confidence: 'low',
      summary: stanceSummary,
    },
    bullTheses,
    bearTheses,
    scenarios,
    risks,
  };
}

function countKeywordHits(text: string, keywords: string[]) {
  return keywords.reduce((count, keyword) => count + (text.includes(keyword) ? 1 : 0), 0);
}

function buildTemplateBriefing(
  template: NonNullable<ReturnType<typeof getFallbackResearchTemplate>>,
  briefingType: string,
  watchEntities: string[],
  preferredLanguage: 'zh' | 'en',
  options?: {
    liveSummary?: string;
    citations?: CitationItem[];
  }
): NormalizedBriefing {
  const fallbackTitleBase = briefingTypeLabel(briefingType, preferredLanguage);
  const entityText = watchEntities.length > 0 ? watchEntities.join(preferredLanguage === 'zh' ? '、' : ', ') : '';

  const briefing: NormalizedBriefing = {
    title: entityText && briefingType !== 'market-morning' ? `${entityText} ${fallbackTitleBase}` : fallbackTitleBase,
    summary:
      preferredLanguage === 'zh'
        ? '以下为模板化兜底简报，便于内部讨论，但仍需等待最新来源补齐后再升级为正式版本。'
        : 'This is a template fallback briefing for internal discussion and still needs fresh sources before it should be treated as a finalized version.',
    stance: template.stance,
    bullTheses: template.bull.map((item) => ({
      title: item.title,
      summary: item.summary,
      evidence: [],
    })),
    bearTheses: template.bear.map((item) => ({
      title: item.title,
      summary: item.summary,
      evidence: [],
    })),
    scenarios: template.scenarios.map((item) => ({
      name: item.name,
      probability: item.probability,
      description: item.description,
      signals: [],
    })),
    risks: template.risks,
  };

  if (options?.liveSummary) {
    briefing.bullTheses.unshift({
      title: preferredLanguage === 'zh' ? '最新价格与新闻线索' : 'Latest Price and News',
      summary: options.liveSummary,
      evidence: (options.citations || []).slice(0, 3).map((citation) => citation.title),
    });
  }

  return briefing;
}

function buildSignalDrivenBriefing(params: {
  briefingType: string;
  watchEntities: string[];
  preferredLanguage: 'zh' | 'en';
  citations: CitationItem[];
  marketData: { snapshot: Record<string, unknown> | null };
}) {
  const { briefingType, watchEntities, preferredLanguage, citations, marketData } = params;
  const snapshot = marketData.snapshot as any;
  const entity = Array.isArray(snapshot?.entities) ? snapshot.entities[0] : null;
  const entityName = pickFirstString(entity?.shortName, entity?.longName, entity?.symbol, watchEntities[0], 'Research');
  const fallbackTitleBase = briefingTypeLabel(briefingType, preferredLanguage);
  const entityText = watchEntities.length > 0 ? watchEntities.join(preferredLanguage === 'zh' ? '、' : ', ') : '';
  const title = entityText && briefingType !== 'market-morning' ? `${entityText} ${fallbackTitleBase}` : fallbackTitleBase;
  const priceText =
    typeof entity?.regularMarketPrice === 'number'
      ? `${entity.regularMarketPrice}${entity?.currency ? ` ${entity.currency}` : ''}`
      : preferredLanguage === 'zh'
        ? '暂无报价'
        : 'price unavailable';
  const changePercent =
    typeof entity?.changePercent === 'number'
      ? `${entity.changePercent >= 0 ? '+' : ''}${Number(entity.changePercent).toFixed(2)}%`
      : preferredLanguage === 'zh'
        ? '涨跌幅未知'
        : 'change unavailable';
  const citationText = citations.map((citation) => `${citation.title} ${citation.snippet}`).join(' ').toLowerCase();
  const positiveKeywords = ['增长', '盈利', '创新高', '合作', '订单', '储能', 'growth', 'profit', 'partnership', 'launch'];
  const negativeKeywords = ['下跌', '减持', '调查', '风险', '监管', 'selloff', 'warning', 'probe', 'decline'];
  const positiveHits = countKeywordHits(citationText, positiveKeywords);
  const negativeHits = countKeywordHits(citationText, negativeKeywords);
  const isNegativeTilt = negativeHits > positiveHits || String(changePercent).startsWith('-');
  const topPositiveTitle =
    citations.find((citation) => countKeywordHits(`${citation.title} ${citation.snippet}`.toLowerCase(), positiveKeywords) > 0)
      ?.title || '';
  const topNegativeTitle =
    citations.find((citation) => countKeywordHits(`${citation.title} ${citation.snippet}`.toLowerCase(), negativeKeywords) > 0)
      ?.title || '';

  return {
    title,
    summary:
      preferredLanguage === 'zh'
        ? `${entityName} 当前最新价 ${priceText}，较前收 ${changePercent}。这是一份基于实时价格与新闻标题信号生成的低置信度简报，适合先把握短线偏向与后续验证方向。`
        : `${entityName} last traded at ${priceText}, versus previous close ${changePercent}. This is a low-confidence briefing built from live price and headline signals and is best used to frame the next validation steps.`,
    stance: {
      label:
        preferredLanguage === 'zh'
          ? isNegativeTilt
            ? '谨慎偏空'
            : '中性偏多'
          : isNegativeTilt
            ? 'Cautious Bearish'
            : 'Cautious Bullish',
      confidence: 'low' as ConfidenceLevel,
      summary:
        preferredLanguage === 'zh'
          ? `当前信号更偏${isNegativeTilt ? '防守' : '观察中的偏积极'}，但仍需要更完整的公告、财报电话会或交易所披露来确认。`
          : `Current signals lean ${isNegativeTilt ? 'defensive' : 'constructive but tentative'}, and still need fuller filings, earnings-call material, or exchange disclosures for confirmation.`,
    },
    bullTheses: [
      {
        title: preferredLanguage === 'zh' ? '最新价格与新闻线索' : 'Latest Price and News',
        summary:
          preferredLanguage === 'zh'
            ? `${entityName} 最新价 ${priceText}，较前收 ${changePercent}。${citations
                .slice(0, 3)
                .map((citation) => `[${citation.publisher}] ${citation.title}`)
                .join('；')}`
            : `${entityName} last traded at ${priceText}, versus previous close ${changePercent}. ${citations
                .slice(0, 3)
                .map((citation) => `[${citation.publisher}] ${citation.title}`)
                .join('; ')}`,
        evidence: citations.slice(0, 3).map((citation) => citation.title),
      },
      {
        title: preferredLanguage === 'zh' ? '仍有可跟踪的上行催化' : 'Still Has Trackable Upside Catalysts',
        summary:
          topPositiveTitle
            ? preferredLanguage === 'zh'
              ? `偏正向的标题信号仍然存在，例如“${topPositiveTitle}”。如果这些线索能落到订单、盈利或份额改善，市场情绪可能重新修复。`
              : `There are still constructive headline signals, such as "${topPositiveTitle}". If they translate into orders, earnings, or share gains, sentiment can repair.`
            : preferredLanguage === 'zh'
              ? '即使短线情绪承压，只要后续正式披露出现改善，市场仍可能重新交易业务改善逻辑。'
              : 'Even if near-term sentiment is soft, later formal disclosures can still reopen the business-improvement thesis.',
        evidence: topPositiveTitle ? [topPositiveTitle] : [],
      },
    ],
    bearTheses: [
      {
        title: preferredLanguage === 'zh' ? '短线压力已经落到价格或标题上' : 'Near-Term Pressure Is Already Visible',
        summary:
          topNegativeTitle
            ? preferredLanguage === 'zh'
              ? `最直接的负面信号来自“${topNegativeTitle}”，再叠加最新涨跌幅 ${changePercent}，说明资金面仍然偏谨慎。`
              : `The clearest negative signal comes from "${topNegativeTitle}", and the latest move of ${changePercent} suggests positioning is still cautious.`
            : preferredLanguage === 'zh'
              ? `即使没有单条决定性利空，最新涨跌幅 ${changePercent} 也说明预期并不稳。`
              : `Even without one decisive negative headline, the latest move of ${changePercent} shows expectations are not stable.`,
        evidence: topNegativeTitle ? [topNegativeTitle] : [],
      },
      {
        title: preferredLanguage === 'zh' ? '证据仍然偏标题级别' : 'Evidence Is Still Headline-Level',
        summary:
          preferredLanguage === 'zh'
            ? '当前更多拿到的是实时标题和价格，而不是正式公告或财报级证据，因此这份简报必须维持低置信度。'
            : 'This run captured more live headlines and price data than filings or earnings-grade evidence, so the briefing must remain low confidence.',
        evidence: [],
      },
    ],
    scenarios: [
      {
        name: preferredLanguage === 'zh' ? '基准情景' : 'Base Case',
        probability: 'medium' as ConfidenceLevel,
        description:
          preferredLanguage === 'zh'
            ? '如果后续新闻继续偏分化、但缺少更强正式披露，股价更可能维持高波动和区间拉锯。'
            : 'If later headlines stay mixed and formal disclosure remains thin, the name is more likely to trade in a volatile range.',
        signals: [],
      },
      {
        name: preferredLanguage === 'zh' ? '风险情景' : 'Risk Case',
        probability: 'medium' as ConfidenceLevel,
        description:
          preferredLanguage === 'zh'
            ? '如果正式披露确认减持、监管、业绩不及预期或需求放缓，当前判断会继续向更偏空方向移动。'
            : 'If formal disclosures confirm insider selling, regulation, weaker earnings, or softer demand, the current view would likely move more negative.',
        signals: [],
      },
    ],
    risks: [
      {
        title: preferredLanguage === 'zh' ? '正式披露不足' : 'Insufficient Formal Disclosure',
        impact: 'high' as ConfidenceLevel,
        description:
          preferredLanguage === 'zh'
            ? '仅靠实时标题和价格无法替代公告、财报和电话会纪要，后续正式披露可能显著改写当前判断。'
            : 'Live headlines and price action cannot replace filings, company disclosures, or earnings-call notes, so later formal evidence could materially change the view.',
      },
      {
        title: preferredLanguage === 'zh' ? '短线波动大于结论稳定性' : 'Volatility Exceeds Conclusion Stability',
        impact: 'medium' as ConfidenceLevel,
        description:
          preferredLanguage === 'zh'
            ? '当前更像是一份信号驱动的临时简报，而不是已经完成验证的高确信度终稿。'
            : 'This is better treated as a signal-driven interim briefing than as a fully validated final document.',
      },
    ],
  } satisfies NormalizedBriefing;
}

function buildMarketMorningSignalBriefing(params: {
  preferredLanguage: 'zh' | 'en';
  citations: CitationItem[];
  marketData: { snapshot: Record<string, unknown> | null };
}) {
  const { preferredLanguage, citations, marketData } = params;
  const snapshot = marketData.snapshot as any;
  const entities = Array.isArray(snapshot?.entities) ? snapshot.entities.slice(0, 4) : [];
  const isChinese = preferredLanguage === 'zh';

  const scorecards = entities.map((entity: any) => {
    const name = pickFirstString(entity?.shortName, entity?.longName, entity?.symbol);
    const changePercent = typeof entity?.changePercent === 'number' ? Number(entity.changePercent) : null;

    return {
      name,
      symbol: String(entity?.symbol || ''),
      changePercent,
      price:
        typeof entity?.regularMarketPrice === 'number'
          ? `${entity.regularMarketPrice}${entity?.currency ? ` ${entity.currency}` : ''}`
          : isChinese
            ? '暂无报价'
            : 'price unavailable',
    };
  });

  const positiveCount = scorecards.filter((item) => (item.changePercent || 0) > 0.5).length;
  const negativeCount = scorecards.filter((item) => (item.changePercent || 0) < -0.5).length;
  const tone =
    negativeCount > positiveCount
      ? isChinese
        ? '偏谨慎'
        : 'Cautious'
      : positiveCount > negativeCount
        ? isChinese
          ? '偏积极'
          : 'Constructive'
        : isChinese
          ? '中性偏谨慎'
          : 'Mixed';

  const strongest = [...scorecards]
    .filter((item) => item.changePercent !== null)
    .sort((left, right) => Math.abs(right.changePercent || 0) - Math.abs(left.changePercent || 0))[0];

  const headlineText = citations.map((citation) => `${citation.title} ${citation.snippet}`).join(' ').toLowerCase();
  const riskKeywords = ['油价', '地缘', '冲突', '关税', 'selloff', 'war', 'tariff', 'inflation', 'hawkish', 'tension'];
  const supportKeywords = ['财报', '盈利', '刺激', '降息', 'buyback', 'earnings', 'stimulus', 'easing', 'rebound'];
  const headlineRiskBias = countKeywordHits(headlineText, riskKeywords) > countKeywordHits(headlineText, supportKeywords);

  const scorecardSummary = scorecards
    .slice(0, 3)
    .map((item) =>
      isChinese
        ? `${item.name}（${item.symbol}）最新价 ${item.price}，较前收 ${item.changePercent === null ? '涨跌幅未知' : `${item.changePercent >= 0 ? '+' : ''}${item.changePercent.toFixed(2)}%`}`
        : `${item.name} (${item.symbol}) last ${item.price}, versus previous close ${item.changePercent === null ? 'change unavailable' : `${item.changePercent >= 0 ? '+' : ''}${item.changePercent.toFixed(2)}%`}`
    )
    .join(isChinese ? '；' : '; ');

  return {
    title: briefingTypeLabel('market-morning', preferredLanguage),
    summary:
      isChinese
        ? `当前晨间快照显示市场整体${tone}。${scorecardSummary}${citations.length > 0 ? `。高信号 headlines 包括：${citations.slice(0, 3).map((item) => `[${item.publisher}] ${item.title}`).join('；')}` : ''}`
        : `The current morning snapshot leans ${tone}. ${scorecardSummary}${citations.length > 0 ? `. Higher-signal headlines include: ${citations.slice(0, 3).map((item) => `[${item.publisher}] ${item.title}`).join('; ')}` : ''}`,
    stance: {
      label: isChinese ? tone : tone,
      confidence: 'low' as ConfidenceLevel,
      summary:
        isChinese
          ? `这是一份基于指数快照与新闻标题的低置信度晨报。当前盘面更像“${tone}”，真正的方向仍要看后续宏观消息、官方披露和现金市场开盘后的确认。`
          : `This is a low-confidence morning note built from index snapshots and headline signals. The current tape looks ${tone}, but direction still needs confirmation from macro releases, official disclosures, and cash-market trading.`,
    },
    bullTheses: [
      {
        title: isChinese ? '至少部分风险资产仍有承接' : 'At Least Part of Risk Assets Are Holding Up',
        summary:
          strongest && (strongest.changePercent || 0) > 0
            ? isChinese
              ? `${strongest.name} 是当前相对更强的市场之一，说明风险偏好并未全面熄火。`
              : `${strongest.name} is one of the relatively stronger markets this morning, suggesting risk appetite has not fully broken.`
            : isChinese
              ? '即使跨市场波动上升，仍未看到所有主要市场同时失速。'
              : 'Even with higher cross-market volatility, not every major market is rolling over at once.',
        evidence: strongest && (strongest.changePercent || 0) > 0 ? [strongest.name] : [],
      },
      {
        title: isChinese ? '晨间新闻仍提供可跟踪催化' : 'Morning Headlines Still Offer Trackable Catalysts',
        summary:
          citations.length > 0
            ? isChinese
              ? `当前可优先跟踪的 headline 包括：${citations.slice(0, 2).map((item) => item.title).join('；')}。`
              : `The most actionable morning headlines are: ${citations.slice(0, 2).map((item) => item.title).join('; ')}.`
            : isChinese
              ? '虽然 headline 不算丰富，但指数快照本身已经给出了晨间风险偏好的第一层线索。'
              : 'Even without many headlines, the index snapshot itself already offers a first read on risk appetite.',
        evidence: citations.slice(0, 2).map((item) => item.title),
      },
    ],
    bearTheses: [
      {
        title: isChinese ? '跨市场风险偏好仍脆弱' : 'Cross-Market Risk Appetite Remains Fragile',
        summary:
          strongest && (strongest.changePercent || 0) < 0
            ? isChinese
              ? `${strongest.name} 的波动幅度居前，说明资金对宏观不确定性仍然敏感。`
              : `${strongest.name} is showing one of the sharpest moves, indicating markets remain sensitive to macro uncertainty.`
            : isChinese
              ? '即使没有出现单边大跌，当前晨间结构仍显示市场更容易被新消息扰动。'
              : 'Even without a straight-line selloff, the morning setup still looks highly sensitive to fresh macro headlines.',
        evidence: strongest && (strongest.changePercent || 0) < 0 ? [strongest.name] : [],
      },
      {
        title: isChinese ? 'headline 仍不足以替代正式宏观验证' : 'Headlines Still Cannot Replace Formal Macro Validation',
        summary:
          isChinese
            ? '当前更多是价格与标题信号，不足以替代经济数据、央行表态和正式公告。'
            : 'This run still relies more on prices and headlines than on hard macro releases, central-bank signals, or formal disclosures.',
        evidence: [],
      },
    ],
    scenarios: [
      {
        name: isChinese ? '基准情景' : 'Base Case',
        probability: 'medium' as ConfidenceLevel,
        description:
          isChinese
            ? '若后续没有更强的新冲击，市场更可能维持分化震荡，等待宏观和盘中成交确认方向。'
            : 'If no stronger shock arrives, markets are more likely to stay mixed and range-bound while waiting for macro and cash-session confirmation.',
        signals: [],
      },
      {
        name: isChinese ? '风险情景' : 'Risk Case',
        probability: 'medium' as ConfidenceLevel,
        description:
          isChinese
            ? headlineRiskBias
              ? '若地缘、油价或政策 headline 继续恶化，晨间偏弱结构可能进一步演变成更明确的 risk-off。'
              : '如果新的宏观或政策 headline 转负，当前平衡很容易被打破并转向更明显的 risk-off。'
            : headlineRiskBias
              ? 'If geopolitics, oil, or policy headlines worsen further, the current weak setup can slide into a more explicit risk-off move.'
              : 'If fresh macro or policy headlines turn negative, the current balance can quickly break into a clearer risk-off move.',
        signals: [],
      },
    ],
    risks: [
      {
        title: isChinese ? '晨间信号噪音偏高' : 'Morning Signal Noise Is High',
        impact: 'high' as ConfidenceLevel,
        description:
          isChinese
            ? '盘前/晨间价格和 headline 容易被单条新闻扰动，不能把这份结果当成全天结论。'
            : 'Pre-market and morning signals can be distorted by a single headline and should not be treated as an all-day conclusion.',
      },
      {
        title: isChinese ? '正式宏观事件仍可能重定价' : 'Formal Macro Events Can Reprice the Tape',
        impact: 'medium' as ConfidenceLevel,
        description:
          isChinese
            ? '后续经济数据、央行讲话、政策表态或地缘消息都可能迅速改写当前判断。'
            : 'Upcoming data, central-bank remarks, policy signals, or geopolitical headlines can quickly reprice the current setup.',
      },
    ],
  } satisfies NormalizedBriefing;
}

function buildBestEffortBriefing(params: {
  briefingType: string;
  watchEntities: string[];
  preferredLanguage: 'zh' | 'en';
  citations: CitationItem[];
  marketData: {
    available: boolean;
    snapshot: Record<string, unknown> | null;
    error?: string;
  };
  retrievalSummary: string;
  retrievalWarning?: string;
  synthesisWarning?: string;
}) {
  const {
    briefingType,
    watchEntities,
    preferredLanguage,
    citations,
    marketData,
    retrievalSummary,
    retrievalWarning,
    synthesisWarning,
  } = params;

  const localizedRetrievalWarning = localizeOperationalMessage(
    retrievalWarning || '',
    preferredLanguage
  );
  const localizedSynthesisWarning = localizeOperationalMessage(
    synthesisWarning || '',
    preferredLanguage
  );
  const liveSummary = hasUsableMarketData(marketData.snapshot)
    ? buildMarketDataSummary(marketData, preferredLanguage)
    : '';
  const template = getFallbackResearchTemplate(
    watchEntities.join(' '),
    { primary_entities: watchEntities },
    preferredLanguage
  );

  if (briefingType === 'market-morning' && hasUsableMarketData(marketData.snapshot)) {
    return buildMarketMorningSignalBriefing({
      preferredLanguage,
      citations,
      marketData,
    });
  }

  if (template) {
    return buildTemplateBriefing(template, briefingType, watchEntities, preferredLanguage, {
      liveSummary: liveSummary || undefined,
      citations,
    });
  }

  const isEntityFocusedBriefing =
    briefingType !== 'market-morning' &&
    watchEntities.length > 0;

  if (isEntityFocusedBriefing && (citations.length > 0 || hasUsableMarketData(marketData.snapshot))) {
    return buildSignalDrivenBriefing({
      briefingType,
      watchEntities,
      preferredLanguage,
      citations,
      marketData,
    });
  }

  return buildFallbackBriefing({
    briefingType,
    watchEntities,
    preferredLanguage,
    retrievalSummary,
    citations,
    retrievalWarning: localizedRetrievalWarning,
    marketDataSummary: liveSummary || buildMarketDataSummary(marketData, preferredLanguage),
    synthesisWarning: localizedSynthesisWarning,
  });
}

async function translateBriefingIfNeeded(
  providerProfile: Awaited<ReturnType<typeof resolveProviderProfile>>,
  briefing: NormalizedBriefing,
  preferredLanguage: 'zh' | 'en',
  briefingType: string,
  watchEntities: string[]
) {
  if (preferredLanguage !== 'zh') {
    return briefing;
  }

  const sampleText = [
    briefing.title,
    briefing.summary,
    briefing.stance.summary,
    briefing.bullTheses[0]?.summary || '',
  ].join(' ');

  if (containsChinese(sampleText)) {
    return briefing;
  }

  const translated = await generateJson(providerProfile, {
    systemPrompt: [
      'Translate all values in the provided JSON into simplified Chinese.',
      'Keep the same JSON keys and array structure.',
      'Do not add or remove fields.',
      'Output JSON only.',
    ].join(' '),
    prompt: JSON.stringify({
      title: briefing.title,
      summary: briefing.summary,
      stance: briefing.stance,
      bull_theses: briefing.bullTheses,
      bear_theses: briefing.bearTheses,
      scenarios: briefing.scenarios,
      risks: briefing.risks,
    }),
    maxTokens: 1800,
  });

  return normalizeBriefing(translated, briefingType, watchEntities, preferredLanguage);
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

    if (!body?.briefing_type) {
      return jsonResponse({ error: 'briefing_type is required' }, 400);
    }

    const preferredLanguage = preferredLanguageFromBody(body);
    const watchEntities: string[] = Array.isArray(body.watch_entities) ? body.watch_entities : [];
    const providerRequest = body.provider_profile as ProviderProfileRequest | undefined;
    const providerProfile = await resolveProviderProfile(supabase, userId, providerRequest);
    const briefingType = String(body.briefing_type) as BriefingType;

    let retrievalMessage = '';
    let retrievalWarning = '';
    let retrievalCitations: CitationItem[] = [];
    let citations: CitationItem[] = [];

    try {
      const retrieval = await callPerplefina({
        focusMode:
          briefingType === 'market-morning'
            ? 'macroEconomy'
            : briefingType === 'company-one-pager'
              ? 'fundamentals'
              : 'news',
        query: inferBriefingQuery(briefingType, body.market_scope, watchEntities, preferredLanguage),
        optimizationMode: 'speed',
        maxSources: 4,
        chatModel: toPerplefinaChatModel(providerProfile),
        maxTokens: 900,
        timeoutMs: 20000,
        systemInstructions: [
          'Collect the latest, highest-signal evidence for an internal financial briefing.',
          'Prefer filings, exchange disclosures, earnings-call transcripts, and reputable financial media.',
          'Tier-3 community sources can only be supplemental context.',
        ].join(' '),
      });

      retrievalMessage = pickFirstString(retrieval?.message);
      retrievalCitations = filterRelevantSources(normalizeCitations(retrieval?.sources || []), {
        query: inferBriefingQuery(briefingType, body.market_scope, watchEntities, preferredLanguage),
        explicitEntities: watchEntities,
        maxItems: 6,
      }).sources;
      citations = retrievalCitations;
    } catch (error: any) {
      retrievalWarning = error?.message || 'Perplefina retrieval failed';
      console.warn('generate-briefing retrieval degraded:', retrievalWarning);
    }

    let marketData = {
      available: false,
      source: 'disabled',
      snapshot: null as Record<string, unknown> | null,
      error: 'market data not requested',
    };

    try {
      marketData = await withTimeout(
        fetchMarketDataSnapshot({
          marketScope: body.market_scope,
          entities: watchEntities.map((entity) => ({ name: entity })),
          query: inferBriefingQuery(briefingType, body.market_scope, watchEntities, preferredLanguage),
          preferredLanguage,
        }),
        9000,
        'market-data-adapter'
      );
    } catch (error: any) {
      marketData = {
        available: false,
        source: 'adapter',
        snapshot: null,
        error: error?.message || 'market data adapter timed out',
      };
    }

    const marketDataCitations = marketDataSnapshotToCitations(marketData.snapshot, 1) as CitationItem[];
    citations = mergeCitations(retrievalCitations, marketDataCitations, 6);
    const marketDataSummary = buildMarketDataSummary(marketData, preferredLanguage);

    let normalizedBriefing: NormalizedBriefing;
    let synthesisWarning = '';
    const isEntityFocusedBriefing =
      briefingType !== 'market-morning' &&
      watchEntities.length > 0;

    if (isEntityFocusedBriefing && retrievalCitations.length > 0) {
      const entityGate = gateEntityFocusedCitations(retrievalCitations, watchEntities);

      if (entityGate.removedForMismatch) {
        retrievalCitations = [];
        citations = mergeCitations(retrievalCitations, marketDataCitations, 6);
        retrievalMessage = '';
        retrievalWarning =
          preferredLanguage === 'zh'
            ? '检索结果与目标标的明显不匹配，已直接输出降级版简报'
            : 'Retrieved sources were clearly mismatched to the requested entity, emitted fallback briefing directly';
      } else {
        retrievalCitations = entityGate.citations;
        citations = mergeCitations(retrievalCitations, marketDataCitations, 6);
      }
    }

    const retrievalLooksOffTopic =
      isEntityFocusedBriefing &&
      summaryShowsSourceMismatch(retrievalMessage);

    if (retrievalLooksOffTopic) {
      retrievalCitations = [];
      citations = mergeCitations(retrievalCitations, marketDataCitations, 6);
      retrievalMessage = '';
      if (!retrievalWarning) {
        retrievalWarning =
          preferredLanguage === 'zh'
            ? '检索结果与目标标的明显不匹配，已切换为内置数据优先'
            : 'Retrieved sources were mismatched to the requested entity, switched to built-in data first';
      }
    }

    const hasFallbackData = hasUsableMarketData(marketData.snapshot);

    const shouldSkipSynthesis =
      ((!retrievalMessage && citations.length === 0 && !hasFallbackData && !marketData.available) ||
      ((retrievalLooksOffTopic || Boolean(retrievalWarning) || isEntityFocusedBriefing) &&
        citations.length === 0 &&
        !hasFallbackData &&
        !marketData.available));

    const citationDigest = citations.slice(0, 6).map((item) => ({
      source_index: item.source_index,
      title: item.title,
      publisher: item.publisher,
      url: item.url,
      source_tier: item.source_tier,
    }));

    if (shouldSkipSynthesis) {
      synthesisWarning =
        preferredLanguage === 'zh'
          ? '实时证据链路不可用，已直接输出降级版简报'
          : 'Real-time evidence chain unavailable, emitted fallback briefing directly';
      if ((isEntityFocusedBriefing || retrievalLooksOffTopic) && !retrievalWarning) {
        retrievalWarning =
          retrievalLooksOffTopic
            ? preferredLanguage === 'zh'
              ? '检索结果与目标标的明显不匹配，已直接输出降级版简报'
              : 'Retrieved sources were clearly mismatched to the requested entity, emitted fallback briefing directly'
            : preferredLanguage === 'zh'
              ? '未检索到足够相关的高质量来源，已直接输出降级版简报'
              : 'No sufficiently relevant high-signal sources were retrieved, emitted fallback briefing directly';
        retrievalMessage = '';
        citations = mergeCitations([], marketDataCitations, 6);
      }
      normalizedBriefing = buildBestEffortBriefing({
        briefingType,
        watchEntities,
        preferredLanguage,
        citations,
        marketData,
        retrievalSummary: retrievalMessage,
        retrievalWarning,
        synthesisWarning,
      });
    } else {
      try {
        const briefingRaw = await withTimeout(
          generateJson(providerProfile, {
            systemPrompt: [
              'You write internal investment research briefings.',
              'Return JSON only with keys: title, summary, stance, bull_theses, bear_theses, scenarios, risks.',
              'stance must include label, confidence, summary.',
              'Each bull_theses and bear_theses item must include title, summary, evidence.',
              'Each scenario item must include name, probability, description, signals.',
              'Each risk item must include title, impact, description.',
              'If the preferred language is Simplified Chinese, every value must be in Simplified Chinese.',
              'Do not provide personalized buy/sell instructions, position sizing, stop losses, take profits, or return promises.',
              'If real-time retrieval is degraded, explicitly acknowledge the evidence gap instead of inventing facts.',
            ].join(' '),
            prompt: [
              `briefing_type: ${briefingType}`,
              `preferred_language: ${preferredLanguage === 'zh' ? 'Simplified Chinese' : 'English'}`,
              `market_scope: ${body.market_scope || 'multi-market'}`,
              `watch_entities: ${JSON.stringify(watchEntities)}`,
              `style_profile: ${JSON.stringify(body.style_profile || {})}`,
              `retrieval_summary: ${retrievalMessage || (preferredLanguage === 'zh' ? '实时检索暂不可用。' : 'Real-time retrieval is unavailable.')}`,
              `retrieval_warning: ${retrievalWarning || 'none'}`,
              `market_data_summary: ${marketDataSummary}`,
              `citations: ${JSON.stringify(citationDigest)}`,
            ].join('\n'),
            maxTokens: 1600,
          }),
          18000,
          'briefing-synthesis'
        );

        normalizedBriefing = normalizeBriefing(briefingRaw, briefingType, watchEntities, preferredLanguage);

        if (
          normalizedBriefing.bullTheses.length === 0 &&
          normalizedBriefing.bearTheses.length === 0 &&
          normalizedBriefing.risks.length === 0
        ) {
          throw new Error('briefing synthesis returned an empty structure');
        }

        try {
          normalizedBriefing = await translateBriefingIfNeeded(
            providerProfile,
            normalizedBriefing,
            preferredLanguage,
            briefingType,
            watchEntities
          );
        } catch (translationError: any) {
          console.warn('generate-briefing translation skipped:', translationError?.message || translationError);
        }
      } catch (error: any) {
        synthesisWarning = error?.message || 'briefing synthesis failed';
        console.warn('generate-briefing synthesis degraded:', synthesisWarning);
        normalizedBriefing = buildBestEffortBriefing({
          briefingType,
          watchEntities,
          preferredLanguage,
          citations,
          marketData,
          retrievalSummary: retrievalMessage,
          retrievalWarning,
          synthesisWarning,
        });
      }
    }

    if (retrievalWarning) {
      retrievalWarning = localizeOperationalMessage(retrievalWarning, preferredLanguage);
    }
    if (synthesisWarning) {
      synthesisWarning = localizeOperationalMessage(synthesisWarning, preferredLanguage);
    }

    const complianceFlags = ['research_only'];
    if (retrievalWarning) {
      complianceFlags.push('retrieval_degraded');
    }
    if (!marketData.available) {
      complianceFlags.push('market_data_unavailable');
    }
    if (synthesisWarning) {
      complianceFlags.push('briefing_synthesis_degraded');
    }

    const answer = buildBriefingMarkdown({
      title: normalizedBriefing.title,
      summary: normalizedBriefing.summary,
      stance: normalizedBriefing.stance,
      bullTheses: normalizedBriefing.bullTheses,
      bearTheses: normalizedBriefing.bearTheses,
      risks: normalizedBriefing.risks,
      scenarios: normalizedBriefing.scenarios,
      citations: citations.map((item) => ({
        title: item.title,
        publisher: item.publisher,
        source_index: item.source_index,
      })),
      preferredLanguage,
    });

    const { data: briefingRow, error: briefingError } = await supabase
      .from('briefings')
      .insert({
        user_id: userId,
        briefing_type: briefingType,
        market_scope: body.market_scope || 'multi-market',
        watch_entities: watchEntities,
        style_profile: body.style_profile || {},
        title: normalizedBriefing.title,
        summary: normalizedBriefing.summary,
        content: answer,
        stance: normalizedBriefing.stance,
        theses: {
          bull: normalizedBriefing.bullTheses,
          bear: normalizedBriefing.bearTheses,
        },
        scenarios: normalizedBriefing.scenarios,
        risks: normalizedBriefing.risks,
        compliance_flags: complianceFlags,
        provider_snapshot: providerSnapshot(providerProfile),
      })
      .select()
      .single();

    if (briefingError) {
      throw new Error(`Failed to save briefing: ${briefingError.message}`);
    }

    if (citations.length > 0) {
      await supabase.from('citations').insert(
        citations.map((citation) => ({
          user_id: userId,
          briefing_id: briefingRow.id,
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

    return jsonResponse({
      success: true,
      briefing: briefingRow,
      answer,
      stance: normalizedBriefing.stance,
      theses: {
        bull: normalizedBriefing.bullTheses,
        bear: normalizedBriefing.bearTheses,
      },
      scenarios: normalizedBriefing.scenarios,
      risks: normalizedBriefing.risks,
      citations,
      compliance_flags: complianceFlags,
      warnings: {
        retrieval: retrievalWarning || null,
        synthesis: synthesisWarning || null,
        market_data: marketData.available ? null : marketData.error || null,
      },
    });
  } catch (error: any) {
    console.error('generate-briefing error:', error);
    return jsonResponse({ error: error?.message || 'Unknown error' }, 500);
  }
});
