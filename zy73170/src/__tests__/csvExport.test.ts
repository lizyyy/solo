import { describe, expect, it } from 'vitest';
import type { StudentSample } from '../types';
import { buildVerdictRows } from '../utils/csvExport';

const base: Partial<StudentSample> = {
  studentId: '000',
  studentName: '测试',
  problemTitle: '测试题',
  resultSummary: '结果',
  status: '待确认',
  isDuplicate: false,
  finalVerdict: null,
  submittedAt: '2026-06-18 10:00',
  batch: '测试批次',
  draftLines: [],
  calculationSteps: [],
  history: [],
};

function make(overrides: Partial<StudentSample> & { id: string }): StudentSample {
  return { ...base, ...overrides } as StudentSample;
}

describe('buildVerdictRows', () => {
  it('导出头部包含重复关联样本ID列', () => {
    const rows = buildVerdictRows([]);
    expect(rows[0]).toContain('重复关联样本ID');
  });

  it('重复样本即使无 finalVerdict 也会被导出', () => {
    const s004 = make({
      id: 's004',
      studentId: '20240417',
      studentName: '赵一诺',
      status: '重复',
      isDuplicate: true,
      duplicateOf: 's005',
      finalVerdict: null,
    });
    const rows = buildVerdictRows([s004]);
    expect(rows.length).toBe(2);
    expect(rows[1][0]).toBe('重复待确认');
    expect(rows[1][6]).toBe('[重复]');
    expect(rows[1][7]).toBe('s005');
  });

  it('已标记需补材料的重复样本归入需补材料组', () => {
    const s = make({
      id: 's010',
      studentId: '20240100',
      studentName: '测试重复需补',
      status: '重复',
      isDuplicate: true,
      duplicateOf: 's011',
      finalVerdict: '需补材料',
    });
    const rows = buildVerdictRows([s]);
    expect(rows[1][0]).toBe('需补材料');
    expect(rows[1][6]).toBe('[重复]');
    expect(rows[1][7]).toBe('s011');
  });

  it('已标记可放行的重复样本归入可放行组', () => {
    const s = make({
      id: 's011',
      studentId: '20240101',
      studentName: '测试重复已放行',
      status: '可放行',
      isDuplicate: true,
      finalVerdict: '可放行',
    });
    const rows = buildVerdictRows([s]);
    expect(rows[1][0]).toBe('可放行');
  });

  it('非重复且无 finalVerdict 的样本不出现在导出中', () => {
    const s = make({
      id: 's099',
      studentId: '20240999',
      studentName: '普通待确认',
      status: '待确认',
      isDuplicate: false,
      finalVerdict: null,
    });
    const rows = buildVerdictRows([s]);
    expect(rows.length).toBe(1);
  });

  it('完整数据列数与头部一致', () => {
    const s = make({
      id: 's020',
      studentId: '20240200',
      studentName: '完整性测试',
      status: '可放行',
      isDuplicate: false,
      finalVerdict: '可放行',
    });
    const rows = buildVerdictRows([s]);
    const header = rows[0];
    const data = rows[1];
    expect(data.length).toBe(header.length);
  });

  it('包含逗号和换行的审核备注被正确转义', () => {
    const s = make({
      id: 's030',
      studentId: '20240300',
      studentName: '转义测试',
      status: '异常',
      isDuplicate: false,
      finalVerdict: '需补材料',
      reviewNote: '第3行有误,\n需补全',
    });
    const rows = buildVerdictRows([s]);
    expect(rows[1][8]).toBe('第3行有误,\n需补全');
  });
});
