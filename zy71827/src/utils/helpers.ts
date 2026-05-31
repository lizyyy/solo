import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type {
  RewardStatus,
  SourceType,
  MissSource,
  MissProgress,
  Reward,
} from '../types';

export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

export const formatDateShort = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}-${day}`;
};

export const getStatusText = (status: RewardStatus): string => {
  const map: Record<RewardStatus, string> = {
    confirmed: '已确认',
    pending: '待审核',
    manual: '需手动处理',
    missed: '漏发',
  };
  return map[status] || status;
};

export const getStatusColor = (status: RewardStatus): string => {
  const map: Record<RewardStatus, string> = {
    confirmed: 'bg-green-100 text-green-800 border-green-200',
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    manual: 'bg-orange-100 text-orange-800 border-orange-200',
    missed: 'bg-red-100 text-red-800 border-red-200',
  };
  return map[status] || 'bg-gray-100 text-gray-800 border-gray-200';
};

export const getSourceTypeText = (source: SourceType): string => {
  const map: Record<SourceType, string> = {
    drop_config: '掉落配置',
    leaderboard: '排行榜',
    manual: '手动添加',
  };
  return map[source] || source;
};

export const getMissSourceText = (source: MissSource): string => {
  const map: Record<MissSource, string> = {
    drop_config_missing: '掉落配置缺失',
    leaderboard_missing: '排行榜数据缺失',
    merge_error: '合并错误',
    other: '其他原因',
  };
  return map[source] || source;
};

export const getMissProgressText = (progress: MissProgress): string => {
  const map: Record<MissProgress, string> = {
    reported: '已上报',
    confirmed: '已确认',
    compensated: '已补发',
    closed: '已关闭',
  };
  return map[progress] || progress;
};

export const generateRewardKey = (reward: Partial<Reward>): string => {
  const playerId = reward.playerId || '';
  const itemName = reward.itemName || '';
  const sourceId = reward.sourceId || '';
  return `${playerId}_${itemName}_${sourceId}`;
};

export const deduplicateRewards = (rewards: Reward[]): Reward[] => {
  const seen = new Set<string>();
  const result: Reward[] = [];
  for (const reward of rewards) {
    const key = generateRewardKey(reward);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(reward);
    }
  }
  return result;
};

export const cn = (...inputs: ClassValue[]): string => {
  return twMerge(clsx(inputs));
};
