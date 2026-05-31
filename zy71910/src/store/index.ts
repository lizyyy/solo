import { create } from 'zustand';
import { Segment, AudioTrack, UserMessage, ActionType } from '../types';
import { db } from '../db';
import { getFriendlyMessage } from '../utils/messages';

interface HistoryState {
  segments: Segment[];
  description: string;
}

interface AppState {
  currentTrack: AudioTrack | null;
  segments: Segment[];
  messages: UserMessage[];
  isLoading: boolean;
  
  history: HistoryState[];
  historyIndex: number;
  
  setCurrentTrack: (track: AudioTrack | null) => void;
  setSegments: (segments: Segment[]) => void;
  
  addMessage: (message: Omit<UserMessage, 'id'>) => void;
  removeMessage: (id: string) => void;
  showFriendlyMessage: (code: string, type: UserMessage['type'], ...params: string[]) => void;
  
  undo: () => void;
  redo: () => void;
  _pushHistory: (description: string) => void;
  
  updateSegment: (id: string, updates: Partial<Segment>) => Promise<void>;
  confirmSegment: (id: string) => Promise<void>;
  markSegmentPending: (id: string) => Promise<void>;
  discardSegment: (id: string) => Promise<void>;
  addSegment: (segment: Omit<Segment, 'id' | 'version' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  deleteSegment: (id: string) => Promise<void>;
  
  loadTrack: (trackId: string) => Promise<void>;
  setLoading: (loading: boolean) => void;
}

const MAX_HISTORY = 50;

export const useAppStore = create<AppState>((set, get) => ({
  currentTrack: null,
  segments: [],
  messages: [],
  isLoading: false,
  history: [],
  historyIndex: -1,

  setCurrentTrack: (track) => set({ currentTrack: track }),
  setSegments: (segments) => set({ segments }),
  setLoading: (loading) => set({ isLoading: loading }),

  addMessage: (message) => {
    const id = crypto.randomUUID();
    set((state) => ({
      messages: [...state.messages, { ...message, id }]
    }));
    setTimeout(() => {
      get().removeMessage(id);
    }, 5000);
  },

  removeMessage: (id) => {
    set((state) => ({
      messages: state.messages.filter(m => m.id !== id)
    }));
  },

  showFriendlyMessage: (code, type, ...params) => {
    const friendly = getFriendlyMessage(code, ...params);
    get().addMessage({
      type,
      title: friendly.title,
      message: friendly.message + (friendly.suggestion ? `\n💡 ${friendly.suggestion}` : '')
    });
  },

  _pushHistory: (description) => {
    const { segments, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      segments: JSON.parse(JSON.stringify(segments)),
      description
    });
    
    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift();
    }
    
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1
    });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) {
      get().showFriendlyMessage('undo_limit', 'warning');
      return;
    }
    
    const prevState = history[historyIndex - 1];
    set({
      segments: prevState.segments,
      historyIndex: historyIndex - 1
    });
    
    get().addMessage({
      type: 'info',
      title: '已撤回',
      message: `撤销了：${history[historyIndex].description}`
    });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    
    const nextState = history[historyIndex + 1];
    set({
      segments: nextState.segments,
      historyIndex: historyIndex + 1
    });
  },

  updateSegment: async (id, updates) => {
    const segment = get().segments.find(s => s.id === id);
    if (!segment) {
      get().showFriendlyMessage('segment_not_found', 'error');
      return;
    }

    const updated = {
      ...segment,
      ...updates,
      version: segment.version + 1,
      updatedAt: new Date()
    };

    const newSegments = get().segments.map(s => s.id === id ? updated : s);
    set({ segments: newSegments });
    get()._pushHistory(`修改了第 ${get().segments.indexOf(segment) + 1} 段`);
    
    await db.segments.update(id, { ...updates, version: segment.version + 1, updatedAt: new Date() });
    await db.addOperationLog({
      trackId: segment.trackId,
      actionType: 'update_segment',
      beforeState: JSON.stringify(segment),
      afterState: JSON.stringify(updated),
      timestamp: new Date()
    });
  },

  confirmSegment: async (id) => {
    const segment = get().segments.find(s => s.id === id);
    if (!segment) return;

    await get().updateSegment(id, { status: 'confirmed', anomalyType: 'normal', anomalyNote: undefined });
    
    await db.addConfirmRecord({
      segmentId: id,
      trackId: segment.trackId,
      operator: 'current_user',
      action: 'confirm',
      timestamp: new Date()
    });
  },

  markSegmentPending: async (id) => {
    const segment = get().segments.find(s => s.id === id);
    if (!segment) return;

    await get().updateSegment(id, { status: 'pending' });
    
    await db.addConfirmRecord({
      segmentId: id,
      trackId: segment.trackId,
      operator: 'current_user',
      action: 'mark_pending',
      timestamp: new Date()
    });
  },

  discardSegment: async (id) => {
    const segment = get().segments.find(s => s.id === id);
    if (!segment) return;

    await get().updateSegment(id, { status: 'discarded' });
    
    await db.addConfirmRecord({
      segmentId: id,
      trackId: segment.trackId,
      operator: 'current_user',
      action: 'discard',
      timestamp: new Date()
    });
  },

  addSegment: async (segment) => {
    const id = crypto.randomUUID();
    const now = new Date();
    const newSegment: Segment = {
      ...segment,
      id,
      version: 1,
      createdAt: now,
      updatedAt: now
    };

    const newSegments = [...get().segments, newSegment].sort((a, b) => a.startTime - b.startTime);
    set({ segments: newSegments });
    get()._pushHistory('添加了新分段');

    await db.segments.add(newSegment);
    await db.addOperationLog({
      trackId: segment.trackId,
      actionType: 'add_segment',
      afterState: JSON.stringify(newSegment),
      timestamp: now
    });
  },

  deleteSegment: async (id) => {
    const segment = get().segments.find(s => s.id === id);
    if (!segment) return;

    const newSegments = get().segments.filter(s => s.id !== id);
    set({ segments: newSegments });
    get()._pushHistory(`删除了第 ${get().segments.indexOf(segment) + 1} 段`);

    await db.segments.delete(id);
    await db.addOperationLog({
      trackId: segment.trackId,
      actionType: 'delete_segment',
      beforeState: JSON.stringify(segment),
      timestamp: new Date()
    });
  },

  loadTrack: async (trackId) => {
    set({ isLoading: true });
    try {
      const track = await db.audioTracks.get(trackId);
      const segments = await db.getSegmentsByTrack(trackId);
      
      if (track) {
        set({ 
          currentTrack: track, 
          segments,
          history: [{ segments, description: '初始状态' }],
          historyIndex: 0
        });
      }
    } finally {
      set({ isLoading: false });
    }
  }
}));
