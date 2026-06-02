import { create } from 'zustand';
import type {
  Game,
  Farm,
  Round,
  Transaction,
  FarmState,
  PauseRecord,
  SupplementRecord,
  GameSnapshot,
  TransactionType,
} from '../types';
import {
  sampleFarms,
  initialGame,
  sampleRounds,
  sampleFarmStates,
  sampleTransactions,
  samplePauseRecords,
  sampleSupplementRecords,
} from '../data/sampleData';
import {
  createSnapshot,
  saveGameSnapshot,
  loadGameSnapshot,
  rollbackToSnapshot,
  getLatestFarmState,
} from '../utils/snapshot';
import { checkPriceFluctuation, validateGameData } from '../utils/validate';
import { loadAllSnapshots } from '../utils/storage';

interface GameStoreState {
  loading: boolean;
  error: string | null;
  warnings: string[];
  game: Game | null;
  farms: Farm[];
  rounds: Round[];
  currentRoundState: Round | null;
  farmStates: FarmState[];
  transactions: Transaction[];
  pauseRecords: PauseRecord[];
  supplementRecords: SupplementRecord[];
  lastSettlementReason: string;
  isReplaying: boolean;
  replayRound: number | null;
  replaySpeed: number;
  pendingTransactions: Transaction[];
  preReplayState: {
    game: Game | null;
    rounds: Round[];
    currentRoundState: Round | null;
    farmStates: FarmState[];
    transactions: Transaction[];
    pauseRecords: PauseRecord[];
    supplementRecords: SupplementRecord[];
    lastSettlementReason: string;
    pendingTransactions: Transaction[];
  } | null;
  originalMaxRound: number | null;
  initGame: () => void;
  startGame: () => void;
  pauseGame: (reason: string) => void;
  resumeGame: () => void;
  restartFromRound: (round: number, reason: string) => void;
  settleRound: (reason: string) => void;
  nextRound: () => void;
  endGame: () => void;
  submitTransaction: (
    farmId: string,
    type: TransactionType,
    amount: number,
    price: number
  ) => { success: boolean; message: string };
  confirmTransaction: (txId: string) => void;
  rejectTransaction: (txId: string) => void;
  supplementData: (
    roundNumber: number,
    farmId: string,
    fieldName: string,
    oldValue: string,
    newValue: string,
    difference: string,
    remark: string
  ) => void;
  getSnapshotAtRound: (round: number) => GameSnapshot | null;
  startReplay: (fromRound?: number) => void;
  stopReplay: () => void;
  stepReplay: (direction: 'prev' | 'next') => void;
  setReplaySpeed: (speed: number) => void;
  loadSampleData: () => void;
  loadDefaultData: () => void;
  resetGame: () => void;
  getFarmRanking: () => { farm: Farm; state: FarmState | undefined; rank: number }[];
  getTotalCarbonQuota: () => number;
  getCurrentCarbonPrice: () => number;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  loading: false,
  error: null,
  warnings: [],
  game: null,
  farms: [],
  rounds: [],
  currentRoundState: null,
  farmStates: [],
  transactions: [],
  pauseRecords: [],
  supplementRecords: [],
  lastSettlementReason: '',
  isReplaying: false,
  replayRound: null,
  replaySpeed: 1,
  pendingTransactions: [],
  preReplayState: null,
  originalMaxRound: null,

  initGame: () => {
    set({ loading: true, error: null });
    try {
      const validation = validateGameData({
        farms: sampleFarms,
        rounds: sampleRounds,
        transactions: sampleTransactions,
        farmStates: sampleFarmStates,
      });

      if (!validation.valid) {
        throw new Error(`数据校验失败: ${validation.errors.join(', ')}`);
      }

      set({
        loading: false,
        game: { ...initialGame },
        farms: sampleFarms,
        rounds: [],
        currentRoundState: null,
        farmStates: [],
        transactions: [],
        pauseRecords: [],
        supplementRecords: [],
        warnings: validation.warnings,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : '初始化游戏失败',
      });
    }
  },

