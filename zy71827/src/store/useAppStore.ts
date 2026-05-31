import { create } from 'zustand';
import Papa from 'papaparse';
import type {
  Activity,
  DropConfig,
  Leaderboard,
  Reward,
  MissedReward,
  OperationLog,
  RewardStatus,
  StatusStats,
  SourceType,
  MissProgress,
} from '../types';
import * as db from '../db/indexedDB';
import { generateMockData } from '../db/mockData';
import {
  generateId,
  formatDate,
  formatDateShort,
  generateRewardKey,
  deduplicateRewards,
  getStatusText,
  getSourceTypeText,
} from '../utils/helpers';

interface AppState {
  currentActivity: Activity | null;
  activities: Activity[];
  dropConfigs: DropConfig[];
  leaderboards: Leaderboard[];
  rewards: Reward[];
  missedRewards: MissedReward[];
  operationLogs: OperationLog[];
  currentOperator: string;
  loading: boolean;
  error: string | null;

  initDB: () => Promise<void>;
  setCurrentActivity: (id: string) => Promise<void>;
  loadAllData: (activityId: string) => Promise<void>;
  addDropConfigWithLog: (
    config: Omit<DropConfig, 'id' | 'createdAt' | 'operator'>
  ) => Promise<string>;
  addLeaderboardWithLog: (
    data: Omit<Leaderboard, 'id' | 'createdAt' | 'operator'>
  ) => Promise<string>;
  updateRewardStatus: (
    id: string,
    status: RewardStatus,
    remark?: string
  ) => Promise<void>;
  updateMissedRewardProgress: (
    id: string,
    progress: MissProgress,
    nextStep?: string
  ) => Promise<void>;
  mergeRewardsFromSources: () => Promise<void>;
  exportRewardsToCSV: (statusFilter?: RewardStatus[]) => Promise<string>;
  getStats: () => StatusStats;
  deleteDropConfigWithLog: (id: string) => Promise<void>;
  deleteLeaderboardWithLog: (id: string) => Promise<void>;
  generateReviewReport: () => {
    activity: Activity | null;
    stats: StatusStats;
    dropConfigCount: number;
    leaderboardCount: number;
    missedRewardCount: number;
    topPlayers: Array<{ playerName: string; rewardCount: number }>;
    rewardTrend: Array<{ date: string; count: number }>;
    sourceDistribution: Array<{ source: string; count: number; percentage: number }>;
  };
}

const getNowISO = (): string => new Date().toISOString();

const createOperationLog = (
  targetType: 'activity' | 'drop_config' | 'leaderboard' | 'reward' | 'missed_reward',
  targetId: string,
  action: 'create' | 'update' | 'delete' | 'import' | 'export',
  operator: string,
  beforeData: unknown,
  afterData: unknown,
  remark: string
): OperationLog => ({
  id: generateId(),
  targetType,
  targetId,
  action,
  operator,
  beforeData: typeof beforeData === 'string' ? beforeData : JSON.stringify(beforeData),
  afterData: typeof afterData === 'string' ? afterData : JSON.stringify(afterData),
  createdAt: getNowISO(),
  remark,
});

