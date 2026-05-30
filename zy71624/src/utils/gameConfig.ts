import type { Difficulty, GameConfig, GameReport, Order, Incident, ReplayNode, HistoryRecord } from '@/types';

export const GAME_CONFIGS: Record<Difficulty, GameConfig> = {
  easy: {
    gameDuration: 90,
    difficulty: 'easy',
    maxConcurrentOrders: 2,
    orderInterval: 15000,
    initialComponents: {
      power: 2,
      switch: 3,
      bulb: 2,
      resistor: 4,
    },
  },
  medium: {
    gameDuration: 120,
    difficulty: 'medium',
    maxConcurrentOrders: 3,
    orderInterval: 12000,
    initialComponents: {
      power: 2,
      switch: 4,
      bulb: 3,
      resistor: 5,
    },
  },
  hard: {
    gameDuration: 150,
    difficulty: 'hard',
    maxConcurrentOrders: 4,
    orderInterval: 10000,
    initialComponents: {
      power: 3,
      switch: 5,
      bulb: 4,
      resistor: 6,
    },
  },
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '新手入门',
  medium: '进阶挑战',
  hard: '大师模式',
};

export const DIFFICULTY_DESCRIPTIONS: Record<Difficulty, string> = {
  easy: '2个吧台，90秒，充足元件',
  medium: '4个吧台，120秒，适量元件',
  hard: '5个吧台，150秒，有限元件',
};

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: '#10B981',
  medium: '#F59E0B',
  hard: '#EF4444',
};

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const formatVoltage = (voltage: number): string => {
  return `${voltage.toFixed(1)}V`;
};

export const formatCurrent = (current: number): string => {
  return `${(current * 1000).toFixed(0)}mA`;
};

export const generateReport = (
  gameId: string,
  startTime: number,
  endTime: number,
  difficulty: Difficulty,
  totalScore: number,
  accuracy: number,
  orders: Order[],
  incidents: Incident[],
  replayData: ReplayNode[]
): GameReport => {
  const processed = orders.filter(o => o.status === 'completed' || o.status === 'confirmed');
  const pending = orders.filter(o => o.status === 'pending');
  const returned = orders.filter(o => o.status === 'timeout' || o.status === 'returned');

  return {
    gameId,
    startTime,
    endTime,
    duration: endTime - startTime,
    difficulty,
    totalScore,
    accuracy,
    statistics: {
      processed: { count: processed.length, orders: processed },
      pending: { count: pending.length, orders: pending },
      returned: { count: returned.length, orders: returned },
    },
    incidents,
    replayData,
    exportTime: Date.now(),
  };
};

export const exportReportAsJSON = (report: GameReport): string => {
  return JSON.stringify(report, null, 2);
};

export const exportReportAsCSV = (report: GameReport): string => {
  const header = '游戏ID,开始时间,结束时间,时长(秒),难度,总分,准确率,已处理,待确认,退回补材料,事故数\n';
  const data = [
    report.gameId,
    new Date(report.startTime).toLocaleString('zh-CN'),
    new Date(report.endTime).toLocaleString('zh-CN'),
    Math.floor(report.duration / 1000),
    DIFFICULTY_LABELS[report.difficulty],
    report.totalScore,
    `${(report.accuracy * 100).toFixed(1)}%`,
    report.statistics.processed.count,
    report.statistics.pending.count,
    report.statistics.returned.count,
    report.incidents.length,
  ].join(',');

  let ordersSection = '\n\n订单详情\n订单ID,吧台,要求电压,状态,创建时间,完成时间,得分\n';
  const allOrders = [
    ...report.statistics.processed.orders,
    ...report.statistics.pending.orders,
    ...report.statistics.returned.orders,
  ];

  allOrders.forEach(order => {
    const row = [
      order.id,
      order.barName,
      `${order.requiredVoltage}V`,
      order.status,
      new Date(order.createdAt).toLocaleTimeString('zh-CN'),
      order.completedAt ? new Date(order.completedAt).toLocaleTimeString('zh-CN') : '',
      order.score,
    ].join(',');
    ordersSection += row + '\n';
  });

  let incidentsSection = '\n事故记录\n时间,类型,描述,扣分\n';
  report.incidents.forEach(incident => {
    const row = [
      new Date(incident.timestamp).toLocaleTimeString('zh-CN'),
      incident.type,
      `"${incident.description}"`,
      incident.penalty,
    ].join(',');
    incidentsSection += row + '\n';
  });

  return header + data + ordersSection + incidentsSection;
};

export const downloadFile = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const saveGameToHistory = (
  gameId: string,
  startTime: number,
  endTime: number,
  difficulty: Difficulty,
  totalScore: number,
  accuracy: number,
  totalOrders: number,
  totalIncidents: number
): void => {
  const record: HistoryRecord = {
    gameId,
    startTime,
    endTime,
    difficulty,
    totalScore,
    accuracy,
    totalOrders,
    totalIncidents,
  };

  const history = getGameHistory();
  history.unshift(record);

  if (history.length > 50) {
    history.pop();
  }

  localStorage.setItem('circuit-bar-history', JSON.stringify(history));
};

export const getGameHistory = (): HistoryRecord[] => {
  const data = localStorage.getItem('circuit-bar-history');
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveGameData = (gameId: string, data: unknown): void => {
  localStorage.setItem(`circuit-bar-game-${gameId}`, JSON.stringify(data));
};

export const loadGameData = (gameId: string): unknown | null => {
  const data = localStorage.getItem(`circuit-bar-game-${gameId}`);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};

export const deleteGameData = (gameId: string): void => {
  localStorage.removeItem(`circuit-bar-game-${gameId}`);
  const history = getGameHistory().filter(h => h.gameId !== gameId);
  localStorage.setItem('circuit-bar-history', JSON.stringify(history));
};
