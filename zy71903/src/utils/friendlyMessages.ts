import { DataSource, MismatchType } from '../types';

interface MessageTemplate {
  message: string;
  suggestion: string;
}

const messageTemplates: Record<string, MessageTemplate> = {
  DUPLICATE_STUDENT_TIME: {
    message: '⚠️ 这位同学在这个时间段已经有一条记录了哦。',
    suggestion: '你可以看看两条是不是说的同一件事，然后合并成一条，或者都保留。',
  },
  MEASURE_REVERSED: {
    message: '🤔 小节号写反啦，{start}-{end} 应该是从小的到大的。',
    suggestion: '试试改成 {end}-{start}？',
  },
  MEASURE_OVERLAP: {
    message: '👀 这个小节范围 {start}-{end} 和 {otherStudent} 的那条重叠了。',
    suggestion: '如果是分谱不同，记得在备注里说明一下哦。',
  },
  MEASURE_DISCONTINUOUS: {
    message: '⏸️ 第 {prevEnd} 小节之后直接跳到 {nextStart} 了，中间差了 {gap} 小节。',
    suggestion: '是休息了吗？找声部长核对一下？',
  },
  IMPORT_FORMAT_ERROR: {
    message: '📋 这个节拍器日志的格式不太对，第 {line} 行有问题。',
    suggestion: '检查一下，应该是"小节号-速度"这样的格式。',
  },
  FIELD_REQUIRED: {
    message: '🎯 {fieldName} 需要填一下哦。',
    suggestion: '不然大家不知道这条记录是给谁记的。',
  },
  INVALID_TEMPO: {
    message: '⚡ 速度 {tempo} 有点奇怪呢。',
    suggestion: '一般乐曲速度在 40-200 之间，是不是写错啦？',
  },
  INVALID_MEASURE: {
    message: '📏 小节号 {measure} 不太对哦。',
    suggestion: '小节号应该是正整数，检查一下是不是写错了？',
  },
  RECORD_DUPLICATE: {
    message: '🔍 这条记录和已有记录（小节 {start}-{end}）有重叠。',
    suggestion: '确认是否为同一段演奏，可选择合并或备注说明差异。',
  },
};

const fieldNames: Record<string, string> = {
  studentId: '学生姓名',
  rehearsalDate: '排练日期',
  measureStart: '起始小节',
  measureEnd: '结束小节',
  tempo: '速度',
  source: '数据来源',
};

export function getFieldName(field: string): string {
  return fieldNames[field] || field;
}

export function generateFriendlyMessage(
  errorCode: string,
  context: Record<string, string | number> = {}
): { message: string; suggestion: string } {
  const template = messageTemplates[errorCode] || {
    message: '❓ 这里好像有点问题。',
    suggestion: '检查一下填写的内容，或者问问声部长？',
  };

  let message = template.message;
  let suggestion = template.suggestion;

  Object.entries(context).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    message = message.replace(placeholder, String(value));
    suggestion = suggestion.replace(placeholder, String(value));
  });

  return { message, suggestion };
}

export function getSourceLabel(source: DataSource): string {
  const labels: Record<DataSource, string> = {
    [DataSource.METRONOME]: '节拍器',
    [DataSource.MUSIC_SHEET]: '选曲表',
    [DataSource.MANUAL]: '手工录入',
  };
  return labels[source];
}

export function getMismatchTypeLabel(type: MismatchType): string {
  const labels: Record<MismatchType, string> = {
    [MismatchType.DISCONTINUOUS]: '小节不连续',
    [MismatchType.OVERLAP]: '范围重叠',
    [MismatchType.REVERSED]: '起止颠倒',
  };
  return labels[type];
}

export function getHandlerSuggestion(type: MismatchType): string {
  const suggestions: Record<MismatchType, string> = {
    [MismatchType.DISCONTINUOUS]: '找声部长核对演奏范围',
    [MismatchType.OVERLAP]: '找指挥确认分段',
    [MismatchType.REVERSED]: '找曲谱管理员核对谱面',
  };
  return suggestions[type];
}
