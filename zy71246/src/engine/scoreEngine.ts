import type {
  GameState,
  EventLog,
  MissionReport,
  ScoreDetail,
  ScoreBreakdown,
  ErrorAnalysis,
  DataPacket,
  Command,
  VisibilityWindow,
} from '../types/mission';
import { getErrorSummary } from './errorHandler';
import { generateId } from '../utils/time';

export function calculateFinalScore(
  gameState: GameState,
  events: EventLog[]
): MissionReport {
  const maxScore = 1000;
  let earnedScore = 0;

  const scoreDetails: ScoreDetail[] = [];

  const downloadScore = calculateDownloadScore(gameState.dataPackets);
  scoreDetails.push(downloadScore);
  earnedScore += downloadScore.earnedScore;

  const commandScore = calculateCommandScore(gameState.commands);
  scoreDetails.push(commandScore);
  earnedScore += commandScore.earnedScore;

  const efficiencyScore = calculateEfficiencyScore(gameState);
  scoreDetails.push(efficiencyScore);
  earnedScore += efficiencyScore.earnedScore;

  const errorPenalty = calculateErrorPenalty(events);
  scoreDetails.push(errorPenalty);
  earnedScore += errorPenalty.earnedScore;

  const bonusScore = calculateBonusScore(gameState, events);
  scoreDetails.push(bonusScore);
  earnedScore += bonusScore.earnedScore;

  earnedScore = Math.max(0, Math.min(maxScore, earnedScore));

  const grade = determineGrade(earnedScore, maxScore);
  const recommendations = generateRecommendations(scoreDetails, events, gameState);

  const scoreBreakdown = generateScoreBreakdown(scoreDetails);
  const statistics = generateStatistics(gameState, events);
  const errorAnalysis = generateErrorAnalysis(events);

  return {
    reportId: generateId(),
    missionId: gameState.missionId,
    missionName: '天问一号数据回传任务',
    startTime: gameState.visibilityWindows[0]?.startTime || Date.now(),
    endTime: Date.now(),
    completedAt: Date.now(),
    finalScore: earnedScore,
    maxScore,
    grade,
    scoreBreakdown,
    scoreDetails,
    statistics,
    errorAnalysis,
    eventSummary: generateEventSummary(events),
    performanceMetrics: calculateMetrics(gameState, events),
    recommendations,
    timelineData: events,
  };
}

function calculateDownloadScore(packets: DataPacket[]): ScoreDetail {
  const maxScore = 400;
  const criticalPackets = packets.filter(p => p.priority === 'critical');
  const highPackets = packets.filter(p => p.priority === 'high');
  const mediumPackets = packets.filter(p => p.priority === 'medium');
  const lowPackets = packets.filter(p => p.priority === 'low');

  const criticalDownloaded = criticalPackets.filter(p => p.isDownloaded).length;
  const highDownloaded = highPackets.filter(p => p.isDownloaded).length;
  const mediumDownloaded = mediumPackets.filter(p => p.isDownloaded).length;
  const lowDownloaded = lowPackets.filter(p => p.isDownloaded).length;

  const criticalScore = criticalPackets.length > 0 ? (criticalDownloaded / criticalPackets.length) * 160 : 160;
  const highScore = highPackets.length > 0 ? (highDownloaded / highPackets.length) * 120 : 120;
  const mediumScore = mediumPackets.length > 0 ? (mediumDownloaded / mediumPackets.length) * 80 : 80;
  const lowScore = lowPackets.length > 0 ? (lowDownloaded / lowPackets.length) * 40 : 40;

  const earnedScore = Math.floor(criticalScore + highScore + mediumScore + lowScore);

  return {
    category: '数据下载',
    maxScore,
    earnedScore,
    description: '根据各优先级数据包的下载完成情况评分，关键数据权重更高',
    breakdown: [
      { label: '关键数据下载', value: criticalDownloaded, maxValue: criticalPackets.length },
      { label: '高优先级数据下载', value: highDownloaded, maxValue: highPackets.length },
      { label: '中优先级数据下载', value: mediumDownloaded, maxValue: mediumPackets.length },
      { label: '低优先级数据下载', value: lowDownloaded, maxValue: lowPackets.length },
    ],
  };
}