  loadSampleData: () => {
    set({ loading: true, error: null });
    try {
      const validation = validateGameData({
        farms: sampleFarms,
        rounds: sampleRounds,
        transactions: sampleTransactions,
        farmStates: sampleFarmStates,
      });

      if (!validation.valid) {
        throw new Error(`样例数据校验失败: ${validation.errors.join(', ')}`);
      }

      const existingSnapshots = loadAllSnapshots();
      if (existingSnapshots.length === 0) {
        sampleRounds.forEach((round) => {
          const snapshot = createSnapshot(
            {
              ...initialGame,
              currentRound: round.roundNumber,
              status: round.roundNumber === 7 ? 'paused' : 'running',
            },
            round,
            sampleFarmStates.filter((fs) => fs.roundNumber <= round.roundNumber),
            sampleTransactions.filter((tx) => tx.roundNumber <= round.roundNumber),
            samplePauseRecords,
            sampleSupplementRecords
          );
          saveGameSnapshot(snapshot);
        });
      }

      set({
        loading: false,
        game: {
          ...initialGame,
          currentRound: 7,
          status: 'paused',
          createdAt: new Date(Date.now() - 7200000).toISOString(),
        },
        farms: sampleFarms,
        rounds: sampleRounds,
        currentRoundState: sampleRounds.find((r) => r.roundNumber === 7) || null,
        farmStates: sampleFarmStates,
        transactions: sampleTransactions,
        pauseRecords: samplePauseRecords,
        supplementRecords: sampleSupplementRecords,
        lastSettlementReason: '正常回合结算',
        warnings: validation.warnings,
        pendingTransactions: sampleTransactions.filter((tx) => tx.status === 'pending'),
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : '加载样例数据失败',
      });
    }
  },

  loadDefaultData: () => {
    get().initGame();
  },

  startGame: () => {
    const { game } = get();
    if (!game) return;

    const firstRound: Round = {
      roundNumber: 1,
      carbonPrice: 45,
      startTime: new Date().toISOString(),
      settlementReason: '回合开始',
      isSupplemented: false,
      priceFluctuation: 0,
    };

    const initialFarmStates: FarmState[] = get().farms.map((farm) => ({
      farmId: farm.id,
      roundNumber: 1,
      carbonQuota: farm.initialQuota,
      landArea: 50,
      cropType: '水稻',
      revenue: 0,
    }));

    const snapshot = createSnapshot(
      { ...game, currentRound: 1, status: 'running' },
      firstRound,
      initialFarmStates,
      [],
      [],
      []
    );
    saveGameSnapshot(snapshot);

    set({
      game: { ...game, currentRound: 1, status: 'running' },
      rounds: [firstRound],
      currentRoundState: firstRound,
      farmStates: initialFarmStates,
    });
  },

  pauseGame: (reason: string) => {
    const { game, currentRoundState } = get();
    if (!game || !currentRoundState) return;

    const pauseRecord: PauseRecord = {
      id: generateId(),
      roundNumber: game.currentRound,
      pauseTime: new Date().toISOString(),
      reason,
    };

    set({
      game: { ...game, status: 'paused' },
      pauseRecords: [...get().pauseRecords, pauseRecord],
    });
  },

  resumeGame: () => {
    const { game, pauseRecords } = get();
    if (!game) return;

    const updatedPauseRecords = pauseRecords.map((pr) =>
      pr.roundNumber === game.currentRound && !pr.resumeTime
        ? { ...pr, resumeTime: new Date().toISOString() }
        : pr
    );

    set({
      game: { ...game, status: 'running' },
      pauseRecords: updatedPauseRecords,
    });
  },

  restartFromRound: (round: number, reason: string) => {
    const snapshot = loadGameSnapshot(round);
    if (!snapshot) {
      set({ error: `未找到第${round}回合的快照，无法重开` });
      return;
    }

    const rolledBack = rollbackToSnapshot(snapshot);

    const newSnapshot = createSnapshot(
      {
        ...rolledBack.game,
        status: 'running',
        restartFromRound: round,
        restartReason: reason,
      },
      {
        ...rolledBack.currentRoundState!,
        settlementReason: `从第${round}回合返工: ${reason}`,
      },
      rolledBack.farmStates,
      rolledBack.transactions,
      rolledBack.pauseRecords,
      rolledBack.supplementRecords
    );
    saveGameSnapshot(newSnapshot);

    set({
      ...rolledBack,
      game: {
        ...rolledBack.game,
        status: 'running',
        restartFromRound: round,
        restartReason: reason,
      },
      currentRoundState: {
        ...rolledBack.currentRoundState!,
        settlementReason: `从第${round}回合返工: ${reason}`,
      },
      lastSettlementReason: `从第${round}回合返工: ${reason}`,
    });
  },

