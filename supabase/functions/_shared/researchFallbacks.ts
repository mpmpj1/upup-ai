import {
  buildOutOfScopeStructuredOutput,
  normalizeStructuredOutput,
  type CitationItem,
  type ResearchConversationContinuity,
  type ResearchStructuredOutput,
  type ResearchTaskType,
} from './researchSchemas.ts';

type FallbackTemplate = {
  aliases: string[];
  zh: Partial<ResearchStructuredOutput>;
  en: Partial<ResearchStructuredOutput>;
};

const FALLBACK_TEMPLATES: FallbackTemplate[] = [
  {
    aliases: ['tesla', 'tsla', '特斯拉'],
    zh: {
      current_view: '高波动，谨慎偏多',
      direct_answer: '即使实时检索暂时不完整，特斯拉当前仍更像一个高波动、谨慎偏多的 thesis：上行来自成本曲线、储能和自动驾驶可选性，下行来自估值、需求弹性和执行波动。',
      core_judgment: '特斯拉不是“好公司就一定值得买”的简单命题，而是一个对远期盈利兑现高度敏感的长期 thesis。真正的分歧在于未来两三年盈利质量能否重新匹配市场给它的想象空间。',
      bull_case: [
        '制造效率和成本曲线仍然是重要护城河，只要单位成本继续下行，价格压力未必只会伤害特斯拉。',
        '储能、软件和自动驾驶仍然提供估值可选性，即使兑现节奏慢于市场最乐观预期。',
        '品牌、渠道和现金流弹性让它在行业波动里比多数对手更能扛。',
      ],
      bear_case: [
        '估值已经计入了很多远期乐观预期，兑现稍慢就可能先经历估值压缩。',
        '需求和定价权并不稳定，销量、ASP 和毛利之间需要持续权衡。',
        '管理层叙事能力强，但执行波动也会被市场放大。',
      ],
      key_variables: ['汽车毛利率', '自动驾驶商业化兑现', '储能与软件收入占比'],
      strongest_counterargument: '最强反方是：如果自动驾驶长期不能商业化，而价格战又持续，特斯拉会同时失去成长溢价和盈利支撑。',
      mind_change_conditions: [
        '如果价格战导致毛利率持续恶化且看不到修复迹象，我会明显转弱。',
        '如果自动驾驶长期无法通过监管和商业化验证，我会下调估值持续性的判断。',
        '如果储能和软件不能成为第二增长曲线，长期 thesis 会被削弱。',
      ],
      one_line_takeaway: '特斯拉的关键不是“车卖得好不好”，而是盈利质量能否重新配得上市场给它的远期故事。',
    },
    en: {
      current_view: 'High-volatility, cautious bullish',
      direct_answer: 'Even with incomplete live retrieval, Tesla still looks like a high-volatility cautious-bullish thesis: upside comes from cost curve, energy, and autonomy optionality, while downside comes from valuation, demand elasticity, and execution swings.',
      core_judgment: 'Tesla is not an automatic buy because it is a strong company; it is a long-duration thesis whose valuation depends on whether earnings quality eventually catches up with narrative optionality.',
      bull_case: [
        'Cost curve leadership still matters, so price pressure does not automatically destroy the thesis.',
        'Energy, software, and autonomy optionality still matter even if realization is slower than bulls expect.',
        'Brand, distribution control, and balance-sheet flexibility remain strategic advantages.',
      ],
      bear_case: [
        'Valuation already prices in a lot of future success.',
        'Demand elasticity and pricing power are not stable in a more competitive EV market.',
        'Execution volatility remains part of the story, not a side issue.',
      ],
      key_variables: ['auto gross margin', 'autonomy commercialization', 'energy/software mix'],
      strongest_counterargument: 'The strongest counterargument is that if autonomy remains delayed and pricing pressure persists, Tesla loses both multiple support and earnings support at the same time.',
      mind_change_conditions: [
        'I would turn materially weaker if gross margin keeps deteriorating with no sign of recovery.',
        'I would cut the valuation case if autonomy remains commercially distant and regulatorily constrained.',
        'I would downgrade the long-term thesis if energy and software fail to become a true second growth engine.',
      ],
      one_line_takeaway: 'Tesla only works if future earnings quality eventually catches up with the market’s long-duration story.',
    },
  },
  {
    aliases: ['tencent', '0700.hk', 'tcehy', '腾讯'],
    zh: {
      current_view: '现金流稳，重估仍有空间',
      direct_answer: '即使实时检索暂时不完整，腾讯的基准判断仍偏正面：核心逻辑是社交流量、游戏和广告现金流，以及持续回购；主要压制因素则是监管、游戏周期和估值折价。',
      core_judgment: '腾讯更像“现金流强但估值仍受折价”的平台龙头，真正分歧不在业务是否优质，而在市场何时愿意重新给它更接近全球平台公司的估值框架。',
      bull_case: [
        '微信生态和流量分发能力仍是底层资产，广告、支付和内容变现具备复合弹性。',
        '游戏与广告形成现金流双引擎，回购和分红进一步抬升股东回报质量。',
        '当监管预期稳定、回购持续推进时，估值修复空间仍在。',
      ],
      bear_case: [
        '监管折价不一定轻易消失，估值上限始终受压。',
        '游戏增长带有周期性，产品节奏一旦失手，利润预期容易下修。',
        '如果宏观消费和广告预算修复不足，广告弹性会被削弱。',
      ],
      key_variables: ['广告恢复斜率', '游戏产品周期', '回购与分红强度'],
      strongest_counterargument: '最强反方是：腾讯不是没有价值，而是长期都可能被监管和流动性折价压在更低的估值区间里。',
      mind_change_conditions: [
        '如果广告和游戏同时弱于预期，我会下调对现金流稳定性的判断。',
        '如果监管环境重新明显收紧，估值修复逻辑会被打断。',
        '如果资本回报承诺转弱，股东回报 thesis 会被削弱。',
      ],
      one_line_takeaway: '腾讯的关键不是“业务好不好”，而是“监管和流动性折价何时松动，现金流价值何时重新被定价”。',
    },
    en: {
      current_view: 'Strong cash flow with room for re-rating',
      direct_answer: 'Even with incomplete live retrieval, Tencent still looks constructive: the core thesis is social-traffic monetization, gaming and ads cash flow, and sustained buybacks, while the key drag remains regulation, game cyclicality, and valuation discount.',
      core_judgment: 'Tencent is less a “does the business work?” story and more a “when does the market stop applying a persistent discount?” story.',
      bull_case: [
        'WeChat remains a foundational asset with monetization optionality across ads, payments, and content.',
        'Gaming plus ads creates durable cash generation, and buybacks improve shareholder return quality.',
        'If regulation stabilizes and capital return stays strong, re-rating remains plausible.',
      ],
      bear_case: [
        'Regulatory discount may remain structurally persistent.',
        'Gaming growth is cyclical and product cadence matters a lot.',
        'Advertising recovery remains exposed to macro softness.',
      ],
      key_variables: ['ad recovery slope', 'game launch cadence', 'capital return intensity'],
      strongest_counterargument: 'The strongest counterargument is that Tencent may remain a discounted platform asset for far longer than bulls expect, even if the business stays high quality.',
      mind_change_conditions: [
        'I would weaken the cash-flow thesis if ads and gaming both undershoot at the same time.',
        'I would reduce the re-rating case if regulation visibly tightens again.',
        'I would turn more cautious if management steps back from capital return discipline.',
      ],
      one_line_takeaway: 'Tencent is fundamentally a discount-to-intrinsic-value debate, not a question of whether the core business is real.',
    },
  },
  {
    aliases: ['catl', '300750.sz', '宁德时代'],
    zh: {
      current_view: '龙头地位仍在，但周期变量不能忽略',
      direct_answer: '即使实时检索暂时不完整，宁德时代仍是“龙头地位仍在，但周期变量不能忽略”的判断：长期竞争力强，短期要盯住行业供需、价格和资本开支。',
      core_judgment: '宁德时代的 thesis 不是“产业趋势好就一定赢”，而是看它能否在行业价格波动里继续守住份额、盈利能力和技术领先。',
      bull_case: [
        '产业链位置和技术积累仍然领先，头部客户关系具备粘性。',
        '如果行业供需重新改善，龙头盈利弹性可能强于市场预期。',
        '海外和储能扩张为中期增长提供增量。',
      ],
      bear_case: [
        '电池行业价格波动和产能周期仍会压制利润率。',
        '如果下游需求修复不足，龙头也很难独善其身。',
        '海外扩张和资本开支若回报不及预期，会拖累估值。',
      ],
      key_variables: ['单位盈利能力', '行业供需平衡', '海外与储能扩张质量'],
      strongest_counterargument: '最强反方是：即便宁德时代是龙头，只要行业进入更长时间的价格竞争周期，龙头估值也会持续受压。',
      mind_change_conditions: [
        '如果单位盈利能力持续下台阶且没有改善迹象，我会转弱。',
        '如果海外扩张无法带来更高质量增长，我会下调中期空间判断。',
        '如果储能和新技术路线不能形成新增量，长期溢价会收缩。',
      ],
      one_line_takeaway: '宁德时代真正要证明的不是行业趋势，而是它能否在周期里把龙头优势变成更稳定的盈利质量。',
    },
    en: {
      current_view: 'Category leader, but still cyclical',
      direct_answer: 'Even with incomplete live retrieval, CATL still looks like a category leader whose long-term edge is real, but whose near-term thesis remains tied to supply-demand balance, pricing, and capex discipline.',
      core_judgment: 'CATL is not a simple “battery demand goes up, therefore buy” story. The real question is whether it can convert scale and technology leadership into more resilient profitability through the cycle.',
      bull_case: [
        'Technology leadership and customer relationships still matter.',
        'If industry supply-demand rebalances, leader-level earnings leverage can surprise positively.',
        'Energy storage and overseas growth still offer medium-term optionality.',
      ],
      bear_case: [
        'Pricing and capacity cycles can still compress margins.',
        'Weak downstream demand would hit even the leader.',
        'Overseas expansion and capex can disappoint on returns.',
      ],
      key_variables: ['unit profitability', 'industry supply-demand balance', 'quality of overseas and storage growth'],
      strongest_counterargument: 'The strongest counterargument is that even the leader can stay stuck in a long valuation compression phase if the industry remains trapped in a pricing cycle.',
      mind_change_conditions: [
        'I would turn weaker if unit profitability keeps stepping down with no stabilization.',
        'I would reduce the medium-term upside case if overseas expansion fails to improve growth quality.',
        'I would cut the long-term premium if new technology and storage fail to become real incremental drivers.',
      ],
      one_line_takeaway: 'CATL still has the strongest long-term positioning, but it must prove that leadership can translate into cycle-resistant earnings quality.',
    },
  },
];

