import { GameState, TeachingReport, PLATFORM_CONFIG } from '@/types/game';

const calculateGrade = (score: number, totalPossible: number): string => {
  const percentage = (score / totalPossible) * 100;
  if (percentage >= 90) return 'S';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  return 'D';
};

export const generateTeachingReport = (state: GameState): TeachingReport => {
  const { dispatchRecords, beatPoints, statistics, platforms, anomalies, score, difficulty, totalTime } = state;

  const totalBeats = beatPoints.length;
  const hitBeats = beatPoints.filter(b => b.isHit && b.judgeType !== 'miss').length;
  const hitRate = totalBeats > 0 ? hitBeats / totalBeats : 0;

  const offsets = dispatchRecords
    .filter(r => r.judgeType !== 'miss')
    .map(r => Math.abs(r.offset));
  const averageOffset = offsets.length > 0 
    ? offsets.reduce((a, b) => a + b, 0) / offsets.length 
    : 0;

  const dispatchIntervals: number[] = [];
  for (let i = 1; i < dispatchRecords.length; i++) {
    dispatchIntervals.push(dispatchRecords[i].time - dispatchRecords[i - 1].time);
  }
  const avgInterval = dispatchIntervals.length > 0 
    ? dispatchIntervals.reduce((a, b) => a + b, 0) / dispatchIntervals.length 
    : 0;
  const minInterval = dispatchIntervals.length > 0 
    ? Math.min(...dispatchIntervals) 
    : 0;

  const collisionCount = anomalies.filter(a => a.type === 'train_collision').length;
  const queueEfficiency = dispatchRecords.length > 0
    ? (dispatchRecords.filter(r => r.judgeType !== 'miss').length / dispatchRecords.length) * 100
    : 0;

  const platformStats = platforms.map(p => ({
    platformId: p.id,
    platformName: p.name,
    avgCongestion: p.history.reduce((a, h) => a + (h.count / p.maxCapacity) * 100, 0) / p.history.length,
    maxCongestion: Math.max(...p.history.map(h => (h.count / p.maxCapacity) * 100)),
    overflowCount: p.overflowCount,
  }));

  const totalOverflow = platformStats.reduce((a, p) => a + p.overflowCount, 0);

  const totalPossible = totalBeats * 100 + state.maxCombo * 10;

  return {
    basicInfo: {
      date: new Date().toISOString(),
      duration: totalTime,
      difficulty,
      finalScore: score,
      grade: calculateGrade(score, totalPossible),
    },
    rhythmAnalysis: {
      totalBeats,
      hitRate,
      judgeDistribution: {
        perfect: statistics.perfect,
        good: statistics.good,
        miss: statistics.miss,
      },
      offsetDistribution: {
        early: statistics.early,
        late: statistics.late,
      },
      averageOffset,
    },
    dispatchAnalysis: {
      totalDispatches: dispatchRecords.length,
      avgInterval,
      minInterval,
      collisionCount,
      queueEfficiency,
    },
    congestionAnalysis: {
      platformStats,
      totalOverflow,
    },
    anomalyDetails: anomalies,
  };
};

export const exportToCSV = (report: TeachingReport): string => {
  const lines: string[] = [];

  lines.push('节奏地铁调度战 - 教学报告');
  lines.push('');
  lines.push('基本信息');
  lines.push(`日期,${report.basicInfo.date}`);
  lines.push(`游戏时长,${report.basicInfo.duration}秒`);
  lines.push(`难度,${report.basicInfo.difficulty}`);
  lines.push(`最终得分,${report.basicInfo.finalScore}`);
  lines.push(`评级,${report.basicInfo.grade}`);
  lines.push('');

  lines.push('节奏分析');
  lines.push(`总节拍数,${report.rhythmAnalysis.totalBeats}`);
  lines.push(`命中率,${(report.rhythmAnalysis.hitRate * 100).toFixed(2)}%`);
  lines.push(`Perfect,${report.rhythmAnalysis.judgeDistribution.perfect}`);
  lines.push(`Good,${report.rhythmAnalysis.judgeDistribution.good}`);
  lines.push(`Miss,${report.rhythmAnalysis.judgeDistribution.miss}`);
  lines.push(`提前,${report.rhythmAnalysis.offsetDistribution.early}`);
  lines.push(`延迟,${report.rhythmAnalysis.offsetDistribution.late}`);
  lines.push(`平均偏移,${report.rhythmAnalysis.averageOffset.toFixed(2)}ms`);
  lines.push('');

  lines.push('调度分析');
  lines.push(`总发车数,${report.dispatchAnalysis.totalDispatches}`);
  lines.push(`平均间隔,${(report.dispatchAnalysis.avgInterval / 1000).toFixed(2)}秒`);
  lines.push(`最小间隔,${(report.dispatchAnalysis.minInterval / 1000).toFixed(2)}秒`);
  lines.push(`追尾警告,${report.dispatchAnalysis.collisionCount}`);
  lines.push(`调度效率,${report.dispatchAnalysis.queueEfficiency.toFixed(2)}%`);
  lines.push('');

  lines.push('客流分析');
  lines.push('站台名称,平均拥堵,最大拥堵,溢出次数');
  report.congestionAnalysis.platformStats.forEach(p => {
    lines.push(`${p.platformName},${p.avgCongestion.toFixed(2)}%,${p.maxCongestion.toFixed(2)}%,${p.overflowCount}`);
  });
  lines.push(`总溢出次数,${report.congestionAnalysis.totalOverflow}`);
  lines.push('');

  lines.push('异常事件详情');
  lines.push('时间,类型,严重程度,描述');
  report.anomalyDetails.forEach(a => {
    lines.push(`${(a.time / 1000).toFixed(2)}s,${a.type},${a.severity},${a.description}`);
  });

  return lines.join('\n');
};

export const exportToJSON = (report: TeachingReport): string => {
  return JSON.stringify(report, null, 2);
};

export const downloadFile = (content: string, filename: string, type: string) => {
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
