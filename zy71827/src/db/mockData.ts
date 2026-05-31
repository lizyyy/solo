import type {
  Activity,
  DropConfig,
  DropConfigItem,
  Leaderboard,
  LeaderboardItem,
  Reward,
  MissedReward,
  OperationLog,
  ActionType,
} from '../types';

const playerNames = [
  '雪域雄鹰', '冰封战士', '雪山飞狐', '极地守护者', '冰川行者',
  '寒风利刃', '雪原狼王', '破冰先锋', '极夜游侠', '霜寒剑士',
  '雪山精灵', '冻土猎人', '冰晶法师', '极光使者', '雪域追风',
  '冰原猎手', '雪山勇者', '寒霜刺客', '冰川骑士', '雪雾行者',
];

const itemNames = [
  '救援绳索', '急救包', '雪山地图', '防寒斗篷', '冰爪',
  '登山镐', '信号弹', '保暖睡袋', '雪地靴', '护目镜',
  '对讲机', '氧气瓶', '应急食品', '保温水壶', '防滑手套',
  '雪崩信标', '探路杖', '太阳能板', '医疗箱', '卫星电话',
];

const operators = ['张运维', '李运营', '王策划', '赵客服', '陈主管'];

const generateId = (): string => crypto.randomUUID();

const formatDate = (date: Date): string => date.toISOString();

const createActivity = (): Activity => ({
  id: generateId(),
  name: '第12期雪山救援小队',
  startDate: formatDate(new Date('2026-01-01')),
  endDate: formatDate(new Date('2026-06-30')),
  status: 'active',
  operator: operators[0],
  createdAt: formatDate(new Date('2026-01-01')),
});

const createDropConfigItems = (count: number): DropConfigItem[] => {
  const shuffled = [...itemNames].sort(() => Math.random() - 0.5);
  return Array.from({ length: count }, (_, i) => ({
    itemId: generateId(),
    itemName: shuffled[i % shuffled.length],
    dropCondition: ['通关第3关', '累计登录7天', '邀请好友3人', '消耗体力100点', '完成每日任务', '击败BOSS', '收集10个碎片', '达到30级'][i % 8],
    quantity: Math.floor(Math.random() * 5) + 1,
  }));
};

const createDropConfigs = (activityId: string): DropConfig[] => {
  const versions = ['v1.0.0', 'v1.1.0', 'v1.2.0'];
  return versions.map((version, index) => {
    const itemCount = 5 + Math.floor(Math.random() * 4);
    return {
      id: generateId(),
      activityId,
      version,
      operator: operators[index % operators.length],
      content: createDropConfigItems(itemCount),
      sourceFile: `drop_config_${version}.xlsx`,
      createdAt: formatDate(new Date(`2026-0${index + 1}-15`)),
      remark: index === 0 ? '初始版本配置' : index === 1 ? '增加稀有物品掉落' : '优化掉落概率调整',
    };
  });
};

const createLeaderboardItems = (count: number): LeaderboardItem[] => {
  const shuffledPlayers = [...playerNames].sort(() => Math.random() - 0.5);
  return Array.from({ length: count }, (_, i) => ({
    rank: i + 1,
    playerId: generateId(),
    playerName: shuffledPlayers[i % shuffledPlayers.length],
    score: Math.floor(Math.random() * 5000) + 10000 - i * 500,
  }));
};

const createLeaderboards = (activityId: string): Leaderboard[] => {
  const names = ['雪山救援先锋榜', '累计贡献排行榜'];
  return names.map((name, index) => {
    const playerCount = 10 + Math.floor(Math.random() * 6);
    return {
      id: generateId(),
      activityId,
      name,
      operator: operators[index % operators.length],
      screenshotUrl: `/screenshots/leaderboard_${index + 1}.png`,
      extractedData: createLeaderboardItems(playerCount),
      createdAt: formatDate(new Date(`2026-0${index + 2}-20`)),
      remark: index === 0 ? '第一期周榜数据' : '月度总榜数据',
    };
  });
};

