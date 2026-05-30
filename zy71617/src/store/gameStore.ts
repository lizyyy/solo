import { create } from 'zustand';
import {
  GameState,
  Difficulty,
  Platform,
  BeatPoint,
  Train,
  DispatchRecord,
  AnomalyEvent,
  JudgeType,
  PLATFORM_CONFIG,
  DIFFICULTY_CONFIG,
  INITIAL_STATISTICS,
} from '@/types/game';

const generateId = () => Math.random().toString(36).substring(2, 11);

const createInitialPlatforms = (): Platform[] =>
  PLATFORM_CONFIG.map((config) => ({
    id: config.id,
    name: config.name,
    passengerCount: Math.floor(Math.random() * 20) + 10,
    maxCapacity: config.maxCapacity,
    congestionLevel: 0,
    overflowCount: 0,
    history: [{ time: 0, count: 0 }],
  }));

const generateBeatPoints = (bpm: number, duration: number): BeatPoint[] => {
  const beatInterval = 60000 / bpm;
  const beats: BeatPoint[] = [];
  for (let time = 1000; time < duration * 1000; time += beatInterval) {
    beats.push({
      id: generateId(),
      time,
      isHit: false,
    });
  }
  return beats;
};

interface GameStore extends GameState {
  startGame: (difficulty: Difficulty) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  endGame: () => void;
  updateTime: (currentTime: number) => void;
  dispatchTrain: (clickTime: number) => void;
  addPassengers: (deltaTime: number) => void;
  updateTrains: (currentTime: number) => void;
  resetGame: () => void;
  savedState: GameState | null;
}

