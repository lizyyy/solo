import { Action, Facility, GameEvent, Location, Resources } from '../types';

export const INITIAL_RESOURCES: Resources = {
  food: 30,
  water: 50,
  energy: 100,
  spirit: 70,
  toolDurability: 50,
  safety: 30,
};

export const MAX_RESOURCES: Resources = {
  food: 100,
  water: 100,
  energy: 100,
  spirit: 100,
  toolDurability: 100,
  safety: 100,
};

export const INITIAL_LOCATIONS: Location[] = [
  {
    id: 'beach',
    name: '海滩',
    description: '你醒来的地方。沙滩上散落着一些沉船残骸。',
    explored: true,
    explorationProgress: 100,
    maxProgress: 100,
    availableActions: ['search_wreckage', 'find_water', 'build_shelter', 'make_fire'],
    discovered: true,
  },
  {
    id: 'forest',
    name: '森林',
    description: '茂密的丛林，可能藏有水源和食物。',
    explored: false,
    explorationProgress: 0,
    maxProgress: 100,
    availableActions: ['explore_forest', 'collect_wood', 'find_food', 'find_water_forest'],
    discovered: true,
  },
  {
    id: 'cave',
    name: '洞穴',
    description: '阴暗潮湿的洞穴，可能有危险，但也可能提供庇护。',
    explored: false,
    explorationProgress: 0,
    maxProgress: 100,
    availableActions: ['explore_cave', 'find_water_cave'],
    discovered: false,
  },
  {
    id: 'cliff',
    name: '悬崖',
    description: '高耸的悬崖，可以俯瞰整个岛屿，是发信号的好地方。',
    explored: false,
    explorationProgress: 0,
    maxProgress: 100,
    availableActions: ['explore_cliff', 'send_signal'],
    discovered: false,
  },
  {
    id: 'stream',
    name: '溪流',
    description: '发现了一条清澈的溪流！',
    explored: false,
    explorationProgress: 0,
    maxProgress: 100,
    availableActions: ['collect_water', 'set_trap', 'fish'],
    discovered: false,
  },
];

export const INITIAL_FACILITIES: Facility[] = [
  {
    id: 'shelter',
    name: '庇护所',
    description: '遮风挡雨的简易帐篷或棚屋',
    level: 0,
    maxLevel: 3,
    built: false,
    effects: {
      resources: { safety: 10, spirit: 5 },
      description: '提供基本的安全保障，每级增加10点安全值和5点精神值',
    },
  },
  {
    id: 'fire',
    name: '火堆',
    description: '可以取暖、烹饪和驱赶野兽',
    level: 0,
    maxLevel: 2,
    built: false,
    effects: {
      resources: { safety: 5, spirit: 10 },
      description: '提供安全和心理慰藉，每级增加5点安全值和10点精神值',
    },
  },
  {
    id: 'storage',
    name: '储物区',
    description: '可以存放更多物资',
    level: 0,
    maxLevel: 2,
    built: false,
    effects: {
      resources: {},
      description: '增加资源上限，每级增加20点最大资源',
    },
  },
  {
    id: 'garden',
    name: '菜园',
    description: '种植粮食的地方',
    level: 0,
    maxLevel: 3,
    built: false,
    effects: {
      resources: { food: 5 },
      description: '每天产出食物，每级增加5点食物',
    },
  },
  {
    id: 'signal',
    name: '信号塔',
    description: '用于发送求救信号',
    level: 0,
    maxLevel: 3,
    built: false,
    effects: {
      resources: {},
      description: '提高被救援的几率，每级增加10%救援成功率',
    },
  },
];

