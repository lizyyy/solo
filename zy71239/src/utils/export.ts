import { GameSession, GameEvent } from '../game/types';

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const getEventTypeName = (type: string): string => {
  const names: Record<string, string> = {
    scan: '扫描',
    pass: '放行',
    block: '拦截',
    warning: '警告',
    check: '核对',
    dispatch: '调度'
  };
  return names[type] || type;
};

export const generateCSV = (session: GameSession): string => {
  const headers = [
    '序号', '时间', '观众姓名', '通道类型', '事件类型', 
    '物品', '分值变化', '描述', '建议核对', '人工核对'
  ];
  
  const rows = session.events.map((e: GameEvent, i: number) => [
    i + 1,
    formatTime(e.timestamp),
    e.audienceName || '-',
    e.channel === 'vip' ? 'VIP' : '普通',
    getEventTypeName(e.type),
    e.itemName || '-',
    e.scoreChange,
    e.description,
    e.needReview ? '是' : '否',
    e.reviewNote || ''
  ]);

  const summaryRows = [
    [],
    ['=== 统计汇总 ==='],
    ['最终得分', session.finalScore],
    ['安检准确率', session.scores.accuracy],
    ['通行效率', session.scores.efficiency],
    ['VIP服务', session.scores.vipService],
    ['应急处置', session.scores.emergency],
    ['总观众数', session.totalAudience],
    ['游戏时长', formatTime(session.duration)],
    ['难度', session.difficulty === 'easy' ? '简单' : session.difficulty === 'normal' ? '普通' : '困难']
  ];

  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.map(cell => `"${cell}"`).join(',')),
    ...summaryRows.map(r => r.join(','))
  ].join('\n');

  return '\ufeff' + csvContent;
};

export const downloadCSV = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportSessionReport = (session: GameSession) => {
  const csv = generateCSV(session);
  const filename = `安检报告_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}_${session.id}.csv`;
  downloadCSV(csv, filename);
};
