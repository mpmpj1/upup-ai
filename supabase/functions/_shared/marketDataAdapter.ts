export interface MarketDataRequest {
  marketScope?: string;
  entities?: Array<Record<string, unknown> | string>;
  query?: string;
  preferredLanguage?: 'zh' | 'en';
}

export interface MarketNewsItem {
  title: string;
  url: string;
  publisher: string;
  summary: string;
  publishedAt: string;
  relatedSymbols: string[];
  source_tier: 2;
  source_type: 'media';
  source: 'google-news';
}

export interface MarketEntitySnapshot {
  requested: string;
  symbol: string;
  market: 'US' | 'HK' | 'CN' | 'INDEX' | 'OTHER';
  exchange: string;
  currency: string;
  shortName: string;
  longName: string;
  regularMarketPrice: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  marketCap: number | null;
  marketState: string;
  asOf: string | null;
  source: 'yahoo-finance';
}

export interface MarketDataSnapshot {
  scope: string;
  entities: MarketEntitySnapshot[];
  news: MarketNewsItem[];
  diagnostics: {
    requested_entities: string[];
    resolved_symbols: string[];
    unresolved_entities: string[];
    news_queries: string[];
  };
}

export interface MarketDataResult {
  available: boolean;
  source: string;
  snapshot: MarketDataSnapshot | null;
  error?: string;
}

export interface MarketDataCitation {
  title: string;
  url: string;
  publisher: string;
  snippet: string;
  source_tier: 2;
  source_type: 'media';
  source_index: number;
}

type ResolvedEntity = {
  requested: string;
  symbol: string;
  market: 'US' | 'HK' | 'CN' | 'INDEX' | 'OTHER';
  displayName: string;
  searchTerms: string[];
};

type EntityPreset = {
  symbol: string;
  market: 'US' | 'HK' | 'CN' | 'INDEX' | 'OTHER';
  displayName: string;
  aliases: string[];
  searchTerms: string[];
};

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0 Safari/537.36',
  Accept: 'application/json,text/plain,*/*',
  Referer: 'https://finance.yahoo.com/',
};

const GOOGLE_NEWS_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0 Safari/537.36',
  Accept: 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
};