export const ACTIONS: Action[] = [
  {
    id: 'search_wreckage',
    name: '搜索残骸',
    description: '在沉船残骸中寻找有用的物资',
    actionPoints: 2,
    energyCost: 15,
    location: 'beach',
    requirements: {
      toolDurability: 5,
    },
    effects: {
      resources: { toolDurability: -5, spirit: 5 },
      description: '在残骸中找到了一些物资！',
    },
  },
  {
    id: 'find_water',
    name: '寻找水源',
    description: '在海滩附近寻找淡水',
    actionPoints: 2,
    energyCost: 20,
    location: 'beach',
    requirements: {},
    effects: {
      resources: { water: 10, energy: -10 },
      description: '发现了一些淡水！',
    },
  },
  {
    id: 'build_shelter',
    name: '搭建庇护所',
    description: '开始建造或升级庇护所',
    actionPoints: 3,
    energyCost: 25,
    location: 'beach',
    requirements: {
      inventory: [{ itemId: 'wood', quantity: 5 }],
    },
    effects: {
      resources: { energy: -20, spirit: 10 },
      facilityProgress: { facilityId: 'shelter', progress: 35 },
      description: '在建造庇护所上取得了进展',
    },
  },
  {
    id: 'make_fire',
    name: '取火',
    description: '尝试钻木取火',
    actionPoints: 2,
    energyCost: 20,
    location: 'beach',
    requirements: {
      inventory: [{ itemId: 'wood', quantity: 3 }, { itemId: 'tinder', quantity: 1 }],
      toolDurability: 10,
    },
    effects: {
      resources: { toolDurability: -10, spirit: 20, safety: 10 },
      facilityProgress: { facilityId: 'fire', progress: 50 },
      description: '成功生起了火堆！',
    },
  },
  {
    id: 'explore_forest',
    name: '探索森林',
    description: '深入森林，可能发现新的地点或资源',
    actionPoints: 3,
    energyCost: 25,
    location: 'forest',
    requirements: {},
    effects: {
      resources: { energy: -15, spirit: 5 },
      locationProgress: { locationId: 'forest', progress: 25 },
      description: '在森林中探索',
    },
  },
  {
    id: 'collect_wood',
    name: '采集木材',
    description: '收集建造用的木材',
    actionPoints: 2,
    energyCost: 15,
    location: 'forest',
    requirements: {
      toolDurability: 5,
    },
    effects: {
      resources: { toolDurability: -5 },
      inventory: [{ itemId: 'wood', quantity: 4 }],
      description: '收集了一些木材',
    },
  },
  {
    id: 'find_food',
    name: '寻找食物',
    description: '在森林中寻找可食用的植物或小动物',
    actionPoints: 2,
    energyCost: 20,
    location: 'forest',
    requirements: {},
    effects: {
      resources: { food: 8, energy: -10 },
      description: '找到了一些食物！',
    },
  },
  {
    id: 'find_water_forest',
    name: '寻找溪流',
    description: '在森林中寻找水源',
    actionPoints: 3,
    energyCost: 25,
    location: 'forest',
    requirements: {},
    effects: {
      resources: { water: 5, energy: -15 },
      description: '似乎听到了水流声...',
    },
  },
  {
    id: 'explore_cave',
    name: '探索洞穴',
    description: '小心地探索黑暗的洞穴',
    actionPoints: 3,
    energyCost: 30,
    location: 'cave',
    requirements: {
      resources: { energy: 40 },
    },
    effects: {
      resources: { energy: -25, spirit: -10 },
      locationProgress: { locationId: 'cave', progress: 30 },
      description: '洞穴中很黑，让人感到不安...',
    },
  },
  {
    id: 'find_water_cave',
    name: '收集洞内水',
    description: '从洞穴中的水洼收集淡水',
    actionPoints: 2,
    energyCost: 15,
    location: 'cave',
    requirements: {},
    effects: {
      resources: { water: 15, spirit: -5 },
      description: '收集到了洞穴中的淡水',
    },
  },
  {
    id: 'explore_cliff',
    name: '攀爬悬崖',
    description: '小心翼翼地爬上悬崖',
    actionPoints: 3,
    energyCost: 30,
    location: 'cliff',
    requirements: {
      resources: { energy: 50 },
      toolDurability: 10,
    },
    effects: {
      resources: { energy: -25, toolDurability: -10, spirit: 15 },
      locationProgress: { locationId: 'cliff', progress: 50 },
      description: '站在高处可以看到更远的海面...',
    },
  },
  {
    id: 'send_signal',
    name: '发送救援信号',
    description: '在悬崖顶部点燃信号火',
    actionPoints: 2,
    energyCost: 15,
    location: 'cliff',
    requirements: {
      inventory: [{ itemId: 'wood', quantity: 10 }, { itemId: 'tinder', quantity: 2 }],
      facility: { facilityId: 'fire', minLevel: 1 },
    },
    effects: {
      resources: { spirit: 20 },
      description: '信号火熊熊燃烧，希望能被船只看到...',
    },
  },
  {
    id: 'collect_water',
    name: '收集溪水',
    description: '从溪流中收集干净的淡水',
    actionPoints: 1,
    energyCost: 10,
    location: 'stream',
    requirements: {},
    effects: {
      resources: { water: 20, spirit: 10 },
      description: '收集到了清澈的溪水！',
    },
  },
  {
    id: 'set_trap',
    name: '设置陷阱',
    description: '在溪流附近设置陷阱捕获小动物',
    actionPoints: 2,
    energyCost: 15,
    location: 'stream',
    requirements: {
      inventory: [{ itemId: 'wood', quantity: 3 }],
      toolDurability: 5,
    },
    effects: {
      resources: { toolDurability: -5, food: 12 },
      description: '陷阱捕获了一些小动物！',
    },
  },
  {
    id: 'fish',
    name: '钓鱼',
    description: '在溪流中钓鱼',
    actionPoints: 2,
    energyCost: 10,
    location: 'stream',
    requirements: {
      inventory: [{ itemId: 'fishing_rod', quantity: 1 }],
    },
    effects: {
      resources: { food: 15, spirit: 5 },
      description: '钓到了几条鱼！',
    },
  },
  {
    id: 'write_journal',
    name: '写航海日志',
    description: '记录今天的经历和感受',
    actionPoints: 1,
    energyCost: 5,
    requirements: {},
    effects: {
      resources: { spirit: 10 },
      description: '写下了今天的日志，心情平静了一些',
    },
  },
  {
    id: 'rest',
    name: '休息',
    description: '坐下来休息，恢复体力',
    actionPoints: 1,
    energyCost: 0,
    requirements: {},
    effects: {
      resources: { energy: 25, spirit: 5 },
      description: '休息了一会儿，体力有所恢复',
    },
  },
  {
    id: 'repair_tools',
    name: '修理工具',
    description: '修复损坏的工具',
    actionPoints: 2,
    energyCost: 10,
    requirements: {
      inventory: [{ itemId: 'metal', quantity: 2 }],
    },
    effects: {
      resources: { toolDurability: 30, spirit: 5 },
      description: '工具修复了！',
    },
  },
  {
    id: 'plant_crops',
    name: '种植作物',
    description: '在菜园中种植粮食作物',
    actionPoints: 2,
    energyCost: 20,
    requirements: {
      inventory: [{ itemId: 'seeds', quantity: 1 }],
      facility: { facilityId: 'garden', minLevel: 1 },
    },
    effects: {
      resources: { energy: -15, spirit: 10 },
      description: '种子已播种，等待收获...',
    },
  },
];

