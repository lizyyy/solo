import type { Sample, Note, ParamVersion, Clue } from '@/types';

export function generateClues(
  sample: Sample,
  notes: Note[],
  paramVersion: ParamVersion
): Clue[] {
  const clues: Clue[] = [];

  clues.push({
    id: `clue-${sample.id}-score`,
    sampleId: sample.id,
    type: 'score',
    title: '评分录入',
    content: sample.scoreNote,
    operator: '小岑',
    timestamp: sample.createdAt,
  });

  clues.push({
    id: `clue-${sample.id}-calc`,
    sampleId: sample.id,
    type: 'calculation',
    title: '验算完成',
    content: `使用参数版本 ${paramVersion.name}，公式：${paramVersion.formula}，参数 A=${paramVersion.params.a}，B=${paramVersion.params.b}，C=${paramVersion.params.c}，阈值 ${paramVersion.threshold}%。${sample.calculationTrace}`,
    operator: '系统',
    timestamp: sample.createdAt,
  });

  const sampleNotes = notes
    .filter((n) => n.sampleId === sample.id && n.type === 'supplement')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  sampleNotes.forEach((note, index) => {
    clues.push({
      id: `clue-${sample.id}-supp-${index}`,
      sampleId: sample.id,
      type: 'supplement',
      title: `补充说明 ${index + 1}`,
      content: note.content,
      operator: note.operator,
      timestamp: note.createdAt,
    });
  });

  if (sample.status !== 'pending') {
    const statusText =
      sample.status === 'normal'
        ? '正常'
        : sample.status === 'abnormal'
        ? '异常'
        : '重复';
    clues.push({
      id: `clue-${sample.id}-conclusion`,
      sampleId: sample.id,
      type: 'conclusion',
      title: '结论确认',
      content: `最终状态标记为「${statusText}」。${
        sample.duplicateOf.length > 0
          ? `关联重复样本：${sample.duplicateOf.join(', ')}`
          : `偏差 ${sample.deviation.toFixed(2)}%`
      }`,
      operator: '小岑',
      timestamp: sample.updatedAt,
    });
  }

  return clues.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

export function highlightKeywords(text: string): string {
  const keywords = ['异常', '偏差', '错误', '重复', '阈值', '符号', '系数', '待确认', '疑似', '核实'];
  let result = text;
  keywords.forEach((keyword) => {
    const regex = new RegExp(`(${keyword})`, 'g');
    result = result.replace(regex, '<mark class="bg-yellow-200 text-red-700 px-0.5 rounded">$1</mark>');
  });
  return result;
}