function calculateCommandScore(commands: Command[]): ScoreDetail {
  const maxScore = 300;
  const priority1 = commands.filter(c => c.priority === 1);
  const priority2 = commands.filter(c => c.priority === 2);
  const priority3 = commands.filter(c => c.priority === 3);
  const priority4 = commands.filter(c => c.priority >= 4);

  const p1Success = priority1.filter(c => c.status === 'success').length;
  const p2Success = priority2.filter(c => c.status === 'success').length;
  const p3Success = priority3.filter(c => c.status === 'success').length;
  const p4Success = priority4.filter(c => c.status === 'success').length;

  const p1Score = priority1.length > 0 ? (p1Success / priority1.length) * 120 : 120;
  const p2Score = priority2.length > 0 ? (p2Success / priority2.length) * 90 : 90;
  const p3Score = priority3.length > 0 ? (p3Success / priority3.length) * 60 : 60;
  const p4Score = priority4.length > 0 ? (p4Success / priority4.length) * 30 : 30;

  const earnedScore = Math.floor(p1Score + p2Score + p3Score + p4Score);

  return {
    category: '指令发送',
    maxScore,
    earnedScore,
    description: '根据各优先级指令的发送成功率评分，高优先级指令权重更高',
    breakdown: [
      { label: 'P1 指令成功', value: p1Success, maxValue: priority1.length },
      { label: 'P2 指令成功', value: p2Success, maxValue: priority2.length },
      { label: 'P3 指令成功', value: p3Success, maxValue: priority3.length },
      { label: 'P4/P5 指令成功', value: p4Success, maxValue: priority4.length },
    ],
  };
}

function calculateEfficiencyScore(gameState: GameState): ScoreDetail {
  const maxScore = 200;
  const windows = gameState.visibilityWindows;
  const usedWindows = windows.filter(w => w.status === 'completed' || w.status === 'active');
  const missedWindows = windows.filter(w => w.status === 'missed');

  const utilization = usedWindows.length > 0 
    ? (usedWindows.length / (usedWindows.length + missedWindows.length)) * 100 
    : 100;

  const totalScheduledTime = usedWindows.reduce((sum, w) => sum + (w.actualDuration || w.predictedDuration), 0);
  const totalAvailableTime = windows.reduce((sum, w) => sum + w.predictedDuration, 0);
  const timeEfficiency = totalAvailableTime > 0 ? (totalScheduledTime / totalAvailableTime) * 100 : 100;

  const utilizationScore = (utilization / 100) * 100;
  const timeEfficiencyScore = (timeEfficiency / 100) * 100;

  const earnedScore = Math.floor(utilizationScore + timeEfficiencyScore);

  return {
    category: '资源利用',
    maxScore,
    earnedScore,
    description: '根据窗口利用率和时间效率评分，避免窗口浪费',
    breakdown: [
      { label: '窗口利用率', value: usedWindows.length, maxValue: windows.length },
      { label: '时间效率', value: Math.floor(totalScheduledTime / 1000), maxValue: Math.floor(totalAvailableTime / 1000) },
    ],
  };
}

function calculateErrorPenalty(events: EventLog[]): ScoreDetail {
  const maxScore = 0;
  const errorSummary = getErrorSummary(events);
  
  const windowMissPenalty = errorSummary.byType.window_missed * 100;
  const timeoutPenalty = errorSummary.byType.command_timeout * 50;
  const packetLossPenalty = errorSummary.byType.data_packet_lost * 150;
  
  const totalPenalty = windowMissPenalty + timeoutPenalty + packetLossPenalty;
  const earnedScore = -totalPenalty;

  return {
    category: '错误惩罚',
    maxScore,
    earnedScore,
    description: '根据发生的错误类型和数量扣分，严重错误扣分更多',
    breakdown: [
      { label: '窗口错过扣分', value: -windowMissPenalty, maxValue: 0 },
      { label: '指令超时扣分', value: -timeoutPenalty, maxValue: 0 },
      { label: '数据包丢失扣分', value: -packetLossPenalty, maxValue: 0 },
    ],
  };
}

