import { create } from 'zustand';
import { Batch, HistoryRecord, ToastMessage, Track } from '@/types';
import { mockBatches, mockHistory, humanFriendlyErrors } from '@/data/mockData';

interface AppState {
  batches: Batch[];
  history: HistoryRecord[];
  toasts: ToastMessage[];
  selectedBatchId: string | null;
  currentOperator: string;
  
  selectBatch: (id: string | null) => void;
  addToast: (type: ToastMessage['type'], message: string) => void;
  removeToast: (id: string) => void;
  showHumanError: (errorKey: string) => void;
  
  importBatch: (tracks: Omit<Track, 'id' | 'status'>[]) => void;
  correctTrack: (batchId: string, trackId: string, updates: Partial<Track>) => void;
  rerunBatch: (batchId: string) => void;
  reviewMixedBatch: (batchId: string, approved: boolean) => void;
  supplementFromPhoto: (batchId: string, trackId: string, photoRemark: string) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useAppStore = create<AppState>((set, get) => ({
  batches: mockBatches,
  history: mockHistory,
  toasts: [],
  selectedBatchId: null,
  currentOperator: '许老师',

  selectBatch: (id) => set({ selectedBatchId: id }),

  addToast: (type, message) => {
    const id = generateId();
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },

  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  showHumanError: (errorKey) => {
    const message = humanFriendlyErrors[errorKey] || '操作失败，请重试';
    get().addToast('error', message);
  },

  importBatch: (trackData) => {
    const { currentOperator, addToast } = get();
    const now = new Date().toLocaleString('zh-CN');
    const batchId = `B${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${generateId().slice(0, 3).toUpperCase()}`;
    
    const hasMixed = trackData.some(t => t.ticketType === 'mixed') || 
                    (trackData.filter(t => t.ticketType === 'free').length > 0 && 
                     trackData.filter(t => t.ticketType === 'paid').length > 0);
    
    const tracks: Track[] = trackData.map((t, idx) => ({
      ...t,
      id: `t${generateId()}${idx}`,
      status: hasMixed ? 'pending_review' : 'normal',
      hasMixedTickets: hasMixed,
    }));

    let sceneType: Batch['sceneType'] = 'smooth';
    let status: Batch['status'] = 'normal';
    
    if (hasMixed) {
      sceneType = 'mixed_tickets';
      status = 'pending_review';
    }

    const newBatch: Batch = {
      id: batchId,
      name: `复核批次-${batchId}`,
      status,
      sceneType,
      tracks,
      photos: [],
      createdAt: now,
      updatedAt: now,
      operator: currentOperator,
    };

    const historyRecord: HistoryRecord = {
      id: `h${generateId()}`,
      targetId: batchId,
      targetType: 'batch',
      action: 'import',
      operator: currentOperator,
      beforeValue: '-',
      afterValue: `导入曲目别名表：${tracks.map(t => `${t.name}(${t.alias})`).join('、')}`,
      timestamp: now,
    };

    set((state) => ({
      batches: [newBatch, ...state.batches],
      history: [historyRecord, ...state.history],
    }));

    addToast('success', `批次 ${batchId} 导入成功`);
    if (hasMixed) {
      get().showHumanError('MIXED_TICKETS');
    }
  },

  correctTrack: (batchId, trackId, updates) => {
    const { currentOperator, addToast } = get();
    const now = new Date().toLocaleString('zh-CN');
    const batch = get().batches.find(b => b.id === batchId);
    const track = batch?.tracks.find(t => t.id === trackId);
    
    if (!track) return;

    const beforeValue = `状态：${track.status}，口径：${track.standard === 'new' ? '新口径' : '旧口径'}`;
    
    set((state) => ({
      batches: state.batches.map((b) => {
        if (b.id !== batchId) return b;
        return {
          ...b,
          updatedAt: now,
          tracks: b.tracks.map((t) => 
            t.id === trackId ? { ...t, ...updates } : t
          ),
        };
      }),
      history: [
        {
          id: `h${generateId()}`,
          targetId: trackId,
          targetType: 'track',
          action: 'correct',
          operator: currentOperator,
          beforeValue,
          afterValue: `状态：${updates.status || track.status}，口径：${(updates.standard || track.standard) === 'new' ? '新口径' : '旧口径'}`,
          timestamp: now,
        },
        ...get().history,
      ],
    }));

    addToast('success', '曲目信息已修正');
  },

  rerunBatch: (batchId) => {
    const { currentOperator, addToast, showHumanError } = get();
    const batch = get().batches.find(b => b.id === batchId);
    if (!batch) return;

    const now = new Date().toLocaleString('zh-CN');
    const newBatchId = `B${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${generateId().slice(0, 3).toUpperCase()}`;

    const rerunTracks = batch.tracks.map((t) => ({
      ...t,
      id: `t${generateId()}`,
      status: 'processing' as const,
    }));

    const hasMixed = rerunTracks.some(t => t.hasMixedTickets);

    setTimeout(() => {
      set((state) => ({
        batches: state.batches.map((b) => {
          if (b.id !== newBatchId) return b;
          return {
            ...b,
            status: hasMixed ? 'pending_review' : 'normal',
            tracks: b.tracks.map((t) => ({
              ...t,
              status: hasMixed ? 'pending_review' : 'normal',
            })),
          };
        }),
      }));
      addToast('success', `重跑完成，新批次 ${newBatchId}`);
      if (hasMixed) {
        showHumanError('MIXED_TICKETS');
      }
    }, 1500);

    const newBatch: Batch = {
      id: newBatchId,
      name: `${batch.name}(重跑)`,
      status: 'processing',
      sceneType: batch.sceneType,
      tracks: rerunTracks,
      photos: batch.photos,
      createdAt: now,
      updatedAt: now,
      operator: currentOperator,
    };

    const historyRecord: HistoryRecord = {
      id: `h${generateId()}`,
      targetId: newBatchId,
      targetType: 'batch',
      action: 'rerun',
      operator: currentOperator,
      beforeValue: `原批次 ${batchId}`,
      afterValue: `新批次 ${newBatchId}（重跑）`,
      timestamp: now,
    };

    set((state) => ({
      batches: [newBatch, ...state.batches],
      history: [historyRecord, ...state.history],
    }));

    addToast('info', '正在重跑批次...');
  },

  reviewMixedBatch: (batchId, approved) => {
    const { currentOperator, addToast } = get();
    const now = new Date().toLocaleString('zh-CN');

    set((state) => ({
      batches: state.batches.map((b) => {
        if (b.id !== batchId) return b;
        return {
          ...b,
          status: approved ? 'normal' : 'pending_review',
          updatedAt: now,
          tracks: b.tracks.map((t) => ({
            ...t,
            status: approved ? 'normal' : 'pending_review',
          })),
        };
      }),
      history: [
        {
          id: `h${generateId()}`,
          targetId: batchId,
          targetType: 'batch',
          action: 'review',
          operator: '录音师',
          beforeValue: '待录音师复核',
          afterValue: approved ? '录音师复核通过' : '需进一步确认',
          timestamp: now,
        },
        ...get().history,
      ],
    }));

    addToast('success', approved ? '录音师复核通过' : '已标记需进一步确认');
  },

  supplementFromPhoto: (batchId, trackId, photoRemark) => {
    const { currentOperator, addToast, showHumanError } = get();
    const now = new Date().toLocaleString('zh-CN');
    const batch = get().batches.find(b => b.id === batchId);
    const track = batch?.tracks.find(t => t.id === trackId);
    
    if (!track) return;

    const beforeValue = `状态：${track.status}，口径：${track.standard === 'new' ? '新口径' : '旧口径'}`;

    set((state) => ({
      batches: state.batches.map((b) => {
        if (b.id !== batchId) return b;
        return {
          ...b,
          status: 'supplemented',
          updatedAt: now,
          tracks: b.tracks.map((t) => 
            t.id === trackId 
              ? { ...t, status: 'updated', standard: 'old', remark: photoRemark }
              : t
          ),
        };
      }),
      history: [
        {
          id: `h${generateId()}`,
          targetId: trackId,
          targetType: 'track',
          action: 'supplement',
          operator: currentOperator,
          beforeValue,
          afterValue: `状态：保留，口径：旧口径（从签到照片补录）`,
          timestamp: now,
        },
        ...get().history,
      ],
    }));

    addToast('success', '已从签到照片补录旧口径信息');
    showHumanError('OLD_STANDARD_DETECTED');
  },
}));
