import { create } from 'zustand';
import {
  GamePhase,
  Stall,
  GameEvent,
  HistoryFrame,
  ScoreBreakdown,
  FailureReason,
  LevelConfig,
  GameReport,
} from '@/types/game';
import {
  createStallsFromConfig,
  calculateTotalElectricity,
  calculateTotalSmoke,
  calculateRoundMoney,
  shouldTriggerComplaint,
} from '@/utils/simulation';
import { getLevelById } from '@/utils/levels';
import { triggerRandomEvent, applyEventEffects, createInfoEvent, createWarningEvent, createPenaltyEvent } from '@/utils/events';
import { calculateTotalScore, ScoringContext } from '@/utils/scoring';
import { generateReport } from '@/utils/report';

interface GameStore {
  phase: GamePhase;
  level: LevelConfig | null;
  round: number;
  maxRounds: number;
  roundDuration: number;
  timeRemaining: number;
  totalElectricity: number;
  maxElectricity: number;
  idealElectricity: number;
  totalSmoke: number;
  maxSmoke: number;
  complaints: number;
  maxComplaints: number;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  money: number;
  targetMoney: number;
  stalls: Stall[];
  events: GameEvent[];
  history: HistoryFrame[];
  failureReason: FailureReason | null;
  report: GameReport | null;

  consecutiveOverCapacity: number;
  consecutiveHighSmoke: number;
  errorCount: number;
  timeoutCount: number;
  wasteCount: number;

  extraElectricityLoad: number;
  bonusMultiplier: number;

  startGame: (levelId: number) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  goToMenu: () => void;

  toggleStall: (stallId: string) => void;
  setStallPower: (stallId: string, power: number) => void;
  setStallExhaust: (stallId: string, level: number) => void;

  tick: (deltaTime: number) => void;
  endRound: () => void;

  recordHistory: (action: string) => void;
  showSettlement: () => void;
  showReplay: () => void;

  setPhase: (phase: GamePhase) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  phase: 'menu',
  level: null,
  round: 0,
  maxRounds: 0,
  roundDuration: 0,
  timeRemaining: 0,
  totalElectricity: 0,
  maxElectricity: 0,
  idealElectricity: 0,
  totalSmoke: 0,
  maxSmoke: 0,
  complaints: 0,
  maxComplaints: 0,
  score: 0,
  scoreBreakdown: { efficiency: 0, compliance: 0, profit: 0, penalty: 0, total: 0 },
  money: 0,
  targetMoney: 0,
  stalls: [],
  events: [],
  history: [],
  failureReason: null,
  report: null,

  consecutiveOverCapacity: 0,
  consecutiveHighSmoke: 0,
  errorCount: 0,
  timeoutCount: 0,
  wasteCount: 0,

  extraElectricityLoad: 0,
  bonusMultiplier: 1,

  startGame: (levelId: number) => {
    const level = getLevelById(levelId);
    if (!level) return;

    const stalls = createStallsFromConfig(level);
    const initialElectricity = calculateTotalElectricity(stalls);
    const initialSmoke = calculateTotalSmoke(stalls);

    set({
      phase: 'playing',
      level,
      round: 1,
      maxRounds: level.maxRounds,
      roundDuration: level.roundDuration,
      timeRemaining: level.roundDuration,
      totalElectricity: initialElectricity,
      maxElectricity: level.maxElectricity,
      idealElectricity: level.idealElectricity,
      totalSmoke: initialSmoke,
      maxSmoke: level.maxSmoke,
      complaints: 0,
      maxComplaints: level.maxComplaints,
      score: 0,
      scoreBreakdown: { efficiency: 0, compliance: 0, profit: 0, penalty: 0, total: 0 },
      money: 0,
      targetMoney: level.targetMoney,
      stalls,
      events: [createInfoEvent(`🎪 ${level.name} 开始！合理经营你的摊位吧`, 1)],
      history: [],
      failureReason: null,
      report: null,
      consecutiveOverCapacity: 0,
      consecutiveHighSmoke: 0,
      errorCount: 0,
      timeoutCount: 0,
      wasteCount: 0,
      extraElectricityLoad: 0,
      bonusMultiplier: 1,
    });
  },

  pauseGame: () => {
    const { phase } = get();
    if (phase === 'playing') {
      set({ phase: 'paused' });
    }
  },