function calculateBonusScore(gameState: GameState, events: EventLog[]): ScoreDetail {
  const maxScore = 100;
  let earnedScore = 0;

  const errorSummary = getErrorSummary(events);
  if (errorSummary.totalErrors === 0) {
    earnedScore += 50;
  }

  const criticalPackets = gameState.dataPackets.filter(p => p.priority === 'critical');
  const allCriticalDownloaded = criticalPackets.every(p => p.isDownloaded);
  if (allCriticalDownloaded && criticalPackets.length > 0) {
    earnedScore += 30;
  }

  const highPriorityCommands = gameState.commands.filter(c => c.priority <= 2);
  const allHighCommandsSent = highPriorityCommands.every(c => c.status === 'success');
  if (allHighCommandsSent && highPriorityCommands.length > 0) {
    earnedScore += 20;
  }

  return {
    category: '效率加成',
    maxScore,
    earnedScore,
    description: '完美执行、关键任务完成等额外奖励',
    breakdown: [
      { label: '零错误奖励', value: errorSummary.totalErrors === 0 ? 50 : 0, maxValue: 50 },
      { label: '关键数据全部下载', value: allCriticalDownloaded ? 30 : 0, maxValue: 30 },
      { label: '高优先级指令全部成功', value: allHighCommandsSent ? 20 : 0, maxValue: 20 },
    ],
  };
}

function determineGrade(score: number, maxScore: number): 'S' | 'A' | 'B' | 'C' | 'D' | 'F' {
  const percentage = (score / maxScore) * 100;
  if (percentage >= 95) return 'S';
  if (percentage >= 85) return 'A';
  if (percentage >= 75) return 'B';
  if (percentage >= 65) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
}

function generateEventSummary(events: EventLog[]) {
  const errorSummary = getErrorSummary(events);
  const errorsByType: Record<string, number> = {
    '窗口错过': errorSummary.byType.window_missed,
    '指令超时': errorSummary.byType.command_timeout,
    '数据包丢失': errorSummary.byType.data_packet_lost,
  };

  const criticalErrors = errorSummary.criticalErrors.map(e => e.message);

  return {
    totalEvents: events.length,
    errorsByType,
    criticalErrors,
  };
}

function calculateMetrics(gameState: GameState, events: EventLog[]) {
  const packets = gameState.dataPackets;
  const commands = gameState.commands;
  const windows = gameState.visibilityWindows;

  const downloadedPackets = packets.filter(p => p.isDownloaded).length;
  const dataDownloadRate = packets.length > 0 ? (downloadedPackets / packets.length) * 100 : 100;

  const successfulCommands = commands.filter(c => c.status === 'success').length;
  const commandSuccessRate = commands.length > 0 ? (successfulCommands / commands.length) * 100 : 100;

  const completedWindows = windows.filter(w => w.status === 'completed').length;
  const missedWindows = windows.filter(w => w.status === 'missed').length;
  const windowUtilization = (completedWindows + missedWindows) > 0
    ? (completedWindows / (completedWindows + missedWindows)) * 100
    : 100;

  const errorSummary = getErrorSummary(events);
  const resourceEfficiency = Math.max(0, 100 - errorSummary.totalErrors * 10);

  return {
    dataDownloadRate,
    commandSuccessRate,
    windowUtilization,
    resourceEfficiency,
  };
}

