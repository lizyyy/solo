import { create } from 'zustand';
import {
  GamePhase,
  Difficulty,
  Audience,
  GameEvent,
  GameStats,
  ChannelType,
  ScoreBreakdown,
  GameSession
} from '../game/types';
import { generateInitialQueue, generateAudience, getSpawnInterval } from '../game/audienceGenerator';
import { scoringEngine } from '../game/scoringEngine';
import { saveSession } from '../utils/storage';

const generateId = () => Math.random().toString(36).substring(2, 9);

const GAME_DURATION = 180;
const INITIAL_QUEUE_SIZE = 5;

interface GameState {
  phase: GamePhase;
  difficulty: Difficulty;
  currentTime: number;
  remainingTime: number;
  totalDuration: number;
  
  sessionId: string;
  waitingQueue: Audience[];
  normalChannelQueue: Audience[];
  vipChannelQueue: Audience[];
  currentAudience: Audience | null;
  
  isScanning: boolean;
  scanProgress: number;
  scanResult: 'idle' | 'safe' | 'warning' | 'danger';
  
  events: GameEvent[];
  pendingReviewCount: number;
  
  vipWarningIssued: boolean;
  lastSpawnTime: number;
  
  stats: GameStats;
  scores: ScoreBreakdown;
  finalScore: number;
  
  checkModalOpen: boolean;
  checkModalMessage: string;
  checkModalEventId: string | null;
  
  startGame: (difficulty: Difficulty) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: () => void;
  resetGame: () => void;
  
  tick: () => void;
  
  sendToChannel: (audienceId: string, channel: ChannelType) => void;
  startScan: () => void;
  passAudience: () => void;
  blockAudience: (itemName?: string) => void;
  
  addReviewNote: (eventId: string, note: string) => void;
  closeCheckModal: () => void;
  confirmCheck: (note: string) => void;
}

const initialStats: GameStats = {
  totalScanned: 0,
  totalPassed: 0,
  totalBlocked: 0,
  contrabandFound: 0,
  contrabandMissed: 0,
  avgWaitTime: 0,
  vipAvgWaitTime: 0,
  warnings: 0,
  specialHandled: 0
};

const initialScores: ScoreBreakdown = {
  accuracy: 100,
  efficiency: 100,
  vipService: 100,
  emergency: 100
};

