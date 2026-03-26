import { describe, expect, it } from 'vitest';

import { buildConversationContinuity } from '../researchConversationState.ts';
import { buildFallbackStructuredOutput } from '../researchFallbacks.ts';
import {
  buildResearchUserPrompt,
  composeResearchSystemPrompt,
  resolveMarketOverlayKey,
  resolveResponseLanguage,
} from '../researchPromptRegistry.ts';
import {
  buildStructuredOutputJsonSchema,
  buildThesisCard,
  normalizeStructuredOutput,
  validateStructuredOutputDraft,
} from '../researchSchemas.ts';
import { classifyResearchTask } from '../researchTaskClassifier.ts';

describe('research prompt composition', () => {
  it('composes all required layers in the blueprint order', () => {
    const prompt = composeResearchSystemPrompt({
      taskType: 'event_update',
      marketScope: 'cn',
    });

    expect(prompt).toContain('### compliance_guardrail');
    expect(prompt).toContain('### thesis_agent_base');
    expect(prompt).toContain('### market_overlay');
    expect(prompt).toContain('### task_prompt');
    expect(prompt).toContain('### output_review');
    expect(prompt).toContain('A 股');
  });

  it('switches market overlays deterministically', () => {
    expect(resolveMarketOverlayKey('cn')).toBe('cn_a');
    expect(resolveMarketOverlayKey('hk')).toBe('hk');
    expect(resolveMarketOverlayKey('us')).toBe('us');
    expect(resolveMarketOverlayKey('multi-market')).toBe('us');
  });

  it('prefers user language over market defaults when the query is clearly English', () => {
    expect(resolveResponseLanguage('What changed in Tencent earnings?', 'hk')).toBe('en');
    expect(resolveResponseLanguage('腾讯财报后 thesis 有什么变化？', 'hk')).toBe('zh');
  });
});

describe('task classifier', () => {
  const continuity = {
    has_prior_thesis: true,
    latest_subject: 'Tesla',
    latest_current_view: 'Cautious bullish',
    latest_core_judgment: 'Margins matter more than hype.',
    latest_one_line_takeaway: 'Watch earnings quality.',
    latest_structured_output: normalizeStructuredOutput(
      {
        subject: 'Tesla',
        current_view: 'Cautious bullish',
        direct_answer: 'Margins matter more than hype.',
        core_judgment: 'Margins matter more than hype.',
        bull_case: ['成本曲线仍有优势'],
        bear_case: ['估值仍然不便宜'],
        key_variables: ['auto gross margin'],
        strongest_counterargument: '估值对执行容错率不高。',
        mind_change_conditions: ['毛利率继续恶化'],
        one_line_takeaway: '先盯盈利质量。',
      },
      {
        taskType: 'initial_thesis',
        marketScope: 'us',
        subject: 'Tesla',
        language: 'en',
      },
    ),
    recent_messages: [],
  } as const;

  it('detects initial thesis, follow-up, event update, thesis card and out-of-scope', () => {
    expect(
      classifyResearchTask({
        query: 'How do you view NVIDIA now?',
        market_scope: 'us',
      }).task_type,
    ).toBe('initial_thesis');
    expect(classifyResearchTask({ query: '那这个反方怎么看？', continuity }).task_type).toBe(
      'follow_up',
    );
    expect(classifyResearchTask({ query: '特斯拉这次财报更新了什么？', continuity }).task_type).toBe(
      'event_update',
    );
    expect(classifyResearchTask({ query: '整理成 thesis card', continuity }).task_type).toBe(
      'thesis_card',
    );
    expect(classifyResearchTask({ query: '一起去吃饭好不好？' }).task_type).toBe('out_of_scope');
  });

  it('does not misclassify a short new thesis question as follow-up only because it is short', () => {
    const classified = classifyResearchTask({
      query: '怎么看腾讯？',
      continuity,
    });

    expect(classified.task_type).toBe('initial_thesis');
    expect(classified.subject_hint).toBe('Tencent');
  });

  it('flags broader personalized trading requests for guardrail conversion', () => {
    const classified = classifyResearchTask({
      query: '特斯拉现在能不能买？要不要加仓，仓位配多少，回撤多少再买？',
      continuity,
    });

    expect(classified.direct_action_request).toBe(true);

    const prompt = buildResearchUserPrompt({
      query: '特斯拉现在能不能买？要不要加仓，仓位配多少，回撤多少再买？',
      classifier: classified,
      continuity,
      marketDataSnapshot: null,
      citations: [],
      language: 'zh',
    });

    expect(prompt).toContain('direct trading action');
    expect(prompt).toContain('impact_on_current_thesis');
    expect(prompt).toContain('thesis_update');
  });
});

