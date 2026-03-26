import { describe, expect, it } from 'vitest';

import {
  getReadableConversationTitle,
  normalizeStructuredOutput,
  normalizeThesisCardContent,
} from '@/lib/research/structuredPayload';

describe('structured payload normalization', () => {
  it('normalizes legacy payloads into the thesis-first schema', () => {
    const output = normalizeStructuredOutput({
      stance: { label: '偏多', summary: '核心判断是盈利质量仍在修复。' },
      theses: {
        bull: [{ title: 'Bull 1', summary: '广告恢复快于预期' }],
        bear: [{ title: 'Bear 1', summary: '监管折价继续存在' }],
      },
      risks: [{ title: '风险', description: '宏观拖累广告预算' }],
      citations: [{ title: 'Reuters', url: 'https://reuters.com/example', publisher: 'Reuters' }],
    });

    expect(output.current_view).toBe('偏多');
    expect(output.core_judgment).toContain('盈利质量');
    expect(output.bull_case[0]).toContain('广告恢复');
    expect(output.bear_case[0]).toContain('监管折价');
    expect(output.citations[0].publisher).toBe('Reuters');
  });

  it('normalizes thesis-card payloads for reuse', () => {
    const card = normalizeThesisCardContent({
      subject: '腾讯',
      current_view: '现金流稳健但估值仍有折价',
      core_thesis: '市场分歧不在业务真伪，而在折价何时修复。',
      bull_case: ['广告恢复'],
      bear_case: ['监管折价'],
      top_key_variables: ['广告恢复斜率'],
      strongest_counterargument: '折价可能长期存在',
      mind_change_conditions: ['监管再度收紧'],
      watch_list: ['广告恢复', '回购强度'],
      last_updated: '2025-03-01T10:00:00Z',
    });

    expect(card?.subject).toBe('腾讯');
    expect(card?.core_thesis).toContain('折价何时修复');
    expect(card?.watch_list).toContain('回购强度');
  });

  it('falls back to a readable title when the original title is broken', () => {
    expect(getReadableConversationTitle('')).toBe('未命名会话');
    expect(getReadableConversationTitle('undefined {item.title}')).toBe('未命名会话');
    expect(getReadableConversationTitle('腾讯财报追问')).toBe('腾讯财报追问');
  });
});