const calculateStats = (
  events: GameEvent[],
  normalQueue: Audience[],
  vipQueue: Audience[],
  currentTime: number
): GameStats => {
  const totalScanned = events.filter(e => e.type === 'scan').length;
  const totalPassed = events.filter(e => e.type === 'pass').length;
  const totalBlocked = events.filter(e => e.type === 'block').length;
  const contrabandFound = events.filter(e => e.type === 'block' && e.needReview).length;
  const contrabandMissed = events.filter(e => e.type === 'pass' && e.needReview && e.scoreChange < 0).length;
  const warnings = events.filter(e => e.type === 'warning').length;
  const specialHandled = events.filter(e => e.description.includes('特殊观众') && e.scoreChange > 0).length;

  const passEvents = events.filter(e => e.type === 'pass');
  const avgWaitTime = passEvents.length > 0
    ? passEvents.reduce((sum, e) => {
        const audience = [...normalQueue, ...vipQueue].find(a => a.id === e.audienceId);
        return sum + (audience ? currentTime - audience.queueStartTime : 0);
      }, 0) / passEvents.length
    : 0;

  const vipPassEvents = passEvents.filter(e => e.channel === 'vip');
  const vipAvgWaitTime = vipPassEvents.length > 0
    ? vipPassEvents.reduce((sum) => sum + 20, 0) / vipPassEvents.length
    : 0;

  return {
    totalScanned,
    totalPassed,
    totalBlocked,
    contrabandFound,
    contrabandMissed,
    avgWaitTime,
    vipAvgWaitTime,
    warnings,
    specialHandled
  };
};

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'idle',
  difficulty: 'normal',
  currentTime: 0,
  remainingTime: GAME_DURATION,
  totalDuration: GAME_DURATION,
  
  sessionId: '',
  waitingQueue: [],
  normalChannelQueue: [],
  vipChannelQueue: [],
  currentAudience: null,
  
  isScanning: false,
  scanProgress: 0,
  scanResult: 'idle',
  
  events: [],
  pendingReviewCount: 0,
  
  vipWarningIssued: false,
  lastSpawnTime: 0,
  
  stats: initialStats,
  scores: initialScores,
  finalScore: 0,
  
  checkModalOpen: false,
  checkModalMessage: '',
  checkModalEventId: null,

  startGame: (difficulty: Difficulty) => {
    const initialQueue = generateInitialQueue(INITIAL_QUEUE_SIZE, 0, difficulty);
    const vipAudiences = initialQueue.filter(a => a.isVIP);
    const normalAudiences = initialQueue.filter(a => !a.isVIP);

    set({
      phase: 'playing',
      difficulty,
      currentTime: 0,
      remainingTime: GAME_DURATION,
      totalDuration: GAME_DURATION,
      sessionId: generateId(),
      waitingQueue: [],
      normalChannelQueue: normalAudiences,
      vipChannelQueue: vipAudiences,
      currentAudience: null,
      isScanning: false,
      scanProgress: 0,
      scanResult: 'idle',
      events: [],
      pendingReviewCount: 0,
      vipWarningIssued: false,
      lastSpawnTime: 0,
      stats: initialStats,
      scores: initialScores,
      finalScore: 0,
      checkModalOpen: false
    });
  },

  pauseGame: () => set({ phase: 'paused' }),
  
  resumeGame: () => set({ phase: 'playing' }),

  endGame: () => {
    const { events, stats, sessionId, difficulty, currentTime } = get();
    const scores = scoringEngine.calculateBreakdown(events, stats);
    const finalScore = scoringEngine.calculateFinalScore(scores);

    const session: GameSession = {
      id: sessionId,
      startTime: Date.now() - currentTime * 1000,
      endTime: Date.now(),
      duration: currentTime,
      difficulty,
      totalAudience: stats.totalScanned,
      events,
      scores,
      finalScore
    };
    saveSession(session);

    set({
      phase: 'ended',
      scores,
      finalScore
    });
  },

  resetGame: () => set({
    phase: 'idle',
    currentTime: 0,
    remainingTime: GAME_DURATION,
    events: [],
    waitingQueue: [],
    normalChannelQueue: [],
    vipChannelQueue: [],
    currentAudience: null,
    stats: initialStats,
    scores: initialScores,
    finalScore: 0
  }),

  tick: () => {
    const state = get();
    if (state.phase !== 'playing') return;

    const newTime = state.currentTime + 1;
    const newRemaining = state.remainingTime - 1;

    if (newRemaining <= 0) {
      get().endGame();
      return;
    }

    let newNormalQueue = [...state.normalChannelQueue];
    let newVipQueue = [...state.vipChannelQueue];
    let newEvents = [...state.events];
    let newPendingReview = state.pendingReviewCount;
    let newVipWarning = state.vipWarningIssued;

    const spawnInterval = getSpawnInterval(newTime, state.totalDuration, state.difficulty);
    if (newTime - state.lastSpawnTime >= spawnInterval) {
      const newAudience = generateAudience(newTime, state.difficulty);
      if (newAudience.isVIP) {
        newVipQueue.push(newAudience);
      } else {
        newNormalQueue.push(newAudience);
      }
    }

    if (newVipQueue.length > 5 && !newVipWarning) {
      const warningEvent: GameEvent = {
        id: generateId(),
        timestamp: newTime,
        type: 'warning',
        channel: 'vip',
        scoreChange: -3,
        description: '⚠️ VIP通道拥堵！排队超过5人，请调度',
        needReview: true,
        reviewed: false,
        reviewNote: ''
      };
      newEvents.push(warningEvent);
      newPendingReview++;
      newVipWarning = true;
    } else if (newVipQueue.length <= 3) {
      newVipWarning = false;
    }

    if (newRemaining <= 30 && newNormalQueue.length + newVipQueue.length > 10) {
      if (newTime % 10 === 0) {
        const backlogEvent: GameEvent = {
          id: generateId(),
          timestamp: newTime,
          type: 'warning',
          channel: 'normal',
          scoreChange: -1,
          description: '🚨 开演前积压严重！请加快安检速度',
          needReview: true,
          reviewed: false,
          reviewNote: ''
        };
        newEvents.push(backlogEvent);
        newPendingReview++;
      }
    }

    if (!state.currentAudience && !state.isScanning) {
      const vipChannel = newVipQueue;
      const targetQueue = vipChannel.length > 0 ? vipChannel : newNormalQueue;
      
      if (targetQueue.length > 0) {
        const nextAudience = targetQueue.shift()!;
        set({
          currentAudience: nextAudience,
          normalChannelQueue: newNormalQueue,
          vipChannelQueue: newVipQueue,
          currentTime: newTime,
          remainingTime: newRemaining,
          events: newEvents,
          pendingReviewCount: newPendingReview,
          vipWarningIssued: newVipWarning,
          lastSpawnTime: newTime - state.lastSpawnTime >= spawnInterval ? newTime : state.lastSpawnTime
        });
        return;
      }
    }

    const newStats = calculateStats(newEvents, newNormalQueue, newVipQueue, newTime);
    const newScores = scoringEngine.calculateBreakdown(newEvents, newStats);

    set({
      currentTime: newTime,
      remainingTime: newRemaining,
      normalChannelQueue: newNormalQueue,
      vipChannelQueue: newVipQueue,
      events: newEvents,
      pendingReviewCount: newPendingReview,
      vipWarningIssued: newVipWarning,
      lastSpawnTime: newTime - state.lastSpawnTime >= spawnInterval ? newTime : state.lastSpawnTime,
      stats: newStats,
      scores: newScores
    });
  },

  sendToChannel: (audienceId: string, channel: ChannelType) => {
    set(state => {
      const fromQueue = channel === 'vip' ? state.normalChannelQueue : state.vipChannelQueue;
      const toQueue = channel === 'vip' ? state.vipChannelQueue : state.normalChannelQueue;
      
      const audienceIndex = fromQueue.findIndex(a => a.id === audienceId);
      if (audienceIndex === -1) return state;

      const audience = fromQueue[audienceIndex];
      const newFromQueue = fromQueue.filter((_, i) => i !== audienceIndex);
      audience.channel = channel;
      
      const dispatchEvent: GameEvent = {
        id: generateId(),
        timestamp: state.currentTime,
        type: 'dispatch',
        audienceId: audience.id,
        audienceName: audience.name,
        channel,
        scoreChange: 0,
        description: `调度 ${audience.name} 到${channel === 'vip' ? 'VIP' : '普通'}通道`,
        needReview: false,
        reviewed: false,
        reviewNote: ''
      };

      return {
        normalChannelQueue: channel === 'vip' ? newFromQueue : [...toQueue, audience],
        vipChannelQueue: channel === 'vip' ? [...toQueue, audience] : newFromQueue,
        events: [...state.events, dispatchEvent],
        vipWarningIssued: false
      };
    });
  },

  startScan: () => {
    const { currentAudience } = get();
    if (!currentAudience) return;

    set({ isScanning: true, scanProgress: 0, scanResult: 'idle' });

    const hasHighRisk = currentAudience.items.some(i => i.riskLevel === 'high');
    const hasMediumRisk = currentAudience.items.some(i => i.riskLevel === 'medium');

    let progress = 0;
    const scanInterval = setInterval(() => {
      progress += 20;
      set({ scanProgress: progress });

      if (progress >= 100) {
        clearInterval(scanInterval);
        const result = hasHighRisk ? 'danger' : hasMediumRisk ? 'warning' : 'safe';
        
        const scanEvent: GameEvent = {
          id: generateId(),
          timestamp: get().currentTime,
          type: 'scan',
          audienceId: currentAudience.id,
          audienceName: currentAudience.name,
          channel: currentAudience.channel,
          scoreChange: 0,
          description: `扫描 ${currentAudience.name} - ${result === 'safe' ? '无异常' : '发现可疑物品'}`,
          needReview: result !== 'safe',
          reviewed: false,
          reviewNote: ''
        };

        set(state => ({
          isScanning: false,
          scanResult: result,
          events: [...state.events, scanEvent],
          stats: {
            ...state.stats,
            totalScanned: state.stats.totalScanned + 1
          }
        }));
      }
    }, 200);
  },

  passAudience: () => {
    const state = get();
    const { currentAudience, currentTime } = state;
    if (!currentAudience) return;

    const hasContraband = currentAudience.items.some(i => i.isContraband);
    const highRiskItems = currentAudience.items.filter(i => i.riskLevel === 'high' && i.isContraband);
    
    let scoreChange = 0;
    let needReview = false;
    let description = `✅ ${currentAudience.name} 正常通过`;

    if (hasContraband) {
      if (highRiskItems.length > 0) {
        scoreChange = -5 * highRiskItems.length;
        needReview = true;
        description = `❌ 漏检！${currentAudience.name} 携带 ${highRiskItems.map(i => i.name).join('、')} 通过`;
      } else {
        scoreChange = -2;
        needReview = true;
        description = `⚠️ ${currentAudience.name} 携带限带物品通过`;
      }
    }

    if (currentAudience.isSpecial) {
      scoreChange += 3;
      description += ` (特殊观众优待处理 +3分)`;
    }

    const passEvent: GameEvent = {
      id: generateId(),
      timestamp: currentTime,
      type: 'pass',
      audienceId: currentAudience.id,
      audienceName: currentAudience.name,
      channel: currentAudience.channel,
      scoreChange,
      description,
      needReview,
      reviewed: false,
      reviewNote: ''
    };

    set(prev => ({
      currentAudience: null,
      scanResult: 'idle',
      events: [...prev.events, passEvent],
      pendingReviewCount: needReview ? prev.pendingReviewCount + 1 : prev.pendingReviewCount,
      stats: {
        ...prev.stats,
        totalPassed: prev.stats.totalPassed + 1,
        contrabandMissed: hasContraband ? prev.stats.contrabandMissed + 1 : prev.stats.contrabandMissed,
        specialHandled: currentAudience.isSpecial ? prev.stats.specialHandled + 1 : prev.stats.specialHandled
      }
    }));
  },

  blockAudience: (itemName?: string) => {
    const state = get();
    const { currentAudience, currentTime } = state;
    if (!currentAudience) return;

    const hasContraband = currentAudience.items.some(i => i.isContraband);
    const blockedItem = currentAudience.items.find(i => i.isContraband);
    
    let scoreChange = 0;
    let needReview = false;
    let description = '';

    if (hasContraband && blockedItem) {
      scoreChange = blockedItem.riskLevel === 'high' ? 5 : 2;
      needReview = true;
      description = `⛔ 正确拦截 ${currentAudience.name} 携带的 ${blockedItem.name} (+${scoreChange}分)`;
    } else {
      scoreChange = -2;
      needReview = true;
      description = `❌ 误拦！${currentAudience.name} 未携带违禁物品 (-2分)`;
    }

    const blockEvent: GameEvent = {
      id: generateId(),
      timestamp: currentTime,
      type: 'block',
      audienceId: currentAudience.id,
      audienceName: currentAudience.name,
      itemId: blockedItem?.id,
      itemName: blockedItem?.name || itemName,
      channel: currentAudience.channel,
      scoreChange,
      description,
      needReview,
      reviewed: false,
      reviewNote: ''
    };

    set(prev => ({
      currentAudience: null,
      scanResult: 'idle',
      events: [...prev.events, blockEvent],
      pendingReviewCount: prev.pendingReviewCount + 1,
      stats: {
        ...prev.stats,
        totalBlocked: prev.stats.totalBlocked + 1,
        contrabandFound: hasContraband ? prev.stats.contrabandFound + 1 : prev.stats.contrabandFound
      }
    }));
  },

  addReviewNote: (eventId: string, note: string) => {
    set(state => ({
      events: state.events.map(e =>
        e.id === eventId ? { ...e, reviewNote: note, reviewed: true } : e
      ),
      pendingReviewCount: state.pendingReviewCount - 1
    }));
  },

  closeCheckModal: () => set({ checkModalOpen: false, checkModalEventId: null }),

  confirmCheck: (note: string) => {
    const { checkModalEventId } = get();
    if (checkModalEventId) {
      get().addReviewNote(checkModalEventId, note);
    }
    set({ checkModalOpen: false, checkModalEventId: null });
  }
}));
