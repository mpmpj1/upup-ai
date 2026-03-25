import { describe, expect, it } from 'vitest';

import { buildConversationContinuity } from '../researchConversationState.ts';
import { buildFallbackStructuredOutput } from '../researchFallbacks.ts';
import {
  buildResearchUserPrompt,
  composeResearchSystemPrompt,
  resolveMarketOverlayKey,
} from '../researchPromptRegistry.ts';
import { buildThesisCard, normalizeStructuredOutput } from '../researchSchemas.ts';
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
    expect(classifyResearchTask({ query: 'How do you view NVIDIA now?', market_scope: 'us' }).task_type).toBe('initial_thesis');
    expect(classifyResearchTask({ query: '那这个反方怎么看？', continuity }).task_type).toBe('follow_up');
    expect(classifyResearchTask({ query: '特斯拉这次财报更新了什么？', continuity }).task_type).toBe('event_update');
    expect(classifyResearchTask({ query: '整理成 thesis card', continuity }).task_type).toBe('thesis_card');
    expect(classifyResearchTask({ query: '一起去吃饭好吗？' }).task_type).toBe('out_of_scope');
  });

  it('flags personalized trading requests for guardrail conversion', () => {
    const classified = classifyResearchTask({
      query: '特斯拉现在能不能买？仓位配多少？',
      continuity,
    });

    expect(classified.direct_action_request).toBe(true);

    const prompt = buildResearchUserPrompt({
      query: '特斯拉现在能不能买？仓位配多少？',
      classifier: classified,
      continuity,
      marketDataSnapshot: null,
      citations: [],
      language: 'zh',
    });

    expect(prompt).toContain('direct trading action');
    expect(prompt).toContain('not give personalized trading instructions');
  });
});

describe('structured output normalization and fallback', () => {
  it('produces stable schemas for initial, follow-up, event-update and thesis-card flows', () => {
    const initial = normalizeStructuredOutput(
      {
        subject: '腾讯',
        current_view: '现金流稳但仍有折价',
        direct_answer: '我偏正面，但重点看估值修复节奏。',
        core_judgment: '腾讯更像现金流强但估值仍受折价的平台龙头。',
        bull_case: ['广告与游戏现金流稳定'],
        bear_case: ['监管折价持续'],
        key_variables: ['广告恢复', '游戏周期', '回购强度'],
        strongest_counterargument: '估值可能长期被压着。',
        mind_change_conditions: ['监管再度收紧'],
        one_line_takeaway: '关键不是业务真不真，而是折价何时松动。',
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
        core_judgment: '原 thesis 仍成立，但弹性没那么大。',
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

    expect(output.direct_answer).not.toContain('undefined');
    expect(output.core_judgment).toBeTruthy();
    expect(output.key_variables.length).toBeGreaterThan(0);
    expect(output.compliance_flags).toContain('retrieval_degraded');
  });
});

describe('conversation continuity', () => {
  it('loads prior thesis context from structured assistant messages', () => {
    const continuity = buildConversationContinuity({
      marketScope: 'us',
      messages: [
        { role: 'user', content: '你怎么看 Tesla？', created_at: '2025-03-01T10:00:00Z' },
        {
          role: 'assistant',
          content: '核心判断：Tesla 仍是高波动 thesis。',
          created_at: '2025-03-01T10:01:00Z',
          structured_answer: {
            structured_output: {
              task_type: 'initial_thesis',
              subject: 'Tesla',
              current_view: 'High-volatility, cautious bullish',
              direct_answer: 'Tesla 仍是高波动 thesis。',
              core_judgment: 'Tesla 仍是高波动 thesis。',
              bull_case: ['成本曲线仍有效'],
              bear_case: ['估值仍高'],
              key_variables: ['auto gross margin'],
              strongest_counterargument: '估值可能长期压缩',
              mind_change_conditions: ['毛利继续恶化'],
              one_line_takeaway: '先看盈利质量再看股价波动。',
            },
          },
        },
      ],
    });

    expect(continuity.has_prior_thesis).toBe(true);
    expect(continuity.latest_subject).toBe('Tesla');
    expect(continuity.latest_core_judgment).toContain('高波动 thesis');
    expect(continuity.recent_messages.length).toBe(2);
  });
});