  settleRound: (reason: string) => {
    const { game, currentRoundState, farmStates, transactions } = get();
    if (!game || !currentRoundState) return;

    const confirmedTransactions = transactions.filter(
      (tx) => tx.roundNumber === game.currentRound && tx.status === 'confirmed'
    );

    const updatedFarmStates = farmStates.map((fs) => {
      if (fs.roundNumber !== game.currentRound) return fs;

      const farmTransactions = confirmedTransactions.filter((tx) => tx.farmId === fs.farmId);
      let quotaChange = 0;
      let revenueChange = 0;

      farmTransactions.forEach((tx) => {
        if (tx.type === 'buy') {
          quotaChange += tx.amount;
          revenueChange -= tx.amount * tx.price;
        } else {
          quotaChange -= tx.amount;
          revenueChange += tx.amount * tx.price;
        }
      });

      const newQuota = fs.carbonQuota + quotaChange;
      const newRevenue = fs.revenue + revenueChange;

      return {
        ...fs,
        carbonQuota: newQuota,
        revenue: newRevenue,
        warning:
          newQuota < 0
            ? '警告：该农场碳配额不足，需在下回合补足'
            : undefined,
      };
    });

    const settledRound: Round = {
      ...currentRoundState,
      endTime: new Date().toISOString(),
      settlementReason: reason,
    };

    const snapshot = createSnapshot(
      { ...game },
      settledRound,
      updatedFarmStates,
      transactions,
      get().pauseRecords,
      get().supplementRecords
    );
    saveGameSnapshot(snapshot);

    set({
      currentRoundState: settledRound,
      rounds: get().rounds.map((r) =>
        r.roundNumber === game.currentRound ? settledRound : r
      ),
      farmStates: updatedFarmStates,
      lastSettlementReason: reason,
    });
  },

  nextRound: () => {
    const { game, currentRoundState, farmStates, rounds } = get();
    if (!game || !currentRoundState) return;

    const nextRoundNum = game.currentRound + 1;
    if (nextRoundNum > game.totalRounds) {
      get().endGame();
      return;
    }

    const previousPrice = currentRoundState.carbonPrice;
    const priceChange = (Math.random() - 0.5) * 10;
    const newPrice = Math.max(30, Math.min(80, previousPrice + priceChange));

    const priceCheck = checkPriceFluctuation(newPrice, previousPrice);

    const newRound: Round = {
      roundNumber: nextRoundNum,
      carbonPrice: newPrice,
      startTime: new Date().toISOString(),
      settlementReason: priceCheck.needsReview
        ? `价格波动较大，需老师确认: ${priceCheck.reason}`
        : '回合开始',
      isSupplemented: false,
      priceFluctuation: priceCheck.fluctuation,
    };

    const latestFarmStates = farmStates
      .filter((fs) => fs.roundNumber === game.currentRound)
      .map((fs) => ({
        ...fs,
        roundNumber: nextRoundNum,
        warning: undefined,
      }));

    const snapshot = createSnapshot(
      { ...game, currentRound: nextRoundNum },
      newRound,
      [...farmStates, ...latestFarmStates],
      get().transactions,
      get().pauseRecords,
      get().supplementRecords
    );
    saveGameSnapshot(snapshot);

    set({
      game: { ...game, currentRound: nextRoundNum },
      rounds: [...rounds, newRound],
      currentRoundState: newRound,
      farmStates: [...farmStates, ...latestFarmStates],
    });
  },

  endGame: () => {
    const { game } = get();
    if (!game) return;

    set({
      game: {
        ...game,
        status: 'ended',
        endedAt: new Date().toISOString(),
      },
    });
  },

