import type { GameRecord, BaggageType, ErrorType } from '@/types/game';

export interface ReportData {
  gameId: string;
  levelName: string;
  levelId: number;
  startTime: string;
  playTime: string;
  score: number;
  totalBaggage: number;
  correctCount: number;
  errorCount: number;
  accuracy: string;
  passed: boolean;
  byType: Record<BaggageType, { total: number; correct: number; error: number }>;
  byGate: Record<string, { total: number; correct: number; error: number }>;
  errors: Array<{
    time: string;
    type: string;
    flight: string;
    description: string;
  }>;
  summary: string;
}

export const generateReport = (record: GameRecord): ReportData => {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}分${secs}秒`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const byType: Record<BaggageType, { total: number; correct: number; error: number }> = {
    normal: { total: 0, correct: 0, error: 0 },
    transfer: { total: 0, correct: 0, error: 0 },
    oversize: { total: 0, correct: 0, error: 0 },
  };

  const byGate: Record<string, { total: number; correct: number; error: number }> = {};

  const errorTypeLabels: Record<ErrorType, string> = {
    wrong_gate: '送错航班口',
    transfer_timeout: '转机超时',
    oversize_wrong_lane: '超规件走错线',
    flight_cancelled: '航班取消未转存',
    missed_flight: '漏过航班',
  };

  record.events.forEach(event => {
    if (event.type === 'baggage_delivered') {
      const baggage = event.data.baggage;
      const type = baggage.type as BaggageType;
      byType[type].total++;
      byType[type].correct++;

      const gate = baggage.targetGate;
      if (!byGate[gate]) {
        byGate[gate] = { total: 0, correct: 0, error: 0 };
      }
      byGate[gate].total++;
      byGate[gate].correct++;
    } else if (event.type === 'baggage_error') {
      const baggage = event.data.baggage;
      const type = baggage.type as BaggageType;
      byType[type].total++;
      byType[type].error++;

      const gate = baggage.targetGate;
      if (!byGate[gate]) {
        byGate[gate] = { total: 0, correct: 0, error: 0 };
      }
      byGate[gate].total++;
      byGate[gate].error++;
    }
  });

  const errors = record.errors.map(err => ({
    time: formatTime(err.gameTime),
    type: errorTypeLabels[err.type] || err.type,
    flight: err.flightNumber,
    description: err.description,
  }));

  const accuracy = (record.accuracy * 100).toFixed(1);

  let summary = '';
  if (record.passed) {
    summary = `恭喜通关！本局得分${record.score}分，准确率${accuracy}%。`;
    if (record.transferTimeoutCount > 0) {
      summary += ` 转机超时${record.transferTimeoutCount}次。`;
    }
    if (record.oversizeErrorCount > 0) {
      summary += ` 超规错误${record.oversizeErrorCount}次。`;
    }
  } else {
    summary = `未能通关。得分${record.score}分，准确率${accuracy}%。`;
    const failReasons: string[] = [];
    if (parseFloat(accuracy) < 70) {
      failReasons.push('准确率不足');
    }
    if (record.transferTimeoutCount > 5) {
      failReasons.push('转机超时过多');
    }
    if (record.oversizeErrorCount > 3) {
      failReasons.push('超规错误过多');
    }
    if (failReasons.length > 0) {
      summary += ` 失败原因：${failReasons.join('、')}。`;
    }
  }

  return {
    gameId: record.id,
    levelName: record.levelName,
    levelId: record.levelId,
    startTime: formatDate(record.startTime),
    playTime: formatTime(record.playTime),
    score: record.score,
    totalBaggage: record.correctCount + record.errorCount,
    correctCount: record.correctCount,
    errorCount: record.errorCount,
    accuracy,
    passed: record.passed,
    byType,
    byGate,
    errors,
    summary,
  };
};

export const exportReportAsJSON = (record: GameRecord): string => {
  const report = generateReport(record);
  return JSON.stringify(report, null, 2);
};

export const exportReportAsCSV = (record: GameRecord): string => {
  const report = generateReport(record);
  
  let csv = '\ufeff';
  
  csv += '机场行李分拣游戏 - 分拣报告\n';
  csv += `游戏ID,${report.gameId}\n`;
  csv += `关卡,${report.levelName}\n`;
  csv += `开始时间,${report.startTime}\n`;
  csv += `游戏时长,${report.playTime}\n`;
  csv += `最终得分,${report.score}\n`;
  csv += `处理行李总数,${report.totalBaggage}\n`;
  csv += `正确分拣,${report.correctCount}\n`;
  csv += `分拣错误,${report.errorCount}\n`;
  csv += `准确率,${report.accuracy}%\n`;
  csv += `是否通关,${report.passed ? '是' : '否'}\n`;
  csv += '\n';
  
  csv += '按行李类型统计\n';
  csv += '类型,总数,正确,错误\n';
  const typeLabels: Record<BaggageType, string> = {
    normal: '普通行李',
    transfer: '转机行李',
    oversize: '超规行李',
  };
  Object.entries(report.byType).forEach(([type, data]) => {
    csv += `${typeLabels[type as BaggageType]},${data.total},${data.correct},${data.error}\n`;
  });
  csv += '\n';
  
  csv += '按航班口统计\n';
  csv += '航班口,总数,正确,错误\n';
  Object.entries(report.byGate).forEach(([gate, data]) => {
    csv += `${gate},${data.total},${data.correct},${data.error}\n`;
  });
  csv += '\n';
  
  csv += '错误明细\n';
  csv += '游戏时间,错误类型,航班号,错误描述\n';
  report.errors.forEach(err => {
    csv += `${err.time},${err.type},${err.flight},"${err.description}"\n`;
  });
  
  return csv;
};

export const downloadFile = (content: string, filename: string, type: string): void => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const saveGameRecord = (record: GameRecord): void => {
  try {
    const existing = localStorage.getItem('baggage_game_records');
    const records: GameRecord[] = existing ? JSON.parse(existing) : [];
    records.unshift(record);
    
    if (records.length > 20) {
      records.pop();
    }
    
    localStorage.setItem('baggage_game_records', JSON.stringify(records));
    
    const progress = localStorage.getItem('baggage_game_progress');
    const progressData = progress ? JSON.parse(progress) : {};
    
    if (record.passed) {
      if (!progressData.clearedLevels || progressData.clearedLevels.indexOf(record.levelId) === -1) {
        progressData.clearedLevels = progressData.clearedLevels || [];
        progressData.clearedLevels.push(record.levelId);
      }
    }
    
    if (!progressData.highScores || record.score > (progressData.highScores?.[record.levelId] || 0)) {
      progressData.highScores = progressData.highScores || {};
      progressData.highScores[record.levelId] = record.score;
    }
    
    localStorage.setItem('baggage_game_progress', JSON.stringify(progressData));
  } catch (e) {
    console.error('Failed to save game record:', e);
  }
};

export const loadGameRecords = (): GameRecord[] => {
  try {
    const existing = localStorage.getItem('baggage_game_records');
    return existing ? JSON.parse(existing) : [];
  } catch (e) {
    console.error('Failed to load game records:', e);
    return [];
  }
};

export const loadGameProgress = (): { clearedLevels: number[]; highScores: Record<number, number> } => {
  try {
    const existing = localStorage.getItem('baggage_game_progress');
    return existing ? JSON.parse(existing) : { clearedLevels: [], highScores: {} };
  } catch (e) {
    console.error('Failed to load game progress:', e);
    return { clearedLevels: [], highScores: {} };
  }
};

export const getGameRecord = (id: string): GameRecord | undefined => {
  const records = loadGameRecords();
  return records.find(r => r.id === id);
};
