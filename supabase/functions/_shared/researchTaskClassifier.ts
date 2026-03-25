import type { ResearchConversationContinuity, ResearchTaskType } from './researchSchemas.ts';

export interface EntityHint {
  symbol: string;
  display_name: string;
  market_scope: 'us' | 'hk' | 'cn';
  search_terms: string[];
}

export interface ClassifiedResearchTask {
  task_type: ResearchTaskType;
  market_scope: string;
  subject_hint: string;
  entity_hints: EntityHint[];
  direct_action_request: boolean;
  out_of_scope: boolean;
  reasons: string[];
}

type KnownEntity = EntityHint & {
  aliases: string[];
};

const KNOWN_ENTITIES: KnownEntity[] = [
  { symbol: 'TSLA', display_name: 'Tesla', market_scope: 'us', search_terms: ['Tesla', 'TSLA'], aliases: ['tesla', 'tsla', '特斯拉'] },
  { symbol: 'NVDA', display_name: 'NVIDIA', market_scope: 'us', search_terms: ['NVIDIA', 'NVDA'], aliases: ['nvidia', 'nvda', '英伟达'] },
  { symbol: 'AAPL', display_name: 'Apple', market_scope: 'us', search_terms: ['Apple', 'AAPL'], aliases: ['apple', 'aapl', '苹果'] },
  { symbol: 'MSFT', display_name: 'Microsoft', market_scope: 'us', search_terms: ['Microsoft', 'MSFT'], aliases: ['microsoft', 'msft', '微软'] },
  { symbol: 'AMZN', display_name: 'Amazon', market_scope: 'us', search_terms: ['Amazon', 'AMZN'], aliases: ['amazon', 'amzn', '亚马逊'] },
  { symbol: 'GOOGL', display_name: 'Alphabet', market_scope: 'us', search_terms: ['Alphabet', 'Google', 'GOOGL'], aliases: ['alphabet', 'google', 'googl', '谷歌'] },
  { symbol: 'INTC', display_name: 'Intel', market_scope: 'us', search_terms: ['Intel', 'INTC'], aliases: ['intel', 'intc', '英特尔'] },
  { symbol: '0700.HK', display_name: 'Tencent', market_scope: 'hk', search_terms: ['Tencent', '0700.HK', 'TCEHY'], aliases: ['tencent', '0700.hk', 'tcehy', '腾讯'] },
  { symbol: '9988.HK', display_name: 'Alibaba', market_scope: 'hk', search_terms: ['Alibaba', '9988.HK', 'BABA'], aliases: ['alibaba', '9988.hk', 'baba', '阿里巴巴', '阿里'] },
  { symbol: '1810.HK', display_name: 'Xiaomi', market_scope: 'hk', search_terms: ['Xiaomi', '1810.HK'], aliases: ['xiaomi', '1810.hk', '小米'] },
  { symbol: '3690.HK', display_name: 'Meituan', market_scope: 'hk', search_terms: ['Meituan', '3690.HK'], aliases: ['meituan', '3690.hk', '美团'] },
  { symbol: '1211.HK', display_name: 'BYD', market_scope: 'hk', search_terms: ['BYD', '1211.HK'], aliases: ['byd', '1211.hk', '比亚迪'] },
  { symbol: '300750.SZ', display_name: 'CATL', market_scope: 'cn', search_terms: ['CATL', 'Contemporary Amperex', '300750.SZ'], aliases: ['catl', '300750.sz', '宁德时代'] },
  { symbol: '600519.SS', display_name: 'Kweichow Moutai', market_scope: 'cn', search_terms: ['Kweichow Moutai', '600519.SS'], aliases: ['moutai', '600519.ss', '贵州茅台', '茅台'] },
  { symbol: '601318.SS', display_name: 'Ping An', market_scope: 'cn', search_terms: ['Ping An', '601318.SS'], aliases: ['ping an', '601318.ss', '中国平安', '平安'] },
  { symbol: '002594.SZ', display_name: 'BYD', market_scope: 'cn', search_terms: ['BYD', '002594.SZ'], aliases: ['byd', '002594.sz', '比亚迪'] },
];