export const useGameStore = create<GameStore>((set, get) => ({
  status: 'idle',
  difficulty: 'normal',
  score: 0,
  energy: 100,
  combo: 0,
  maxCombo: 0,
  currentTime: 0,
  totalTime: 90,
  beatPoints: [],
  trains: [],
  platforms: createInitialPlatforms(),
  dispatchRecords: [],
  anomalies: [],
  statistics: { ...INITIAL_STATISTICS },
  lastDispatchTime: 0,
  savedState: null,

  startGame: (difficulty: Difficulty) => {
    const config = DIFFICULTY_CONFIG[difficulty];
    set({
      status: 'playing',
      difficulty,
      score: 0,
      energy: 100,
      combo: 0,
      maxCombo: 0,
      currentTime: 0,
      totalTime: config.gameDuration,
      beatPoints: generateBeatPoints(config.bpm, config.gameDuration),
      trains: [],
      platforms: createInitialPlatforms(),
      dispatchRecords: [],
      anomalies: [],
      statistics: { ...INITIAL_STATISTICS },
      lastDispatchTime: 0,
      savedState: null,
    });
  },

  pauseGame: () => {
    const state = get();
    if (state.status === 'playing') {
      set({
        status: 'paused',
        savedState: JSON.parse(JSON.stringify(state)),
      });
    }
  },

  resumeGame: () => {
    const state = get();
    if (state.status === 'paused' && state.savedState) {
      set({
        status: 'playing',
      });
    }
  },

  restartGame: () => {
    const state = get();
    get().startGame(state.difficulty);
  },

  endGame: () => {
    set({ status: 'ended' });
  },

  updateTime: (currentTime: number) => {
    const state = get();
    if (state.status !== 'playing') return;

    const totalTime = state.totalTime * 1000;
    if (currentTime >= totalTime) {
      set({ currentTime: totalTime, status: 'ended' });
      return;
    }

    set({ currentTime });

    const config = DIFFICULTY_CONFIG[state.difficulty];
    state.beatPoints.forEach((beat) => {
      if (!beat.isHit && currentTime > beat.time + config.goodWindow + 50) {
        set((prev) => ({
          beatPoints: prev.beatPoints.map((b) =>
            b.id === beat.id ? { ...b, isHit: true, judgeType: 'miss' as JudgeType, offset: undefined } : b
          ),
          statistics: {
            ...prev.statistics,
            miss: prev.statistics.miss + 1,
          },
          combo: 0,
          energy: Math.max(0, prev.energy - 5),
        }));

        set((prev) => ({
          platforms: prev.platforms.map((p) => {
            const newCount = Math.min(p.maxCapacity + 20, p.passengerCount + 5);
            return {
              ...p,
              passengerCount: newCount,
              congestionLevel: Math.min(100, (newCount / p.maxCapacity) * 100),
            };
          }),
        }));
      }
    });
  },

  dispatchTrain: (clickTime: number) => {
    const state = get();
    if (state.status !== 'playing') return;

    const config = DIFFICULTY_CONFIG[state.difficulty];

    const nearestBeat = state.beatPoints
      .filter((b) => !b.isHit)
      .reduce<BeatPoint | null>((nearest, beat) => {
        const diff = Math.abs(clickTime - beat.time);
        if (!nearest) return beat;
        const nearestDiff = Math.abs(clickTime - nearest.time);
        return diff < nearestDiff ? beat : nearest;
      }, null);

    if (!nearestBeat) return;

    const offset = clickTime - nearestBeat.time;
    const absOffset = Math.abs(offset);

    let judgeType: JudgeType = 'miss';
    let scoreGain = 0;
    let energyChange = 0;
    let comboChange = 0;

    if (absOffset <= config.perfectWindow) {
      judgeType = 'perfect';
      scoreGain = 100;
      energyChange = 5;
      comboChange = 1;
    } else if (absOffset <= config.goodWindow) {
      judgeType = offset < 0 ? 'early' : 'late';
      scoreGain = 50;
      energyChange = 2;
      comboChange = 1;
    } else {
      judgeType = 'miss';
      energyChange = -10;
      comboChange = -state.combo;
    }

    const timeSinceLastDispatch = clickTime - state.lastDispatchTime;
    const minSafeInterval = 1500;

    let collisionWarning = false;
    if (timeSinceLastDispatch < minSafeInterval && state.lastDispatchTime > 0) {
      collisionWarning = true;
    }

    const sortedPlatforms = [...state.platforms].sort(
      (a, b) => b.passengerCount - a.passengerCount
    );
    const targetPlatform = sortedPlatforms[0];

    const newTrain: Train = {
      id: generateId(),
      departureTime: clickTime,
      position: 0,
      speed: 1,
      status: 'running',
      platformId: targetPlatform.id,
    };

    const newRecord: DispatchRecord = {
      id: generateId(),
      time: clickTime,
      trainId: newTrain.id,
      platformId: targetPlatform.id,
      judgeType,
      offset,
    };

    set((prev) => {
      const newCombo = Math.max(0, prev.combo + comboChange);
      const newMaxCombo = Math.max(prev.maxCombo, newCombo);
      const comboBonus = Math.floor(newCombo * 10);

      return {
        beatPoints: prev.beatPoints.map((b) =>
          b.id === nearestBeat.id
            ? { ...b, isHit: true, judgeType, offset }
            : b
        ),
        trains: [...prev.trains, newTrain],
        dispatchRecords: [...prev.dispatchRecords, newRecord],
        score: Math.max(0, prev.score + scoreGain + comboBonus),
        energy: Math.min(100, Math.max(0, prev.energy + energyChange)),
        combo: newCombo,
        maxCombo: newMaxCombo,
        statistics: {
          ...prev.statistics,
          [judgeType]: prev.statistics[judgeType as keyof typeof prev.statistics] + 1,
        },
        lastDispatchTime: clickTime,
      };
    });

    if (judgeType !== 'miss') {
      set((prev) => ({
        platforms: prev.platforms.map((p) => {
          if (p.id === targetPlatform.id) {
            const passengersRemoved = Math.min(30, p.passengerCount);
            const newCount = Math.max(0, p.passengerCount - passengersRemoved);
            return {
              ...p,
              passengerCount: newCount,
              congestionLevel: Math.min(100, (newCount / p.maxCapacity) * 100),
              history: [...p.history, { time: clickTime, count: newCount }],
            };
          }
          return {
            ...p,
            history: [...p.history, { time: clickTime, count: p.passengerCount }],
          };
        }),
      }));
    }

    if (collisionWarning) {
      const anomaly: AnomalyEvent = {
        id: generateId(),
        type: 'train_collision',
        time: clickTime,
        severity: 'danger',
        description: `列车间隔过短: ${(timeSinceLastDispatch / 1000).toFixed(2)}秒`,
        data: { interval: timeSinceLastDispatch },
      };
      set((prev) => ({
        anomalies: [...prev.anomalies, anomaly],
        score: Math.max(0, prev.score - 50),
        energy: Math.max(0, prev.energy - 15),
      }));
    }

    if (absOffset > config.perfectWindow && absOffset <= config.goodWindow) {
      const anomaly: AnomalyEvent = {
        id: generateId(),
        type: 'beat_offset',
        time: clickTime,
        severity: 'warning',
        description: `拍点${offset < 0 ? '提前' : '延迟'}: ${Math.abs(offset).toFixed(0)}ms`,
        data: { offset },
      };
      set((prev) => ({
        anomalies: [...prev.anomalies, anomaly],
      }));
    }
  },

  addPassengers: (deltaTime: number) => {
    const state = get();
    if (state.status !== 'playing') return;

    const config = DIFFICULTY_CONFIG[state.difficulty];

    set((prev) => ({
      platforms: prev.platforms.map((p) => {
        const increase = Math.floor(config.passengerRate * (deltaTime / 1000) * 3);
        const newCount = p.passengerCount + increase;
        const overflow = Math.max(0, newCount - p.maxCapacity);

        if (overflow > 0 && p.overflowCount === 0) {
          const anomaly: AnomalyEvent = {
            id: generateId(),
            type: 'passenger_overflow',
            time: state.currentTime,
            severity: 'danger',
            description: `${p.name} 客流溢出`,
            data: { platformId: p.id, overflow },
          };
          set((s) => ({
            anomalies: [...s.anomalies, anomaly],
            energy: Math.max(0, s.energy - 20),
          }));
        }

        return {
          ...p,
          passengerCount: Math.min(p.maxCapacity + 30, newCount),
          congestionLevel: Math.min(100, (newCount / p.maxCapacity) * 100),
          overflowCount: overflow > 0 ? p.overflowCount + 1 : p.overflowCount,
        };
      }),
    }));
  },

  updateTrains: (currentTime: number) => {
    set((prev) => ({
      trains: prev.trains
        .map((train) => {
          const elapsed = currentTime - train.departureTime;
          const position = Math.min(100, (elapsed / 5000) * 100);
          return {
            ...train,
            position,
            status: (position >= 100 ? 'arrived' : 'running') as 'waiting' | 'running' | 'arrived',
          };
        })
        .filter((t) => t.status !== 'arrived' || currentTime - t.departureTime < 10000),
    }));
  },

  resetGame: () => {
    set({
      status: 'idle',
      score: 0,
      energy: 100,
      combo: 0,
      maxCombo: 0,
      currentTime: 0,
      beatPoints: [],
      trains: [],
      platforms: createInitialPlatforms(),
      dispatchRecords: [],
      anomalies: [],
      statistics: { ...INITIAL_STATISTICS },
      lastDispatchTime: 0,
      savedState: null,
    });
  },
}));
