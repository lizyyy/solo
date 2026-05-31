import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type {
  Activity,
  DropConfig,
  Leaderboard,
  Reward,
  MissedReward,
  OperationLog,
  RewardStatus,
  SourceType,
  TargetType,
} from '../types';

interface SnowRescueDB extends DBSchema {
  activities: {
    key: string;
    value: Activity;
  };
  dropConfigs: {
    key: string;
    value: DropConfig;
    indexes: { activityId: string };
  };
  leaderboards: {
    key: string;
    value: Leaderboard;
    indexes: { activityId: string };
  };
  rewards: {
    key: string;
    value: Reward;
    indexes: { activityId: string; status: RewardStatus; sourceType: SourceType };
  };
  missedRewards: {
    key: string;
    value: MissedReward;
    indexes: { rewardId: string; progress: string };
  };
  operationLogs: {
    key: string;
    value: OperationLog;
    indexes: { targetType: TargetType; targetId: string; createdAt: string };
  };
}

const DB_NAME = 'snow_rescue_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<SnowRescueDB>> | null = null;

const initDB = async (): Promise<IDBPDatabase<SnowRescueDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<SnowRescueDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('activities')) {
          db.createObjectStore('activities', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('dropConfigs')) {
          const dropConfigStore = db.createObjectStore('dropConfigs', { keyPath: 'id' });
          dropConfigStore.createIndex('activityId', 'activityId');
        }

        if (!db.objectStoreNames.contains('leaderboards')) {
          const leaderboardStore = db.createObjectStore('leaderboards', { keyPath: 'id' });
          leaderboardStore.createIndex('activityId', 'activityId');
        }

        if (!db.objectStoreNames.contains('rewards')) {
          const rewardStore = db.createObjectStore('rewards', { keyPath: 'id' });
          rewardStore.createIndex('activityId', 'activityId');
          rewardStore.createIndex('status', 'status');
          rewardStore.createIndex('sourceType', 'sourceType');
        }

        if (!db.objectStoreNames.contains('missedRewards')) {
          const missedRewardStore = db.createObjectStore('missedRewards', { keyPath: 'id' });
          missedRewardStore.createIndex('rewardId', 'rewardId');
          missedRewardStore.createIndex('progress', 'progress');
        }

        if (!db.objectStoreNames.contains('operationLogs')) {
          const operationLogStore = db.createObjectStore('operationLogs', { keyPath: 'id' });
          operationLogStore.createIndex('targetType', 'targetType');
          operationLogStore.createIndex('targetId', 'targetId');
          operationLogStore.createIndex('createdAt', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
};

export const addActivity = async (activity: Activity): Promise<string> => {
  const db = await initDB();
  return db.add('activities', activity);
};

export const getActivities = async (): Promise<Activity[]> => {
  const db = await initDB();
  return db.getAll('activities');
};

export const getActivity = async (id: string): Promise<Activity | undefined> => {
  const db = await initDB();
  return db.get('activities', id);
};

export const updateActivity = async (activity: Activity): Promise<string> => {
  const db = await initDB();
  return db.put('activities', activity);
};

export const deleteActivity = async (id: string): Promise<void> => {
  const db = await initDB();
  return db.delete('activities', id);
};

export const addDropConfig = async (dropConfig: DropConfig): Promise<string> => {
  const db = await initDB();
  return db.add('dropConfigs', dropConfig);
};

export const getDropConfigs = async (): Promise<DropConfig[]> => {
  const db = await initDB();
  return db.getAll('dropConfigs');
};

export const getDropConfig = async (id: string): Promise<DropConfig | undefined> => {
  const db = await initDB();
  return db.get('dropConfigs', id);
};

export const updateDropConfig = async (dropConfig: DropConfig): Promise<string> => {
  const db = await initDB();
  return db.put('dropConfigs', dropConfig);
};

export const deleteDropConfig = async (id: string): Promise<void> => {
  const db = await initDB();
  return db.delete('dropConfigs', id);
};

export const addLeaderboard = async (leaderboard: Leaderboard): Promise<string> => {
  const db = await initDB();
  return db.add('leaderboards', leaderboard);
};

export const getLeaderboards = async (): Promise<Leaderboard[]> => {
  const db = await initDB();
  return db.getAll('leaderboards');
};

export const getLeaderboard = async (id: string): Promise<Leaderboard | undefined> => {
  const db = await initDB();
  return db.get('leaderboards', id);
};

export const updateLeaderboard = async (leaderboard: Leaderboard): Promise<string> => {
  const db = await initDB();
  return db.put('leaderboards', leaderboard);
};

export const deleteLeaderboard = async (id: string): Promise<void> => {
  const db = await initDB();
  return db.delete('leaderboards', id);
};

export const addReward = async (reward: Reward): Promise<string> => {
  const db = await initDB();
  return db.add('rewards', reward);
};

export const getRewards = async (): Promise<Reward[]> => {
  const db = await initDB();
  return db.getAll('rewards');
};

export const getReward = async (id: string): Promise<Reward | undefined> => {
  const db = await initDB();
  return db.get('rewards', id);
};

export const updateReward = async (reward: Reward): Promise<string> => {
  const db = await initDB();
  return db.put('rewards', reward);
};

export const deleteReward = async (id: string): Promise<void> => {
  const db = await initDB();
  return db.delete('rewards', id);
};

export const getRewardsByActivity = async (activityId: string): Promise<Reward[]> => {
  const db = await initDB();
  return db.getAllFromIndex('rewards', 'activityId', activityId);
};

export const addMissedReward = async (missedReward: MissedReward): Promise<string> => {
  const db = await initDB();
  return db.add('missedRewards', missedReward);
};

export const getMissedRewards = async (): Promise<MissedReward[]> => {
  const db = await initDB();
  return db.getAll('missedRewards');
};

export const getMissedReward = async (id: string): Promise<MissedReward | undefined> => {
  const db = await initDB();
  return db.get('missedRewards', id);
};

export const updateMissedReward = async (missedReward: MissedReward): Promise<string> => {
  const db = await initDB();
  return db.put('missedRewards', missedReward);
};

export const deleteMissedReward = async (id: string): Promise<void> => {
  const db = await initDB();
  return db.delete('missedRewards', id);
};

export const addOperationLog = async (operationLog: OperationLog): Promise<string> => {
  const db = await initDB();
  return db.add('operationLogs', operationLog);
};

export const getOperationLogs = async (): Promise<OperationLog[]> => {
  const db = await initDB();
  return db.getAll('operationLogs');
};

export const getOperationLogsByTarget = async (
  targetType: TargetType,
  targetId: string
): Promise<OperationLog[]> => {
  const db = await initDB();
  const tx = db.transaction('operationLogs', 'readonly');
  const store = tx.objectStore('operationLogs');
  const typeIndex = store.index('targetType');
  const logs: OperationLog[] = [];
  let cursor = await typeIndex.openCursor(targetType);
  while (cursor) {
    if (cursor.value.targetId === targetId) {
      logs.push(cursor.value);
    }
    cursor = await cursor.continue();
  }
  await tx.done;
  return logs;
};
