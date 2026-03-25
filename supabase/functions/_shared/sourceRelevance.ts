export interface SourceCandidate {
  title: string;
  url: string;
  publisher?: string;
  snippet?: string;
  source_tier?: number;
  source_type?: string;
  source_index?: number;
}

export interface FilterRelevantSourcesOptions {
  query: string;
  classifier?: Record<string, any>;
  explicitEntities?: unknown[];
  maxItems?: number;
}

export interface FilterRelevantSourcesResult<T extends SourceCandidate> {
  sources: T[];
  droppedCount: number;
  appliedStrictFilter: boolean;
  entityKeywords: string[];
}

const LOW_SIGNAL_DOMAIN_FRAGMENTS = [
  'dictionary.com',
  'dictionary.cambridge.org',
  'merriam-webster.com',
  'wiktionary.org',
  'wikipedia.org',
  'reddit.com',
  'github.com',
  'investopedia.com',
];

const LOW_SIGNAL_TITLE_PATTERNS = [
  /\bdefinition\b/i,
  /\bmeaning\b/i,
  /\bdictionary\b/i,
  /\breadme\b/i,
  /\bglossary\b/i,
  /\btemplate\b/i,
  /\bpronunciation\b/i,
  /\bexample sentence\b/i,
];

const ENTITY_MISMATCH_PATTERNS = [
  /\bunrelated to\b/i,
  /\bnot related to\b/i,
  /\boff-topic\b/i,
  /\binsufficient evidence\b/i,
  /\bno (?:directly )?relevant (?:information|evidence|sources)\b/i,
  /\bno (?:company|market|financial) information\b/i,
  /\bcannot (?:generate|build|provide)\b/i,
  /\bsource(?:s)? (?:do|does) not match\b/i,
  /无法生成/,
  /不匹配/,
  /无关/,
  /没有任何.*相关/,
  /证据不足/,
  /缺乏.*信息/,
];

const GENERIC_ENGLISH_STOPWORDS = new Set([
  'what',
  'view',
  'think',
  'latest',
  'market',
  'markets',
  'stock',
  'stocks',
  'company',
  'research',
  'analysis',
  'answer',
  'briefing',
  'bull',
  'bear',
  'thesis',
  'risk',
  'risks',
  'scenario',
  'scenarios',
  'source',
  'sources',
  'please',
  'today',
  'give',
  'with',
  'from',
  'into',
  'about',
  'should',
  'could',
  'would',
  'your',
]);

const GENERIC_CHINESE_PHRASES = [
  '你怎么看',
  '请给出',
  '请用研究型回答',
  '不要给交易指令',
  '重点讲',
  '风险点',
  '情景分析',
  '研究型回答',
  '生成简报',
  '市场晨报',
  '公司一页纸',
  '事件快报',
  '最新消息',
  '请用中文回答',
  '明确立场',
  '来源',
  '今天',
  '最重要',
  '是什么',
  '可以',
  '一个',
  '问题',
  '回答',
  '研究',
  '分析',
  '简报',
  '市场',
];

function uniqueStrings(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function hasChinese(text: string) {
  return /[\u3400-\u9fff]/.test(text);
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeToken(token: string) {
  return token.trim().toLowerCase();
}

function flattenEntityValues(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenEntityValues(item));
  }

  if (typeof value === 'object') {
    const entry = value as Record<string, unknown>;
    return [
      ...flattenEntityValues(entry.name),
      ...flattenEntityValues(entry.symbol),
      ...flattenEntityValues(entry.ticker),
      ...flattenEntityValues(entry.code),
      ...flattenEntityValues(entry.alias),
      ...flattenEntityValues(entry.aliases),
      ...flattenEntityValues(entry.value),
    ];
  }

  return [];
}

function stripInstructionalPhrases(query: string) {
  let normalized = query;

  for (const phrase of GENERIC_CHINESE_PHRASES) {
    normalized = normalized.replace(new RegExp(escapeRegExp(phrase), 'gi'), ' ');
  }

  normalized = normalized.replace(
    /\b(what do you think of|please answer in chinese|research style|do not give trading instructions|thesis[- ]first|give me|tell me about)\b/gi,
    ' '
  );

  return normalized;
}

function extractKeywordHints(query: string) {
  const stripped = stripInstructionalPhrases(query);
  const englishTokens = (stripped.toLowerCase().match(/\b[a-z0-9][a-z0-9.\-]{1,15}\b/g) || [])
    .filter((token) => token.length >= 2)
    .filter((token) => !GENERIC_ENGLISH_STOPWORDS.has(token))
    .filter((token) => !/^\d+$/.test(token));

  const chineseTokens = (stripped.match(/[\u3400-\u9fff]{2,10}/g) || [])
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter(
      (token) =>
        !GENERIC_CHINESE_PHRASES.some((phrase) => phrase.includes(token) || token.includes(phrase))
    );

  const tickerTokens = (query.match(/\b[A-Z]{1,6}(?:\.[A-Z]{1,4})?\b/g) || []).map((token) =>
    token.toLowerCase()
  );

  return uniqueStrings([...chineseTokens, ...englishTokens, ...tickerTokens]).slice(0, 12);
}

