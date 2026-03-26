import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import StructuredResearchView from '@/components/research/StructuredResearchView';
import type { ResearchStructuredOutput, ThesisCardContent } from '@/types/research';

const output: ResearchStructuredOutput = {
  task_type: 'initial_thesis',
  market_scope: 'hk',
  subject: '腾讯',
  current_view: '现金流稳健，但估值仍存在监管折价。',
  direct_answer: '我偏正面，但真正要盯的是估值修复节奏。',
  core_judgment: '腾讯更像现金流强、但估值仍受折价影响的平台龙头。',
  bull_case: ['广告恢复快于预期', '回购强度持续维持'],
  bear_case: ['监管折价可能长期存在'],
  key_variables: ['广告恢复斜率', '游戏周期', '回购强度'],
  strongest_counterargument: '估值可能长期被流动性和监管折价压制。',
  mind_change_conditions: ['监管再度收紧', '广告与游戏同时低于预期'],
  one_line_takeaway: '关键不在业务真不真，而在折价何时松动。',
  facts: ['回购持续推进'],
  inference: ['现金流质量仍在支撑估值底部'],
  assumptions: ['监管环境不会明显恶化'],
  short_term_catalysts: ['下次财报'],
  medium_term_drivers: ['广告恢复'],
  long_term_thesis: ['平台生态与资本回报'],
  thesis_change_vs_price_action: '股价波动不等于 Thesis 被证伪。',
  impact_on_current_thesis: 'not_applicable',
  thesis_update: '',
  top_things_to_watch: ['广告恢复', '游戏新品'],
  watch_list: ['广告恢复', '回购强度'],
  citations: [
    {
      title: 'Reuters coverage',
      url: 'https://www.reuters.com/example',
      publisher: 'Reuters',
      snippet: 'Tencent continued buybacks.',
      source_tier: 2,
      source_type: 'media',
      source_index: 1,
    },
  ],
  compliance_flags: ['personalized_advice_blocked'],
  degraded: false,
};

const thesisCard: ThesisCardContent = {
  subject: '腾讯',
  current_view: '现金流稳健，但估值仍存在监管折价。',
  core_thesis: '市场分歧不在业务真伪，而在折价何时修复。',
  bull_case: ['广告恢复快于预期'],
  bear_case: ['监管折价可能长期存在'],
  top_key_variables: ['广告恢复斜率'],
  strongest_counterargument: '折价可能长期存在',
  mind_change_conditions: ['监管再度收紧'],
  watch_list: ['广告恢复', '回购强度'],
  last_updated: '2025-03-01T10:00:00Z',
};

describe('StructuredResearchView', () => {
  it('renders thesis-first sections with localized Chinese labels', () => {
    render(<StructuredResearchView output={output} thesisCard={thesisCard} answer="补充说明" />);

    expect(screen.getByTestId('structured-research-view')).toBeInTheDocument();
    expect(screen.getAllByText('腾讯').length).toBeGreaterThan(0);
    expect(
      screen.getByText('腾讯更像现金流强、但估值仍受折价影响的平台龙头。'),
    ).toBeInTheDocument();
    expect(screen.getByText('看多逻辑')).toBeInTheDocument();
    expect(screen.getByText('看空逻辑')).toBeInTheDocument();
    expect(screen.getByText('关键变量')).toBeInTheDocument();
    expect(screen.getByText('最强反方')).toBeInTheDocument();
    expect(screen.getByText('一句话结论')).toBeInTheDocument();
    expect(screen.getByText('参考来源')).toBeInTheDocument();
    expect(screen.getByText('Thesis Card')).toBeInTheDocument();
    expect(screen.getByText('市场分歧不在业务真伪，而在折价何时修复。')).toBeInTheDocument();
  });
});
