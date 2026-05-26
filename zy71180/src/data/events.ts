import { GameEvent } from '../types/game';

export const eventPool: GameEvent[] = [
  {
    id: 'evt_001',
    title: '周末聚餐高峰',
    description: '本周末餐馆生意火爆，所有餐馆本回合产油量增加50%！',
    type: 'negative',
    effect: {
      type: 'oil_increase',
      value: 50,
    },
  },
  {
    id: 'evt_002',
    title: '市民投诉热线',
    description: '有市民反映闻到异味，投诉次数+1！',
    type: 'negative',
    effect: {
      type: 'complaint',
      value: 1,
    },
  },
  {
    id: 'evt_003',
    title: '车辆临时维修',
    description: '回收车需要临时检修，本回合最大行驶距离减少30%！',
    type: 'negative',
    effect: {
      type: 'capacity_change',
      value: -30,
    },
  },
  {
    id: 'evt_004',
    title: '道路施工',
    description: '部分道路封闭，本回合所有移动距离增加20%！',
    type: 'negative',
    effect: {
      type: 'road_block',
      value: 20,
    },
  },
  {
    id: 'evt_005',
    title: '环保奖励',
    description: '市环保局表彰你们的工作，获得+200分奖励！',
    type: 'positive',
    effect: {
      type: 'bonus_score',
      value: 200,
    },
  },
  {
    id: 'evt_006',
    title: '餐馆自查',
    description: '餐馆主动减少用油，本回合所有餐馆产油量减少30%！',
    type: 'positive',
    effect: {
      type: 'oil_increase',
      value: -30,
    },
  },
  {
    id: 'evt_007',
    title: '加班补贴',
    description: '司机愿意加班，本回合最大行驶距离增加25%！',
    type: 'positive',
    effect: {
      type: 'capacity_change',
      value: 25,
    },
  },
  {
    id: 'evt_008',
    title: '绿色通道',
    description: '交警为回收车开绿灯，本回合所有移动距离减少15%！',
    type: 'positive',
    effect: {
      type: 'road_block',
      value: -15,
    },
  },
  {
    id: 'evt_009',
    title: '媒体采访',
    description: '电视台报道你们的工作，获得+150分加分！',
    type: 'positive',
    effect: {
      type: 'bonus_score',
      value: 150,
    },
  },
  {
    id: 'evt_010',
    title: '设备升级',
    description: '临时借用大容量回收车，本回合车辆容量增加50%！',
    type: 'positive',
    effect: {
      type: 'capacity_change',
      value: 50,
    },
  },
  {
    id: 'evt_011',
    title: '暴雨天气',
    description: '暴雨导致路面湿滑，本回合移动距离增加30%！',
    type: 'negative',
    effect: {
      type: 'road_block',
      value: 30,
    },
  },
  {
    id: 'evt_012',
    title: '突发检查',
    description: '卫生部门突击检查，如果本回合有油桶溢出，额外+1次投诉！',
    type: 'neutral',
    effect: {
      type: 'complaint',
      value: 0,
    },
  },
];

export const getRandomEvent = (): GameEvent | null => {
  const randomIndex = Math.floor(Math.random() * eventPool.length);
  return eventPool[randomIndex];
};

export const shouldTriggerEvent = (probability: number): boolean => {
  return Math.random() < probability;
};
