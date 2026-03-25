import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { callPerplefina } from './perplefinaClient.ts';
import {
  ProviderProfileRequest,
  generateJson,
  providerSnapshot,
  resolveProviderProfile,
  toPerplefinaChatModel,
} from './providerProfiles.ts';
import {
  fetchMarketDataSnapshot,
  hasUsableMarketData,
  marketDataSnapshotToCitations,
} from './marketDataAdapter.ts';
import { filterRelevantSources } from './sourceRelevance.ts';
import { getFallbackResearchTemplate } from './fallbackResearchTemplates.ts';

interface ResearchLog {
  agent_name: string;
  message: string;
  message_type?: string;
  metadata?: Record<string, any>;
}

export interface CitationItem {
  title: string;
  url: string;
  publisher: string;
  snippet: string;
  source_tier: 1 | 2 | 3;
  source_type: 'filing' | 'media' | 'community' | 'market-data' | 'other';
  source_index: number;
}

interface ThesisPoint {
  title: string;
  summary: string;
  evidence: string[];
}

interface ScenarioPoint {
  name: string;
  probability: 'low' | 'medium' | 'high';
  description: string;
  signals: string[];
}

interface RiskPoint {
  title: string;
  impact: 'low' | 'medium' | 'high';
  description: string;
}

interface StructuredResearchResult {
  answer: string;
  stance: {
    label: string;
    confidence: 'low' | 'medium' | 'high';
    summary: string;
  };
  theses: {
    bull: ThesisPoint[];
    bear: ThesisPoint[];
  };
  scenarios: ScenarioPoint[];
  risks: RiskPoint[];
  citations: CitationItem[];
  compliance_flags: string[];
}

export interface OrchestratedResearchResult {
  result: StructuredResearchResult;
  citations: CitationItem[];
  logs: ResearchLog[];
  classifier: Record<string, any>;
  providerSnapshot: Record<string, any>;
  marketData: Record<string, any> | null;
}

const PERSONAL_ADVICE_PATTERNS = [
  /仓位/,
  /怎么买/,
  /买多少/,
  /止盈/,
  /止损/,
  /收益保证/,
  /胜率/,
  /自动调仓/,
  /自动再平衡/,
  /个性化/,
  /\bposition size\b/i,
  /\bstop loss\b/i,
  /\btake profit\b/i,
  /\bhow much should i buy\b/i,
];

const FINANCE_DOMAIN_PATTERNS = [
  /股票/,
  /美股/,
  /港股/,
  /a股/i,
  /基金/,
  /债券/,
  /期货/,
  /期权/,
  /财报/,
  /业绩/,
  /估值/,
  /市值/,
  /营收/,
  /利润/,
  /毛利/,
  /净利/,
  /回购/,
  /分红/,
  /宏观/,
  /利率/,
  /通胀/,
  /cpi/i,
  /ppi/i,
  /pmi/i,
  /fed/i,
  /ecb/i,
  /ipo/i,
  /etf/i,
  /\bstock\b/i,
  /\bequity\b/i,
  /\bfund\b/i,
  /\bbond\b/i,
  /\bearnings\b/i,
  /\brevenue\b/i,
  /\bmargin\b/i,
  /\bvaluation\b/i,
  /\bbuyback\b/i,
  /\bmacro\b/i,
  /\bticker\b/i,
];

const CLEARLY_OFF_TOPIC_PATTERNS = [
  /吃饭/,
  /陪我/,
  /约会/,
  /旅游/,
  /天气/,
  /写诗/,
  /讲笑话/,
  /翻译/,
  /数学/,
  /方程/,
  /乘法/,
  /加法/,
  /减法/,
  /微积分/,
  /\d+\s*[\*xX×]\s*\d+/,
  /\d+\s*[+\-]\s*\d+/,
  /\bmath\b/i,
  /\bcalculate\b/i,
  /\bdinner\b/i,
  /\beat with me\b/i,
  /\bdate\b/i,
  /\bweather\b/i,
  /\btravel\b/i,
];