const OUT_OF_SCOPE_PATTERNS = [/一起去吃饭/, /陪我吃饭/, /约会/, /天气/, /旅游/, /翻译/, /写诗/, /笑话/, /数学/, /方程/, /\bmath\b/i, /\bcalculate\b/i, /\bdinner\b/i, /\beat with me\b/i, /\bweather\b/i, /\btravel\b/i];
const DIRECT_ACTION_PATTERNS = [/能不能买/, /要不要买/, /现在买还是卖/, /现在卖还是买/, /什么时候买/, /什么时候卖/, /仓位/, /止损/, /止盈/, /进场/, /出场/, /买多少/, /卖多少/, /\bshould i buy\b/i, /\bshould i sell\b/i, /\bposition size\b/i, /\bstop loss\b/i, /\btake profit\b/i, /\bentry price\b/i, /\bexit price\b/i];
const CARD_REQUEST_PATTERNS = [/整理成卡片/, /总结成卡片/, /thesis card/i, /内部卡片/, /投资卡片/, /沉淀成卡片/];
const EVENT_UPDATE_PATTERNS = [/财报/, /业绩/, /公告/, /指引/, /监管/, /并购/, /发布/, /更新/, /新闻/, /消息/, /事件/, /\bearnings\b/i, /\bguidance\b/i, /\bresults\b/i, /\bannounced\b/i, /\bupdate\b/i, /\bnews\b/i, /\bcatalyst\b/i];
const FOLLOW_UP_PATTERNS = [/那这(个|家公司|只股票)?呢/, /那为什么/, /你刚才说/, /上面提到/, /刚才的thesis/, /这个逻辑/, /这个反方/, /这个风险/, /那个key variable/, /\bwhat about\b/i, /\bwhy\b/i, /\bhow does that change\b/i, /\bdoes that change\b/i, /\byou mentioned\b/i];

function containsChinese(text: string) {
  return /[\u3400-\u9fff]/.test(text);
}

function normalizeText(text: string) {
  return String(text || '').trim().toLowerCase();
}

function flattenEntityContext(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === 'string' || typeof value === 'number') return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => flattenEntityContext(item));
  if (typeof value === 'object') {
    const entry = value as Record<string, unknown>;
    return [
      ...flattenEntityContext(entry.name),
      ...flattenEntityContext(entry.symbol),
      ...flattenEntityContext(entry.ticker),
      ...flattenEntityContext(entry.code),
      ...flattenEntityContext(entry.alias),
      ...flattenEntityContext(entry.aliases),
      ...flattenEntityContext(entry.entities),
    ];
  }
  return [];
}

function inferMarketScopeFromSymbol(symbol: string): 'us' | 'hk' | 'cn' {
  const normalized = symbol.toUpperCase();
  if (normalized.endsWith('.HK')) return 'hk';
  if (normalized.endsWith('.SZ') || normalized.endsWith('.SS')) return 'cn';
  return 'us';
}

function buildGenericSymbolHint(symbol: string): EntityHint {
  return {
    symbol,
    display_name: symbol,
    market_scope: inferMarketScopeFromSymbol(symbol),
    search_terms: [symbol],
  };
}

function dedupeEntityHints(items: EntityHint[]) {
  const seen = new Set<string>();
  const output: EntityHint[] = [];
  for (const item of items) {
    if (seen.has(item.symbol)) continue;
    seen.add(item.symbol);
    output.push(item);
  }
  return output;
}

