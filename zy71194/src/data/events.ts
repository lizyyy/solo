import { GameEvent } from '../game/types';

export const EVENTS: GameEvent[] = [
  {
    id: 'event_001',
    title: '队员扭伤脚踝',
    description: '一名队员在行进中不慎扭伤脚踝，需要立即处理。',
    icon: '🦶',
    probability: 0.3,
    choices: [
      {
        text: '使用绷带包扎 (-1绷带)',
        effect: {
          health: -5,
          removeItems: ['bandage_001'],
          score: 10,
        },
      },
      {
        text: '服用止痛药后继续前进 (-1止痛药)',
        effect: {
          health: -10,
          removeItems: ['medicine_001'],
          actionPoints: -1,
          score: 5,
        },
      },
      {
        text: '原地休息',
        effect: {
          health: -20,
          actionPoints: -2,
          score: -10,
        },
      },
    ],
  },
  {
    id: 'event_002',
    title: '遭遇暴雨',
    description: '突然下起了暴雨，队伍需要紧急应对。',
    icon: '🌧️',
    probability: 0.25,
    choices: [
      {
        text: '搭建临时避雨棚 (-1工具)',
        effect: {
          health: 0,
          removeItems: ['tool_002'],
          actionPoints: -1,
          score: 15,
        },
      },
      {
        text: '冒雨前进',
        effect: {
          health: -15,
          score: -5,
        },
      },
      {
        text: '服用感冒药预防 (-1感冒药)',
        effect: {
          health: -5,
          removeItems: ['medicine_002'],
          score: 5,
        },
      },
    ],
  },
  {
    id: 'event_003',
    title: '发现迷路',
    description: '队伍发现偏离了原定路线，需要重新定位。',
    icon: '🧭',
    probability: 0.2,
    choices: [
      {
        text: '使用指南针定位 (-1工具)',
        effect: {
          removeItems: ['tool_001'],
          actionPoints: -1,
          score: 10,
        },
      },
      {
        text: '原路返回',
        effect: {
          actionPoints: -3,
          score: -15,
        },
      },
      {
        text: '凭感觉继续前进',
        effect: {
          actionPoints: -1,
          health: -10,
          score: -20,
        },
      },
    ],
  },
  {
    id: 'event_004',
    title: '队员中暑',
    description: '天气炎热，一名队员出现中暑症状。',
    icon: '☀️',
    probability: 0.2,
    choices: [
      {
        text: '服用解暑药并休息 (-1解暑药)',
        effect: {
          health: 5,
          removeItems: ['medicine_003'],
          actionPoints: -1,
          score: 15,
        },
      },
      {
        text: '物理降温后继续',
        effect: {
          health: -10,
          actionPoints: -2,
          score: 0,
        },
      },
      {
        text: '坚持前进',
        effect: {
          health: -30,
          score: -25,
        },
      },
    ],
  },
  {
    id: 'event_005',
    title: '发现野生草药',
    description: '在路边发现了一些可入药的野生草药。',
    icon: '🌿',
    probability: 0.15,
    choices: [
      {
        text: '采集草药 (+2草药)',
        effect: {
          addItems: [
            {
              id: 'medicine_004',
              name: '草药',
              type: 'medicine',
              weight: 0.1,
              quantity: 2,
              expiryTurn: 8,
              isExpired: false,
              description: '野外采集的草药，可用于简单治疗',
            },
          ],
          actionPoints: -1,
          score: 10,
        },
      },
      {
        text: '继续前进',
        effect: {
          score: 0,
        },
      },
    ],
  },
  {
    id: 'event_006',
    title: '遇到友好驴友',
    description: '路上遇到了其他友好的徒步队伍，愿意分享物资。',
    icon: '🤝',
    probability: 0.1,
    choices: [
      {
        text: '交换物资 (获得1绷带)',
        effect: {
          addItems: [
            {
              id: 'bandage_001',
              name: '绷带',
              type: 'bandage',
              weight: 0.2,
              quantity: 1,
              isExpired: false,
              description: '用于包扎伤口的弹性绷带',
            },
          ],
          score: 10,
        },
      },
      {
        text: '交流路线信息',
        effect: {
          actionPoints: 2,
          score: 5,
        },
      },
      {
        text: '礼貌告别',
        effect: {
          score: 0,
        },
      },
    ],
  },
  {
    id: 'event_007',
    title: '装备损坏',
    description: '背包的肩带断裂，需要紧急修复。',
    icon: '🎒',
    probability: 0.15,
    choices: [
      {
        text: '用工具修复 (-1工具)',
        effect: {
          removeItems: ['tool_003'],
          score: 10,
        },
      },
      {
        text: '丢弃部分物资减轻重量',
        effect: {
          health: -5,
          score: -10,
        },
      },
      {
        text: '勉强继续背负',
        effect: {
          health: -15,
          actionPoints: -2,
          score: -15,
        },
      },
    ],
  },
  {
    id: 'event_008',
    title: '夜间行军',
    description: '为了赶时间，队伍决定夜间行军。',
    icon: '🌙',
    probability: 0.15,
    choices: [
      {
        text: '使用手电筒照明 (-1工具)',
        effect: {
          removeItems: ['tool_004'],
          score: 5,
        },
      },
      {
        text: '摸黑前进',
        effect: {
          health: -20,
          score: -20,
        },
      },
      {
        text: '原地扎营休息',
        effect: {
          actionPoints: -2,
          health: 10,
          score: 0,
        },
      },
    ],
  },
];

export const getRandomEvent = (eventPool: string[]): GameEvent | null => {
  const availableEvents = EVENTS.filter(e => eventPool.includes(e.id));
  if (availableEvents.length === 0) return null;
  
  const rand = Math.random();
  let cumulative = 0;
  
  const totalProb = availableEvents.reduce((sum, e) => sum + e.probability, 0);
  
  for (const event of availableEvents) {
    cumulative += event.probability / totalProb;
    if (rand < cumulative) {
      return event;
    }
  }
  
  return availableEvents[0];
};
