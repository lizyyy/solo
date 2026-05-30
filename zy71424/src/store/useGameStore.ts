import { create } from 'zustand';
import { GameState, GameActions, Channel, GameEvent, ActionLog, EvidenceChain, MonitorLevel } from '@/types';
import { v4 as uuidv4 } from '@/utils/uuid';
import { sampleEvents, sampleActions, sampleEvidenceChains } from '@/data/sampleGame';

const createInitialChannels = (): Channel[] => [
  { id: 1, name: '主唱', type: 'vocal', level: 70, pan: 0, mute: false, solo: false, monitorLevel: 'good' },
  { id: 2, name: '和声', type: 'vocal', level: 55, pan: -20, mute: false, solo: false, monitorLevel: 'good' },
  { id: 3, name: '主音吉他', type: 'guitar', level: 65, pan: 30, mute: false, solo: false, monitorLevel: 'good' },
  { id: 4, name: '节奏吉他', type: 'guitar', level: 50, pan: -30, mute: false, solo: false, monitorLevel: 'good' },
  { id: 5, name: '贝斯', type: 'bass', level: 60, pan: 0, mute: false, solo: false, monitorLevel: 'good' },
  { id: 6, name: '架子鼓', type: 'drum', level: 75, pan: 0, mute: false, solo: false, monitorLevel: 'good' },
  { id: 7, name: '键盘', type: 'keys', level: 55, pan: 15, mute: false, solo: false, monitorLevel: 'good' },
  { id: 8, name: '采样', type: 'other', level: 45, pan: -15, mute: false, solo: false, monitorLevel: 'good' },
];

const initialState: GameState = {
  status: 'idle',
  score: 100,
  timeElapsed: 0,
  totalDuration: 180,
  channels: createInitialChannels(),
  masterLevel: 70,
  events: [],
  actionLogs: [],
  evidenceChains: [],
  selectedEvidenceId: null,
  showReview: false,
  showClueOrganizer: false,
};

export const useGameStore = create<GameState & GameActions>((set, get) => ({
  ...initialState,

  startGame: () => {
    set({ status: 'playing', timeElapsed: 0 });
  },

  pauseGame: () => {
    set({ status: 'paused' });
  },

  resumeGame: () => {
    set({ status: 'playing' });
  },

  restartGame: () => {
    set({
      ...initialState,
      channels: createInitialChannels(),
    });
  },

  endGame: () => {
    set({ status: 'ended', showReview: true });
  },

  setChannelLevel: (channelId: number, level: number) => {
    const state = get();
    const channel = state.channels.find(c => c.id === channelId);
    if (!channel || channel.level === level) return;

    const actionLog: ActionLog = {
      id: uuidv4(),
      type: 'fader_move',
      channelId,
      fromValue: channel.level,
      toValue: level,
      timestamp: state.timeElapsed,
    };

    set(state => ({
      channels: state.channels.map(c =>
        c.id === channelId ? { ...c, level } : c
      ),
      actionLogs: [...state.actionLogs, actionLog],
    }));
  },

  setMasterLevel: (level: number) => {
    const state = get();
    if (state.masterLevel === level) return;

    const actionLog: ActionLog = {
      id: uuidv4(),
      type: 'master_adjust',
      fromValue: state.masterLevel,
      toValue: level,
      timestamp: state.timeElapsed,
    };

    set({
      masterLevel: level,
      actionLogs: [...get().actionLogs, actionLog],
    });
  },

  toggleMute: (channelId: number) => {
    const state = get();
    const channel = state.channels.find(c => c.id === channelId);
    if (!channel) return;

    const actionLog: ActionLog = {
      id: uuidv4(),
      type: 'mute',
      channelId,
      fromValue: channel.mute ? 1 : 0,
      toValue: channel.mute ? 0 : 1,
      timestamp: state.timeElapsed,
    };

    set(state => ({
      channels: state.channels.map(c =>
        c.id === channelId ? { ...c, mute: !c.mute } : c
      ),
      actionLogs: [...state.actionLogs, actionLog],
    }));
  },

  toggleSolo: (channelId: number) => {
    const state = get();
    const channel = state.channels.find(c => c.id === channelId);
    if (!channel) return;

    const actionLog: ActionLog = {
      id: uuidv4(),
      type: 'solo',
      channelId,
      fromValue: channel.solo ? 1 : 0,
      toValue: channel.solo ? 0 : 1,
      timestamp: state.timeElapsed,
    };

    set(state => ({
      channels: state.channels.map(c =>
        c.id === channelId ? { ...c, solo: !c.solo } : c
      ),
      actionLogs: [...state.actionLogs, actionLog],
    }));
  },

  setMonitorLevel: (channelId: number, level: MonitorLevel) => {
    set(state => ({
      channels: state.channels.map(c =>
        c.id === channelId ? { ...c, monitorLevel: level } : c
      ),
    }));
  },

  addEvent: (eventData) => {
    const state = get();
    const newEvent: GameEvent = {
      ...eventData,
      id: uuidv4(),
      timestamp: state.timeElapsed,
      resolved: false,
    };

    const evidenceChain: EvidenceChain = {
      id: uuidv4(),
      eventType: eventData.type,
      startTime: state.timeElapsed,
      actions: [],
      events: [newEvent],
      conclusion: 'partial',
      notes: '',
    };

    newEvent.evidenceId = evidenceChain.id;

    set(state => ({
      events: [...state.events, newEvent],
      evidenceChains: [...state.evidenceChains, evidenceChain],
    }));
  },

  resolveEvent: (eventId: string) => {
    const state = get();
    const event = state.events.find(e => e.id === eventId);
    if (!event || event.resolved) return;

    set(state => ({
      events: state.events.map(e =>
        e.id === eventId
          ? { ...e, resolved: true, resolvedAt: state.timeElapsed }
          : e
      ),
      evidenceChains: state.evidenceChains.map(ec => {
        if (ec.id === event.evidenceId) {
          const responseTime = state.timeElapsed - ec.startTime;
          let bonus = 0;
          if (responseTime < 2) bonus = 10;
          else if (responseTime < 5) bonus = 5;
          
          set(s => ({ score: s.score + bonus }));
          
          return {
            ...ec,
            endTime: state.timeElapsed,
            conclusion: 'resolved' as const,
            events: ec.events.map(e =>
              e.id === eventId
                ? { ...e, resolved: true, resolvedAt: state.timeElapsed }
                : e
            ),
          };
        }
        return ec;
      }),
    }));
  },

  selectEvidence: (id) => {
    set({ selectedEvidenceId: id });
  },

  toggleReview: () => {
    set(state => ({ showReview: !state.showReview }));
  },

  toggleClueOrganizer: () => {
    set(state => ({ showClueOrganizer: !state.showClueOrganizer }));
  },

  resetGame: () => {
    set({
      ...initialState,
      channels: createInitialChannels(),
    });
  },

  setTimeElapsed: (time: number) => {
    set({ timeElapsed: time });
  },

  setScore: (score: number) => {
    set({ score: Math.max(0, Math.min(100, score)) });
  },

  setEvents: (events: GameEvent[]) => {
    set({ events });
  },

  setActionLogs: (actionLogs: ActionLog[]) => {
    set({ actionLogs });
  },

  setEvidenceChains: (evidenceChains: EvidenceChain[]) => {
    set({ evidenceChains });
  },

  loadSampleData: () => {
    set({
      events: sampleEvents,
      actionLogs: sampleActions,
      evidenceChains: sampleEvidenceChains,
      score: 78,
      timeElapsed: 90,
      status: 'ended',
      showReview: false,
    });
  },
}));