export const EVENTS: GameEvent[] = [
  {
    id: 'storm_3',
    name: '暴风雨来袭',
    type: 'storm',
    triggerCondition: {
      type: 'day',
      value: 3,
      comparator: 'eq',
    },
    description: '天空阴沉，狂风大作，一场暴风雨即将来临！你需要决定如何应对。',
    choices: [
      {
        id: 'storm_hide',
        text: '躲进庇护所（需要已建造庇护所）',
        requirements: {
          facility: { facilityId: 'shelter', minLevel: 1 },
        },
        effects: {
          resources: { spirit: -10, safety: 5 },
          outcome: '你躲进了庇护所，虽然外面风雨交加，但你相对安全。',
        },
      },
      {
        id: 'storm_bear',
        text: '硬扛过去',
        requirements: {},
        effects: {
          resources: { health: -20, spirit: -25, safety: -15 },
          outcome: '你在风雨中艰难支撑，虽然活了下来，但损失惨重。',
        },
      },
      {
        id: 'storm_collect',
        text: '趁暴风雨收集淡水（高风险）',
        requirements: {
          resources: { energy: 30 },
        },
        effects: {
          resources: { water: 40, energy: -30, safety: -20 },
          outcome: '你冒着风险收集了大量淡水，但这让你筋疲力尽，而且暴露在危险中。',
        },
      },
    ],
    triggered: false,
  },
  {
    id: 'disease_7',
    name: '疾病侵袭',
    type: 'disease',
    triggerCondition: {
      type: 'day',
      value: 7,
      comparator: 'eq',
    },
    description: '你感到身体不适，发烧、乏力。可能是饮用了不干净的水，或者只是过度劳累。',
    choices: [
      {
        id: 'disease_rest',
        text: '卧床休息',
        requirements: {
          resources: { food: 15, water: 15 },
        },
        effects: {
          resources: { food: -15, water: -15, spirit: 10, energy: 30 },
          outcome: '你休息了一整天，身体慢慢恢复过来。',
        },
      },
      {
        id: 'disease_work',
        text: '带病继续工作',
        requirements: {},
        effects: {
          resources: { energy: -20, spirit: -15, safety: -10 },
          outcome: '你硬撑着继续工作，但身体状况急剧恶化。',
        },
      },
      {
        id: 'disease_herbs',
        text: '尝试用草药治疗（需要已探索森林）',
        requirements: {
          locationProgress: { locationId: 'forest', progress: 50 },
        },
        effects: {
          resources: { spirit: 15, energy: 20 },
          outcome: '你想起了一些草药知识，找到了一些有效的药草，身体很快康复了。',
        },
      },
    ],
    triggered: false,
  },
  {
    id: 'wreckage_5',
    name: '沉船残骸',
    type: 'wreck',
    triggerCondition: {
      type: 'day',
      value: 5,
      comparator: 'eq',
    },
    description: '你发现远处的海岸上有一些新的残骸被冲上岸！这可能是沉船的另一部分。',
    choices: [
      {
        id: 'wreck_search',
        text: '仔细搜索残骸',
        requirements: {
          resources: { energy: 20 },
          toolDurability: 10,
        },
        effects: {
          resources: { toolDurability: -10, energy: -15, spirit: 20, safety: 5 },
          inventory: [
            { itemId: 'rope', quantity: 2 },
            { itemId: 'metal', quantity: 3 },
            { itemId: 'tinder', quantity: 2 },
          ],
          outcome: '你找到了很多有用的物资：绳索、金属片、引火物，甚至还有一些罐头！',
        },
      },
      {
        id: 'wreck_quick',
        text: '快速查看，不浪费太多时间',
        requirements: {},
        effects: {
          resources: { energy: -10, spirit: 10 },
          inventory: [{ itemId: 'wood', quantity: 5 }],
          outcome: '你快速看了一下，找到了一些木材。',
        },
      },
      {
        id: 'wreck_ignore',
        text: '无视它，太危险了',
        requirements: {},
        effects: {
          resources: { spirit: -5 },
          outcome: '你决定不冒险，虽然可能错过了物资，但至少是安全的。',
        },
      },
    ],
    triggered: false,
  },
  {
    id: 'footprints_10',
    name: '神秘脚印',
    type: 'footprints',
    triggerCondition: {
      type: 'day',
      value: 10,
      comparator: 'eq',
    },
    description: '你在沙滩上发现了一串脚印！这不是你的脚印。岛上可能还有其他人...',
    choices: [
      {
        id: 'footprints_follow',
        text: '跟踪脚印',
        requirements: {
          resources: { energy: 30 },
          toolDurability: 15,
        },
        effects: {
          resources: { energy: -25, toolDurability: -10, spirit: 15 },
          outcome: '你小心翼翼地跟踪脚印，发现它们通向森林深处。这让你更加确信岛上还有其他人，但也感到一丝不安。',
        },
      },
      {
        id: 'footprints_hide',
        text: '躲藏起来，保持警惕',
        requirements: {
          facility: { facilityId: 'shelter', minLevel: 1 },
        },
        effects: {
          resources: { safety: 10, spirit: -10 },
          outcome: '你躲进了庇护所，保持警惕。虽然安全，但你不知道脚印是谁留下的，这让你心神不宁。',
        },
      },
      {
        id: 'footprints_signal',
        text: '尝试留下友好的信号',
        requirements: {},
        effects: {
          resources: { spirit: 10 },
          outcome: '你用石头在沙滩上摆出了"HELLO"的字样。希望留下脚印的人能看到，并且是友好的。',
        },
      },
    ],
    triggered: false,
  },
  {
    id: 'friday_14',
    name: '遇到星期五',
    type: 'friday',
    triggerCondition: {
      type: 'day',
      value: 14,
      comparator: 'eq',
    },
    description: '你看到一个野人正在被追捕！他看起来是个俘虏，正在被其他野人追赶。你该怎么办？',
    choices: [
      {
        id: 'friday_save',
        text: '挺身而出，救下他',
        requirements: {
          resources: { energy: 40 },
          toolDurability: 20,
          facility: { facilityId: 'fire', minLevel: 1 },
        },
        effects: {
          resources: { energy: -30, toolDurability: -15, spirit: 30, safety: 15 },
          outcome: '你用火把和大声喊叫吓跑了追捕者。被救的人非常感激，他表示愿意跟随你，成为你的同伴。你叫他"星期五"。',
        },
      },
      {
        id: 'friday_observe',
        text: '远远观察，不介入',
        requirements: {},
        effects: {
          resources: { spirit: -15, safety: 5 },
          outcome: '你躲在灌木丛中看着这一切发生。虽然你没有冒险，但看着一个人陷入困境却无能为力，这让你感到非常不安。',
        },
      },
      {
        id: 'friday_fire',
        text: '用火制造混乱（风险高）',
        requirements: {
          facility: { facilityId: 'fire', minLevel: 1 },
          inventory: [{ itemId: 'wood', quantity: 10 }],
        },
        effects: {
          resources: { safety: -10, spirit: 5 },
          outcome: '你点燃了一大片灌木，制造了混乱。追捕者被吓跑了，但你不知道那个被救的人是否安全。你也不确定他是否会感激你这种"帮助"方式。',
        },
      },
    ],
    triggered: false,
  },
  {
    id: 'rescue_21',
    name: '救援信号被发现',
    type: 'rescue',
    triggerCondition: {
      type: 'day',
      value: 21,
      comparator: 'eq',
    },
    description: '你看到远处的海平面上有一艘船！它似乎正在接近岛屿。这是你获救的机会！',
    choices: [
      {
        id: 'rescue_signal',
        text: '在悬崖上点燃巨大的信号火（需要信号塔或已探索悬崖）',
        requirements: {
          inventory: [{ itemId: 'wood', quantity: 20 }, { itemId: 'tinder', quantity: 5 }],
          locationProgress: { locationId: 'cliff', progress: 80 },
        },
        effects: {
          resources: { spirit: 40 },
          outcome: '你在悬崖顶部点燃了巨大的信号火，浓烟滚滚。船上的人看到了信号，正在向岛屿驶来！你成功获救了！',
        },
      },
      {
        id: 'rescue_wave',
        text: '在海滩上挥舞衣物并大声呼救',
        requirements: {},
        effects: {
          resources: { energy: -20, spirit: 20 },
          outcome: '你疯狂地挥舞着衣物并大声呼救。船似乎注意到了你，正在转向...但它离得还很远。你能做的只有等待和继续发出信号。',
        },
      },
      {
        id: 'rescue_nothing',
        text: '什么都不做，让船通过',
        requirements: {},
        effects: {
          resources: { spirit: -40, safety: -20 },
          outcome: '你看着船从远处经过，逐渐消失在地平线上。你错过了一个极好的救援机会，这让你感到绝望。',
        },
      },
    ],
    triggered: false,
  },
  {
    id: 'random_low_food',
    name: '饥饿难耐',
    type: 'random',
    triggerCondition: {
      type: 'resource',
      value: 15,
      comparator: 'lte',
    },
    description: '饥饿感越来越强烈，你的肚子咕咕叫个不停。你必须尽快找到食物。',
    choices: [
      {
        id: 'lowfood_search',
        text: '冒险出去寻找食物',
        requirements: {
          resources: { energy: 20 },
        },
        effects: {
          resources: { food: 12, energy: -15, safety: -5 },
          outcome: '你成功找到了一些可食用的植物和野果。虽然不是很丰盛，但暂时缓解了饥饿。',
        },
      },
      {
        id: 'lowfood_rest',
        text: '减少活动，保存体力',
        requirements: {},
        effects: {
          resources: { energy: -10, spirit: -10 },
          outcome: '你决定减少活动来保存体力。虽然这样可以延缓饥饿的消耗，但这不是长久之计。',
        },
      },
    ],
    triggered: false,
  },
  {
    id: 'random_low_spirit',
    name: '孤独抑郁',
    type: 'random',
    triggerCondition: {
      type: 'resource',
      value: 30,
      comparator: 'lte',
    },
    description: '孤独感如潮水般涌来，你开始怀疑自己是否能活着离开这个岛。',
    choices: [
      {
        id: 'lowspirit_journal',
        text: '写日记，记录自己的感受',
        requirements: {},
        effects: {
          resources: { spirit: 20 },
          outcome: '你在日记中倾诉了自己的心声，这让你感到稍微轻松了一些。',
        },
      },
      {
        id: 'lowspirit_work',
        text: '埋头工作，用忙碌来忘记孤独',
        requirements: {
          resources: { energy: 30 },
        },
        effects: {
          resources: { spirit: 10, energy: -25, toolDurability: 5 },
          inventory: [{ itemId: 'wood', quantity: 8 }],
          outcome: '你用工作来麻痹自己。孤独感暂时被忙碌驱散，但你知道它还会回来。不过你确实完成了不少工作。',
        },
      },
    ],
    triggered: false,
  },
];