  resumeGame: () => {
    const { phase } = get();
    if (phase === 'paused') {
      set({ phase: 'playing' });
    }
  },

  restartGame: () => {
    const { level } = get();
    if (level) {
      get().startGame(level.id);
    }
  },

  goToMenu: () => {
    set({
      phase: 'menu',
      level: null,
      stalls: [],
      events: [],
      history: [],
      failureReason: null,
      report: null,
    });
  },

  toggleStall: (stallId: string) => {
    const { stalls, phase, round } = get();
    if (phase !== 'playing' && phase !== 'paused') return;

    const stall = stalls.find((s) => s.id === stallId);
    if (!stall) return;

    const newStalls = stalls.map((s) =>
      s.id === stallId ? { ...s, isOn: !s.isOn } : s
    );

    const newElectricity = calculateTotalElectricity(newStalls);
    const newSmoke = calculateTotalSmoke(newStalls);

    set({
      stalls: newStalls,
      totalElectricity: newElectricity,
      totalSmoke: newSmoke,
    });

    get().recordHistory(`${stall.isOn ? '关闭' : '开启'} ${stall.name}`);
  },

  setStallPower: (stallId: string, power: number) => {
    const { stalls, phase, maxElectricity, errorCount } = get();
    if (phase !== 'playing' && phase !== 'paused') return;

    const clampedPower = Math.max(0, Math.min(100, power));
    const stall = stalls.find((s) => s.id === stallId);
    if (!stall) return;

    const newStalls = stalls.map((s) =>
      s.id === stallId ? { ...s, power: clampedPower } : s
    );

    const newElectricity = calculateTotalElectricity(newStalls);
    const newSmoke = calculateTotalSmoke(newStalls);

    let newErrorCount = errorCount;
    const newEvents = [...get().events];

    if (newElectricity > maxElectricity) {
      newErrorCount++;
      newEvents.unshift(
        createPenaltyEvent(`⚠️ ${stall.name} 功率调节导致用电超限！`, get().round)
      );
    }

    set({
      stalls: newStalls,
      totalElectricity: newElectricity,
      totalSmoke: newSmoke,
      errorCount: newErrorCount,
      events: newEvents.slice(0, 50),
    });

    get().recordHistory(`调节 ${stall.name} 功率至 ${clampedPower}%`);
  },

  setStallExhaust: (stallId: string, level: number) => {
    const { stalls, phase } = get();
    if (phase !== 'playing' && phase !== 'paused') return;

    const clampedLevel = Math.max(0, Math.min(3, level));
    const stall = stalls.find((s) => s.id === stallId);
    if (!stall) return;

    const newStalls = stalls.map((s) =>
      s.id === stallId ? { ...s, exhaustLevel: clampedLevel } : s
    );

    const newSmoke = calculateTotalSmoke(newStalls);

    set({
      stalls: newStalls,
      totalSmoke: newSmoke,
    });

    get().recordHistory(`调节 ${stall.name} 排烟档位至 ${clampedLevel}`);
  },

  tick: (deltaTime: number) => {
    const { phase, timeRemaining, round } = get();
    if (phase !== 'playing') return;

    const newTime = timeRemaining - deltaTime;

    if (newTime <= 0) {
      get().endRound();
    } else {
      set({ timeRemaining: newTime });
    }
  },