describe('structured output normalization and fallback', () => {
  it('produces stable schemas for initial, follow-up, event-update and thesis-card flows', () => {
    const initial = normalizeStructuredOutput(
      {
        subject: '腾讯',
        current_view: '现金流稳健，但估值仍有折价',
        direct_answer: '我偏正面，但重点要看估值修复节奏。',
        core_judgment: '腾讯更像现金流强但估值仍受折价影响的平台龙头。',
        bull_case: ['广告与游戏现金流稳定'],
        bear_case: ['监管折价持续存在'],
        key_variables: ['广告恢复', '游戏周期', '回购强度'],
        strongest_counterargument: '估值可能长期被压着。',
        mind_change_conditions: ['监管再度收紧'],
        one_line_takeaway: '关键不在业务真不真，而在折价何时松动。',
      },
      {
        taskType: 'initial_thesis',
        marketScope: 'hk',
        subject: '腾讯',
        language: 'zh',
      },
    );

    const followUp = normalizeStructuredOutput(
      {
        subject: '腾讯',
        direct_answer: '这个追问让原判断更谨慎一些。',
        core_judgment: '原 thesis 仍成立，但弹性没有那么大。',
        impact_on_current_thesis: 'weakens',
        thesis_update: '如果广告恢复慢于预期，重估节奏会被拖后。',
      },
      {
        taskType: 'follow_up',
        marketScope: 'hk',
        subject: '腾讯',
        language: 'zh',
      },
    );

    const eventUpdate = buildFallbackStructuredOutput({
      query: '腾讯最新财报怎么看？',
      subject: '腾讯',
      marketScope: 'hk',
      taskType: 'event_update',
      language: 'zh',
      citations: [],
      complianceFlags: [],
    });

    const thesisCard = buildThesisCard(initial);

    expect(initial.task_type).toBe('initial_thesis');
    expect(followUp.task_type).toBe('follow_up');
    expect(eventUpdate.task_type).toBe('event_update');
    expect(eventUpdate.degraded).toBe(true);
    expect(initial.key_variables.length).toBeGreaterThan(0);
    expect(followUp.impact_on_current_thesis).toBe('weakens');
    expect(thesisCard.subject).toBe('腾讯');
    expect(thesisCard.core_thesis).toContain('平台龙头');
  });

  it('keeps degraded fallback output usable instead of returning garbage', () => {
    const output = buildFallbackStructuredOutput({
      query: '今天美股最重要的变量是什么？',
      subject: 'US market thesis',
      marketScope: 'us',
      taskType: 'initial_thesis',
      language: 'zh',
      citations: [],
      complianceFlags: ['retrieval_degraded'],
    });

    expect(output.direct_answer).toContain('临时');
    expect(output.core_judgment).toBeTruthy();
    expect(output.key_variables.length).toBeGreaterThan(0);
    expect(output.compliance_flags).toContain('retrieval_degraded');
  });
});

describe('structured output contract', () => {
  it('builds a task-aware JSON schema and validates required keys', () => {
    const schema = buildStructuredOutputJsonSchema('event_update');
    expect(schema.required).toContain('impact_on_current_thesis');
    expect(schema.required).toContain('top_things_to_watch');

    const valid = validateStructuredOutputDraft(
      {
        subject: '腾讯',
        current_view: '判断被小幅强化',
        direct_answer: '这次更新强化了原判断，但不是整篇重写。',
        core_judgment: '财报确认现金流质量仍然稳健。',
        bull_case: ['广告恢复继续兑现'],
        bear_case: ['监管折价尚未完全消失'],
        key_variables: ['广告恢复节奏'],
        strongest_counterargument: '估值修复仍可能晚于基本面兑现。',
        mind_change_conditions: ['监管再度明显收紧'],
        one_line_takeaway: '旧 thesis 被强化，但估值弹性仍要谨慎。',
        impact_on_current_thesis: 'strengthens',
        thesis_update: '新的信息主要强化现金流韧性，而不是重写 thesis。',
        top_things_to_watch: ['下次电话会指引'],
      },
      'event_update',
    );
    const invalid = validateStructuredOutputDraft(
      {
        subject: '腾讯',
        current_view: '不完整输出',
      },
      'event_update',
    );

    expect(valid.ok).toBe(true);
    expect(invalid.ok).toBe(false);
    expect(invalid.missing).toContain('direct_answer');
  });
});

describe('conversation continuity', () => {
  it('loads prior thesis context from structured assistant messages without forcing Chinese defaults', () => {
    const continuity = buildConversationContinuity({
      marketScope: 'hk',
      language: 'en',
      messages: [
        { role: 'user', content: 'What is your Tencent thesis?', created_at: '2025-03-01T10:00:00Z' },
        {
          role: 'assistant',
          content: 'Core judgment: Tencent remains a cash-flow-rich platform with valuation discount.',
          created_at: '2025-03-01T10:01:00Z',
          structured_answer: {
            structured_output: {
              task_type: 'initial_thesis',
              subject: 'Tencent',
              current_view: 'Cash flow solid, valuation still discounted',
              direct_answer: 'Tencent remains a discounted but durable thesis.',
              core_judgment: 'Tencent remains a discounted but durable thesis.',
              bull_case: ['Ads and gaming cash flow stay resilient'],
              bear_case: ['Regulatory discount may persist'],
              key_variables: ['ad recovery'],
              strongest_counterargument: 'Discount can last longer than bulls expect.',
              mind_change_conditions: ['Capital return weakens'],
              one_line_takeaway: 'The business is real, but the discount may linger.',
            },
          },
        },
      ],
    });

    expect(continuity.has_prior_thesis).toBe(true);
    expect(continuity.latest_subject).toBe('Tencent');
    expect(continuity.latest_core_judgment).toContain('discounted but durable');
    expect(continuity.recent_messages.length).toBe(2);
  });
});