function normalizeText(text: string) {
  return String(text || '').trim().toLowerCase();
}

function resolveTemplate(subject: string, query: string) {
  const haystack = `${subject} ${query}`.toLowerCase();
  return FALLBACK_TEMPLATES.find((template) =>
    template.aliases.some((alias) => haystack.includes(normalizeText(alias))),
  );
}

function genericVariablesByMarket(marketScope: string, language: 'zh' | 'en') {
  if (marketScope === 'hk') {
    return language === 'zh'
      ? ['估值折价何时修复', '流动性与南向资金', '盈利兑现与资本回报']
      : ['timing of valuation repair', 'liquidity and southbound flows', 'earnings delivery and capital return'];
  }
  if (marketScope === 'cn') {
    return language === 'zh'
      ? ['政策方向与监管变化', '行业景气与供需格局', '业绩兑现与估值预期差']
      : ['policy and regulation', 'industry supply-demand balance', 'earnings delivery versus expectations'];
  }
  return language === 'zh'
    ? ['收入增长持续性', '利润率与经营杠杆', '估值与市场预期差']
    : ['growth durability', 'margin structure and operating leverage', 'valuation versus expectations'];
}

export function buildFallbackStructuredOutput(params: {
  query: string;
  subject: string;
  marketScope: string;
  taskType: ResearchTaskType;
  continuity?: ResearchConversationContinuity;
  language: 'zh' | 'en';
  citations?: CitationItem[];
  complianceFlags?: string[];
}) {
  if (params.taskType === 'out_of_scope') {
    return buildOutOfScopeStructuredOutput(params.language);
  }

  const template = resolveTemplate(params.subject, params.query);
  const base = template ? (params.language === 'zh' ? template.zh : template.en) : null;

  const generic = normalizeStructuredOutput(
    {
      subject: params.subject,
      current_view: params.language === 'zh' ? '等待更多实时证据验证' : 'Needs more live evidence',
      direct_answer: params.language === 'zh'
        ? '实时检索链路当前不完整，所以我先给出一个可讨论、可更新的 provisional thesis，而不是返回空结果。'
        : 'Live retrieval is incomplete right now, so I am returning a usable provisional thesis instead of an empty result.',
      core_judgment: params.language === 'zh'
        ? `${params.subject} 目前更适合用“先看盈利质量与预期差，再看价格波动”的框架来判断。`
        : `${params.subject} is better framed through earnings quality versus expectations, not short-term price action alone.`,
      bull_case: params.language === 'zh'
        ? ['如果基本面兑现好于预期，市场会重新给出更高信心。', '如果关键变量改善，当前分歧可能向多头方向收敛。']
        : ['If fundamentals deliver better than expected, conviction can re-rate higher.', 'If the key variables improve, the current debate can resolve in the bull direction.'],
      bear_case: params.language === 'zh'
        ? ['如果盈利质量弱于预期，价格本身不是 thesis，而只是结果。', '如果关键变量恶化，当前判断需要及时转弱。']
        : ['If earnings quality disappoints, price action is a result rather than the thesis.', 'If the key variables deteriorate, the current view should weaken quickly.'],
      key_variables: genericVariablesByMarket(params.marketScope, params.language),
      strongest_counterargument: params.language === 'zh'
        ? '最强反方是：市场担心的不是故事是否成立，而是故事能否最终转化成盈利。'
        : 'The strongest counterargument is that the market is not doubting the story, it is doubting whether the story converts into earnings.',
      mind_change_conditions: params.language === 'zh'
        ? ['如果关键变量持续恶化，我会明显转弱。', '如果新信息直接削弱盈利兑现，我会下调判断。']
        : ['I would turn weaker if the key variables deteriorate persistently.', 'I would downgrade the thesis if new information directly weakens earnings delivery.'],
      one_line_takeaway: params.language === 'zh'
        ? '先抓最影响判断的变量，不要把短期涨跌误当成 thesis 本身。'
        : 'Anchor on the variables that change the judgment, not on price moves alone.',
    },
    {
      taskType: params.taskType,
      marketScope: params.marketScope,
      subject: params.subject,
      language: params.language,
      citations: params.citations,
      complianceFlags: params.complianceFlags,
      degraded: true,
    },
  );

  if (!base) {
    return generic;
  }

  return normalizeStructuredOutput(base, {
    taskType: params.taskType,
    marketScope: params.marketScope,
    subject: params.subject,
    language: params.language,
    citations: params.citations,
    complianceFlags: params.complianceFlags,
    degraded: true,
  });
}
