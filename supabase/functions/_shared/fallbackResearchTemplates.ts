type ConfidenceLevel = 'low' | 'medium' | 'high';

export type TemplateThesisPoint = {
  title: string;
  summary: string;
};

export type TemplateScenarioPoint = {
  name: string;
  probability: ConfidenceLevel;
  description: string;
};

export type TemplateRiskPoint = {
  title: string;
  impact: ConfidenceLevel;
  description: string;
};

export type TemplateResearchPack = {
  aliases: string[];
  stance: {
    label: string;
    confidence: ConfidenceLevel;
    summary: string;
  };
  bull: TemplateThesisPoint[];
  bear: TemplateThesisPoint[];
  scenarios: TemplateScenarioPoint[];
  risks: TemplateRiskPoint[];
};

type TemplateEntry = {
  aliases: string[];
  zh: TemplateResearchPack;
  en: TemplateResearchPack;
};

const TEMPLATE_LIBRARY: TemplateEntry[] = [
  {
    aliases: ['tesla', '特斯拉', 'tsla'],
    zh: {
      aliases: ['tesla', '特斯拉', 'tsla'],
      stance: {
        label: '中性偏多',
        confidence: 'low',
        summary:
          '这是一份非实时兜底观点。若暂时不依赖本轮最新来源，我对 Tesla 更接近“高波动的中性偏多”：多头核心在制造效率、能源业务和自动驾驶可选性，空头核心在高估值、需求弹性与执行波动。',
      },
      bull: [
        {
          title: '制造与成本曲线仍是核心护城河',
          summary: '只要 Tesla 还能持续做成本下探和供应链优化，价格战就不一定只会伤害它，也可能反而挤压更弱的竞争对手。',
        },
        {
          title: '汽车之外的能源与 AI 可选性仍然值钱',
          summary: '储能、软件和 Robotaxi/FSD 叙事让 Tesla 不只是传统整车厂，哪怕兑现节奏慢，这些可选性仍支撑估值溢价的一部分。',
        },
        {
          title: '品牌、渠道与现金流弹性提供战略空间',
          summary: '在行业波动里，Tesla 仍比多数车企拥有更强的品牌心智、直销能力和资本配置自由度。',
        },
      ],
      bear: [
        {
          title: '估值已经把太多远期乐观预期提前计价',
          summary: '如果 Robotaxi、FSD 或能源业务兑现慢于预期，Tesla 很容易先经历估值压缩，再谈基本面验证。',
        },
        {
          title: '需求与定价权并不稳固',
          summary: '全球 EV 竞争加剧后，Tesla 需要在销量、ASP 和毛利之间不断权衡，利润率波动仍是核心空头抓手。',
        },
        {
          title: '马斯克式执行带来额外波动溢价',
          summary: '管理层叙事能力很强，但也意味着组织重点、产品节奏和监管摩擦更容易放大市场波动。',
        },
      ],
      scenarios: [
        {
          name: '牛市情景',
          probability: 'low',
          description: '若自动驾驶商业化叙事重新被验证，同时能源与新车型贡献改善，市场会重新愿意给 Tesla 更高的增长溢价。',
        },
        {
          name: '基准情景',
          probability: 'medium',
          description: '汽车主业维持增长但利润率反复，能源与软件贡献逐步抬升，股价更多在“兑现一点、怀疑一点”的拉锯中波动。',
        },
        {
          name: '熊市情景',
          probability: 'medium',
          description: '若价格战延长、交付承压、自动驾驶兑现继续后移，Tesla 会先面对估值压缩，再承受基本面下修。',
        },
      ],
      risks: [
        {
          title: '毛利率与定价风险',
          impact: 'high',
          description: '销量目标和价格策略之间的平衡一旦失控，利润率会比市场预期更脆弱。',
        },
        {
          title: '自动驾驶监管与兑现风险',
          impact: 'high',
          description: 'FSD/Robotaxi 叙事如果无法顺利过监管和商业化验证，估值支撑会被削弱。',
        },
        {
          title: '竞争加剧风险',
          impact: 'high',
          description: '中国和全球 EV 厂商同时卷价格、卷配置时，Tesla 的相对优势未必像过去那样显著。',
        },
      ],
    },
    en: {
      aliases: ['tesla', '特斯拉', 'tsla'],
      stance: {
        label: 'Cautious Bullish',
        confidence: 'low',
        summary:
          'This is a non-live fallback view. Without fresh sources, Tesla still looks like a high-volatility cautious bullish thesis: the upside rests on manufacturing efficiency, energy optionality, and autonomy, while the downside rests on valuation, demand elasticity, and execution swings.',
      },
      bull: [
        {
          title: 'Manufacturing and cost curve still matter',
          summary: 'If Tesla keeps driving unit-cost improvements, pricing pressure does not automatically destroy the thesis and may hurt weaker competitors more.',
        },
        {
          title: 'Energy and autonomy still create optionality',
          summary: 'Tesla is valued as more than an automaker because software, energy, and robotaxi optionality can still matter even with slower realization.',
        },
        {
          title: 'Brand and balance-sheet flexibility remain valuable',
          summary: 'Tesla retains more brand power, distribution control, and strategic flexibility than many legacy automakers in a volatile EV market.',
        },
      ],
      bear: [
        {
          title: 'Valuation already prices in a lot of future success',
          summary: 'If autonomy, energy, or margin recovery arrive later than expected, Tesla can suffer meaningful multiple compression.',
        },
        {
          title: 'Demand and pricing power are not stable',
          summary: 'Tesla still has to trade off volume, ASP, and margins in an increasingly competitive EV market.',
        },
        {
          title: 'Execution volatility is part of the story',
          summary: 'Leadership-driven optionality can help upside, but it also amplifies swings in product timing, regulation, and investor expectations.',
        },
      ],
      scenarios: [
        {
          name: 'Bull case',
          probability: 'low',
          description: 'Autonomy progress and stronger energy economics revive the growth premium and support another re-rating cycle.',
        },
        {
          name: 'Base case',
          probability: 'medium',
          description: 'Autos stay competitive but volatile, while energy and software gradually offset part of the margin pressure.',
        },
        {
          name: 'Bear case',
          probability: 'medium',
          description: 'A prolonged price war plus delayed autonomy monetization forces valuation compression and lower earnings expectations.',
        },
      ],
      risks: [
        {
          title: 'Margin volatility',
          impact: 'high',
          description: 'Tesla remains exposed to swings in pricing, mix, and operating leverage.',
        },
        {
          title: 'Autonomy execution and regulation',
          impact: 'high',
          description: 'The autonomy narrative can support valuation, but failure to commercialize or clear regulation would weaken the thesis.',
        },
        {
          title: 'Competition risk',
          impact: 'high',
          description: 'Global EV competition can erode Tesla’s relative advantage faster than the market expects.',
        },
      ],
    },
  },
  {
    aliases: ['腾讯', 'tencent', 'tencent holdings', '0700.hk', 'tcehy'],
    zh: {
      aliases: ['腾讯', 'tencent', 'tencent holdings', '0700.hk', 'tcehy'],
      stance: {
        label: '中性偏多',
        confidence: 'low',
        summary:
          '这是一份非实时兜底观点。若不依赖本轮最新来源，我对腾讯的基准判断仍是“中性偏多”：核心在微信生态、游戏与广告现金流、以及持续回购；主要压制在监管、游戏周期和估值折价。',
      },
      bull: [
        {
          title: '微信生态和流量分发能力仍是底层资产',
          summary: '微信/视频号/社交流量让腾讯拥有跨广告、支付、内容与小程序商业化的复合变现能力。',
        },
        {
          title: '游戏与广告形成现金流双引擎',
          summary: '只要游戏产品周期不失速，广告效率继续修复，腾讯的自由现金流和回购能力就仍有支撑。',
        },
        {
          title: '资本配置改善能抬升股东回报',
          summary: '近年来更强调回购、分红和投资组合梳理，这会让腾讯从“只会扩张”转向“更重视股东回报”。',
        },
      ],
      bear: [
        {
          title: '监管变量始终压着估值上限',
          summary: '平台、内容、游戏版号、金融科技等监管风险不会完全消失，市场因此长期给腾讯打折。',
        },
        {
          title: '游戏增长具有明显周期性',
          summary: '爆款周期和产品节奏一旦不顺，腾讯的利润预期容易被下修，市场也会质疑其增长质量。',
        },
        {
          title: '广告与消费修复仍受宏观环境影响',
          summary: '如果国内消费、品牌预算或互联网流量效率恢复不及预期，广告业务弹性会被削弱。',
        },
      ],
      scenarios: [
        {
          name: '牛市情景',
          probability: 'low',
          description: '广告、游戏、视频号与回购共同发力，市场重新接受“高现金流平台型龙头”的估值框架。',
        },
        {
          name: '基准情景',
          probability: 'medium',
          description: '基本盘稳定、增长不算爆发，但持续回购和经营韧性足以支撑中性偏多判断。',
        },
        {
          name: '熊市情景',
          probability: 'medium',
          description: '监管再起波澜、游戏周期走弱、广告修复受阻时，腾讯会继续被困在估值折价里。',
        },
      ],
      risks: [
        {
          title: '监管风险',
          impact: 'high',
          description: '平台和内容监管的不确定性，会持续影响估值和业务节奏。',
        },
        {
          title: '游戏产品周期风险',
          impact: 'high',
          description: '游戏作为利润核心板块，一旦产品储备或版号节奏不顺，盈利预期容易承压。',
        },
        {
          title: '宏观广告风险',
          impact: 'medium',
          description: '广告预算和品牌投放修复不及预期，会压缩腾讯广告业务的弹性。',
        },
      ],
    },
    en: {
      aliases: ['腾讯', 'tencent', 'tencent holdings', '0700.hk', 'tcehy'],
      stance: {
        label: 'Cautious Bullish',
        confidence: 'low',
        summary:
          'This is a non-live fallback view. Without fresh sources, Tencent still screens as cautious bullish: WeChat ecosystem strength, gaming and advertising cash flow, and buybacks support the thesis, while regulation, game-cycle volatility, and a persistent valuation discount cap upside.',
      },
      bull: [
        {
          title: 'WeChat ecosystem remains the base asset',
          summary: 'WeChat, Video Accounts, payments, and mini-programs still create a multi-layer monetization engine.',
        },
        {
          title: 'Gaming and ads remain dual cash-flow engines',
          summary: 'If game pipelines stay resilient and ad monetization improves, Tencent keeps strong free-cash-flow support.',
        },
        {
          title: 'Capital allocation is getting more shareholder-friendly',
          summary: 'Buybacks, dividends, and portfolio discipline can help close part of the conglomerate discount.',
        },
      ],
      bear: [
        {
          title: 'Regulation still caps valuation',
          summary: 'The market continues to apply a discount because platform, content, gaming, and fintech regulation remain live risks.',
        },
        {
          title: 'Gaming growth is cyclical',
          summary: 'Weak product cycles or approval delays can quickly pressure sentiment and earnings expectations.',
        },
        {
          title: 'Ads still depend on macro recovery',
          summary: 'If brand budgets and consumer activity recover slowly, ad monetization will remain less powerful than the bull case assumes.',
        },
      ],
      scenarios: [
        {
          name: 'Bull case',
          probability: 'low',
          description: 'Ads, gaming, and buybacks reinforce each other and the market re-rates Tencent as a durable cash-compounder.',
        },
        {
          name: 'Base case',
          probability: 'medium',
          description: 'Core businesses stay solid, growth remains moderate, and buybacks support a cautious bullish view.',
        },
        {
          name: 'Bear case',
          probability: 'medium',
          description: 'Regulatory pressure, weaker game cycles, or a softer ad environment keep Tencent trapped in a discounted multiple.',
        },
      ],
      risks: [
        {
          title: 'Regulation risk',
          impact: 'high',
          description: 'Ongoing platform and content regulation can hit both sentiment and business execution.',
        },
        {
          title: 'Game pipeline risk',
          impact: 'high',
          description: 'Gaming remains a major profit pool, so weak launches or approval issues can pressure earnings.',
        },
        {
          title: 'Macro advertising risk',
          impact: 'medium',
          description: 'Slower brand spending recovery would reduce advertising upside.',
        },
      ],
    },
  },
  {
    aliases: ['宁德时代', 'catl', '300750.sz'],
    zh: {
      aliases: ['宁德时代', 'catl', '300750.sz'],
      stance: {
        label: '中性',
        confidence: 'low',
        summary:
          '这是一份非实时兜底观点。若不依赖本轮最新来源，我对宁德时代更偏“中性”：产业地位和技术/规模优势仍强，但 EV 价格战、客户议价和海外扩张执行会持续拉扯估值。',
      },
      bull: [
        {
          title: '规模、成本与技术路线仍有领先性',
          summary: '宁德时代的产能规模、材料体系和工艺能力，仍让它在行业下行期比中小厂商更能守住份额。',
        },
        {
          title: '储能与海外布局提供第二增长曲线',
          summary: '如果储能和海外客户拓展兑现，宁德时代就不只是吃国内 EV 周期，而是变成更全球化的电池平台。',
        },
        {
          title: '头部客户绑定增强基本盘',
          summary: '与主要车企的深度合作，让它在新车型平台化和迭代过程中仍有较强黏性。',
        },
      ],
      bear: [
        {
          title: '价格战会压缩电池产业利润池',
          summary: '整车厂卷终端价格时，电池企业很难完全独善其身，利润率和议价权都可能承压。',
        },
        {
          title: '客户自研与供应链多元化会削弱溢价',
          summary: '车企越想掌控关键零部件，越会压缩单一供应商的超额利润空间。',
        },
        {
          title: '海外扩张不是零摩擦',
          summary: '地缘政治、贸易政策和本地化制造执行，都会影响宁德时代的海外兑现节奏。',
        },
      ],
      scenarios: [
        {
          name: '牛市情景',
          probability: 'low',
          description: '储能、海外与新技术路线顺利兑现，市场重新接受其“全球电池平台”的估值框架。',
        },
        {
          name: '基准情景',
          probability: 'medium',
          description: '行业竞争激烈但龙头优势仍在，估值更多围绕周期波动而不是彻底破坏。',
        },
        {
          name: '熊市情景',
          probability: 'medium',
          description: '价格战持续、海外扩张不顺、客户压价增强时，宁德时代会面临盈利和估值双压。',
        },
      ],
      risks: [
        {
          title: '行业价格战风险',
          impact: 'high',
          description: '电池环节难以完全隔离整车价格战，利润率波动会放大。',
        },
        {
          title: '客户议价风险',
          impact: 'high',
          description: '头部车企要求降本、自研或多供应商策略时，龙头的议价能力也会受挑战。',
        },
        {
          title: '海外执行风险',
          impact: 'medium',
          description: '海外产能建设、政策变化和地缘摩擦都会影响第二增长曲线的兑现。',
        },
      ],
    },
    en: {
      aliases: ['宁德时代', 'catl', '300750.sz'],
      stance: {
        label: 'Neutral',
        confidence: 'low',
        summary:
          'This is a non-live fallback view. Without fresh sources, CATL looks closer to neutral: scale, cost, and technology leadership still matter, but EV price competition, customer bargaining power, and overseas execution keep valuation in check.',
      },
      bull: [
        {
          title: 'Scale and cost position still matter',
          summary: 'CATL remains better positioned than smaller peers to defend share when the industry gets more competitive.',
        },
        {
          title: 'Storage and overseas growth can extend the story',
          summary: 'If storage and offshore expansion execute well, CATL becomes more than a China EV cycle proxy.',
        },
        {
          title: 'Major customer relationships support the base business',
          summary: 'Deep platform integration with large OEMs can still protect part of CATL’s volume base.',
        },
      ],
      bear: [
        {
          title: 'Price wars compress the industry profit pool',
          summary: 'Battery suppliers rarely stay untouched when auto OEMs intensify end-market price competition.',
        },
        {
          title: 'Customer insourcing and diversification matter',
          summary: 'OEMs pushing for in-house batteries or broader supplier mixes can erode supplier pricing power.',
        },
        {
          title: 'Overseas execution is not frictionless',
          summary: 'Trade policy, geopolitics, and local manufacturing execution can all delay the overseas thesis.',
        },
      ],
      scenarios: [
        {
          name: 'Bull case',
          probability: 'low',
          description: 'Storage, overseas expansion, and technology upgrades reinforce the global battery-platform narrative.',
        },
        {
          name: 'Base case',
          probability: 'medium',
          description: 'Industry pressure persists, but leadership and scale keep CATL from suffering structural damage.',
        },
        {
          name: 'Bear case',
          probability: 'medium',
          description: 'Persistent price wars and weak overseas execution create both earnings and multiple pressure.',
        },
      ],
      risks: [
        {
          title: 'Industry price-war risk',
          impact: 'high',
          description: 'Battery margins can remain volatile when OEM competition intensifies.',
        },
        {
          title: 'Customer bargaining risk',
          impact: 'high',
          description: 'Large customers can still pressure pricing or pursue alternate supply strategies.',
        },
        {
          title: 'Overseas execution risk',
          impact: 'medium',
          description: 'Factories, policy, and geopolitics can all delay the second-growth-curve story.',
        },
      ],
    },
  },
];

export function getFallbackResearchTemplate(
  query: string,
  classifier: Record<string, any>,
  preferredLanguage: 'zh' | 'en'
): TemplateResearchPack | null {
  const haystack = `${query} ${JSON.stringify(classifier?.primary_entities || [])}`.toLowerCase();
  const matched = TEMPLATE_LIBRARY.find((entry) =>
    entry.aliases.some((alias) => haystack.includes(alias.toLowerCase()))
  );

  if (!matched) {
    return null;
  }

  return preferredLanguage === 'zh' ? matched.zh : matched.en;
}