export const useAppStore = create<AppState>((set, get) => ({
  currentActivity: null,
  activities: [],
  dropConfigs: [],
  leaderboards: [],
  rewards: [],
  missedRewards: [],
  operationLogs: [],
  currentOperator: '当前运营',
  loading: false,
  error: null,

  initDB: async () => {
    set({ loading: true, error: null });
    try {
      const existingActivities = await db.getActivities();
      if (existingActivities.length === 0) {
        const mockData = generateMockData();
        await db.addActivity(mockData.activity);
        for (const config of mockData.dropConfigs) {
          await db.addDropConfig(config);
        }
        for (const leaderboard of mockData.leaderboards) {
          await db.addLeaderboard(leaderboard);
        }
        for (const reward of mockData.rewards) {
          await db.addReward(reward);
        }
        for (const missedReward of mockData.missedRewards) {
          await db.addMissedReward(missedReward);
        }
        for (const log of mockData.operationLogs) {
          await db.addOperationLog(log);
        }
      }
      const activities = await db.getActivities();
      set({ activities, loading: false });
      if (activities.length > 0) {
        await get().setCurrentActivity(activities[0].id);
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '初始化数据库失败', loading: false });
    }
  },

  setCurrentActivity: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const activity = await db.getActivity(id);
      if (activity) {
        set({ currentActivity: activity });
        await get().loadAllData(id);
      }
      set({ loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '设置活动失败', loading: false });
    }
  },

  loadAllData: async (activityId: string) => {
    set({ loading: true, error: null });
    try {
      const [dropConfigs, leaderboards, rewards, missedRewards, operationLogs] =
        await Promise.all([
          db.getDropConfigs(),
          db.getLeaderboards(),
          db.getRewardsByActivity(activityId),
          db.getMissedRewards(),
          db.getOperationLogs(),
        ]);

      set({
        dropConfigs: dropConfigs.filter((d) => d.activityId === activityId),
        leaderboards: leaderboards.filter((l) => l.activityId === activityId),
        rewards,
        missedRewards,
        operationLogs,
        loading: false,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载数据失败', loading: false });
    }
  },

  addDropConfigWithLog: async (config) => {
    set({ loading: true, error: null });
    try {
      const { currentOperator, currentActivity } = get();
      if (!currentActivity) throw new Error('未选择活动');

      const newConfig: DropConfig = {
        ...config,
        id: generateId(),
        createdAt: getNowISO(),
        operator: currentOperator,
      };

      const id = await db.addDropConfig(newConfig);

      const log = createOperationLog(
        'drop_config',
        newConfig.id,
        'create',
        currentOperator,
        '{}',
        newConfig,
        '添加掉落配置'
      );
      await db.addOperationLog(log);

      set((state) => ({
        dropConfigs: [...state.dropConfigs, newConfig],
        operationLogs: [...state.operationLogs, log],
        loading: false,
      }));

      return id;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '添加掉落配置失败', loading: false });
      throw error;
    }
  },

  addLeaderboardWithLog: async (data) => {
    set({ loading: true, error: null });
    try {
      const { currentOperator, currentActivity } = get();
      if (!currentActivity) throw new Error('未选择活动');

      const newLeaderboard: Leaderboard = {
        ...data,
        id: generateId(),
        createdAt: getNowISO(),
        operator: currentOperator,
      };

      const id = await db.addLeaderboard(newLeaderboard);

      const log = createOperationLog(
        'leaderboard',
        newLeaderboard.id,
        'create',
        currentOperator,
        '{}',
        newLeaderboard,
        '添加排行榜'
      );
      await db.addOperationLog(log);

      set((state) => ({
        leaderboards: [...state.leaderboards, newLeaderboard],
        operationLogs: [...state.operationLogs, log],
        loading: false,
      }));

      return id;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '添加排行榜失败', loading: false });
      throw error;
    }
  },

  updateRewardStatus: async (id, status, remark = '') => {
    set({ loading: true, error: null });
    try {
      const { currentOperator, rewards } = get();
      const existingReward = rewards.find((r) => r.id === id);
      if (!existingReward) throw new Error('奖励记录不存在');

      const beforeData = { ...existingReward };
      const updatedReward: Reward = {
        ...existingReward,
        status,
        remark: existingReward.remark ? `${existingReward.remark}; ${remark}` : remark,
        updatedAt: getNowISO(),
      };

      await db.updateReward(updatedReward);

      const log = createOperationLog(
        'reward',
        id,
        'update',
        currentOperator,
        beforeData,
        updatedReward,
        `更新奖励状态为${getStatusText(status)}`
      );
      await db.addOperationLog(log);

      set((state) => ({
        rewards: state.rewards.map((r) => (r.id === id ? updatedReward : r)),
        operationLogs: [...state.operationLogs, log],
        loading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '更新奖励状态失败', loading: false });
      throw error;
    }
  },

  updateMissedRewardProgress: async (id, progress, nextStep = '') => {
    set({ loading: true, error: null });
    try {
      const { currentOperator, missedRewards } = get();
      const existingMissedReward = missedRewards.find((m) => m.id === id);
      if (!existingMissedReward) throw new Error('漏发记录不存在');

      const beforeData = { ...existingMissedReward };
      const updatedMissedReward: MissedReward = {
        ...existingMissedReward,
        progress,
        nextStep: nextStep || existingMissedReward.nextStep,
        updatedAt: getNowISO(),
      };

      await db.updateMissedReward(updatedMissedReward);

      const log = createOperationLog(
        'missed_reward',
        id,
        'update',
        currentOperator,
        beforeData,
        updatedMissedReward,
        `更新漏发进度为${progress}`
      );
      await db.addOperationLog(log);

      set((state) => ({
        missedRewards: state.missedRewards.map((m) =>
          m.id === id ? updatedMissedReward : m
        ),
        operationLogs: [...state.operationLogs, log],
        loading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '更新漏发进度失败', loading: false });
      throw error;
    }
  },

  mergeRewardsFromSources: async () => {
    set({ loading: true, error: null });
    try {
      const { dropConfigs, leaderboards, currentActivity, currentOperator, rewards } = get();
      if (!currentActivity) throw new Error('未选择活动');

      const mergedRewards: Reward[] = [];
      const existingKeys = new Set(rewards.map(generateRewardKey));

      for (const config of dropConfigs) {
        for (const item of config.content) {
          const playerId = `drop_${config.id}_${item.itemId}`;
          const playerName = `系统配置_${item.itemName}`;
          const rewardKey = generateRewardKey({
            playerId,
            itemName: item.itemName,
            sourceId: config.id,
          });

          if (!existingKeys.has(rewardKey)) {
            const newReward: Reward = {
              id: generateId(),
              activityId: currentActivity.id,
              playerId,
              playerName,
              itemName: item.itemName,
              quantity: item.quantity,
              status: 'confirmed',
              sourceType: 'drop_config',
              sourceId: config.id,
              operator: currentOperator,
              createdAt: getNowISO(),
              updatedAt: getNowISO(),
              remark: `来源: ${config.sourceFile}, 版本: ${config.version}`,
            };
            mergedRewards.push(newReward);
            existingKeys.add(rewardKey);
          }
        }
      }

      for (const board of leaderboards) {
        for (const item of board.extractedData) {
          const itemName = '排行榜奖励';
          const quantity = Math.max(100 - item.rank * 5, 10);
          const rewardKey = generateRewardKey({
            playerId: item.playerId,
            itemName,
            sourceId: board.id,
          });

          if (!existingKeys.has(rewardKey)) {
            const newReward: Reward = {
              id: generateId(),
              activityId: currentActivity.id,
              playerId: item.playerId,
              playerName: item.playerName,
              itemName,
              quantity,
              status: 'pending',
              sourceType: 'leaderboard',
              sourceId: board.id,
              operator: currentOperator,
              createdAt: getNowISO(),
              updatedAt: getNowISO(),
              remark: `排行榜: ${board.name}, 排名: ${item.rank}`,
            };
            mergedRewards.push(newReward);
            existingKeys.add(rewardKey);
          }
        }
      }

      const deduplicated = deduplicateRewards(mergedRewards);

      for (const reward of deduplicated) {
        await db.addReward(reward);
      }

      if (deduplicated.length > 0) {
        const log = createOperationLog(
          'reward',
          currentActivity.id,
          'import',
          currentOperator,
          '{}',
          { count: deduplicated.length, sources: ['drop_config', 'leaderboard'] },
          `从掉落配置和排行榜合并生成 ${deduplicated.length} 条奖励记录`
        );
        await db.addOperationLog(log);

        set((state) => ({
          rewards: deduplicateRewards([...state.rewards, ...deduplicated]),
          operationLogs: [...state.operationLogs, log],
          loading: false,
        }));
      } else {
        set({ loading: false });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '合并奖励记录失败', loading: false });
      throw error;
    }
  },

  exportRewardsToCSV: async (statusFilter) => {
    set({ loading: true, error: null });
    try {
      const { rewards, currentActivity, currentOperator, dropConfigs, leaderboards } = get();
      if (!currentActivity) throw new Error('未选择活动');

      let filteredRewards = [...rewards];
      if (statusFilter && statusFilter.length > 0) {
        filteredRewards = rewards.filter((r) => statusFilter.includes(r.status));
      }

      const csvData = filteredRewards.map((reward) => {
        let sourceLink = '';
        if (reward.sourceType === 'drop_config') {
          const config = dropConfigs.find((d) => d.id === reward.sourceId);
          sourceLink = config ? config.sourceFile : reward.sourceId;
        } else if (reward.sourceType === 'leaderboard') {
          const board = leaderboards.find((l) => l.id === reward.sourceId);
          sourceLink = board ? board.screenshotUrl : reward.sourceId;
        } else {
          sourceLink = '手动添加';
        }

        return {
          ID: reward.id,
          活动ID: reward.activityId,
          玩家ID: reward.playerId,
          玩家名称: reward.playerName,
          物品名称: reward.itemName,
          数量: reward.quantity,
          状态: getStatusText(reward.status),
          来源类型: getSourceTypeText(reward.sourceType),
          来源追溯: sourceLink,
          操作人: reward.operator,
          创建时间: formatDate(reward.createdAt),
          更新时间: formatDate(reward.updatedAt),
          备注: reward.remark,
        };
      });

      const csv = Papa.unparse(csvData);

      const log = createOperationLog(
        'reward',
        currentActivity.id,
        'export',
        currentOperator,
        '{}',
        { count: csvData.length, statusFilter: statusFilter || 'all' },
        `导出 ${csvData.length} 条奖励记录为CSV`
      );
      await db.addOperationLog(log);

      set((state) => ({
        operationLogs: [...state.operationLogs, log],
        loading: false,
      }));

      return csv;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '导出CSV失败', loading: false });
      throw error;
    }
  },

  getStats: () => {
    const { rewards } = get();
    const stats: StatusStats = {
      confirmed: 0,
      pending: 0,
      manual: 0,
      missed: 0,
      total: rewards.length,
    };
    for (const reward of rewards) {
      stats[reward.status]++;
    }
    return stats;
  },

  deleteDropConfigWithLog: async (id) => {
    set({ loading: true, error: null });
    try {
      const { currentOperator, dropConfigs } = get();
      const existingConfig = dropConfigs.find((d) => d.id === id);
      if (!existingConfig) throw new Error('掉落配置不存在');

      await db.deleteDropConfig(id);

      const log = createOperationLog(
        'drop_config',
        id,
        'delete',
        currentOperator,
        existingConfig,
        '{}',
        `撤回掉落配置版本 ${existingConfig.version}`
      );
      await db.addOperationLog(log);

      set((state) => ({
        dropConfigs: state.dropConfigs.filter((d) => d.id !== id),
        operationLogs: [...state.operationLogs, log],
        loading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '撤回掉落配置失败', loading: false });
      throw error;
    }
  },

  deleteLeaderboardWithLog: async (id) => {
    set({ loading: true, error: null });
    try {
      const { currentOperator, leaderboards } = get();
      const existingLeaderboard = leaderboards.find((l) => l.id === id);
      if (!existingLeaderboard) throw new Error('排行榜不存在');

      await db.deleteLeaderboard(id);

      const log = createOperationLog(
        'leaderboard',
        id,
        'delete',
        currentOperator,
        existingLeaderboard,
        '{}',
        `撤回排行榜 ${existingLeaderboard.name}`
      );
      await db.addOperationLog(log);

      set((state) => ({
        leaderboards: state.leaderboards.filter((l) => l.id !== id),
        operationLogs: [...state.operationLogs, log],
        loading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '撤回排行榜失败', loading: false });
      throw error;
    }
  },

  generateReviewReport: () => {
    const {
      currentActivity,
      dropConfigs,
      leaderboards,
      rewards,
      missedRewards,
      getStats,
    } = get();

    const stats = getStats();

    const playerMap = new Map<string, number>();
    for (const reward of rewards) {
      const count = playerMap.get(reward.playerName) || 0;
      playerMap.set(reward.playerName, count + 1);
    }
    const topPlayers = Array.from(playerMap.entries())
      .map(([playerName, rewardCount]) => ({ playerName, rewardCount }))
      .sort((a, b) => b.rewardCount - a.rewardCount)
      .slice(0, 10);

    const dateMap = new Map<string, number>();
    for (const reward of rewards) {
      const date = formatDateShort(reward.createdAt);
      const count = dateMap.get(date) || 0;
      dateMap.set(date, count + 1);
    }
    const rewardTrend = Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const sourceMap = new Map<SourceType, number>();
    for (const reward of rewards) {
      const count = sourceMap.get(reward.sourceType) || 0;
      sourceMap.set(reward.sourceType, count + 1);
    }
    const total = rewards.length || 1;
    const sourceDistribution = Array.from(sourceMap.entries())
      .map(([source, count]) => ({
        source: getSourceTypeText(source),
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    return {
      activity: currentActivity,
      stats,
      dropConfigCount: dropConfigs.length,
      leaderboardCount: leaderboards.length,
      missedRewardCount: missedRewards.length,
      topPlayers,
      rewardTrend,
      sourceDistribution,
    };
  },
}));