function isMacroLikeQuery(query: string, classifier?: Record<string, any>) {
  const queryType = String(classifier?.query_type || '').toLowerCase();
  if (queryType.includes('macro')) {
    return true;
  }

  return /宏观|利率|美股|非农|cpi|fed|fomc|rates?|inflation|economy|recession|yield/i.test(query);
}

function matchToken(haystack: string, token: string) {
  const normalizedToken = normalizeToken(token);
  if (!normalizedToken) {
    return false;
  }

  if (hasChinese(normalizedToken)) {
    return haystack.includes(normalizedToken);
  }

  if (haystack.includes(`/${normalizedToken}`) || haystack.includes(`=${normalizedToken}`)) {
    return true;
  }

  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedToken)}([^a-z0-9]|$)`, 'i').test(haystack);
}

function buildDisplayHaystack(source: SourceCandidate) {
  return `${source.title || ''} ${source.publisher || ''} ${source.url || ''}`.toLowerCase();
}

function buildSnippetHaystack(source: SourceCandidate) {
  return `${source.snippet || ''}`.toLowerCase();
}

function isClearlyLowSignalSource(source: SourceCandidate) {
  const haystack = buildDisplayHaystack(source);

  if (LOW_SIGNAL_DOMAIN_FRAGMENTS.some((fragment) => haystack.includes(fragment))) {
    return true;
  }

  return LOW_SIGNAL_TITLE_PATTERNS.some((pattern) => pattern.test(source.title || ''));
}

function hasEntityMismatchSignal(source: SourceCandidate, entityKeywords: string[]) {
  if (entityKeywords.length === 0) {
    return false;
  }

  const combinedText = `${source.title || ''} ${source.snippet || ''}`.toLowerCase();
  const mentionsEntity = entityKeywords.some((token) => matchToken(combinedText, token));

  if (!mentionsEntity) {
    return false;
  }

  return ENTITY_MISMATCH_PATTERNS.some((pattern) => pattern.test(combinedText));
}

export function filterRelevantSources<T extends SourceCandidate>(
  sources: T[],
  options: FilterRelevantSourcesOptions
): FilterRelevantSourcesResult<T> {
  const maxItems = options.maxItems || 6;
  const queryKeywords = extractKeywordHints(options.query);
  const entityKeywords = uniqueStrings([
    ...flattenEntityValues(options.explicitEntities || []),
    ...flattenEntityValues(options.classifier?.primary_entities || []),
  ])
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .slice(0, 10);

  const appliedStrictFilter =
    entityKeywords.length > 0 && !isMacroLikeQuery(options.query, options.classifier);

  const scored = sources
    .map((source) => {
      const displayHaystack = buildDisplayHaystack(source);
      const snippetHaystack = buildSnippetHaystack(source);
      const combinedHaystack = `${displayHaystack} ${snippetHaystack}`.trim();
      const displayEntityHits = entityKeywords.filter((token) =>
        matchToken(displayHaystack, token)
      ).length;
      const snippetEntityHits = entityKeywords.filter((token) =>
        matchToken(snippetHaystack, token)
      ).length;
      const displayKeywordHits = queryKeywords.filter((token) =>
        matchToken(displayHaystack, token)
      ).length;
      const snippetKeywordHits = queryKeywords.filter((token) =>
        matchToken(snippetHaystack, token)
      ).length;
      const financeSignalHits =
        combinedHaystack.match(
          /earnings|guidance|results|investor|10-k|10-q|annual report|quarter|filing|公告|财报|年报|季报|业绩|电话会|港交所|sec|nasdaq|nyse/gi
        )?.length || 0;
      const tierBonus = source.source_tier === 1 ? 3 : source.source_tier === 2 ? 2 : 0;
      const lowSignal = isClearlyLowSignalSource(source);
      const mismatchSignal = hasEntityMismatchSignal(source, entityKeywords);

      return {
        source,
        displayEntityHits,
        totalEntityHits: displayEntityHits + snippetEntityHits,
        totalKeywordHits: displayKeywordHits + snippetKeywordHits,
        lowSignal,
        mismatchSignal,
        score:
          displayEntityHits * 8 +
          snippetEntityHits * 2 +
          displayKeywordHits * 3 +
          snippetKeywordHits +
          financeSignalHits +
          tierBonus -
          (lowSignal ? 100 : 0) -
          (mismatchSignal ? 80 : 0),
      };
    })
    .filter((item) => !item.lowSignal)
    .filter((item) => !item.mismatchSignal);

  const filtered = appliedStrictFilter
    ? scored.filter((item) => {
        const tier = item.source.source_tier || 3;

        if (item.displayEntityHits > 0) {
          return true;
        }

        if (tier <= 2 && item.totalEntityHits > 0) {
          return true;
        }

        return false;
      })
    : scored.filter((item) => item.score >= 2 || (item.source.source_tier || 3) <= 2);

  const ranked = filtered
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if ((left.source.source_tier || 3) !== (right.source.source_tier || 3)) {
        return (left.source.source_tier || 3) - (right.source.source_tier || 3);
      }

      return (left.source.source_index || 999) - (right.source.source_index || 999);
    })
    .slice(0, maxItems)
    .map((item, index) => ({
      ...item.source,
      source_index: index + 1,
    }));

  return {
    sources: ranked as T[],
    droppedCount: Math.max(sources.length - ranked.length, 0),
    appliedStrictFilter,
    entityKeywords,
  };
}