const ENTITY_PRESETS: EntityPreset[] = [
  {
    symbol: 'TSLA',
    market: 'US',
    displayName: 'Tesla, Inc.',
    aliases: ['tesla', 'tsla', '特斯拉'],
    searchTerms: ['Tesla', 'TSLA'],
  },
  {
    symbol: 'INTC',
    market: 'US',
    displayName: 'Intel Corporation',
    aliases: ['intel', 'intc', '英特尔'],
    searchTerms: ['Intel', 'INTC'],
  },
  {
    symbol: 'NVDA',
    market: 'US',
    displayName: 'NVIDIA Corporation',
    aliases: ['nvidia', 'nvda', '英伟达'],
    searchTerms: ['NVIDIA', 'NVDA'],
  },
  {
    symbol: 'AAPL',
    market: 'US',
    displayName: 'Apple Inc.',
    aliases: ['apple', 'aapl', '苹果'],
    searchTerms: ['Apple', 'AAPL'],
  },
  {
    symbol: 'MSFT',
    market: 'US',
    displayName: 'Microsoft Corporation',
    aliases: ['microsoft', 'msft', '微软'],
    searchTerms: ['Microsoft', 'MSFT'],
  },
  {
    symbol: 'AMZN',
    market: 'US',
    displayName: 'Amazon.com, Inc.',
    aliases: ['amazon', 'amzn', '亚马逊'],
    searchTerms: ['Amazon', 'AMZN'],
  },
  {
    symbol: 'GOOGL',
    market: 'US',
    displayName: 'Alphabet Inc.',
    aliases: ['alphabet', 'google', 'googl', '谷歌'],
    searchTerms: ['Alphabet', 'Google', 'GOOGL'],
  },
  {
    symbol: 'AMD',
    market: 'US',
    displayName: 'Advanced Micro Devices, Inc.',
    aliases: ['amd'],
    searchTerms: ['AMD'],
  },
  {
    symbol: '0700.HK',
    market: 'HK',
    displayName: 'Tencent Holdings Limited',
    aliases: ['腾讯', '腾讯控股', 'tencent', '0700.hk', '0700', 'tcehy'],
    searchTerms: ['Tencent', '0700.HK'],
  },
  {
    symbol: '9988.HK',
    market: 'HK',
    displayName: 'Alibaba Group Holding Limited',
    aliases: ['阿里', '阿里巴巴', 'alibaba', '9988.hk', '9988', 'baba'],
    searchTerms: ['Alibaba', '9988.HK'],
  },
  {
    symbol: '1810.HK',
    market: 'HK',
    displayName: 'Xiaomi Corporation',
    aliases: ['小米', '小米集团', 'xiaomi', '1810.hk', '1810'],
    searchTerms: ['Xiaomi', '1810.HK'],
  },
  {
    symbol: '1211.HK',
    market: 'HK',
    displayName: 'BYD Company Limited',
    aliases: ['比亚迪', 'byd', '1211.hk', '1211'],
    searchTerms: ['BYD', '1211.HK'],
  },
  {
    symbol: '3690.HK',
    market: 'HK',
    displayName: 'Meituan',
    aliases: ['美团', 'meituan', '3690.hk', '3690'],
    searchTerms: ['Meituan', '3690.HK'],
  },
  {
    symbol: '0981.HK',
    market: 'HK',
    displayName: 'Semiconductor Manufacturing International Corporation',
    aliases: ['中芯国际', 'smic', '0981.hk', '981.hk', '0981'],
    searchTerms: ['SMIC', '0981.HK'],
  },
  {
    symbol: '300750.SZ',
    market: 'CN',
    displayName: 'Contemporary Amperex Technology Co., Limited',
    aliases: ['宁德时代', 'catl', '300750.sz', '300750'],
    searchTerms: ['Contemporary Amperex', 'CATL', '300750.SZ'],
  },
  {
    symbol: '001696.SZ',
    market: 'CN',
    displayName: 'Chongqing Zongshen Power Machinery Co., Ltd',
    aliases: ['宗申动力', 'zongshen power', '001696.sz', '001696'],
    searchTerms: ['Zongshen Power', '001696.SZ'],
  },
  {
    symbol: '600519.SS',
    market: 'CN',
    displayName: 'Kweichow Moutai Co., Ltd.',
    aliases: ['贵州茅台', 'moutai', '600519.ss', '600519', '茅台'],
    searchTerms: ['Kweichow Moutai', '600519.SS'],
  },
  {
    symbol: '601318.SS',
    market: 'CN',
    displayName: 'Ping An Insurance (Group) Company of China, Ltd.',
    aliases: ['中国平安', 'ping an', '601318.ss', '601318', '平安'],
    searchTerms: ['Ping An', '601318.SS'],
  },
  {
    symbol: '002594.SZ',
    market: 'CN',
    displayName: 'BYD Company Limited',
    aliases: ['比亚迪', '002594.sz', '002594', 'byd'],
    searchTerms: ['BYD', '002594.SZ'],
  },
  {
    symbol: '^GSPC',
    market: 'INDEX',
    displayName: 'S&P 500',
    aliases: ['标普500', 's&p500', 'sp500', '^gspc'],
    searchTerms: ['S&P 500', '^GSPC'],
  },
  {
    symbol: '^IXIC',
    market: 'INDEX',
    displayName: 'NASDAQ Composite',
    aliases: ['纳斯达克', 'nasdaq', '^ixic'],
    searchTerms: ['NASDAQ Composite', '^IXIC'],
  },
  {
    symbol: '^HSI',
    market: 'INDEX',
    displayName: 'Hang Seng Index',
    aliases: ['恒生指数', '恒指', 'hang seng', '^hsi'],
    searchTerms: ['Hang Seng Index', '^HSI'],
  },
  {
    symbol: '000001.SS',
    market: 'INDEX',
    displayName: 'SSE Composite Index',
    aliases: ['上证指数', '上证综指', '000001.ss'],
    searchTerms: ['SSE Composite Index', '000001.SS'],
  },
];
const SYMBOL_PATTERN =
  /^(?:\^[A-Z0-9.-]{1,12}|[A-Z]{1,6}(?:\.[A-Z]{1,4})?|\d{4,6}\.(?:HK|SZ|SS)|\d{4,6})$/i;