const createRewards = (
  activityId: string,
  dropConfigs: DropConfig[],
  leaderboards: Leaderboard[]
): Reward[] => {
  const rewards: Reward[] = [];
  const statusDistribution: Array<'confirmed' | 'pending' | 'manual' | 'missed'> = [
    ...Array(25).fill('confirmed'),
    ...Array(8).fill('pending'),
    ...Array(5).fill('manual'),
    ...Array(2).fill('missed'),
  ];
  const sourceTypes: Array<'drop_config' | 'leaderboard' | 'manual'> = [
    'drop_config', 'drop_config', 'drop_config', 'leaderboard', 'manual',
  ];

  const allPlayers = [...playerNames];
  const shuffledPlayers = [...allPlayers].sort(() => Math.random() - 0.5);

  for (let i = 0; i < 40; i++) {
    const sourceType = sourceTypes[i % sourceTypes.length];
    let sourceId: string;
    let itemName: string;
    let quantity: number;

    if (sourceType === 'drop_config') {
      const config = dropConfigs[Math.floor(Math.random() * dropConfigs.length)];
      sourceId = config.id;
      const item = config.content[Math.floor(Math.random() * config.content.length)];
      itemName = item.itemName;
      quantity = item.quantity;
    } else if (sourceType === 'leaderboard') {
      const board = leaderboards[Math.floor(Math.random() * leaderboards.length)];
      sourceId = board.id;
      itemName = ['钻石奖励', '金币奖励', '限定头像框'][Math.floor(Math.random() * 3)];
      quantity = Math.floor(Math.random() * 100) + 50;
    } else {
      sourceId = generateId();
      itemName = itemNames[Math.floor(Math.random() * itemNames.length)];
      quantity = Math.floor(Math.random() * 10) + 1;
    }

    const playerIndex = i % shuffledPlayers.length;
    const baseDate = new Date('2026-03-01');
    baseDate.setDate(baseDate.getDate() + Math.floor(i / 5));

    rewards.push({
      id: generateId(),
      activityId,
      playerId: generateId(),
      playerName: shuffledPlayers[playerIndex],
      itemName,
      quantity,
      status: statusDistribution[i],
      sourceType,
      sourceId,
      operator: operators[Math.floor(Math.random() * operators.length)],
      createdAt: formatDate(baseDate),
      updatedAt: formatDate(baseDate),
      remark: i % 10 === 0 ? 'VIP玩家额外补偿' : '',
    });
  }

  return rewards;
};

const createMissedRewards = (rewards: Reward[]): MissedReward[] => {
  const missedRewardItems = rewards.filter(r => r.status === 'missed');
  const missSources: Array<'drop_config_missing' | 'leaderboard_missing' | 'merge_error' | 'other'> = [
    'drop_config_missing', 'leaderboard_missing',
  ];
  const progress: Array<'reported' | 'confirmed' | 'compensated' | 'closed'> = [
    'confirmed', 'reported',
  ];
  const nextSteps = [
    '已补发奖励至玩家邮箱',
    '正在核实数据中，请耐心等待',
  ];

  return missedRewardItems.slice(0, 2).map((reward, index) => ({
    id: generateId(),
    rewardId: reward.id,
    missSource: missSources[index],
    responsible: operators[index % operators.length],
    progress: progress[index],
    nextStep: nextSteps[index],
    createdAt: formatDate(new Date('2026-04-10')),
    updatedAt: formatDate(new Date('2026-04-12')),
  }));
};

const createOperationLogs = (
  activity: Activity,
  dropConfigs: DropConfig[],
  leaderboards: Leaderboard[],
  rewards: Reward[]
): OperationLog[] => {
  const logs: OperationLog[] = [];
  const allTargets: Array<{ type: 'activity' | 'drop_config' | 'leaderboard' | 'reward' | 'missed_reward'; id: string; data: unknown }> = [
    { type: 'activity', id: activity.id, data: activity },
  ];
  dropConfigs.forEach(dc => allTargets.push({ type: 'drop_config', id: dc.id, data: dc }));
  leaderboards.forEach(lb => allTargets.push({ type: 'leaderboard', id: lb.id, data: lb }));
  rewards.slice(0, 8).forEach(r => allTargets.push({ type: 'reward', id: r.id, data: r }));

  const actions: ActionType[] = ['create', 'update', 'import', 'export'];

  for (let i = 0; i < 15; i++) {
    const target = allTargets[i % allTargets.length];
    const action = actions[i % actions.length];
    const logDate = new Date('2026-03-01');
    logDate.setDate(logDate.getDate() + i);

    logs.push({
      id: generateId(),
      targetType: target.type,
      targetId: target.id,
      action,
      operator: operators[i % operators.length],
      beforeData: action === 'create' ? '{}' : JSON.stringify({ ...(target.data as object), name: '修改前名称' }),
      afterData: action === 'delete' ? '{}' : JSON.stringify(target.data),
      createdAt: formatDate(logDate),
      remark: [
        '活动创建成功',
        '掉落配置导入完成',
        '排行榜数据更新',
        '奖励批量发放',
        '数据导出备份',
      ][i % 5],
    });
  }

  return logs;
};

export const generateMockData = () => {
  const activity = createActivity();
  const dropConfigs = createDropConfigs(activity.id);
  const leaderboards = createLeaderboards(activity.id);
  const rewards = createRewards(activity.id, dropConfigs, leaderboards);
  const missedRewards = createMissedRewards(rewards);
  const operationLogs = createOperationLogs(activity, dropConfigs, leaderboards, rewards);

  return {
    activity,
    dropConfigs,
    leaderboards,
    rewards,
    missedRewards,
    operationLogs,
  };
};

export type MockData = ReturnType<typeof generateMockData>;
