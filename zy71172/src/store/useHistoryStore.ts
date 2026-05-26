
import { create } from 'zustand';
import { GameRecord } from '@/types';

interface HistoryStore {
  records: GameRecord[];
  currentReplayRecord: GameRecord | null;
  isReplaying: boolean;
  replayIndex: number;
  loadRecords: () => void;
  getRecordById: (id: string) => GameRecord | undefined;
  deleteRecord: (id: string) => void;
  clearAllRecords: () => void;
  startReplay: (record: GameRecord) => void;
  stopReplay: () => void;
  setReplayIndex: (index: number) => void;
  exportReport: (record: GameRecord) => string;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  records: [],
  currentReplayRecord: null,
  isReplaying: false,
  replayIndex: 0,

  loadRecords: () => {
    const stored = localStorage.getItem('gameRecords');
    if (stored) {
      set({ records: JSON.parse(stored) });
    }
  },

  getRecordById: (id: string) => {
    return get().records.find(r => r.id === id);
  },

  deleteRecord: (id: string) => {
    const { records } = get();
    const filtered = records.filter(r => r.id !== id);
    set({ records: filtered });
    localStorage.setItem('gameRecords', JSON.stringify(filtered));
  },

  clearAllRecords: () => {
    set({ records: [] });
    localStorage.removeItem('gameRecords');
  },

  startReplay: (record: GameRecord) => {
    set({
      currentReplayRecord: record,
      isReplaying: true,
      replayIndex: 0,
    });
  },

  stopReplay: () => {
    set({
      currentReplayRecord: null,
      isReplaying: false,
      replayIndex: 0,
    });
  },

  setReplayIndex: (index: number) => {
    set({ replayIndex: index });
  },

  exportReport: (record: GameRecord) => {
    const levelNames = ['', '新手入门', '进阶挑战', '实战模拟'];
    const date = new Date(record.completedAt).toLocaleString('zh-CN');

    let report = `
========================================
      小区垃圾投放游戏 - 投放报告
========================================

【基本信息】
关卡: ${levelNames[record.levelId] || `关卡${record.levelId}`}
完成时间: ${date}
用时: ${Math.floor(record.duration / 60)}分${record.duration % 60}秒

【成绩统计】
最终得分: ${record.score} 分
准确率: ${record.accuracy}%
正确投放: ${record.correctCount} 次
错误投放: ${record.wrongCount} 次

【错误详情】
`;

    if (record.errors.length === 0) {
      report += '  太棒了！没有任何错误！\n';
    } else {
      record.errors.forEach((err, idx) => {
        report += `
${idx + 1}. ${err.trashItem.emoji} ${err.trashItem.name}
   错误操作: ${err.wrongAction}
   正确做法: ${err.correctAction}
   分析: ${err.explanation}
`;
      });
    }

    report += `
========================================
          感谢参与！
========================================
`;

    return report;
  },
}));

export default useHistoryStore;