  submitTransaction: (farmId: string, type: TransactionType, amount: number, price: number) => {
    const { game, currentRoundState, farmStates } = get();
    if (!game || !currentRoundState) {
      return { success: false, message: '游戏未开始或回合未初始化' };
    }
    if (game.status !== 'running') {
      return { success: false, message: '游戏当前状态不允许交易' };
    }

    const latestState = getLatestFarmState(farmStates, farmId, game.currentRound);
    if (!latestState) {
      return { success: false, message: '未找到该农场的当前状态' };
    }

    if (type === 'sell' && latestState.carbonQuota < amount) {
      return { success: false, message: '碳配额不足，无法卖出' };
    }

    const priceCheck = checkPriceFluctuation(price, currentRoundState.carbonPrice);

    const transaction: Transaction = {
      id: generateId(),
      farmId,
      roundNumber: game.currentRound,
      type,
      amount,
      price,
      status: priceCheck.needsReview ? 'pending' : 'confirmed',
      needsReview: priceCheck.needsReview,
      reviewReason: priceCheck.reason,
      createdAt: new Date().toISOString(),
    };

    set({
      transactions: [...get().transactions, transaction],
      pendingTransactions: priceCheck.needsReview
        ? [...get().pendingTransactions, transaction]
        : get().pendingTransactions,
    });

    return {
      success: true,
      message: priceCheck.needsReview
        ? '交易已提交，需等待老师确认'
        : '交易成功',
    };
  },

  confirmTransaction: (txId: string) => {
    set({
      transactions: get().transactions.map((tx) =>
        tx.id === txId
          ? { ...tx, status: 'confirmed', reviewedAt: new Date().toISOString(), reviewedBy: '小林老师' }
          : tx
      ),
      pendingTransactions: get().pendingTransactions.filter((tx) => tx.id !== txId),
    });
  },

  rejectTransaction: (txId: string) => {
    set({
      transactions: get().transactions.map((tx) =>
        tx.id === txId
          ? { ...tx, status: 'rejected', reviewedAt: new Date().toISOString(), reviewedBy: '小林老师' }
          : tx
      ),
      pendingTransactions: get().pendingTransactions.filter((tx) => tx.id !== txId),
    });
  },

  supplementData: (
    roundNumber: number,
    farmId: string,
    fieldName: string,
    oldValue: string,
    newValue: string,
    difference: string,
    remark: string
  ) => {
    const { game, farmStates, rounds, transactions, pauseRecords, supplementRecords, currentRoundState } = get();
    if (!game) return;

    const supplementRecord: SupplementRecord = {
      id: generateId(),
      roundNumber,
      farmId,
      fieldName,
      oldValue,
      newValue,
      difference,
      remark,
      confirmedAt: new Date().toISOString(),
      confirmedBy: '小林老师',
    };

    const updatedFarmStates = farmStates.map((fs) => {
      if (fs.roundNumber !== roundNumber || fs.farmId !== farmId) return fs;

      const parsedNewValue = Number(newValue);
      if (!isNaN(parsedNewValue) && fieldName in fs) {
        return {
          ...fs,
          [fieldName]: parsedNewValue,
        } as FarmState;
      }
      return fs;
    });

    const updatedRounds = rounds.map((r) =>
      r.roundNumber === roundNumber ? { ...r, isSupplemented: true } : r
    );

    const newCurrentRoundState =
      currentRoundState?.roundNumber === roundNumber
        ? { ...currentRoundState!, isSupplemented: true }
        : currentRoundState;

    const newSupplementRecords = [...supplementRecords, supplementRecord];

    const snapshot = createSnapshot(
      game,
      newCurrentRoundState,
      updatedFarmStates,
      transactions,
      pauseRecords,
      newSupplementRecords
    );
    saveGameSnapshot(snapshot);

    set({
      supplementRecords: newSupplementRecords,
      farmStates: updatedFarmStates,
      rounds: updatedRounds,
      currentRoundState: newCurrentRoundState,
    });
  },

  getSnapshotAtRound: (round: number) => {
    return loadGameSnapshot(round);
  },

