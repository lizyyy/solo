export type ActivityStatus = 'draft' | 'active' | 'completed' | 'archived';

export interface Activity {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: ActivityStatus;
  operator: string;
  createdAt: string;
}

export interface DropConfigItem {
  itemId: string;
  itemName: string;
  dropCondition: string;
  quantity: number;
}

export interface DropConfig {
  id: string;
  activityId: string;
  version: string;
  operator: string;
  content: DropConfigItem[];
  sourceFile: string;
  createdAt: string;
  remark: string;
}

export interface LeaderboardItem {
  rank: number;
  playerId: string;
  playerName: string;
  score: number;
}

export interface Leaderboard {
  id: string;
  activityId: string;
  name: string;
  operator: string;
  screenshotUrl: string;
  extractedData: LeaderboardItem[];
  createdAt: string;
  remark: string;
}

export type RewardStatus = 'confirmed' | 'pending' | 'manual' | 'missed';
export type SourceType = 'drop_config' | 'leaderboard' | 'manual';

export interface Reward {
  id: string;
  activityId: string;
  playerId: string;
  playerName: string;
  itemName: string;
  quantity: number;
  status: RewardStatus;
  sourceType: SourceType;
  sourceId: string;
  operator: string;
  createdAt: string;
  updatedAt: string;
  remark: string;
}

export type MissSource = 'drop_config_missing' | 'leaderboard_missing' | 'merge_error' | 'other';
export type MissProgress = 'reported' | 'confirmed' | 'compensated' | 'closed';

export interface MissedReward {
  id: string;
  rewardId: string;
  missSource: MissSource;
  responsible: string;
  progress: MissProgress;
  nextStep: string;
  createdAt: string;
  updatedAt: string;
}

export type TargetType = 'activity' | 'drop_config' | 'leaderboard' | 'reward' | 'missed_reward';
export type ActionType = 'create' | 'update' | 'delete' | 'import' | 'export';

export interface OperationLog {
  id: string;
  targetType: TargetType;
  targetId: string;
  action: ActionType;
  operator: string;
  beforeData: string;
  afterData: string;
  createdAt: string;
  remark: string;
}

export interface StatusStats {
  confirmed: number;
  pending: number;
  manual: number;
  missed: number;
  total: number;
}

export interface ImportResult<T> {
  success: boolean;
  data?: T[];
  errors: string[];
  duplicates: number;
  inserted: number;
}