function generateRecommendations(
  scoreDetails: ScoreDetail[],
  events: EventLog[],
  gameState: GameState
): string[] {
  const recommendations: string[] = [];
  const errorSummary = getErrorSummary(events);

  if (errorSummary.byType.window_missed > 0) {
    recommendations.push(`本次任务错过 ${errorSummary.byType.window_missed} 个窗口，建议优化预调度时的窗口预报精度检查`);
    
    const windowMissEvents = events.filter(e => e.errorDetail?.errorType === 'window_missed');
    const reasons = [...new Set(windowMissEvents.map(e => e.errorDetail!.windowMissed!.reason))];
    
    reasons.forEach(r => {
      const tips: Record<string, string> = {
        wrong_station: '• 调度前请核对每个窗口对应的地面站是否正确',
        previous_overrun: '• 任务间请预留足够的缓冲时间，避免前序任务超时影响后续窗口',
        insufficient_slew_time: '• 天线转向需要时间，请在相邻任务间预留至少30秒转向时间',
        prediction_error: '• 考虑预报误差，不要把任务排满整个窗口，预留10%余量',
      };
      recommendations.push(tips[r]);
    });
  }

  if (errorSummary.byType.command_timeout > 0) {
    recommendations.push(`有 ${errorSummary.byType.command_timeout} 条指令超时，建议重新评估队列优先级排序`);
    
    const timeoutEvents = events.filter(e => e.errorDetail?.errorType === 'command_timeout');
    const queueIssues = timeoutEvents.filter(e => e.errorDetail!.commandTimeout!.reason === 'queue_position');
    if (queueIssues.length > 0) {
      recommendations.push('• 高优先级指令请提前排到队列前面，避免窗口结束时才轮到发送');
    }
    
    const sizeIssues = timeoutEvents.filter(e => e.errorDetail!.commandTimeout!.reason === 'size_too_large');
    if (sizeIssues.length > 0) {
      recommendations.push('• 长指令请拆分发送，或安排在更长的窗口中传输');
    }
  }

  if (errorSummary.byType.data_packet_lost > 0) {
    recommendations.push(`丢失 ${errorSummary.byType.data_packet_lost} 个数据包，建议优化链路预算和冗余策略`);
    
    const lossEvents = events.filter(e => e.errorDetail?.errorType === 'data_packet_lost');
    const bandwidthIssues = lossEvents.filter(e => e.errorDetail!.dataPacketLost!.reason === 'bandwidth_exceeded');
    if (bandwidthIssues.length > 0) {
      recommendations.push('• 计算窗口带宽能力，不要安排超过传输能力的数据量');
    }
    
    const rainFadeIssues = lossEvents.filter(e => e.errorDetail!.dataPacketLost!.reason === 'rain_fade');
    if (rainFadeIssues.length > 0) {
      recommendations.push('• 恶劣天气时请降低传输速率，或启用纠错编码');
    }
  }

  const downloadScore = scoreDetails.find(s => s.category === '数据下载');
  if (downloadScore && downloadScore.earnedScore < downloadScore.maxScore * 0.7) {
    const criticalPackets = gameState.dataPackets.filter(p => p.priority === 'critical' && !p.isDownloaded);
    if (criticalPackets.length > 0) {
      recommendations.push(`• 警告：有 ${criticalPackets.length} 个关键数据包未能下载，请优先安排关键数据的传输窗口`);
    }
  }

  const commandScore = scoreDetails.find(s => s.category === '指令发送');
  if (commandScore && commandScore.earnedScore < commandScore.maxScore * 0.7) {
    const failedCommands = gameState.commands.filter(c => c.priority <= 2 && c.status !== 'success');
    if (failedCommands.length > 0) {
      recommendations.push(`• 警告：有 ${failedCommands.length} 条高优先级指令发送失败，请检查队列调度策略`);
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('任务执行完美！所有关键任务均已完成，没有发生任何错误。');
    recommendations.push('建议挑战更高难度的任务配置，或尝试优化调度方案以获得更快的执行效率。');
  }

  return recommendations;
}

function generateScoreBreakdown(scoreDetails: ScoreDetail[]): ScoreBreakdown {
  const findScore = (category: string) => {
    const detail = scoreDetails.find(d => d.category === category);
    return detail?.earnedScore || 0;
  };

  return {
    dataDownload: findScore('数据下载'),
    commandDelivery: findScore('指令发送'),
    resourceUtilization: findScore('资源利用'),
    efficiencyBonus: findScore('效率加成'),
    errorPenalty: findScore('错误惩罚'),
  };
}

function generateStatistics(gameState: GameState, events: EventLog[]) {
  const packets = gameState.dataPackets;
  const commands = gameState.commands;
  const windows = gameState.visibilityWindows;
  const errorSummary = getErrorSummary(events);

  const downloadedPackets = packets.filter(p => p.isDownloaded).length;
  const successfulCommands = commands.filter(c => c.status === 'success').length;
  const completedWindows = windows.filter(w => w.status === 'completed').length;
  const missedWindows = windows.filter(w => w.status === 'missed').length;

  return {
    windowUtilization: (completedWindows + missedWindows) > 0
      ? (completedWindows / (completedWindows + missedWindows)) * 100
      : 100,
    dataCompletionRate: packets.length > 0 ? (downloadedPackets / packets.length) * 100 : 100,
    commandSuccessRate: commands.length > 0 ? (successfulCommands / commands.length) * 100 : 100,
    totalErrors: errorSummary.totalErrors,
  };
}

function generateErrorAnalysis(events: EventLog[]): ErrorAnalysis {
  const errorSummary = getErrorSummary(events);
  
  const errorsByType: Record<string, number> = {
    window_missed: errorSummary.byType.window_missed,
    command_timeout: errorSummary.byType.command_timeout,
    data_packet_lost: errorSummary.byType.data_packet_lost,
  };

  const deductionDetails: ErrorAnalysis['deductionDetails'] = [
    {
      type: 'window_missed',
      totalDeduction: errorSummary.byType.window_missed * 100,
      count: errorSummary.byType.window_missed,
      breakdown: [],
    },
    {
      type: 'command_timeout',
      totalDeduction: errorSummary.byType.command_timeout * 50,
      count: errorSummary.byType.command_timeout,
      breakdown: [],
    },
    {
      type: 'data_packet_lost',
      totalDeduction: errorSummary.byType.data_packet_lost * 150,
      count: errorSummary.byType.data_packet_lost,
      breakdown: [],
    },
  ];

  events.forEach(event => {
    if (!event.errorDetail) return;
    
    const detail = deductionDetails.find(d => d.type === event.errorDetail!.errorType);
    if (!detail) return;

    let reason = '';
    let deduction = 0;
    
    if (event.errorDetail.errorType === 'window_missed' && event.errorDetail.windowMissed) {
      reason = event.errorDetail.windowMissed.reason;
      deduction = 100;
    } else if (event.errorDetail.errorType === 'command_timeout' && event.errorDetail.commandTimeout) {
      reason = event.errorDetail.commandTimeout.reason;
      deduction = 50;
    } else if (event.errorDetail.errorType === 'data_packet_lost' && event.errorDetail.dataPacketLost) {
      reason = event.errorDetail.dataPacketLost.reason;
      deduction = 150;
    }

    const existingBreakdown = detail.breakdown.find(b => b.reason === reason);
    if (existingBreakdown) {
      existingBreakdown.count++;
      existingBreakdown.deduction += deduction;
    } else {
      detail.breakdown.push({ reason, count: 1, deduction });
    }
  });

  return {
    totalErrors: errorSummary.totalErrors,
    errorsByType,
    deductionDetails,
  };
}

export function getGradeColor(grade: string): string {
  const colors: Record<string, string> = {
    S: '#ffd700',
    A: '#27ae60',
    B: '#3498db',
    C: '#f39c12',
    D: '#e67e22',
    F: '#e74c3c',
  };
  return colors[grade] || '#95a5a6';
}

export function getGradeDescription(grade: string): string {
  const descriptions: Record<string, string> = {
    S: '卓越 - 完美完成所有任务，零错误',
    A: '优秀 - 大部分任务完成，仅有少量小问题',
    B: '良好 - 基本完成任务，存在一些可改进之处',
    C: '及格 - 勉强完成任务，需要大幅改进',
    D: '不合格 - 任务部分失败，需要重新学习',
    F: '失败 - 任务严重失败，请重新开始',
  };
  return descriptions[grade] || '';
}