function normalizeText(value: string) {
  return String(value || '').trim().toLowerCase();
}

function coerceNumber(value: unknown) {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(numericValue) ? numericValue : null;
}

function containsChinese(text: string) {
  return /[\u3400-\u9fff]/.test(text);
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x2F;/g, '/');
}

function stripHtml(value: string) {
  return decodeXmlEntities(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function flattenEntityHints(entities: Array<Record<string, unknown> | string> = []) {
  const values: string[] = [];

  const pushValue = (value: unknown) => {
    if (!value && value !== 0) {
      return;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const trimmed = String(value).trim();
      if (trimmed) {
        values.push(trimmed);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(pushValue);
      return;
    }

    if (typeof value === 'object') {
      const entry = value as Record<string, unknown>;
      pushValue(entry.name);
      pushValue(entry.symbol);
      pushValue(entry.ticker);
      pushValue(entry.code);
      pushValue(entry.alias);
      pushValue(entry.aliases);
      pushValue(entry.value);
    }
  };

  entities.forEach(pushValue);

  return Array.from(new Set(values));
}

function extractHintsFromQuery(query: string) {
  const normalized = query.trim();
  if (!normalized) {
    return [];
  }

  const lower = normalized.toLowerCase();
  const matches = new Set<string>();

  for (const preset of ENTITY_PRESETS) {
    const candidates = [preset.displayName, preset.symbol, ...preset.aliases];
    const matched = candidates.find((candidate) => {
      const value = candidate.trim();
      if (!value) {
        return false;
      }

      if (containsChinese(value)) {
        return normalized.includes(value);
      }

      return lower.includes(value.toLowerCase());
    });

    if (matched) {
      matches.add(matched);
    }
  }

  const symbolMatches =
    normalized.match(/\^?[A-Z]{1,6}(?:\.[A-Z]{1,4})?|\d{4,6}(?:\.(?:HK|SZ|SS))?/g) || [];
  for (const symbol of symbolMatches) {
    if (SYMBOL_PATTERN.test(symbol)) {
      matches.add(symbol);
    }
  }

  return Array.from(matches);
}

function inferMarketFromSymbol(symbol: string): ResolvedEntity['market'] {
  const normalized = symbol.toUpperCase();

  if (normalized.startsWith('^')) {
    return 'INDEX';
  }

  if (normalized.endsWith('.HK')) {
    return 'HK';
  }

  if (normalized.endsWith('.SZ') || normalized.endsWith('.SS')) {
    return 'CN';
  }

  if (/^[A-Z]{1,6}$/.test(normalized)) {
    return 'US';
  }

  return 'OTHER';
}

function dedupeBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  const output: T[] = [];

  for (const item of items) {
    const key = getKey(item);
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(item);
  }

  return output;
}

function findPresetForHint(hint: string) {
  const normalized = normalizeText(hint);
  return ENTITY_PRESETS.find((preset) =>
    [preset.symbol, preset.displayName, ...preset.aliases].some(
      (candidate) => normalizeText(candidate) === normalized,
    ),
  );
}

function formatDirectSymbol(hint: string) {
  const trimmed = hint.trim();
  const upper = trimmed.toUpperCase();

  if (/^\d{4}$/.test(trimmed)) {
    return `${trimmed}.HK`;
  }

  if (/^\d{6}$/.test(trimmed)) {
    return trimmed.startsWith('6') ? `${trimmed}.SS` : `${trimmed}.SZ`;
  }

  return upper;
}

function normalizeMarketScope(scope?: string) {
  const normalized = String(scope || 'multi-market').toLowerCase();

  if (/^us$|美股|united states|america/.test(normalized)) {
    return 'us';
  }

  if (/^hk$|港股|hong kong/.test(normalized)) {
    return 'hk';
  }

  if (/^cn$|a股|ashare|a-share|china/.test(normalized)) {
    return 'cn';
  }

  return 'multi-market';
}

function defaultScopeEntities(scope: string): ResolvedEntity[] {
  const presetsBySymbol = new Map(ENTITY_PRESETS.map((preset) => [preset.symbol, preset]));
  const pick = (symbol: string) => {
    const preset = presetsBySymbol.get(symbol);
    if (!preset) {
      return null;
    }

    return {
      requested: preset.displayName,
      symbol: preset.symbol,
      market: preset.market,
      displayName: preset.displayName,
      searchTerms: preset.searchTerms,
    } satisfies ResolvedEntity;
  };

  if (scope === 'us') {
    return [pick('^GSPC'), pick('^IXIC')].filter(Boolean) as ResolvedEntity[];
  }

  if (scope === 'hk') {
    return [pick('^HSI'), pick('0700.HK')].filter(Boolean) as ResolvedEntity[];
  }

  if (scope === 'cn') {
    return [pick('000001.SS'), pick('300750.SZ')].filter(Boolean) as ResolvedEntity[];
  }

  return [pick('^GSPC'), pick('^HSI'), pick('000001.SS')].filter(Boolean) as ResolvedEntity[];
}

async function fetchJsonWithTimeout<T>(
  url: string,
  headers: Record<string, string>,
  timeoutMs = 6000,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchTextWithTimeout(
  url: string,
  headers: Record<string, string>,
  timeoutMs = 6000,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function searchYahooEntity(hint: string): Promise<ResolvedEntity | null> {
  const encoded = encodeURIComponent(hint);
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encoded}&quotesCount=8&newsCount=0&lang=en-US&region=US`;

  try {
    const response = await fetchJsonWithTimeout<Record<string, unknown>>(url, YAHOO_HEADERS, 6000);
    const quotes = Array.isArray(response.quotes)
      ? (response.quotes as Array<Record<string, unknown>>)
      : [];
    const best = quotes.find((quote) =>
      ['EQUITY', 'INDEX', 'ETF'].includes(String(quote?.quoteType || '').toUpperCase()),
    );

    if (!best?.symbol) {
      return null;
    }

    return {
      requested: hint,
      symbol: String(best.symbol),
      market: inferMarketFromSymbol(String(best.symbol)),
      displayName: String(best.longname || best.shortname || best.symbol),
      searchTerms: [
        hint,
        String(best.longname || best.shortname || best.symbol),
        String(best.symbol),
      ],
    };
  } catch {
    return null;
  }
}

async function resolveEntities(request: MarketDataRequest) {
  const explicitHints = flattenEntityHints(request.entities);
  const requestedHints =
    explicitHints.length > 0 ? explicitHints : extractHintsFromQuery(request.query || '');
  const resolved: ResolvedEntity[] = [];
  const unresolved = new Set<string>();

  for (const hint of requestedHints) {
    const preset = findPresetForHint(hint);
    if (preset) {
      resolved.push({
        requested: hint,
        symbol: preset.symbol,
        market: preset.market,
        displayName: preset.displayName,
        searchTerms: preset.searchTerms,
      });
      continue;
    }

    if (SYMBOL_PATTERN.test(hint)) {
      const symbol = formatDirectSymbol(hint);
      resolved.push({
        requested: hint,
        symbol,
        market: inferMarketFromSymbol(symbol),
        displayName: symbol,
        searchTerms: [symbol],
      });
      continue;
    }

    if (!containsChinese(hint)) {
      const searched = await searchYahooEntity(hint);
      if (searched) {
        resolved.push(searched);
        continue;
      }
    }

    unresolved.add(hint);
  }

  const scope = normalizeMarketScope(request.marketScope);
  if (resolved.length === 0) {
    resolved.push(...defaultScopeEntities(scope));
  }

  return {
    resolved: dedupeBy(resolved, (item) => item.symbol),
    unresolved: Array.from(unresolved),
    scope,
  };
}

async function fetchChartSnapshot(entity: ResolvedEntity): Promise<MarketEntitySnapshot | null> {
  const encoded = encodeURIComponent(entity.symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=5d&interval=1d&includePrePost=false&events=div%2Csplits`;

  try {
    const response = await fetchJsonWithTimeout<Record<string, unknown>>(url, YAHOO_HEADERS, 6500);
    const chart = response.chart as Record<string, unknown> | undefined;
    const result = Array.isArray(chart?.result)
      ? (chart.result[0] as Record<string, unknown> | undefined)
      : undefined;
    const meta =
      result?.meta && typeof result.meta === 'object'
        ? (result.meta as Record<string, unknown>)
        : undefined;

    if (!meta?.symbol) {
      return null;
    }

    const previousClose = coerceNumber(meta.chartPreviousClose) ?? coerceNumber(meta.previousClose);
    const regularMarketPrice = coerceNumber(meta.regularMarketPrice);
    const change =
      regularMarketPrice !== null && previousClose !== null
        ? Number((regularMarketPrice - previousClose).toFixed(4))
        : null;
    const changePercent =
      change !== null && previousClose !== null && previousClose !== 0
        ? Number(((change / previousClose) * 100).toFixed(4))
        : null;

    return {
      requested: entity.requested,
      symbol: String(meta.symbol),
      market: entity.market,
      exchange: String(meta.fullExchangeName || meta.exchangeName || entity.market),
      currency: String(meta.currency || ''),
      shortName: String(meta.shortName || entity.displayName || meta.symbol),
      longName: String(meta.longName || meta.shortName || entity.displayName || meta.symbol),
      regularMarketPrice,
      previousClose,
      change,
      changePercent,
      dayHigh: coerceNumber(meta.regularMarketDayHigh),
      dayLow: coerceNumber(meta.regularMarketDayLow),
      volume: coerceNumber(meta.regularMarketVolume),
      fiftyTwoWeekHigh: coerceNumber(meta.fiftyTwoWeekHigh),
      fiftyTwoWeekLow: coerceNumber(meta.fiftyTwoWeekLow),
      marketCap: null,
      marketState: String(meta.exchangeTimezoneName || ''),
      asOf: coerceNumber(meta.regularMarketTime) !== null
        ? new Date(Number(coerceNumber(meta.regularMarketTime)) * 1000).toISOString()
        : null,
      source: 'yahoo-finance',
    };
  } catch {
    return null;
  }
}

async function fetchMarketCap(symbol: string) {
  const encoded = encodeURIComponent(symbol);
  const now = Math.floor(Date.now() / 1000);
  const period1 = now - 60 * 60 * 24 * 365 * 2;
  const url =
    `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encoded}` +
    `?type=trailingMarketCap&period1=${period1}&period2=${now}`;

  try {
    const response = await fetchJsonWithTimeout<Record<string, unknown>>(url, YAHOO_HEADERS, 6500);
    const timeseries = response.timeseries as Record<string, unknown> | undefined;
    const result = Array.isArray(timeseries?.result)
      ? (timeseries.result[0] as Record<string, unknown> | undefined)
      : undefined;
    const series = Array.isArray(result?.trailingMarketCap)
      ? (result.trailingMarketCap as Array<Record<string, unknown>>)
      : [];
    if (!Array.isArray(series) || series.length === 0) {
      return null;
    }

    const latest = [...series]
      .reverse()
      .find((item) =>
        coerceNumber((item.reportedValue as Record<string, unknown> | undefined)?.raw) !== null,
      );

    return latest
      ? coerceNumber((latest.reportedValue as Record<string, unknown> | undefined)?.raw)
      : null;
  } catch {
    return null;
  }
}

function inferPublisherFromTitle(title: string) {
  const parts = title.split(' - ');
  if (parts.length >= 2) {
    return parts[parts.length - 1].trim();
  }

  return 'Google News';
}

function inferHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function scoreNewsItem(item: MarketNewsItem) {
  const publisherText = `${item.publisher || ''} ${inferHostname(item.url)}`.toLowerCase();
  const bodyText = `${item.title || ''} ${item.summary || ''}`.toLowerCase();

  const highSignalPatterns = [
    /reuters/,
    /bloomberg/,
    /wsj/,
    /financial times/,
    /ft\.com/,
    /cnbc/,
    /yahoo finance/,
    /新华网/,
    /财联社/,
    /证券时报/,
    /新浪财经/,
    /东方财富/,
    /华尔街见闻/,
    /21财经/,
    /aastocks/,
    /marketwatch/,
    /barrons/,
  ];

  const lowSignalPatterns = [
    /binance/,
    /mexc/,
    /polymarket/,
    /coinglass/,
    /coinmarketcap/,
    /gate\.io/,
    /okx/,
    /bybit/,
    /kucoin/,
    /kraken/,
  ];

  const lowSignalTitlePatterns = [
    /今日价格/,
    /兑换\s*[A-Z]{3}/,
    /\bderivatives?\b/,
    /投注赔率/,
    /\bprediction\b/,
    /\bbetting\b/,
  ];

  let score = 0;

  if (highSignalPatterns.some((pattern) => pattern.test(publisherText))) {
    score += 4;
  }

  if (lowSignalPatterns.some((pattern) => pattern.test(publisherText))) {
    score -= 8;
  }

  if (lowSignalTitlePatterns.some((pattern) => pattern.test(bodyText))) {
    score -= 6;
  }

  if ((item.relatedSymbols || []).some((symbol) => !String(symbol || '').startsWith('^'))) {
    score += 2;
  }

  if (
    /财报|业绩|回购|监管|交付|需求|订单|earnings|guidance|buyback|deliveries|probe|tariff|fed|cpi|pmi|stimulus|oil/.test(
      bodyText,
    )
  ) {
    score += 1;
  }

  return score;
}

function parseGoogleNewsItems(xml: string, relatedSymbols: string[]) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

  return items
    .map((match) => {
      const block = match[1];
      const title = decodeXmlEntities(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
      const url = decodeXmlEntities(block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '').trim();
      const description = stripHtml(
        block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || '',
      );
      const publishedAt = decodeXmlEntities(
        block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || '',
      ).trim();
      const publisher =
        decodeXmlEntities(block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] || '').trim() ||
        inferPublisherFromTitle(title);

      if (!title || !url) {
        return null;
      }

      return {
        title,
        url,
        publisher,
        summary: description || title,
        publishedAt,
        relatedSymbols,
        source_tier: 2 as const,
        source_type: 'media' as const,
        source: 'google-news' as const,
      };
    })
    .filter(Boolean) as MarketNewsItem[];
}

function buildNewsRequests(
  resolvedEntities: ResolvedEntity[],
  scope: string,
  preferredLanguage: 'zh' | 'en',
) {
  if (resolvedEntities.length > 0) {
    return resolvedEntities.slice(0, 3).map((entity) => {
      const baseTerm = containsChinese(entity.requested)
        ? entity.requested
        : entity.searchTerms[0] || entity.displayName;
      const query =
        preferredLanguage === 'zh' || containsChinese(baseTerm)
          ? `${baseTerm} when:7d`
          : `${baseTerm} stock when:7d`;
      const locale =
        preferredLanguage === 'zh' || containsChinese(baseTerm)
          ? { hl: 'zh-CN', gl: 'CN', ceid: 'CN:zh-Hans' }
          : { hl: 'en-US', gl: 'US', ceid: 'US:en' };

      return {
        query,
        relatedSymbols: [entity.symbol],
        ...locale,
      };
    });
  }

  if (scope === 'us') {
    return [
      {
        query: 'US stock market when:3d',
        relatedSymbols: ['^GSPC', '^IXIC'],
        hl: 'en-US',
        gl: 'US',
        ceid: 'US:en',
      },
    ];
  }

  if (scope === 'hk') {
    return [
      {
        query: '港股 when:3d',
        relatedSymbols: ['^HSI'],
        hl: 'zh-CN',
        gl: 'CN',
        ceid: 'CN:zh-Hans',
      },
    ];
  }

  if (scope === 'cn') {
    return [
      {
        query: 'A股 when:3d',
        relatedSymbols: ['000001.SS'],
        hl: 'zh-CN',
        gl: 'CN',
        ceid: 'CN:zh-Hans',
      },
    ];
  }

  return [
    {
      query: 'US stock market when:3d',
      relatedSymbols: ['^GSPC'],
      hl: 'en-US',
      gl: 'US',
      ceid: 'US:en',
    },
    {
      query: '港股 when:3d',
      relatedSymbols: ['^HSI'],
      hl: 'zh-CN',
      gl: 'CN',
      ceid: 'CN:zh-Hans',
    },
    {
      query: 'A股 when:3d',
      relatedSymbols: ['000001.SS'],
      hl: 'zh-CN',
      gl: 'CN',
      ceid: 'CN:zh-Hans',
    },
  ];
}

async function fetchNews(
  resolvedEntities: ResolvedEntity[],
  scope: string,
  preferredLanguage: 'zh' | 'en',
) {
  const requests = buildNewsRequests(resolvedEntities, scope, preferredLanguage);
  const queries = requests.map((item) => item.query);

  const results = await Promise.all(
    requests.map(async (request) => {
      const params = new URLSearchParams({
        q: request.query,
        hl: request.hl,
        gl: request.gl,
        ceid: request.ceid,
      });
      const url = `https://news.google.com/rss/search?${params.toString()}`;

      try {
        const xml = await fetchTextWithTimeout(url, GOOGLE_NEWS_HEADERS, 6500);
        return parseGoogleNewsItems(xml, request.relatedSymbols).slice(0, 5);
      } catch {
        return [];
      }
    }),
  );

  return {
    queries,
    items: (() => {
      const deduped = dedupeBy(results.flat(), (item) => `${item.title}::${item.url}`);
      const scored = deduped
        .map((item) => ({
          item,
          score: scoreNewsItem(item),
          publishedAtMs: Date.parse(item.publishedAt || '') || 0,
        }))
        .sort((left, right) => right.score - left.score || right.publishedAtMs - left.publishedAtMs);

      const preferred = scored.filter((entry) => entry.score >= 1);
      const usable = preferred.length > 0 ? preferred : scored.filter((entry) => entry.score >= -1);
      const finalItems = (usable.length > 0 ? usable : scored).slice(0, 8);

      return finalItems.map((entry) => entry.item);
    })(),
  };
}

export function marketDataSnapshotToCitations(
  snapshot: MarketDataSnapshot | null,
  startIndex = 1,
): MarketDataCitation[] {
  if (!snapshot) {
    return [];
  }

  return (snapshot.news || []).slice(0, 6).map((item, index) => ({
    title: item.title,
    url: item.url,
    publisher: item.publisher,
    snippet: item.summary,
    source_tier: 2,
    source_type: 'media',
    source_index: startIndex + index,
  }));
}

export function hasUsableMarketData(snapshot: MarketDataSnapshot | null) {
  return Boolean(
    snapshot && ((snapshot.entities?.length || 0) > 0 || (snapshot.news?.length || 0) > 0),
  );
}

export async function fetchMarketDataSnapshot(
  request: MarketDataRequest,
): Promise<MarketDataResult> {
  const preferredLanguage = request.preferredLanguage || 'zh';
  const { resolved, unresolved, scope } = await resolveEntities(request);

  try {
    const entitySnapshots = await Promise.all(
      resolved.slice(0, 4).map(async (entity) => {
        const snapshot = await fetchChartSnapshot(entity);
        if (!snapshot) {
          return null;
        }

        if (snapshot.market !== 'INDEX') {
          snapshot.marketCap = await fetchMarketCap(snapshot.symbol);
        }

        return snapshot;
      }),
    );

    const { queries, items: news } = await fetchNews(resolved, scope, preferredLanguage);
    const entities = entitySnapshots.filter(Boolean) as MarketEntitySnapshot[];
    const requestedEntities =
      flattenEntityHints(request.entities).length > 0
        ? flattenEntityHints(request.entities)
        : extractHintsFromQuery(request.query || '');

    const snapshot: MarketDataSnapshot = {
      scope,
      entities,
      news,
      diagnostics: {
        requested_entities: requestedEntities,
        resolved_symbols: resolved.map((item) => item.symbol),
        unresolved_entities: unresolved,
        news_queries: queries,
      },
    };

    if (!hasUsableMarketData(snapshot)) {
      return {
        available: false,
        source: 'yahoo-finance+google-news',
        snapshot,
        error:
          unresolved.length > 0
            ? `No usable market data resolved for: ${unresolved.join(', ')}`
            : 'No usable market data available',
      };
    }

    return {
      available: true,
      source: 'yahoo-finance+google-news',
      snapshot,
    };
  } catch (error: unknown) {
    return {
      available: false,
      source: 'yahoo-finance+google-news',
      snapshot: null,
      error: error instanceof Error ? error.message : 'Unknown market data adapter error',
    };
  }
}