  endRound: () => {
    const state = get();
    const {
      round,
      maxRounds,
      stalls,
      totalElectricity,
      maxElectricity,
      totalSmoke,
      maxSmoke,
      complaints,
      maxComplaints,
      level,
      consecutiveOverCapacity,
      consecutiveHighSmoke,
      timeoutCount,
      events,
    } = state;

    if (!level) return;

    const newEvents = [...events];
    let newComplaints = complaints;
    let newConsecutiveOver = consecutiveOverCapacity;
    let newConsecutiveSmoke = consecutiveHighSmoke;
    let newTimeoutCount = timeoutCount;
    let failureReason: FailureReason | null = null;

    if (totalElectricity > maxElectricity) {
      newConsecutiveOver++;
      newEvents.unshift(
        createWarningEvent(`⚡ 用电超限！已连续 ${newConsecutiveOver} 回合`, round)
      );
      if (newConsecutiveOver >= 3) {
        failureReason = {
          type: 'tripping',
          message: '用电跳闸！',
          detail: `连续 ${newConsecutiveOver} 回合用电超过容量限制，电路跳闸，经营失败。请合理分配各摊位功率。`,
        };
      }
    } else {
      newConsecutiveOver = 0;
    }

    const smokeRatio = totalSmoke / maxSmoke;
    if (smokeRatio >= 0.8) {
      newConsecutiveSmoke++;
      if (shouldTriggerComplaint(totalSmoke, maxSmoke, newConsecutiveSmoke)) {
        newComplaints += 2;
        newEvents.unshift(
          createPenaltyEvent(`😤 油烟严重超标！邻摊投诉 +2`, round)
        );
      } else if (smokeRatio >= 1) {
        newComplaints += 1;
        newEvents.unshift(
          createWarningEvent(`⚠️ 油烟超标！邻摊投诉 +1`, round)
        );
      }
    } else {
      newConsecutiveSmoke = 0;
    }

    if (newComplaints >= maxComplaints) {
      failureReason = {
        type: 'complaints',
        message: '投诉过多！',
        detail: `累积投诉已达 ${newComplaints} 次，超过最大容忍值 ${maxComplaints}。请注意控制油烟排放，及时开启排烟设备。`,
      };
    }

    const randomEvent = triggerRandomEvent(level.randomEvents, round);
    if (randomEvent) {
      newEvents.unshift(randomEvent);
      const effects = applyEventEffects(randomEvent, level.randomEvents);
      if (effects.complaintDelta > 0) {
        newComplaints += effects.complaintDelta;
        if (newComplaints >= maxComplaints && !failureReason) {
          failureReason = {
            type: 'complaints',
            message: '投诉过多！',
            detail: `累积投诉已达 ${newComplaints} 次，超过最大容忍值 ${maxComplaints}。`,
          };
        }
      }
    }

    const roundMoney = calculateRoundMoney(stalls, 50, state.bonusMultiplier);
    const newMoney = state.money + roundMoney;

    newEvents.unshift(
      createInfoEvent(`💰 第 ${round} 回合收益：+${roundMoney} 元`, round)
    );

    if (state.timeRemaining <= 0) {
      newTimeoutCount++;
    }

    get().recordHistory(`回合 ${round} 结束`);

    if (failureReason || round >= maxRounds) {
      const scoringCtx: ScoringContext = {
        stalls,
        maxElectricity,
        idealElectricity: state.idealElectricity,
        maxSmoke,
        complaints: newComplaints,
        maxComplaints,
        money: newMoney,
        targetMoney: state.targetMoney,
        totalRounds: maxRounds,
        completedRounds: round,
        events: newEvents,
        errorCount: state.errorCount,
        timeoutCount: newTimeoutCount,
        wasteCount: state.wasteCount,
      };

      const scoreBreakdown = calculateTotalScore(scoringCtx);
      const report = generateReport({
        levelId: level.id,
        levelName: level.name,
        totalRounds: round,
        scoreBreakdown,
        events: newEvents,
        stalls,
        history: state.history,
        failureReason,
      });

      set({
        phase: 'settlement',
        round,
        complaints: newComplaints,
        money: newMoney,
        score: scoreBreakdown.total,
        scoreBreakdown,
        events: newEvents.slice(0, 50),
        history: [...state.history],
        failureReason,
        report,
      });
    } else {
      set({
        round: round + 1,
        timeRemaining: state.roundDuration,
        complaints: newComplaints,
        money: newMoney,
        consecutiveOverCapacity: newConsecutiveOver,
        consecutiveHighSmoke: newConsecutiveSmoke,
        timeoutCount: newTimeoutCount,
        events: newEvents.slice(0, 50),
      });
    }
  },

  recordHistory: (action: string) => {
    const { round, history, stalls, totalElectricity, totalSmoke, complaints, score, money } = get();
    const frame: HistoryFrame = {
      round,
      timestamp: Date.now(),
      snapshot: {
        totalElectricity,
        totalSmoke,
        complaints,
        score,
        money,
        stalls: stalls.map((s) => ({
          id: s.id,
          power: s.power,
          isOn: s.isOn,
          exhaustLevel: s.exhaustLevel,
        })),
      },
      action,
    };

    set({ history: [...history, frame].slice(-200) });
  },

  showSettlement: () => {
    set({ phase: 'settlement' });
  },

  showReplay: () => {
    set({ phase: 'replay' });
  },

  setPhase: (phase: GamePhase) => {
    set({ phase });
  },
}));