function addLog(
  logs: ResearchLog[],
  agent_name: string,
  message: string,
  metadata?: Record<string, any>
) {
  logs.push({
    agent_name,
    message,
    message_type: 'analysis',
    metadata,
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

function coerceArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function containsChinese(text: string) {
  return /[\u3400-\u9fff]/.test(text);
}

function detectComplianceFlags(query: string): string[] {
  return PERSONAL_ADVICE_PATTERNS
    .filter((pattern) => pattern.test(query))
    .map(() => 'personalized_advice_blocked');
}

function looksLikeFinanceScopedQuery(
  query: string,
  classifier: Record<string, any>,
  entityContext?: Record<string, any>
) {
  if (FINANCE_DOMAIN_PATTERNS.some((pattern) => pattern.test(query))) {
    return true;
  }

  if (/\b[A-Z]{1,5}(?:\.[A-Z]{2,4})?\b/.test(query)) {
    return true;
  }

  const primaryEntities = [
    ...coerceArray<string>(classifier?.primary_entities || []),
    ...coerceArray<string>(entityContext?.entities || []),
  ].filter((value) => String(value || '').trim().length > 0);

  if (primaryEntities.length > 0) {
    return true;
  }

  if (CLEARLY_OFF_TOPIC_PATTERNS.some((pattern) => pattern.test(query))) {
    return false;
  }

  const queryType = String(classifier?.query_type || '').toLowerCase();
  return (
    queryType.includes('macro') ||
    queryType.includes('earnings') ||
    queryType.includes('equity') ||
    queryType.includes('fundamental') ||
    queryType.includes('company') ||
    queryType.includes('investment') ||
    queryType.includes('thesis')
  );
}

function inferPublisher(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown-source';
  }
}

function inferSourceTier(url: string): 1 | 2 | 3 {
  const hostname = inferPublisher(url);

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
    hostname.includes('cnbc.com')
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

function normalizeCitations(sources: any[] = []): CitationItem[] {
  return sources.slice(0, 8).map((source, index) => ({
    title: source?.metadata?.title || `来源 ${index + 1}`,
    url: source?.metadata?.url || '',
    publisher: inferPublisher(source?.metadata?.url || ''),
    snippet: String(source?.pageContent || '').slice(0, 400),
    source_tier: inferSourceTier(source?.metadata?.url || ''),
    source_type: inferSourceType(source?.metadata?.url || ''),
    source_index: index + 1,
  }));
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

function buildMarketDataEvidenceSummary(
  marketDataSnapshot: Record<string, any> | null,
  preferredLanguage: 'zh' | 'en'
) {
  if (!marketDataSnapshot) {
    return '';
  }

  const entities = Array.isArray(marketDataSnapshot.entities)
    ? (() => {
        const preferredEntities = marketDataSnapshot.entities.filter(
          (item: Record<string, any>) => String(item?.market || '').toUpperCase() !== 'INDEX'
        );
        return (preferredEntities.length > 0 ? preferredEntities : marketDataSnapshot.entities).slice(0, 3);
      })()
    : [];
  const news = Array.isArray(marketDataSnapshot.news)
    ? marketDataSnapshot.news.slice(0, 3)
    : [];

  const quoteSummary = entities
    .map((item) => {
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
    .map((item) =>
      preferredLanguage === 'zh'
        ? `[${item.publisher || 'Google News'}] ${item.title}`
        : `[${item.publisher || 'Google News'}] ${item.title}`
    )
    .join(preferredLanguage === 'zh' ? '；' : '; ');

  if (!quoteSummary && !newsSummary) {
    return '';
  }

  if (preferredLanguage === 'zh') {
    return [quoteSummary, newsSummary ? `最新新闻：${newsSummary}` : ''].filter(Boolean).join('。');
  }

  return [quoteSummary, newsSummary ? `Latest news: ${newsSummary}` : '']
    .filter(Boolean)
    .join('. ');
}

function normalizeFallbackSummary(
  retrievalSummary: string,
  preferredLanguage: 'zh' | 'en',
  query: string
) {
  const trimmed = retrievalSummary.trim().replace(/\s+/g, ' ');

  if (!trimmed) {
    return preferredLanguage === 'en'
      ? `The latest evidence retrieval for "${query}" completed, but the final synthesis step timed out.`
      : `关于“${query}”的最新证据检索已经完成，但最终综合环节超时了。`;
  }

  if (preferredLanguage === 'zh' && !containsChinese(trimmed)) {
    return '系统已拿到部分英文证据摘要，但当前中文综合环节未完成。请先参考下方来源，并稍后重试获取完整中文 thesis。';
  }

  return trimmed.slice(0, 500);
}

function retrievalSummaryLooksOffTopic(summary: string) {
  const text = summary.trim();
  if (!text) {
    return false;
  }

  return (
    /\bno (?:directly )?relevant\b/i.test(text) ||
    /\bnone of (?:the )?sources\b/i.test(text) ||
    /\bcannot (?:responsibly )?(?:answer|provide|generate)\b/i.test(text) ||
    /\bthe sources? (?:are|were) (?:off-topic|unrelated)\b/i.test(text) ||
    /没有任何合格/.test(text) ||
    /证据不足/.test(text) ||
    /与.*无关/.test(text) ||
    /无法负责地给出/.test(text) ||
    /给的.*来源/.test(text)
  );
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

function focusModeFromClassifier(classifier: Record<string, any>): 'news' | 'social' | 'fundamentals' | 'macroEconomy' {
  const queryType = String(classifier.query_type || '').toLowerCase();

  if (queryType.includes('macro')) {
    return 'macroEconomy';
  }

  if (queryType.includes('social') || queryType.includes('sentiment')) {
    return 'social';
  }

  if (
    queryType.includes('fundamental') ||
    queryType.includes('earnings') ||
    queryType.includes('company') ||
    queryType.includes('equity') ||
    queryType.includes('investment') ||
    queryType.includes('thesis')
  ) {
    return 'fundamentals';
  }

  return 'news';
}

function buildRetrievalPrompt(
  query: string,
  classifier: Record<string, any>,
  marketScope?: string
) {
  const primaryEntities = coerceArray<string>(classifier?.primary_entities || []).filter(Boolean);
  const isEntitySpecific = primaryEntities.length > 0 && !String(classifier?.query_type || '').toLowerCase().includes('macro');

  return [
    'Generate a high-signal financial research pack with the latest evidence.',
    `User question: ${query}`,
    isEntitySpecific
      ? `Primary entities: ${primaryEntities.join(', ')}`
      : `Market scope: ${marketScope || classifier.market_scope || 'multi-market'}`,
    isEntitySpecific
      ? 'This is entity-specific research. Only keep sources directly about the named entity or its listed aliases/tickers.'
      : 'This is a market-level research request. Prefer directly relevant cross-asset and macro sources.',
    'Prioritize tier-1 and tier-2 sources. Tier-3 sources can only be supporting context.',
    'Capture clear evidence for both bull and bear theses.',
    'If sources are off-topic, prefer returning no useful evidence over generic or dictionary-style pages.',
  ].join('\n');
}

function fallbackClassifier(query: string, marketScope?: string, entityContext?: Record<string, any>) {
  return {
    query_type: /宏观|cpi|fed|利率|macro/i.test(query) ? 'macro' : 'company_research',
    market_scope: marketScope || 'multi-market',
    primary_entities: entityContext?.entities || [],
    needs_structured_data: /估值|财报|revenue|margin|valuation/i.test(query),
    needs_latest_information: true,
  };
}

function normalizeTheses(items: unknown[]): ThesisPoint[] {
  return coerceArray(items)
    .map((item, index) => {
      if (typeof item === 'string') {
        return {
          title: `要点 ${index + 1}`,
          summary: item,
          evidence: [],
        };
      }

      if (!item || typeof item !== 'object') {
        return null;
      }

      return {
        title: pickFirstString(
          (item as any).title,
          (item as any).name,
          (item as any).thesis,
          `要点 ${index + 1}`
        ),
        summary: pickFirstString(
          (item as any).summary,
          (item as any).description,
          (item as any).detail,
          (item as any).content
        ) || pickFirstString((item as any).title, (item as any).name, `要点 ${index + 1}`),
        evidence: coerceArray<string>((item as any).evidence).filter(Boolean),
      };
    })
    .filter(Boolean) as ThesisPoint[];
}

function normalizeScenarios(items: unknown[]): ScenarioPoint[] {
  return coerceArray(items)
    .map((item, index) => {
      if (typeof item === 'string') {
        return {
          name: `情景 ${index + 1}`,
          probability: 'medium',
          description: item,
          signals: [],
        };
      }

      if (!item || typeof item !== 'object') {
        return null;
      }

      return {
        name: pickFirstString((item as any).name, (item as any).title, `情景 ${index + 1}`),
        probability: ['low', 'medium', 'high'].includes(String((item as any).probability))
          ? (item as any).probability
          : 'medium',
        description: pickFirstString(
          (item as any).description,
          (item as any).summary,
          (item as any).detail,
          (item as any).content
        ) || pickFirstString((item as any).name, (item as any).title, `情景 ${index + 1}`),
        signals: coerceArray<string>((item as any).signals).filter(Boolean),
      };
    })
    .filter(Boolean) as ScenarioPoint[];
}

function normalizeRisks(items: unknown[]): RiskPoint[] {
  return coerceArray(items)
    .map((item, index) => {
      if (typeof item === 'string') {
        return {
          title: `风险 ${index + 1}`,
          impact: 'medium',
          description: item,
        };
      }

      if (!item || typeof item !== 'object') {
        return null;
      }

      return {
        title: pickFirstString((item as any).title, (item as any).name, `风险 ${index + 1}`),
        impact: ['low', 'medium', 'high'].includes(String((item as any).impact))
          ? (item as any).impact
          : 'medium',
        description: pickFirstString(
          (item as any).description,
          (item as any).summary,
          (item as any).detail,
          (item as any).content
        ) || pickFirstString((item as any).title, (item as any).name, `风险 ${index + 1}`),
      };
    })
    .filter(Boolean) as RiskPoint[];
}

function normalizeStance(input: any) {
  if (typeof input === 'string') {
    return {
      label: '研究结论',
      confidence: 'medium' as const,
      summary: input,
    };
  }

  return {
    label: pickFirstString(input?.label, input?.stance, '研究结论'),
    confidence: ['low', 'medium', 'high'].includes(String(input?.confidence))
      ? input.confidence
      : 'medium',
    summary: pickFirstString(input?.summary, input?.description, '暂无明确立场。'),
  } as StructuredResearchResult['stance'];
}

function renderResearchAnswer(
  result: Omit<StructuredResearchResult, 'answer'>,
  preferredLanguage: 'zh' | 'en'
) {
  const bullTheses = result.theses.bull.slice(0, 2);
  const bearTheses = result.theses.bear.slice(0, 2);
  const risks = result.risks.slice(0, 2);
  const scenarios = result.scenarios.slice(0, 2);
  const citations = result.citations.slice(0, 4);

  if (preferredLanguage === 'en') {
    const disclaimer = result.compliance_flags.includes('personalized_advice_blocked')
      ? 'This answer is research-only and does not provide personalized buy/sell advice, position sizing, stop loss, take profit, or return promises.'
      : 'This answer is for research discussion only and does not constitute investment advice.';

    return [
      '## Stance',
      `**${result.stance.label}**`,
      result.stance.summary,
      '',
      '## Bull Thesis',
      ...(bullTheses.length > 0
        ? bullTheses.map((item, index) => `${index + 1}. ${item.title}: ${item.summary}`)
        : ['No clear bull thesis yet.']),
      '',
      '## Bear Thesis',
      ...(bearTheses.length > 0
        ? bearTheses.map((item, index) => `${index + 1}. ${item.title}: ${item.summary}`)
        : ['No clear bear thesis yet.']),
      '',
      '## Risks',
      ...(risks.length > 0
        ? risks.map((item, index) => `${index + 1}. ${item.title}: ${item.description}`)
        : ['No additional risks identified.']),
      '',
      '## Scenarios',
      ...(scenarios.length > 0
        ? scenarios.map((item, index) => `${index + 1}. ${item.name}: ${item.description}`)
        : ['No scenario analysis available.']),
      '',
      '## Sources',
      ...(citations.length > 0
        ? citations.map((item) => `[${item.source_index}] ${item.title} - ${item.publisher}`)
        : ['No displayable sources available.']),
      '',
      '## Disclaimer',
      disclaimer,
    ].join('\n');
  }

  const disclaimer = result.compliance_flags.includes('personalized_advice_blocked')
    ? '本回答仅提供研究观点与论证，不构成个性化买卖建议、仓位建议、止盈止损或收益承诺。'
    : '本回答仅用于研究与讨论，不构成投资建议。';

  return [
    '## 结论立场',
    `**${result.stance.label}**`,
    result.stance.summary,
    '',
    '## 核心 Thesis',
    ...(bullTheses.length > 0
      ? bullTheses.map((item, index) => `${index + 1}. ${item.title}：${item.summary}`)
      : ['暂无核心 thesis。']),
    '',
    '## 反方 Thesis',
    ...(bearTheses.length > 0
      ? bearTheses.map((item, index) => `${index + 1}. ${item.title}：${item.summary}`)
      : ['暂无反方 thesis。']),
    '',
    '## 风险点',
    ...(risks.length > 0
      ? risks.map((item, index) => `${index + 1}. ${item.title}：${item.description}`)
      : ['暂无额外风险点。']),
    '',
    '## 情景分析',
    ...(scenarios.length > 0
      ? scenarios.map((item, index) => `${index + 1}. ${item.name}：${item.description}`)
      : ['暂无情景分析。']),
    '',
    '## 来源',
    ...(citations.length > 0
      ? citations.map((item) => `[${item.source_index}] ${item.title} - ${item.publisher}`)
      : ['暂无引用来源。']),
    '',
    '## 免责声明',
    disclaimer,
  ].join('\n');
}

function buildComplianceOnlyResult(
  query: string,
  preferredLanguage: 'zh' | 'en'
): StructuredResearchResult {
  const result: Omit<StructuredResearchResult, 'answer'> =
    preferredLanguage === 'en'
      ? {
          stance: {
            label: 'Research-only',
            confidence: 'high',
            summary:
              `Your request asks for personalized trading execution or sizing. I cannot provide direct account-level instructions, but I can convert it into a research question. Original request: ${query}`,
          },
          theses: {
            bull: [
              {
                title: 'Rewrite as a research question',
                summary:
                  'Turn "What should I buy and how much?" into "What is the strongest long thesis for this company right now?"',
                evidence: [],
              },
            ],
            bear: [
              {
                title: 'Avoid false certainty',
                summary:
                  'Personalized sizing, stop loss, and return promises can create misleading certainty and compliance risk.',
                evidence: [],
              },
            ],
          },
          scenarios: [
            {
              name: 'Continue the research',
              probability: 'high',
              description:
                'Specify the company, time frame, and thesis you want to test, then convert it into a research-style question.',
              signals: [],
            },
          ],
          risks: [
            {
              title: 'Personalized advice risk',
              impact: 'high',
              description:
                'The same conclusion may not fit different account sizes, holdings, liquidity needs, or risk tolerance.',
            },
          ],
          citations: [],
          compliance_flags: ['personalized_advice_blocked'],
        }
      : {
          stance: {
            label: '仅限研究',
            confidence: 'high',
            summary:
              `你的问题涉及个性化买卖、仓位或风控执行，我不能直接给出针对个人账户的操作指令，但我可以帮你把它改写成研究问题。原始问题：${query}`,
          },
          theses: {
            bull: [
              {
                title: '改写成研究问题',
                summary: '把“我该怎么买、买多少”改写成“这家公司当前最强的多头逻辑是什么”。',
                evidence: [],
              },
            ],
            bear: [
              {
                title: '避免伪确定性',
                summary: '个性化仓位、止盈止损和收益承诺会制造不合规且误导性的确定性。',
                evidence: [],
              },
            ],
          },
          scenarios: [
            {
              name: '继续研究',
              probability: 'high',
              description:
                '明确标的、时间框架和你想验证的 thesis，再用研究型问法继续提问。',
              signals: [],
            },
          ],
          risks: [
            {
              title: '个性化建议风险',
              impact: 'high',
              description: '同一结论对不同资金规模、持仓结构和风险承受能力未必适用。',
            },
          ],
          citations: [],
          compliance_flags: ['personalized_advice_blocked'],
        };

  return {
    ...result,
    answer: renderResearchAnswer(result, preferredLanguage),
  };
}

function buildOutOfScopeResult(
  query: string,
  preferredLanguage: 'zh' | 'en'
): StructuredResearchResult {
  const result: Omit<StructuredResearchResult, 'answer'> =
    preferredLanguage === 'en'
      ? {
          stance: {
            label: 'Finance-only',
            confidence: 'high',
            summary:
              'I only handle finance, stocks, funds, earnings, macro, and market-research requests. I will not answer social, lifestyle, or general math questions here.',
          },
          theses: {
            bull: [
              {
                title: 'Ask a finance-scoped question instead',
                summary:
                  'Example: "What is the strongest bull/bear thesis on Tencent right now?" or "Give me a concise morning brief on US/HK/CN markets."',
                evidence: [],
              },
            ],
            bear: [],
          },
          scenarios: [],
          risks: [],
          citations: [],
          compliance_flags: ['out_of_scope'],
        }
      : {
          stance: {
            label: '仅限金融研究',
            confidence: 'high',
            summary:
              '我只处理金融、股票、基金、财报、宏观和市场研究问题。像社交陪同、日常生活或普通数学题这类请求，我不在这个模式下回答。',
          },
          theses: {
            bull: [
              {
                title: '请改成金融研究问法',
                summary:
                  '例如：“你怎么看腾讯当前的多空逻辑？”、“给我一份美股/港股/A股晨报”、“分析宁德时代最新财报影响”。',
                evidence: [],
              },
            ],
            bear: [],
          },
          scenarios: [],
          risks: [],
          citations: [],
          compliance_flags: ['out_of_scope'],
        };

  return {
    ...result,
    answer:
      preferredLanguage === 'en'
        ? `I only answer finance and market-research questions here. I will not handle "${query}" in this mode.`
        : `我这里只回答金融与市场研究问题，不处理“${query}”这类非金融请求。`,
  };
}

function buildEvidenceFallbackResult(
  query: string,
  retrievalSummary: string,
  citations: CitationItem[],
  complianceFlags: string[],
  preferredLanguage: 'zh' | 'en'
): StructuredResearchResult {
  const summary = normalizeFallbackSummary(retrievalSummary, preferredLanguage, query);

  const result: Omit<StructuredResearchResult, 'answer'> =
    preferredLanguage === 'en'
      ? {
          stance: {
            label: 'Preliminary',
            confidence: 'low',
            summary:
              'Fresh evidence was collected, but the final thesis synthesis timed out. Treat this as a preliminary research pack and retry if you want a fuller long/short view.',
          },
          theses: {
            bull: [
              {
                title: 'Fresh evidence pack',
                summary,
                evidence: citations.slice(0, 3).map((citation) => citation.title),
              },
            ],
            bear: [
              {
                title: 'Why this is not final yet',
                summary:
                  'The orchestration timed out during synthesis, so the system is returning evidence-first output instead of a fully expanded thesis set.',
                evidence: [],
              },
            ],
          },
          scenarios: [
            {
              name: 'Retry the same question',
              probability: 'high',
              description:
                'A retry often succeeds once retrieval is warm and provider latency is lower.',
              signals: [],
            },
          ],
          risks: [
            {
              title: 'Incomplete synthesis',
              impact: 'high',
              description:
                'This fallback output may understate the strongest bull or bear counterarguments.',
            },
          ],
          citations,
          compliance_flags: complianceFlags,
        }
      : {
          stance: {
            label: '初步观点',
            confidence: 'low',
            summary:
              '系统已经收集到最新证据，但最终 thesis 综合环节超时了。当前结果可作为初步研究包，若想得到更完整的多空观点，建议稍后重试。',
          },
          theses: {
            bull: [
              {
                title: '最新证据包',
                summary,
                evidence: citations.slice(0, 3).map((citation) => citation.title),
              },
            ],
            bear: [
              {
                title: '为什么它还不是最终结论',
                summary:
                  '本次编排在综合阶段超时，所以系统返回的是证据优先版本，而不是完整展开的 thesis 套件。',
                evidence: [],
              },
            ],
          },
          scenarios: [
            {
              name: '重试同一个问题',
              probability: 'high',
              description: '检索预热后、模型延迟下降时，重试往往能拿到更完整的最终观点。',
              signals: [],
            },
          ],
          risks: [
            {
              title: '综合不完整',
              impact: 'high',
              description: '这份 fallback 结果偏证据包展示，可能低估了最强的多头或空头反论点。',
            },
          ],
          citations,
          compliance_flags: complianceFlags,
        };

  return {
    ...result,
    answer: renderResearchAnswer(result, preferredLanguage),
  };
}

function buildInsufficientEvidenceResult(
  query: string,
  citations: CitationItem[],
  complianceFlags: string[],
  preferredLanguage: 'zh' | 'en'
): StructuredResearchResult {
  const result: Omit<StructuredResearchResult, 'answer'> =
    preferredLanguage === 'en'
      ? {
          stance: {
            label: 'Insufficient evidence',
            confidence: 'low',
            summary:
              `I did not retrieve enough directly relevant, high-signal evidence for "${query}", so I cannot responsibly force a long/short research view yet.`,
          },
          theses: {
            bull: [
              {
                title: 'What is missing',
                summary:
                  'A responsible answer still needs directly relevant filings, earnings-call material, exchange disclosures, or high-quality financial media coverage tied to the entity or topic.',
                evidence: citations.slice(0, 3).map((citation) => citation.title),
              },
            ],
            bear: [
              {
                title: 'Why I am not forcing a thesis',
                summary:
                  'If the evidence pack is off-topic or too weak, inventing a strong stance would create false confidence and degrade research quality.',
                evidence: [],
              },
            ],
          },
          scenarios: [
            {
              name: 'Refresh with better sources',
              probability: 'high',
              description:
                'Retry after retrieval warms up or after stronger tier-1/tier-2 sources become available.',
              signals: [],
            },
          ],
          risks: [
            {
              title: 'Evidence-quality risk',
              impact: 'high',
              description:
                'Weak or irrelevant sources can push the system into confident-sounding but unsupported conclusions.',
            },
          ],
          citations,
          compliance_flags: complianceFlags,
        }
      : {
          stance: {
            label: '证据不足',
            confidence: 'low',
            summary:
              `当前没有检索到与“${query}”直接相关、且足够高质量的最新证据，所以我不能负责任地强行给出明确多空结论。`,
          },
          theses: {
            bull: [
              {
                title: '还缺什么材料',
                summary:
                  '至少还需要更直接相关的公告、财报电话会、交易所披露或高质量财经媒体报道，才能支撑像样的 thesis。',
                evidence: citations.slice(0, 3).map((citation) => citation.title),
              },
            ],
            bear: [
              {
                title: '为什么我不硬写观点',
                summary:
                  '如果证据包本身跑偏了，硬凑“强观点”只会制造伪确定性，反而会把研究质量拉低。',
                evidence: [],
              },
            ],
          },
          scenarios: [
            {
              name: '补到高质量来源后重试',
              probability: 'high',
              description: '等检索链路拿到更像样的一二级来源后，再生成完整的多空 thesis 会更稳。',
              signals: [],
            },
          ],
          risks: [
            {
              title: '证据质量风险',
              impact: 'high',
              description: '无关来源或低质量来源会把系统推向“说了很多，但并不成立”的假研究结果。',
            },
          ],
          citations,
          compliance_flags: complianceFlags,
        };

  return {
    ...result,
    answer: renderResearchAnswer(result, preferredLanguage),
  };
}

function buildTemplateFallbackResult(
  template: NonNullable<ReturnType<typeof getFallbackResearchTemplate>>,
  complianceFlags: string[],
  preferredLanguage: 'zh' | 'en',
  options?: {
    citations?: CitationItem[];
    liveSummary?: string;
  }
): StructuredResearchResult {
  const result: Omit<StructuredResearchResult, 'answer'> = {
    stance: template.stance,
    theses: {
      bull: template.bull.map((item) => ({
        title: item.title,
        summary: item.summary,
        evidence: [],
      })),
      bear: template.bear.map((item) => ({
        title: item.title,
        summary: item.summary,
        evidence: [],
      })),
    },
    scenarios: template.scenarios.map((item) => ({
      name: item.name,
      probability: item.probability,
      description: item.description,
      signals: [],
    })),
    risks: template.risks,
    citations: options?.citations || [],
    compliance_flags: complianceFlags,
  };

  if (options?.liveSummary) {
    result.theses.bull.unshift({
      title: preferredLanguage === 'zh' ? '最新价格与新闻线索' : 'Latest Price and News',
      summary: options.liveSummary,
      evidence: (options.citations || []).slice(0, 3).map((citation) => citation.title),
    });
  }

  const baseStanceSummary =
    options?.liveSummary
      ? preferredLanguage === 'zh'
        ? result.stance.summary.replace(/^这是一份非实时兜底观点。/, '')
        : result.stance.summary.replace(/^This is a non-live fallback view\.\s*/i, '')
      : result.stance.summary;

  result.stance.summary =
    options?.liveSummary
      ? preferredLanguage === 'zh'
        ? `以下为模板化研究观点，已附带本轮最新价格与新闻线索，但核心 thesis 仍需更多高质量来源继续验证。${baseStanceSummary}`
        : `The following is a template research view supplemented with live price and headline signals from this run, but the core thesis still needs stronger source validation. ${baseStanceSummary}`
      : preferredLanguage === 'zh'
        ? `以下为模板化兜底观点，便于继续讨论，但仍需等待最新来源验证。${baseStanceSummary}`
        : `The following is a template fallback view for discussion only and still needs validation from fresh sources. ${baseStanceSummary}`;

  return {
    ...result,
    answer: renderResearchAnswer(result, preferredLanguage),
  };
}

function countKeywordHits(text: string, keywords: string[]) {
  return keywords.reduce((count, keyword) => count + (text.includes(keyword) ? 1 : 0), 0);
}

function buildSignalDrivenFallbackResult(
  query: string,
  marketDataSnapshot: Record<string, any> | null,
  citations: CitationItem[],
  complianceFlags: string[],
  preferredLanguage: 'zh' | 'en'
): StructuredResearchResult {
  const entity = Array.isArray((marketDataSnapshot as any)?.entities)
    ? (marketDataSnapshot as any).entities[0]
    : null;
  const entityName = pickFirstString(entity?.shortName, entity?.longName, entity?.symbol, query);
  const priceText =
    typeof entity?.regularMarketPrice === 'number'
      ? `${entity.regularMarketPrice}${entity?.currency ? ` ${entity.currency}` : ''}`
      : preferredLanguage === 'zh'
        ? '暂无报价'
        : 'price unavailable';
  const changePercentValue =
    typeof entity?.changePercent === 'number' ? Number(entity.changePercent) : null;
  const changeText =
    changePercentValue !== null
      ? `${changePercentValue >= 0 ? '+' : ''}${changePercentValue.toFixed(2)}%`
      : preferredLanguage === 'zh'
        ? '涨跌幅未知'
        : 'change unavailable';

  const citationText = citations.map((citation) => `${citation.title} ${citation.snippet}`).join(' ').toLowerCase();
  const positiveKeywords = [
    '增长',
    '盈利',
    '创新高',
    '合作',
    '订单',
    '发布',
    '回购',
    '储能',
    '盈利',
    'improve',
    'growth',
    'profit',
    'partnership',
    'launch',
  ];
  const negativeKeywords = [
    '下跌',
    '减持',
    '调查',
    '风险',
    '亏损',
    '下滑',
    '压力',
    '监管',
    '召回',
    'warning',
    'decline',
    'probe',
    'selloff',
    'cut',
  ];

  const positiveHits = countKeywordHits(citationText, positiveKeywords);
  const negativeHits = countKeywordHits(citationText, negativeKeywords);
  const netSignal =
    (changePercentValue !== null ? (changePercentValue >= 3 ? 1 : changePercentValue <= -3 ? -1 : 0) : 0) +
    (positiveHits > negativeHits ? 1 : 0) -
    (negativeHits > positiveHits ? 1 : 0);

  const stanceLabel =
    preferredLanguage === 'zh'
      ? netSignal <= -1
        ? '谨慎偏空'
        : netSignal >= 1
          ? '中性偏多'
          : '中性'
      : netSignal <= -1
        ? 'Cautious Bearish'
        : netSignal >= 1
          ? 'Cautious Bullish'
          : 'Neutral';

  const topPositiveTitle =
    citations.find((citation) => countKeywordHits(`${citation.title} ${citation.snippet}`.toLowerCase(), positiveKeywords) > 0)
      ?.title || '';
  const topNegativeTitle =
    citations.find((citation) => countKeywordHits(`${citation.title} ${citation.snippet}`.toLowerCase(), negativeKeywords) > 0)
      ?.title || '';

  const stanceSummary =
    preferredLanguage === 'zh'
      ? `${entityName} 当前最新价 ${priceText}，较前收 ${changeText}。基于本轮实时行情与新闻标题信号，我给出一个低置信度的 ${stanceLabel} 判断：短线情绪${netSignal <= -1 ? '偏弱' : netSignal >= 1 ? '偏正面' : '分化'}，但仍需等待更完整的一二级来源确认。`
      : `${entityName} last traded at ${priceText}, versus previous close ${changeText}. Based on the live price move and headline mix in this run, the low-confidence stance is ${stanceLabel}: short-term signal is ${netSignal <= -1 ? 'soft' : netSignal >= 1 ? 'constructive' : 'mixed'}, but it still needs stronger tier-1 and tier-2 confirmation.`;

  const result: Omit<StructuredResearchResult, 'answer'> = {
    stance: {
      label: stanceLabel,
      confidence: 'low',
      summary: stanceSummary,
    },
    theses: {
      bull: [
        {
          title: preferredLanguage === 'zh' ? '最新价格与新闻线索' : 'Latest Price and News',
          summary:
            preferredLanguage === 'zh'
              ? `${entityName} 最新价 ${priceText}，较前收 ${changeText}。${citations
                  .slice(0, 3)
                  .map((citation) => `[${citation.publisher}] ${citation.title}`)
                  .join('；')}`
              : `${entityName} last traded at ${priceText}, versus previous close ${changeText}. ${citations
                  .slice(0, 3)
                  .map((citation) => `[${citation.publisher}] ${citation.title}`)
                  .join('; ')}`,
          evidence: citations.slice(0, 3).map((citation) => citation.title),
        },
        {
          title: preferredLanguage === 'zh' ? '仍有可跟踪的正向催化' : 'Still Has Trackable Upside Catalysts',
          summary:
            topPositiveTitle
              ? preferredLanguage === 'zh'
                ? `新闻里仍能看到偏正向的业务线索，例如“${topPositiveTitle}”。这意味着标的并非只有单边利空，后续要继续确认这些催化能否落到订单、盈利或份额。`
                : `There are still constructive business signals in the headlines, such as "${topPositiveTitle}". That means the name is not purely one-way negative, but those catalysts still need confirmation in orders, earnings, or market share.`
              : preferredLanguage === 'zh'
                ? '即使当前行情承压，只要后续公告或行业数据继续改善，市场仍可能重新交易业务改善与主题催化。'
                : 'Even if near-term price action is soft, the name can still rerate if later disclosures or industry data validate an improving business path.',
          evidence: topPositiveTitle ? [topPositiveTitle] : [],
        },
      ],
      bear: [
        {
          title: preferredLanguage === 'zh' ? '短线压力已经体现在价格或标题里' : 'Near-Term Stress Is Already Visible',
          summary:
            topNegativeTitle
              ? preferredLanguage === 'zh'
                ? `当前最直接的负面信号来自“${topNegativeTitle}”，再叠加最新涨跌幅 ${changeText}，说明短线资金面对这只股票仍然偏谨慎。`
                : `The clearest near-term negative signal comes from "${topNegativeTitle}", and the latest move of ${changeText} suggests positioning is still cautious.`
              : preferredLanguage === 'zh'
                ? `即使没有单条决定性利空，最新涨跌幅 ${changeText} 也说明市场对它的预期并不稳。`
                : `Even without one decisive negative headline, the latest move of ${changeText} shows expectations are not stable.`,
          evidence: topNegativeTitle ? [topNegativeTitle] : [],
        },
        {
          title: preferredLanguage === 'zh' ? '证据仍然偏 headlines 级别' : 'Evidence Is Still Headline-Level',
          summary:
            preferredLanguage === 'zh'
              ? '本轮拿到的更多是实时标题和行情，而不是财报电话会、正式公告或交易所披露，所以结论必须保留低置信度。'
              : 'This run captured more live headlines and price data than filings, earnings-call material, or exchange disclosures, so the stance must stay low confidence.',
          evidence: [],
        },
      ],
    },
    scenarios: [
      {
        name: preferredLanguage === 'zh' ? '基准情景' : 'Base Case',
        probability: 'medium',
        description:
          preferredLanguage === 'zh'
            ? '接下来如果新闻流继续偏分化、但没有更强的正式披露，股价更可能维持高波动与来回拉锯。'
            : 'If the next headlines remain mixed and formal disclosures stay limited, the name is more likely to trade in a volatile back-and-forth range.',
        signals: [],
      },
      {
        name: preferredLanguage === 'zh' ? '风险情景' : 'Risk Case',
        probability: 'medium',
        description:
          preferredLanguage === 'zh'
            ? '如果后续再出现减持、监管、业绩不及预期或需求放缓等正式信号，当前低置信度判断会继续向更偏空方向移动。'
            : 'If later disclosures confirm insider selling, regulation, weaker earnings, or slower demand, the low-confidence stance would likely move more negative.',
        signals: [],
      },
    ],
    risks: [
      {
        title: preferredLanguage === 'zh' ? '正式披露不足' : 'Insufficient Formal Disclosure',
        impact: 'high',
        description:
          preferredLanguage === 'zh'
            ? '仅靠实时标题和价格无法替代财报、公告和电话会纪要，后续正式披露可能显著改写当前判断。'
            : 'Live headlines and price action cannot replace filings, company disclosures, or earnings-call notes, so later formal evidence could materially change the view.',
      },
      {
        title: preferredLanguage === 'zh' ? '短线波动大于结论稳定性' : 'Volatility Exceeds Conclusion Stability',
        impact: 'medium',
        description:
          preferredLanguage === 'zh'
            ? '当前更像是短线信号驱动的初步研究，而不是已经完成验证的高确信度投资结论。'
            : 'The current output is better treated as signal-driven preliminary research than as a fully validated high-conviction investment view.',
      },
    ],
    citations,
    compliance_flags: complianceFlags,
  };

  return {
    ...result,
    answer: renderResearchAnswer(result, preferredLanguage),
  };
}

async function generateModelOnlyFallbackResult(
  providerProfile: Awaited<ReturnType<typeof resolveProviderProfile>>,
  query: string,
  classifier: Record<string, any>,
  complianceFlags: string[],
  preferredLanguage: 'zh' | 'en',
  options?: {
    evidenceSummary?: string;
    citations?: CitationItem[];
    timeoutMs?: number;
  }
): Promise<StructuredResearchResult> {
  const synthesis = await withTimeout(
    generateJson(providerProfile, {
      systemPrompt: [
        'You are a research synthesis lead for an internal investment research product.',
        'Live retrieval is unavailable or off-topic, so you must generate a clearly labeled fallback view from general financial knowledge only.',
        'Be concise, decisive, and low-noise.',
        'Output JSON only with keys: stance, bull_theses, bear_theses, scenarios, risks.',
        'The stance confidence must be low or medium, never high.',
        'Explicitly acknowledge the lack of live evidence and avoid pretending anything is current.',
        'Use simplified Chinese when the user query is Chinese, otherwise use English.',
        'Each bull_theses and bear_theses item must include title, summary, evidence.',
        'Each scenario item must include name, probability, description, signals.',
        'Each risk item must include title, impact, description.',
        'Prefer 2-3 bull theses, 2-3 bear theses, 2-3 scenarios, and 2-4 risks.',
        'Do not provide personalized portfolio sizing or execution instructions.',
      ].join(' '),
      prompt: `Question: ${query}\nClassifier: ${JSON.stringify(classifier)}\nPreferred language: ${
        preferredLanguage === 'zh' ? 'Simplified Chinese' : 'English'
      }\nLive signal summary: ${options?.evidenceSummary || 'none'}\nProduce a useful fallback thesis package for internal discussion, while being explicit that live retrieval failed or was off-topic.`,
      maxTokens: 650,
    }),
    options?.timeoutMs || 12000,
    'model-only-fallback'
  );

  const structuredResult: Omit<StructuredResearchResult, 'answer'> = {
    stance: normalizeStance(synthesis?.stance),
    theses: {
      bull: normalizeTheses(synthesis?.bull_theses || synthesis?.theses?.bull || []).slice(0, 4),
      bear: normalizeTheses(synthesis?.bear_theses || synthesis?.theses?.bear || []).slice(0, 4),
    },
    scenarios: normalizeScenarios(synthesis?.scenarios || []).slice(0, 4),
    risks: normalizeRisks(synthesis?.risks || []).slice(0, 5),
    citations: options?.citations || [],
    compliance_flags: complianceFlags,
  };

  structuredResult.stance.summary =
    preferredLanguage === 'zh'
      ? `以下为非实时兜底观点，基于模型的通用研究知识生成，未经过本轮最新来源验证。${structuredResult.stance.summary}`
      : `The following is a non-live fallback view generated from general research knowledge and not validated by fresh sources in this run. ${structuredResult.stance.summary}`;

  return {
    ...structuredResult,
    answer: renderResearchAnswer(structuredResult, preferredLanguage),
  };
}

export async function orchestrateResearch(
  supabase: SupabaseClient,
  userId: string,
  input: {
    query: string;
    market_scope?: string;
    entity_context?: Record<string, any>;
    output_mode?: string;
    provider_profile?: ProviderProfileRequest;
  }
): Promise<OrchestratedResearchResult> {
  const logs: ResearchLog[] = [];
  const complianceFlags = detectComplianceFlags(input.query);
  const preferredLanguage: 'zh' | 'en' = containsChinese(input.query) ? 'zh' : 'en';
  const providerProfile = await resolveProviderProfile(supabase, userId, input.provider_profile);

  addLog(logs, 'provider-resolver', JSON.stringify(providerSnapshot(providerProfile)));

  let classifier = fallbackClassifier(input.query, input.market_scope, input.entity_context);

  try {
    classifier = await withTimeout(
      generateJson(providerProfile, {
        systemPrompt:
          'You classify financial research questions. Output JSON only. Extract query_type, market_scope, primary_entities, needs_structured_data, needs_latest_information.',
        prompt: `Classify this request for a research workflow.\n\nQuery: ${input.query}\nMarket scope: ${
          input.market_scope || 'multi-market'
        }\nEntity context: ${JSON.stringify(input.entity_context || {})}`,
        maxTokens: 250,
      }),
      6000,
      'query-classifier'
    );
  } catch (error: any) {
    addLog(logs, 'query-classifier', `Fallback classifier used: ${error?.message || error}`);
  }

  addLog(logs, 'query-classifier', JSON.stringify(classifier));

  if (!looksLikeFinanceScopedQuery(input.query, classifier, input.entity_context)) {
    const result = buildOutOfScopeResult(input.query, preferredLanguage);
    addLog(logs, 'scope-guard', JSON.stringify(result.compliance_flags));

    return {
      result,
      citations: [],
      logs,
      classifier,
      providerSnapshot: providerSnapshot(providerProfile),
      marketData: null,
    };
  }

  if (
    complianceFlags.includes('personalized_advice_blocked') &&
    !input.query.match(/特斯拉|腾讯|宁德时代|tesla|tencent|catl/i)
  ) {
    const result = buildComplianceOnlyResult(input.query, preferredLanguage);
    addLog(logs, 'compliance-guard', JSON.stringify(result.compliance_flags));

    return {
      result,
      citations: [],
      logs,
      classifier,
      providerSnapshot: providerSnapshot(providerProfile),
      marketData: null,
    };
  }

  let marketData = {
    available: false,
    source: 'disabled',
    snapshot: null,
    error: 'market data not requested',
  };

  try {
    marketData = await withTimeout(
      fetchMarketDataSnapshot({
        marketScope: input.market_scope,
        entities: classifier.primary_entities || input.entity_context?.entities || [],
        query: input.query,
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

  addLog(logs, 'market-data-adapter', JSON.stringify(marketData));
  const adapterCitations = marketDataSnapshotToCitations(marketData.snapshot, 1) as CitationItem[];

  if (adapterCitations.length > 0) {
    addLog(
      logs,
      'market-data-news',
      JSON.stringify({
        adapter_news_count: adapterCitations.length,
        market_data_entities: Array.isArray((marketData.snapshot as any)?.entities)
          ? (marketData.snapshot as any).entities.length
          : 0,
      })
    );
  }

  let retrieval: any = { message: '', sources: [] };

  try {
    retrieval = await callPerplefina({
      focusMode: focusModeFromClassifier(classifier),
      query: buildRetrievalPrompt(input.query, classifier, input.market_scope),
      optimizationMode: 'speed',
      maxSources: 4,
      chatModel: toPerplefinaChatModel(providerProfile),
      maxTokens: 900,
      timeoutMs: 16000,
      systemInstructions:
        'You are gathering research evidence for an internal investment research workflow. Prefer filings, earnings calls, exchange disclosures, reputable financial media, and high-signal commentary.',
    });
  } catch (error: any) {
    addLog(logs, 'source-retrieval', `Perplefina failed: ${error?.message || error}`);
  }

  addLog(
    logs,
    'source-retrieval',
    JSON.stringify({
      source_count: retrieval?.sources?.length || 0,
      summary: retrieval?.message?.slice(0, 1200) || '',
    })
  );

  const rawCitations = normalizeCitations(retrieval.sources || []);
  const filteredCitations = filterRelevantSources(rawCitations, {
    query: input.query,
    classifier,
    explicitEntities: input.entity_context?.entities || [],
    maxItems: 6,
  });
  const citations = mergeCitations(filteredCitations.sources, adapterCitations, 6);

  if (filteredCitations.droppedCount > 0) {
    addLog(
      logs,
      'source-relevance-filter',
      JSON.stringify({
        dropped_count: filteredCitations.droppedCount,
        strict_filter: filteredCitations.appliedStrictFilter,
        entity_keywords: filteredCitations.entityKeywords,
      })
    );
  }

  if (
    filteredCitations.appliedStrictFilter &&
    filteredCitations.sources.length === 0 &&
    adapterCitations.length === 0
  ) {
    retrieval = {
      ...retrieval,
      message: '',
      sources: [],
    };
  }

  const effectiveRetrievalSummary =
    filteredCitations.sources.length > 0 && !retrievalSummaryLooksOffTopic(retrieval?.message || '')
      ? retrieval?.message || ''
      : '';

  if (!effectiveRetrievalSummary && retrieval?.message && adapterCitations.length > 0) {
    addLog(
      logs,
      'retrieval-summary-sanitizer',
      'Ignored low-signal retrieval summary because market-data news was stronger and directly relevant'
    );
  }

  const marketDataEvidenceSummary = buildMarketDataEvidenceSummary(
    marketData.snapshot,
    preferredLanguage
  );
  const evidencePack = {
    classifier,
    retrieval_summary:
      citations.length > 0
        ? [effectiveRetrievalSummary, marketDataEvidenceSummary].filter(Boolean).join('\n\n')
        : marketDataEvidenceSummary,
    citations,
    market_data: marketData.snapshot,
    output_mode: input.output_mode || 'research-note',
  };
  const template = getFallbackResearchTemplate(input.query, classifier, preferredLanguage);

  const shouldUseFastTemplateFallback =
    Boolean(template) &&
    hasUsableMarketData(marketData.snapshot) &&
    !effectiveRetrievalSummary &&
    filteredCitations.sources.length === 0;

  if (shouldUseFastTemplateFallback) {
    addLog(logs, 'fast-template-fallback', 'Skipped synthesis because template plus live market data was already sufficient');
    const result = buildTemplateFallbackResult(
      template as NonNullable<ReturnType<typeof getFallbackResearchTemplate>>,
      complianceFlags,
      preferredLanguage,
      {
        citations,
        liveSummary: marketDataEvidenceSummary,
      }
    );

    return {
      result,
      citations,
      logs,
      classifier,
      providerSnapshot: providerSnapshot(providerProfile),
      marketData: marketData.snapshot,
    };
  }

  const shouldReturnInsufficientEvidence =
    filteredCitations.appliedStrictFilter &&
    citations.length === 0 &&
    !hasUsableMarketData(marketData.snapshot);

  if (shouldReturnInsufficientEvidence) {
    addLog(logs, 'synthesis', 'Skipped live synthesis because relevant evidence was insufficient after source filtering');
    let result: StructuredResearchResult;

    if (template) {
      result = buildTemplateFallbackResult(template, complianceFlags, preferredLanguage);
      addLog(logs, 'template-fallback', 'Used curated template fallback because live evidence was insufficient');
    } else {
      try {
        result = await generateModelOnlyFallbackResult(
          providerProfile,
          input.query,
          classifier,
          complianceFlags,
          preferredLanguage
        );
        addLog(logs, 'model-only-fallback', 'Used model-only fallback because live evidence was insufficient');
      } catch (error: any) {
        addLog(logs, 'model-only-fallback', `Model-only fallback failed: ${error?.message || error}`);
        result = buildInsufficientEvidenceResult(
          input.query,
          citations,
          complianceFlags,
          preferredLanguage
        );
      }
    }

    return {
      result,
      citations,
      logs,
      classifier,
      providerSnapshot: providerSnapshot(providerProfile),
      marketData: marketData.snapshot,
    };
  }

  const shouldSkipSynthesis =
    !effectiveRetrievalSummary &&
    citations.length === 0 &&
    !marketData.available;

  if (shouldSkipSynthesis) {
    addLog(logs, 'synthesis', 'Skipped synthesis because retrieval and market data were both unavailable');
    let result: StructuredResearchResult;

    if (template) {
      result = buildTemplateFallbackResult(template, complianceFlags, preferredLanguage);
      addLog(logs, 'template-fallback', 'Used curated template fallback because retrieval and market data were unavailable');
    } else {
      try {
        result = await generateModelOnlyFallbackResult(
          providerProfile,
          input.query,
          classifier,
          complianceFlags,
          preferredLanguage
        );
        addLog(logs, 'model-only-fallback', 'Used model-only fallback because retrieval and market data were unavailable');
      } catch (error: any) {
        addLog(logs, 'model-only-fallback', `Model-only fallback failed: ${error?.message || error}`);
        result = buildEvidenceFallbackResult(
          input.query,
          marketDataEvidenceSummary,
          citations,
          complianceFlags,
          preferredLanguage
        );
      }
    }

    return {
      result,
      citations,
      logs,
      classifier,
      providerSnapshot: providerSnapshot(providerProfile),
      marketData: marketData.snapshot,
    };
  }

  let synthesis: Record<string, any>;

  try {
    synthesis = await withTimeout(
      generateJson(providerProfile, {
        systemPrompt: [
          'You are a research synthesis lead for an internal investment research product.',
          'Be concise, decisive, and low-noise.',
          'Output JSON only with keys: stance, bull_theses, bear_theses, scenarios, risks.',
          'Use simplified Chinese when the user query is Chinese, otherwise use English.',
          'stance must include label, confidence, summary.',
          'Each bull_theses and bear_theses item must include title, summary, evidence.',
          'Each scenario item must include name, probability, description, signals.',
          'Each risk item must include title, impact, description.',
          'Prefer 2-3 bull theses, 2-3 bear theses, 2-3 scenarios, and 2-4 risks unless the evidence is unusually rich.',
          'Avoid filler, throat-clearing, and repeated caveats.',
          'Do not provide personalized portfolio sizing or execution instructions.',
        ].join(' '),
        prompt: `Synthesize the final research view.\n\nPreferred language: ${
          preferredLanguage === 'zh' ? 'Simplified Chinese' : 'English'
        }\nQuestion: ${input.query}\nEvidence pack: ${JSON.stringify(evidencePack)}`,
        maxTokens: 820,
      }),
      15000,
      'research-synthesis'
    );
  } catch (error: any) {
    addLog(logs, 'synthesis', `Fallback synthesis used: ${error?.message || error}`);
    const liveSummary = [effectiveRetrievalSummary, marketDataEvidenceSummary]
      .filter(Boolean)
      .join('\n\n');
    let result: StructuredResearchResult;

    if (template) {
      result = buildTemplateFallbackResult(template, complianceFlags, preferredLanguage, {
        citations,
        liveSummary,
      });
      addLog(logs, 'template-fallback', 'Used curated template fallback after synthesis timeout');
    } else if (citations.length > 0 || hasUsableMarketData(marketData.snapshot)) {
      result = buildSignalDrivenFallbackResult(
        input.query,
        marketData.snapshot,
        citations,
        complianceFlags,
        preferredLanguage
      );
      addLog(logs, 'signal-fallback', 'Used market-data-driven fallback after synthesis timeout');
    } else {
      try {
        result = await generateModelOnlyFallbackResult(
          providerProfile,
          input.query,
          classifier,
          complianceFlags,
          preferredLanguage,
          {
            evidenceSummary: liveSummary,
            citations,
            timeoutMs: 12000,
          }
        );
        addLog(logs, 'model-only-fallback', 'Used concise model fallback after synthesis timeout');
      } catch (fallbackError: any) {
        addLog(
          logs,
          'model-only-fallback',
          `Model-only fallback after synthesis timeout failed: ${fallbackError?.message || fallbackError}`
        );
        result = buildEvidenceFallbackResult(
          input.query,
          liveSummary,
          citations,
          complianceFlags,
          preferredLanguage
        );
      }
    }

    return {
      result,
      citations,
      logs,
      classifier,
      providerSnapshot: providerSnapshot(providerProfile),
      marketData: marketData.snapshot,
    };
  }

  const structuredResult: Omit<StructuredResearchResult, 'answer'> = {
    stance: normalizeStance(synthesis?.stance),
    theses: {
      bull: normalizeTheses(synthesis?.bull_theses || synthesis?.theses?.bull || []).slice(0, 4),
      bear: normalizeTheses(synthesis?.bear_theses || synthesis?.theses?.bear || []).slice(0, 4),
    },
    scenarios: normalizeScenarios(synthesis?.scenarios || []).slice(0, 4),
    risks: normalizeRisks(synthesis?.risks || []).slice(0, 5),
    citations,
    compliance_flags: complianceFlags,
  };

  if (structuredResult.compliance_flags.includes('personalized_advice_blocked')) {
    structuredResult.stance.summary =
      preferredLanguage === 'zh'
        ? `${structuredResult.stance.summary} 同时提醒：我不会提供针对个人账户的买卖、仓位、止盈止损或收益承诺。`
        : `${structuredResult.stance.summary} I also will not provide personalized buy/sell, sizing, stop loss, take profit, or return promises.`;
  }

  addLog(logs, 'bull-thesis', JSON.stringify(structuredResult.theses.bull));
  addLog(logs, 'bear-thesis', JSON.stringify(structuredResult.theses.bear));
  addLog(logs, 'synthesis', JSON.stringify(synthesis));

  const result: StructuredResearchResult = {
    ...structuredResult,
    answer: renderResearchAnswer(structuredResult, preferredLanguage),
  };

  addLog(logs, 'compliance-guard', JSON.stringify(result.compliance_flags));
  addLog(logs, 'citation-assembler', JSON.stringify(citations));

  return {
    result,
    citations,
    logs,
    classifier,
    providerSnapshot: providerSnapshot(providerProfile),
    marketData: marketData.snapshot,
  };
}
