import type { GameConfig, GameRecord, DataSource } from '../types';
import { formatTimestamp, generateId } from './timeUtils';
import { OPERATOR } from '../config/gameConfig';

export interface DirtyTestScenario {
  name: string;
  description: string;
  inputs: Array<{
    value: string | number | null;
    note: string;
    delay?: number;
    source?: DataSource;
  }>;
}

export const DIRTY_TEST_SCENARIOS: DirtyTestScenario[] = [
  {
    name: '完整脏数据测试套件',
    description: '包含空值、重复项、边界记录、误操作、故意暂停的完整测试场景',
    inputs: [
      { value: 50, note: '学生A正常回答', delay: 2000 },
      { value: '', note: '学生B站起来没说话，空值', delay: 1500 },
      { value: 80, note: '学生C回答正确', delay: 2300 },
      { value: 80, note: '老师重复输入了一次，测试重复检测', delay: 1000 },
      { value: null, note: '学生D低头不说话，标记空值', delay: 3000 },
      { value: 760, note: '边界值记录，接近目标800', delay: 2500 },
      { value: 120, note: '学生E抢答，测试误操作', delay: 100 },
      { value: 150, note: '', delay: 6000 },
      { value: '无效文字', note: '学生F说"不对"，测试规则关键词', delay: 3500 },
      { value: 200, note: '故意打断的暂停记录，课间休息', delay: 2000 },
    ],
  },
  {
    name: '空值测试',
    description: '专门测试空值处理',
    inputs: [
      { value: '', note: '空字符串', delay: 1000 },
      { value: null, note: 'null值', delay: 1000 },
      { value: undefined as any, note: 'undefined值', delay: 1000 },
      { value: '   ', note: '空白字符', delay: 1000 },
      { value: NaN as any, note: 'NaN值', delay: 1000 },
    ],
  },
  {
    name: '重复项测试',
    description: '专门测试重复项检测',
    inputs: [
      { value: 100, note: '第一次输入', delay: 500 },
      { value: 100, note: '快速重复，应该被标记', delay: 500 },
      { value: 100, note: '第三次重复', delay: 500 },
      { value: 200, note: '不同值', delay: 1000 },
      { value: 100, note: '间隔后重复，应该不被标记', delay: 4000 },
    ],
  },
  {
    name: '边界值测试',
    description: '专门测试边界值识别',
    inputs: [
      { value: 760, note: '刚好5%边界(800*0.95=760)', delay: 2000 },
      { value: 840, note: '刚好5%上边界', delay: 2000 },
      { value: 800, note: '完全等于目标值', delay: 2000 },
      { value: 759, note: '略低于边界', delay: 2000 },
      { value: 841, note: '略高于边界', delay: 2000 },
    ],
  },
  {
    name: '失败原因测试',
    description: '测试失败原因分析引擎',
    inputs: [
      { value: 1500, note: '超过最大载荷1000', delay: 2000 },
      { value: '不对，应该是500', note: '包含规则违规关键词', delay: 2000 },
      { value: 300, note: '故意等很久', delay: 7000 },
      { value: '超过了，是900', note: '规则违规+超时', delay: 7000 },
      { value: 200, note: '正常输入但超过时限', delay: 6000 },
    ],
  },
];

export function generateTestRecord(
  sequence: number,
  value: string | number | null,
  note: string,
  config: GameConfig,
  timestamp: number,
  previousRecords: GameRecord[],
  lastInputTime: number | null,
  responseTime: number | null,
  source: DataSource = 'test'
): GameRecord {
  const rawValue = value;
  let processedValue: number | null = null;
  
  if (value !== null && value !== undefined && value !== '') {
    const cleaned = String(value).trim();
    if (cleaned !== '') {
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) {
        processedValue = parsed;
      }
    }
  }

  const flags: string[] = [];
  const processingNotes: string[] = [];

  if (rawValue === null || rawValue === undefined || rawValue === '' || 
      (typeof rawValue === 'number' && isNaN(rawValue)) ||
      (typeof rawValue === 'string' && rawValue.trim() === '')) {
    flags.push('empty');
    processingNotes.push('原始值为空，已标记但保留原始位置');
  }

  if (processedValue !== null) {
    const now = timestamp;
    const recentRecords = previousRecords.filter(
      r => now - r.timestamp < config.duplicateWindow && r.processedValue === processedValue
    );
    if (recentRecords.length > 0) {
      flags.push('duplicate');
      processingNotes.push(`与记录#${recentRecords[0].sequence}重复，时间窗口${config.duplicateWindow}ms内`);
    }

    const diff = Math.abs(processedValue - config.targetLoad);
    const percent = (diff / config.targetLoad) * 100;
    if (percent <= config.boundaryThreshold) {
      flags.push('boundary');
      processingNotes.push(`边界值记录，与目标差值${diff}(${percent.toFixed(2)}%)，阈值${config.boundaryThreshold}%`);
    }

    if (lastInputTime && timestamp - lastInputTime < config.misoperationThreshold) {
      flags.push('misoperation');
      const timeDiff = timestamp - lastInputTime;
      processingNotes.push(`疑似误操作，距上次输入仅${timeDiff}ms，阈值${config.misoperationThreshold}ms`);
    }
  }

  const isTimeout = responseTime !== null && responseTime >= config.slowOperationThreshold;
  if (isTimeout) {
    flags.push('timeout');
    processingNotes.push(`操作超时，响应时间${responseTime}ms，阈值${config.slowOperationThreshold}ms`);
  }

  if (flags.length === 0) {
    flags.push('normal');
  }

  const roundNumber = previousRecords.length + 1;
  const newLoad = roundNumber * config.loadPerRound;
  const isValueValid = processedValue !== null && processedValue <= config.maxLoad;
  const isSuccess = isValueValid && !isTimeout;

  const record: GameRecord = {
    id: generateId(),
    sequence,
    timestamp,
    formattedTime: formatTimestamp(timestamp),
    source,
    rawValue,
    processedValue,
    load: newLoad,
    note: note || '',
    flags: flags as any,
    isSuccess,
    failureReason: null,
    failureDetail: '',
    processingNote: processingNotes.join('；'),
    operator: OPERATOR,
    responseTime,
    roundNumber,
  };

  return record;
}

export async function runDirtyScenario(
  scenario: DirtyTestScenario,
  config: GameConfig,
  onRecord: (record: GameRecord) => void,
  onComplete: () => void
): Promise<void> {
  const records: GameRecord[] = [];
  let lastInputTime: number | null = null;
  let baseTime = Date.now() - scenario.inputs.length * 3000;

  for (let i = 0; i < scenario.inputs.length; i++) {
    const input = scenario.inputs[i];
    const delay = input.delay || 2000;
    const timestamp = baseTime + i * 3000 + Math.floor(Math.random() * 1000);
    const responseTime = delay;

    const record = generateTestRecord(
      i + 1,
      input.value,
      input.note,
      config,
      timestamp,
      records,
      lastInputTime,
      responseTime,
      input.source || 'test'
    );

    records.push(record);
    lastInputTime = timestamp;
    onRecord(record);

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  onComplete();
}