  startReplay: (fromRound = 1) => {
    const { game, rounds, currentRoundState, farmStates, transactions, pauseRecords, supplementRecords, lastSettlementReason, pendingTransactions, isReplaying, preReplayState, originalMaxRound } = get();
    
    if (isReplaying && preReplayState && originalMaxRound) {
      const snapshot = loadGameSnapshot(fromRound);
      if (!snapshot) {
        set({ error: `未找到第${fromRound}回合的快照` });
        return;
      }
      set({
        replayRound: fromRound,
        game: snapshot.game,
        currentRoundState: snapshot.currentRoundState,
        farmStates: snapshot.farmStates,
        transactions: snapshot.transactions,
        pauseRecords: snapshot.pauseRecords,
        supplementRecords: snapshot.supplementRecords,
      });
      return;
    }

    if (!game) {
      set({ error: '游戏未初始化，无法开始回放' });
      return;
    }

    const snapshot = loadGameSnapshot(fromRound);
    if (!snapshot) {
      set({ error: `未找到第${fromRound}回合的快照` });
      return;
    }

    set({
      preReplayState: {
        game: { ...game },
        rounds: [...rounds],
        currentRoundState: currentRoundState ? { ...currentRoundState } : null,
        farmStates: [...farmStates],
        transactions: [...transactions],
        pauseRecords: [...pauseRecords],
        supplementRecords: [...supplementRecords],
        lastSettlementReason,
        pendingTransactions: [...pendingTransactions],
      },
      originalMaxRound: game.currentRound,
      isReplaying: true,
      replayRound: fromRound,
      game: snapshot.game,
      currentRoundState: snapshot.currentRoundState,
      farmStates: snapshot.farmStates,
      transactions: snapshot.transactions,
      pauseRecords: snapshot.pauseRecords,
      supplementRecords: snapshot.supplementRecords,
    });
  },

  stopReplay: () => {
    const { preReplayState, originalMaxRound } = get();
    if (!preReplayState) {
      set({
        isReplaying: false,
        replayRound: null,
        preReplayState: null,
        originalMaxRound: null,
      });
      return;
    }

    set({
      isReplaying: false,
      replayRound: null,
      preReplayState: null,
      originalMaxRound: null,
      game: preReplayState.game,
      rounds: preReplayState.rounds,
      currentRoundState: preReplayState.currentRoundState,
      farmStates: preReplayState.farmStates,
      transactions: preReplayState.transactions,
      pauseRecords: preReplayState.pauseRecords,
      supplementRecords: preReplayState.supplementRecords,
      lastSettlementReason: preReplayState.lastSettlementReason,
      pendingTransactions: preReplayState.pendingTransactions,
    });
  },

  stepReplay: (direction: 'prev' | 'next') => {
    const { replayRound, originalMaxRound } = get();
    if (!replayRound || !originalMaxRound) return;

    const targetRound = direction === 'next' ? replayRound + 1 : replayRound - 1;
    if (targetRound < 1 || targetRound > originalMaxRound) return;

    const snapshot = loadGameSnapshot(targetRound);
    if (!snapshot) return;

    set({
      replayRound: targetRound,
      game: snapshot.game,
      currentRoundState: snapshot.currentRoundState,
      farmStates: snapshot.farmStates,
      transactions: snapshot.transactions,
      pauseRecords: snapshot.pauseRecords,
      supplementRecords: snapshot.supplementRecords,
    });
  },

  setReplaySpeed: (speed: number) => {
    set({ replaySpeed: speed });
  },

  resetGame: () => {
    set({
      game: { ...initialGame },
      rounds: [],
      currentRoundState: null,
      farmStates: [],
      transactions: [],
      pauseRecords: [],
      supplementRecords: [],
      lastSettlementReason: '',
      isReplaying: false,
      replayRound: null,
      pendingTransactions: [],
      preReplayState: null,
      originalMaxRound: null,
      error: null,
      warnings: [],
    });
  },

  getFarmRanking: () => {
    const { farms, farmStates, game } = get();
    if (!game) return [];

    const currentStates = farmStates.filter((fs) => fs.roundNumber === game.currentRound);
    return farms
      .map((farm) => ({
        farm,
        state: currentStates.find((fs) => fs.farmId === farm.id),
        rank: 0,
      }))
      .sort((a, b) => (b.state?.revenue || 0) - (a.state?.revenue || 0))
      .map((item, index) => ({ ...item, rank: index + 1 }));
  },

  getTotalCarbonQuota: () => {
    const { farmStates, game } = get();
    if (!game) return 0;
    return farmStates
      .filter((fs) => fs.roundNumber === game.currentRound)
      .reduce((sum, fs) => sum + fs.carbonQuota, 0);
  },

  getCurrentCarbonPrice: () => {
    return get().currentRoundState?.carbonPrice || 0;
  },
}));
