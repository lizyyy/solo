import type { GameState, TurnSnapshot, Operation, GameEvent } from '../engine/types';
import { formatHour } from './temperature';

export function generateCSVReport(gameState: GameState): string {
  const headers = [
    '回合',
    '时间',
    '室外温度(°C)',
    '电价(元/kWh)',
    '时段',
    '平均温度(°C)',
    '最高温度(°C)',
    '最低温度(°C)',
    '总负载(kW)',
    '空调运行台数',
    '本回合用电(kWh)',
    '累计电费(元)',
    '本回合得分',
    '累计得分',
    '告警数',
    '操作记录',
    '事件记录',
  ];

  const rows: string[][] = [];

  for (let i = 0; i < gameState.snapshotHistory.length; i++) {
    const snapshot = gameState.snapshotHistory[i];
    const { turnState, racks, acUnits } = snapshot;

    const temps = racks.map((r) => r.temperature);
    const avgTemp = (temps.reduce((s, t) => s + t, 0) / temps.length).toFixed(1);
    const maxTemp = Math.max(...temps).toFixed(1);
    const minTemp = Math.min(...temps).toFixed(1);
    const totalLoad = racks.reduce((s, r) => s + r.load, 0).toFixed(1);
    const acRunning = acUnits.filter((a) => a.isOn && a.status !== 'fault').length;
    const warningCount = racks.filter((r) => r.status === 'warning' || r.status === 'danger').length;

    const turnOps = gameState.operationLog.filter((op) => op.turn === turnState.turn);
    const turnEvents = gameState.eventLog.filter((evt) => evt.turn === turnState.turn);

    const opDescriptions = turnOps.map(formatOperation).join('; ');
    const eventDescriptions = turnEvents.map((e) => e.message).join('; ');

    const prevScore = i > 0 ? gameState.snapshotHistory[i - 1].turnState.score : 0;
    const turnScore = turnState.score - prevScore;

    rows.push([
      String(turnState.turn),
      formatHour(turnState.hour),
      String(turnState.outdoorTemp),
      String(turnState.electricityPrice),
      turnState.pricePeriod === 'peak' ? '峰时' : turnState.pricePeriod === 'valley' ? '谷时' : '平时',
      avgTemp,
      maxTemp,
      minTemp,
      totalLoad,
      String(acRunning),
      String(turnState.electricityUsed),
      turnState.totalCost.toFixed(2),
      String(turnScore),
      String(turnState.score),
      String(warningCount),
      `"${opDescriptions}"`,
      `"${eventDescriptions}"`,
    ]);
  }

  const csvContent = [
    `# 机房降温策略游戏 - 运行报告`,
    `# 关卡: ${gameState.levelName}`,
    `# 游戏ID: ${gameState.gameId}`,
    `# 最终状态: ${gameState.gamePhase === 'won' ? '挑战成功' : gameState.gamePhase === 'lost' ? '挑战失败' : '进行中'}`,
    gameState.failReason ? `# 失败原因: ${gameState.failReason}` : '',
    `# 最终得分: ${gameState.turnState.score}`,
    `# 累计电费: ${gameState.turnState.totalCost.toFixed(2)} 元`,
    `# 生成时间: ${new Date().toLocaleString('zh-CN')}`,
    '',
    headers.join(','),
    ...rows.map((r) => r.join(',')),
  ].filter(Boolean).join('\n');

  return csvContent;
}

function formatOperation(op: Operation): string {
  switch (op.type) {
    case 'ac_toggle': {
      const acId = op.payload.acId as string;
      const isOn = op.payload.isOn as boolean;
      return `${acId} ${isOn ? '开启' : '关闭'}`;
    }
    case 'ac_setpoint': {
      const acId = op.payload.acId as string;
      const temp = op.payload.temperature as number;
      return `${acId} 设定温度 ${temp}°C`;
    }
    case 'migrate_load': {
      const from = op.payload.fromRackId as string;
      const to = op.payload.toRackId as string;
      const amount = op.payload.amount as number;
      return `迁移 ${amount}kW: ${from}→${to}`;
    }
    case 'next_turn':
      return '推进到下一回合';
    default:
      return op.type;
  }
}

export function downloadCSV(content: string, filename: string): void {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateSummaryReport(gameState: GameState): {
  title: string;
  sections: Array<{ title: string; items: Array<{ label: string; value: string | number }> }>;
} {
  const finalSnapshot = gameState.snapshotHistory[gameState.snapshotHistory.length - 1];
  const { racks, turnState } = finalSnapshot;

  const allTemps = gameState.snapshotHistory.flatMap((s) => s.racks.map((r) => r.temperature));
  const avgOverallTemp = allTemps.reduce((s, t) => s + t, 0) / allTemps.length;
  const maxOverallTemp = Math.max(...allTemps);

  const totalWarningTurns = gameState.snapshotHistory.filter((s) =>
    s.racks.some((r) => r.status === 'warning' || r.status === 'danger'),
  ).length;

  const totalOps = gameState.operationLog.length;
  const totalEvents = gameState.eventLog.length;

  return {
    title: `${gameState.levelName} - 运行报告`,
    sections: [
      {
        title: '基本信息',
        items: [
          { label: '游戏ID', value: gameState.gameId },
          { label: '关卡', value: gameState.levelName },
          { label: '最终状态', value: gameState.gamePhase === 'won' ? '挑战成功' : gameState.gamePhase === 'lost' ? '挑战失败' : '进行中' },
          { label: '完成回合', value: `${turnState.turn - 1}/${gameState.totalTurns}` },
        ],
      },
      {
        title: '最终得分',
        items: [
          { label: '总得分', value: turnState.score },
          { label: '累计电费', value: `${turnState.totalCost.toFixed(2)} 元` },
          { label: '电费预算', value: `${turnState.budget.toFixed(2)} 元` },
          { label: '预算使用率', value: `${((turnState.totalCost / turnState.budget) * 100).toFixed(1)}%` },
        ],
      },
      {
        title: '温度统计',
        items: [
          { label: '最终平均温度', value: `${(racks.reduce((s, r) => s + r.temperature, 0) / racks.length).toFixed(1)}°C` },
          { label: '全程平均温度', value: `${avgOverallTemp.toFixed(1)}°C` },
          { label: '最高温度', value: `${maxOverallTemp.toFixed(1)}°C` },
          { label: '温度告警回合', value: `${totalWarningTurns} 回合` },
        ],
      },
      {
        title: '操作统计',
        items: [
          { label: '总操作次数', value: totalOps },
          { label: '事件次数', value: totalEvents },
        ],
      },
    ],
  };
}

export function exportGameReport(gameState: GameState): void {
  const csv = generateCSVReport(gameState);
  const filename = `机房运行报告_${gameState.levelId}_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCSV(csv, filename);
}

export function generateReplayShareData(replay: any): string {
  return JSON.stringify({
    gameId: replay.gameId,
    levelName: replay.levelName,
    finalScore: replay.finalScore,
    completedTurns: replay.completedTurns,
    totalTurns: replay.totalTurns,
    totalCost: replay.totalCost,
    gamePhase: replay.gamePhase,
    failReason: replay.failReason,
    createdAt: replay.createdAt,
  });
}