export function detectEntityHints(query: string, entityContext?: Record<string, unknown>) {
  const candidates = [query, ...flattenEntityContext(entityContext)];
  const matches: EntityHint[] = [];

  for (const entity of KNOWN_ENTITIES) {
    const found = candidates.some((candidate) => {
      const text = String(candidate || '');
      if (!text) return false;
      if (entity.aliases.some((alias) => containsChinese(alias) && text.includes(alias))) return true;
      const lowered = normalizeText(text);
      return entity.aliases.some((alias) => lowered.includes(normalizeText(alias)));
    });
    if (found) {
      matches.push({
        symbol: entity.symbol,
        display_name: entity.display_name,
        market_scope: entity.market_scope,
        search_terms: entity.search_terms,
      });
    }
  }

  const symbolMatches =
    query.match(/\b(?:\^?[A-Z]{1,6}(?:\.[A-Z]{1,4})?|\d{4,6}(?:\.(?:HK|SZ|SS))?)\b/g) || [];
  for (const symbol of symbolMatches) {
    matches.push(buildGenericSymbolHint(symbol.toUpperCase()));
  }

  return dedupeEntityHints(matches);
}

function resolveRequestedMarketScope(requestedMarketScope: string | undefined, entityHints: EntityHint[]) {
  const normalized = String(requestedMarketScope || '').toLowerCase();
  if (normalized === 'us' || normalized.includes('美股')) return 'us';
  if (normalized === 'hk' || normalized.includes('港股')) return 'hk';
  if (normalized === 'cn' || normalized.includes('a股') || normalized.includes('ashare') || normalized.includes('a-share')) return 'cn';
  if (entityHints.length > 0) return entityHints[0].market_scope;
  return 'multi-market';
}

function fallbackSubjectByMarket(marketScope: string) {
  if (marketScope === 'us') return 'US market thesis';
  if (marketScope === 'hk') return 'Hong Kong market thesis';
  if (marketScope === 'cn') return 'A-share thesis';
  return 'Cross-market thesis';
}

export function classifyResearchTask(input: {
  query: string;
  market_scope?: string;
  entity_context?: Record<string, unknown>;
  continuity?: ResearchConversationContinuity;
  task_override?: ResearchTaskType;
}): ClassifiedResearchTask {
  const query = String(input.query || '').trim();
  const continuity = input.continuity;
  const entityHints = detectEntityHints(query, input.entity_context);
  const marketScope = resolveRequestedMarketScope(input.market_scope, entityHints);
  const reasons: string[] = [];
  const directActionRequest = DIRECT_ACTION_PATTERNS.some((pattern) => pattern.test(query));
  const outOfScope = OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(query));
  const cardRequest = CARD_REQUEST_PATTERNS.some((pattern) => pattern.test(query));
  const eventSignal = EVENT_UPDATE_PATTERNS.some((pattern) => pattern.test(query));
  const followUpSignal =
    FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(query)) || query.length <= 36;

  let taskType: ResearchTaskType = 'initial_thesis';

  if (input.task_override) {
    taskType = input.task_override;
    reasons.push('task_override');
  } else if (outOfScope) {
    taskType = 'out_of_scope';
    reasons.push('out_of_scope_pattern');
  } else if (cardRequest && continuity?.has_prior_thesis) {
    taskType = 'thesis_card';
    reasons.push('card_request');
  } else if (continuity?.has_prior_thesis && eventSignal) {
    taskType = 'event_update';
    reasons.push('event_signal_with_prior_thesis');
  } else if (continuity?.has_prior_thesis && followUpSignal) {
    taskType = 'follow_up';
    reasons.push('follow_up_signal_with_prior_thesis');
  } else {
    reasons.push('default_initial_thesis');
  }

  if (directActionRequest) {
    reasons.push('direct_action_request');
  }

  return {
    task_type: taskType,
    market_scope: marketScope,
    subject_hint:
      entityHints[0]?.display_name ||
      continuity?.latest_subject ||
      fallbackSubjectByMarket(marketScope),
    entity_hints: entityHints,
    direct_action_request: directActionRequest,
    out_of_scope: outOfScope,
    reasons,
  };
}
