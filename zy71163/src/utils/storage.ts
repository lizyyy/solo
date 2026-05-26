import type { GameRecord } from '@/types';

const GAME_RECORDS_KEY = 'pharmacy_game_records';
const HIGH_SCORES_KEY = 'pharmacy_game_high_scores';

export const saveGameRecord = (record: GameRecord): void => {
  try {
    const records = getGameRecords();
    records.unshift(record);
    if (records.length > 50) {
      records.pop();
    }
    localStorage.setItem(GAME_RECORDS_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('保存游戏记录失败:', e);
  }
};

export const getGameRecords = (): GameRecord[] => {
  try {
    const data = localStorage.getItem(GAME_RECORDS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('读取游戏记录失败:', e);
    return [];
  }
};

export const getGameRecordById = (gameId: string): GameRecord | null => {
  const records = getGameRecords();
  return records.find(r => r.id === gameId) || null;
};

export const saveHighScore = (levelId: string, score: number): void => {
  try {
    const highScores = getHighScores();
    highScores[levelId] = Math.max(highScores[levelId] || 0, score);
    localStorage.setItem(HIGH_SCORES_KEY, JSON.stringify(highScores));
  } catch (e) {
    console.error('保存最高分失败:', e);
  }
};

export const getHighScore = (levelId: string): number => {
  const highScores = getHighScores();
  return highScores[levelId] || 0;
};

export const getHighScores = (): Record<string, number> => {
  try {
    const data = localStorage.getItem(HIGH_SCORES_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error('读取最高分失败:', e);
    return {};
  }
};

export const clearGameData = (): void => {
  localStorage.removeItem(GAME_RECORDS_KEY);
  localStorage.removeItem(HIGH_SCORES_KEY);
};

export const getAllGameRecords = (): GameRecord[] => {
  return getGameRecords();
};

export const deleteGameRecord = (gameId: string): void => {
  try {
    const records = getGameRecords();
    const filteredRecords = records.filter(r => r.id !== gameId);
    localStorage.setItem(GAME_RECORDS_KEY, JSON.stringify(filteredRecords));
  } catch (e) {
    console.error('删除游戏记录失败:', e);
  }
};

export const clearAllRecords = (): void => {
  localStorage.removeItem(GAME_RECORDS_KEY);
};

export const exportGameRecord = (record: GameRecord): string => {
  const errorSummary = record.errors.reduce((acc, err) => {
    acc[err.type] = (acc[err.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const report = `
╔══════════════════════════════════════════════════════════════╗
║              药房配药校验报告                                ║
╠══════════════════════════════════════════════════════════════╣
║  游戏编号: ${record.id.padEnd(46)}║
║  关卡名称: ${record.levelName.padEnd(45)}║
║  开始时间: ${new Date(record.startTime).toLocaleString('zh-CN').padEnd(45)}║
║  结束时间: ${new Date(record.endTime).toLocaleString('zh-CN').padEnd(45)}║
║  总用时: ${formatTime(record.totalTime).padEnd(49)}║
╠══════════════════════════════════════════════════════════════╣
║  最终得分: ${String(record.score).padEnd(11)} / ${String(record.maxScore).padEnd(10)} (${Math.round(record.score / record.maxScore * 100)}%)   ║
║  星级评定: ${'⭐'.repeat(record.starRating).padEnd(30)}║
║  正确率: ${String(record.accuracy).padEnd(6)}%                                        ║
╠══════════════════════════════════════════════════════════════╣
║  处理处方数: ${String(record.prescriptions.length).padEnd(10)}张                                ║
║  错误总数: ${String(record.errors.length).padEnd(10)}次                                  ║
╠══════════════════════════════════════════════════════════════╣
║  错误类型统计:                                               ║
${Object.entries(errorSummary).map(([type, count]) => 
  `║    - ${getErrorTypeName(type)}: ${count}次${' '.repeat(40 - getErrorTypeName(type).length - String(count).length)}║`
).join('\n')}
╠══════════════════════════════════════════════════════════════╣
║  错误详情:                                                   ║
${record.errors.map((err, i) => 
  `║  ${i + 1}. [${getSeverityName(err.severity)}] ${err.description.slice(0, 40).padEnd(42)}║`
  + `\n║      扣分: -${err.pointsDeducted}分${' '.repeat(38)}║`
  + `\n║      正确做法: ${err.correctAnswer.slice(0, 38).padEnd(40)}║`
).join('\n')}
╠══════════════════════════════════════════════════════════════╣
║  配药处方详情:                                               ║
${record.prescriptions.map((p, i) => 
  `║  处方${i + 1}: ${p.patientName} (${p.patientAge}岁${p.patientGender})                   ║`
  + `\n║      诊断: ${p.diagnosis.slice(0, 40).padEnd(42)}║`
  + p.items.map(item => 
      `\n║      - ${item.medicineName} ${item.dosage}${item.unit} ${item.frequency.padEnd(20)}║`
    ).join('')
).join('\n')}
╚══════════════════════════════════════════════════════════════╝
  `.trim();
  
  return report;
};

export const downloadReport = (record: GameRecord): void => {
  const report = exportGameRecord(record);
  const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `配药报告_${record.id}_${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}分${secs}秒`;
};

const getErrorTypeName = (type: string): string => {
  const names: Record<string, string> = {
    dosage_unit: '剂量单位错误',
    dosage_amount: '剂量数值错误',
    contraindication: '禁忌未拦截',
    drug_interaction: '药物相互作用',
    batch_expired: '批号过期',
    wrong_medicine: '选错药品',
    timeout: '超时',
    unchecked_confirm: '未核对确认',
    repeated_operation: '重复操作'
  };
  return names[type] || type;
};

const getSeverityName = (severity: string): string => {
  const names: Record<string, string> = {
    minor: '轻微',
    major: '中等',
    critical: '严重'
  };
  return names[severity] || severity;
};
