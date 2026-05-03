import { 
  Recipe, 
  Project, 
  StorageSlot, 
  ContainerType,
  SelectedRecipe,
  ExistingIngredient,
  Ingredient
} from '@shared/types';

export const SAMPLE_INGREDIENTS: Ingredient[] = [
  {
    id: 'ing-chicken-breast',
    name: '鸡胸肉',
    category: '肉类',
    allergens: [],
    defaultUnit: 'g',
    shelfLifeDays: { fresh: 3, refrigerated: 5, frozen: 90 },
    notes: '选择新鲜鸡胸肉，去除筋膜'
  },
  {
    id: 'ing-ground-beef',
    name: '牛肉馅',
    category: '肉类',
    allergens: [],
    defaultUnit: 'g',
    shelfLifeDays: { fresh: 2, refrigerated: 3, frozen: 90 }
  },
  {
    id: 'ing-shrimp',
    name: '虾仁',
    category: '肉类',
    allergens: ['海鲜'],
    defaultUnit: 'g',
    shelfLifeDays: { fresh: 2, refrigerated: 3, frozen: 180 }
  },
  {
    id: 'ing-egg',
    name: '鸡蛋',
    category: '蛋奶',
    allergens: ['鸡蛋'],
    defaultUnit: 'piece',
    shelfLifeDays: { fresh: 30, refrigerated: 45, frozen: 0 },
    notes: '室温下可保存约30天，冷藏可延长'
  },
  {
    id: 'ing-broccoli',
    name: '西兰花',
    category: '蔬菜',
    allergens: [],
    defaultUnit: 'g',
    shelfLifeDays: { fresh: 5, refrigerated: 7, frozen: 180 }
  },
  {
    id: 'ing-carrot',
    name: '胡萝卜',
    category: '蔬菜',
    allergens: [],
    defaultUnit: 'g',
    shelfLifeDays: { fresh: 14, refrigerated: 21, frozen: 180 }
  },
  {
    id: 'ing-onion',
    name: '洋葱',
    category: '蔬菜',
    allergens: [],
    defaultUnit: 'piece',
    shelfLifeDays: { fresh: 30, refrigerated: 45, frozen: 180 }
  },
  {
    id: 'ing-garlic',
    name: '大蒜',
    category: '蔬菜',
    allergens: [],
    defaultUnit: 'clove',
    shelfLifeDays: { fresh: 60, refrigerated: 90, frozen: 180 }
  },
  {
    id: 'ing-ginger',
    name: '姜',
    category: '蔬菜',
    allergens: [],
    defaultUnit: 'g',
    shelfLifeDays: { fresh: 14, refrigerated: 21, frozen: 180 }
  },
  {
    id: 'ing-tomato',
    name: '番茄',
    category: '蔬菜',
    allergens: [],
    defaultUnit: 'piece',
    shelfLifeDays: { fresh: 7, refrigerated: 10, frozen: 90 }
  },
  {
    id: 'ing-potato',
    name: '土豆',
    category: '蔬菜',
    allergens: [],
    defaultUnit: 'piece',
    shelfLifeDays: { fresh: 30, refrigerated: 45, frozen: 180 }
  },
  {
    id: 'ing-rice',
    name: '大米',
    category: '粮油',
    allergens: [],
    defaultUnit: 'g',
    shelfLifeDays: { fresh: 365, refrigerated: 365, frozen: 365 }
  },
  {
    id: 'ing-soy-sauce',
    name: '生抽',
    category: '调料',
    allergens: ['大豆'],
    defaultUnit: 'ml',
    shelfLifeDays: { fresh: 365, refrigerated: 365, frozen: 0 }
  },
  {
    id: 'ing-oyster-sauce',
    name: '蚝油',
    category: '调料',
    allergens: ['海鲜'],
    defaultUnit: 'ml',
    shelfLifeDays: { fresh: 180, refrigerated: 365, frozen: 0 }
  },
  {
    id: 'ing-cooking-wine',
    name: '料酒',
    category: '调料',
    allergens: [],
    defaultUnit: 'ml',
    shelfLifeDays: { fresh: 365, refrigerated: 365, frozen: 0 }
  },
  {
    id: 'ing-starch',
    name: '淀粉',
    category: '粮油',
    allergens: [],
    defaultUnit: 'g',
    shelfLifeDays: { fresh: 365, refrigerated: 365, frozen: 365 }
  },
  {
    id: 'ing-salt',
    name: '盐',
    category: '调料',
    allergens: [],
    defaultUnit: 'g',
    shelfLifeDays: { fresh: 730, refrigerated: 730, frozen: 730 }
  },
  {
    id: 'ing-pepper',
    name: '黑胡椒',
    category: '调料',
    allergens: [],
    defaultUnit: 'g',
    shelfLifeDays: { fresh: 365, refrigerated: 365, frozen: 365 }
  },
  {
    id: 'ing-oil',
    name: '食用油',
    category: '粮油',
    allergens: [],
    defaultUnit: 'ml',
    shelfLifeDays: { fresh: 180, refrigerated: 365, frozen: 0 }
  },
  {
    id: 'ing-green-onion',
    name: '葱花',
    category: '蔬菜',
    allergens: [],
    defaultUnit: 'g',
    shelfLifeDays: { fresh: 5, refrigerated: 7, frozen: 90 }
  }
];

export const SAMPLE_RECIPES: Recipe[] = [
  {
    id: 'recipe-garlic-chicken',
    name: '蒜香鸡胸肉',
    description: '简单快手的蒜香鸡胸肉，鲜嫩多汁，适合减脂期食用',
    servings: 2,
    prepTimeMinutes: 15,
    cookTimeMinutes: 10,
    ingredients: [
      {
        ingredientId: 'ing-chicken-breast',
        ingredientName: '鸡胸肉',
        quantity: 300,
        unit: 'g',
        notes: '切块',
        isOptional: false
      },
      {
        ingredientId: 'ing-garlic',
        ingredientName: '大蒜',
        quantity: 5,
        unit: 'clove',
        notes: '切末',
        isOptional: false
      },
      {
        ingredientId: 'ing-ginger',
        ingredientName: '姜',
        quantity: 10,
        unit: 'g',
        notes: '切丝',
        isOptional: false
      },
      {
        ingredientId: 'ing-soy-sauce',
        ingredientName: '生抽',
        quantity: 15,
        unit: 'ml',
        isOptional: false
      },
      {
        ingredientId: 'ing-oyster-sauce',
        ingredientName: '蚝油',
        quantity: 10,
        unit: 'ml',
        isOptional: false
      },
      {
        ingredientId: 'ing-cooking-wine',
        ingredientName: '料酒',
        quantity: 10,
        unit: 'ml',
        isOptional: false
      },
      {
        ingredientId: 'ing-starch',
        ingredientName: '淀粉',
        quantity: 5,
        unit: 'g',
        isOptional: false
      },
      {
        ingredientId: 'ing-oil',
        ingredientName: '食用油',
        quantity: 20,
        unit: 'ml',
        isOptional: false
      },
      {
        ingredientId: 'ing-pepper',
        ingredientName: '黑胡椒',
        quantity: 2,
        unit: 'g',
        isOptional: true
      }
    ],
    prepSteps: [
      {
        id: 'step-1',
        stepNumber: 1,
        description: '鸡胸肉洗净，切成2cm见方的块',
        estimatedMinutes: 3,
        canBatch: true,
        dependencies: [],
        ingredients: ['ing-chicken-breast']
      },
      {
        id: 'step-2',
        stepNumber: 2,
        description: '大蒜切末，姜切丝',
        estimatedMinutes: 2,
        canBatch: true,
        dependencies: [],
        ingredients: ['ing-garlic', 'ing-ginger']
      },
      {
        id: 'step-3',
        stepNumber: 3,
        description: '鸡胸肉加入生抽、蚝油、料酒、淀粉腌制10分钟',
        estimatedMinutes: 12,
        canBatch: true,
        dependencies: ['step-1'],
        ingredients: ['ing-chicken-breast', 'ing-soy-sauce', 'ing-oyster-sauce', 'ing-cooking-wine', 'ing-starch']
      },
      {
        id: 'step-4',
        stepNumber: 4,
        description: '热锅倒油，放入蒜末姜丝爆香',
        estimatedMinutes: 2,
        canBatch: false,
        dependencies: ['step-2'],
        ingredients: ['ing-garlic', 'ing-ginger', 'ing-oil']
      },
      {
        id: 'step-5',
        stepNumber: 5,
        description: '放入腌制好的鸡胸肉，中火翻炒至变色熟透',
        estimatedMinutes: 6,
        canBatch: false,
        dependencies: ['step-3', 'step-4'],
        ingredients: ['ing-chicken-breast']
      },
      {
        id: 'step-6',
        stepNumber: 6,
        description: '撒上黑胡椒调味，出锅装盘',
        estimatedMinutes: 1,
        canBatch: false,
        dependencies: ['step-5'],
        ingredients: ['ing-pepper']
      }
    ],
    storageInstructions: {
      storageType: 'refrigerated',
      shelfLifeDays: 4,
      reheatMethod: 'microwave',
      notes: '冷藏保存，食用前用微波炉加热2-3分钟'
    },
    category: '肉类',
    tags: ['快手菜', '减脂', '鸡肉'],
    notes: '腌制时间越长越入味，但不要超过30分钟'
  },
  {
    id: 'recipe-broccoli-shrimp',
    name: '西兰花炒虾仁',
    description: '清爽健康的西兰花炒虾仁，营养均衡',
    servings: 2,
    prepTimeMinutes: 20,
    cookTimeMinutes: 8,
    ingredients: [
      {
        ingredientId: 'ing-shrimp',
        ingredientName: '虾仁',
        quantity: 200,
        unit: 'g',
        notes: '去壳去虾线',
        isOptional: false
      },
      {
        ingredientId: 'ing-broccoli',
        ingredientName: '西兰花',
        quantity: 250,
        unit: 'g',
        notes: '切小朵',
        isOptional: false
      },
      {
        ingredientId: 'ing-garlic',
        ingredientName: '大蒜',
        quantity: 3,
        unit: 'clove',
        notes: '切末',
        isOptional: false
      },
      {
        ingredientId: 'ing-ginger',
        ingredientName: '姜',
        quantity: 5,
        unit: 'g',
        notes: '切片',
        isOptional: false
      },
      {
        ingredientId: 'ing-soy-sauce',
        ingredientName: '生抽',
        quantity: 10,
        unit: 'ml',
        isOptional: false
      },
      {
        ingredientId: 'ing-oyster-sauce',
        ingredientName: '蚝油',
        quantity: 15,
        unit: 'ml',
        isOptional: false
      },
      {
        ingredientId: 'ing-cooking-wine',
        ingredientName: '料酒',
        quantity: 5,
        unit: 'ml',
        isOptional: false
      },
      {
        ingredientId: 'ing-starch',
        ingredientName: '淀粉',
        quantity: 3,
        unit: 'g',
        isOptional: false
      },
      {
        ingredientId: 'ing-oil',
        ingredientName: '食用油',
        quantity: 15,
        unit: 'ml',
        isOptional: false
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: '盐',
        quantity: 2,
        unit: 'g',
        isOptional: true
      }
    ],
    prepSteps: [
      {
        id: 'step-1',
        stepNumber: 1,
        description: '虾仁去壳去虾线，用料酒腌制5分钟',
        estimatedMinutes: 8,
        canBatch: true,
        dependencies: [],
        ingredients: ['ing-shrimp', 'ing-cooking-wine']
      },
      {
        id: 'step-2',
        stepNumber: 2,
        description: '西兰花切小朵，洗净备用',
        estimatedMinutes: 3,
        canBatch: true,
        dependencies: [],
        ingredients: ['ing-broccoli']
      },
      {
        id: 'step-3',
        stepNumber: 3,
        description: '大蒜切末，姜切片',
        estimatedMinutes: 2,
        canBatch: true,
        dependencies: [],
        ingredients: ['ing-garlic', 'ing-ginger']
      },
      {
        id: 'step-4',
        stepNumber: 4,
        description: '烧开水，加少许盐，西兰花焯水1分钟捞出',
        estimatedMinutes: 4,
        canBatch: false,
        dependencies: ['step-2'],
        ingredients: ['ing-broccoli', 'ing-salt']
      },
      {
        id: 'step-5',
        stepNumber: 5,
        description: '热锅倒油，放入姜片蒜末爆香',
        estimatedMinutes: 2,
        canBatch: false,
        dependencies: ['step-3'],
        ingredients: ['ing-garlic', 'ing-ginger', 'ing-oil']
      },
      {
        id: 'step-6',
        stepNumber: 6,
        description: '放入虾仁翻炒至变色',
        estimatedMinutes: 3,
        canBatch: false,
        dependencies: ['step-1', 'step-5'],
        ingredients: ['ing-shrimp']
      },
      {
        id: 'step-7',
        stepNumber: 7,
        description: '加入西兰花，淋入生抽、蚝油，翻炒均匀',
        estimatedMinutes: 2,
        canBatch: false,
        dependencies: ['step-4', 'step-6'],
        ingredients: ['ing-broccoli', 'ing-soy-sauce', 'ing-oyster-sauce']
      },
      {
        id: 'step-8',
        stepNumber: 8,
        description: '淀粉加水调成水淀粉，淋入勾芡即可出锅',
        estimatedMinutes: 1,
        canBatch: false,
        dependencies: ['step-7'],
        ingredients: ['ing-starch']
      }
    ],
    storageInstructions: {
      storageType: 'refrigerated',
      shelfLifeDays: 3,
      reheatMethod: 'stovetop',
      notes: '虾仁冷藏容易出水，建议尽快食用，复热时用炉灶快炒'
    },
    category: '海鲜',
    tags: ['健康', '海鲜', '蔬菜'],
    notes: '西兰花焯水时间不宜过长，保持脆嫩口感'
  },
  {
    id: 'recipe-tomato-egg',
    name: '番茄炒蛋',
    description: '经典家常菜，酸甜可口，百吃不腻',
    servings: 2,
    prepTimeMinutes: 10,
    cookTimeMinutes: 8,
    ingredients: [
      {
        ingredientId: 'ing-egg',
        ingredientName: '鸡蛋',
        quantity: 3,
        unit: 'piece',
        isOptional: false
      },
      {
        ingredientId: 'ing-tomato',
        ingredientName: '番茄',
        quantity: 2,
        unit: 'piece',
        notes: '中等大小',
        isOptional: false
      },
      {
        ingredientId: 'ing-green-onion',
        ingredientName: '葱花',
        quantity: 10,
        unit: 'g',
        isOptional: true
      },
      {
        ingredientId: 'ing-oil',
        ingredientName: '食用油',
        quantity: 30,
        unit: 'ml',
        isOptional: false
      },
      {
        ingredientId: 'ing-salt',
        ingredientName: '盐',
        quantity: 3,
        unit: 'g',
        isOptional: false
      },
      {
        ingredientId: 'ing-soy-sauce',
        ingredientName: '生抽',
        quantity: 5,
        unit: 'ml',
        isOptional: true
      }
    ],
    prepSteps: [
      {
        id: 'step-1',
        stepNumber: 1,
        description: '番茄洗净切块，葱花切好备用',
        estimatedMinutes: 3,
        canBatch: true,
        dependencies: [],
        ingredients: ['ing-tomato', 'ing-green-onion']
      },
      {
        id: 'step-2',
        stepNumber: 2,
        description: '鸡蛋打散，加少许盐搅匀',
        estimatedMinutes: 1,
        canBatch: false,
        dependencies: [],
        ingredients: ['ing-egg', 'ing-salt']
      },
      {
        id: 'step-3',
        stepNumber: 3,
        description: '热锅多倒油，油温六成热倒入蛋液，快速划散成块，盛出备用',
        estimatedMinutes: 2,
        canBatch: false,
        dependencies: ['step-2'],
        ingredients: ['ing-egg', 'ing-oil']
      },
      {
        id: 'step-4',
        stepNumber: 4,
        description: '锅中留底油，放入番茄块翻炒出汁',
        estimatedMinutes: 3,
        canBatch: false,
        dependencies: ['step-1'],
        ingredients: ['ing-tomato', 'ing-oil']
      },
      {
        id: 'step-5',
        stepNumber: 5,
        description: '番茄出汁后加盐调味，淋入少许生抽',
        estimatedMinutes: 1,
        canBatch: false,
        dependencies: ['step-4'],
        ingredients: ['ing-salt', 'ing-soy-sauce']
      },
      {
        id: 'step-6',
        stepNumber: 6,
        description: '倒入炒好的鸡蛋，翻炒均匀，撒上葱花即可出锅',
        estimatedMinutes: 1,
        canBatch: false,
        dependencies: ['step-3', 'step-5'],
        ingredients: ['ing-egg', 'ing-green-onion']
      }
    ],
    storageInstructions: {
      storageType: 'refrigerated',
      shelfLifeDays: 2,
      reheatMethod: 'microwave',
      notes: '鸡蛋不宜冷藏过久，建议2天内食用完毕'
    },
    category: '素菜',
    tags: ['经典', '快手', '素菜'],
    notes: '想让番茄出汁更多，可以先用开水烫去皮'
  },
  {
    id: 'recipe-beef-potato',
    name: '土豆炖牛肉',
    description: '浓郁入味的家常炖菜，适合冷冻保存',
    servings: 4,
    prepTimeMinutes: 30,
    cookTimeMinutes: 60,
    ingredients: [
      {
        ingredientId: 'ing-ground-beef',
        ingredientName: '牛肉馅',
        quantity: 400,
        unit: 'g',
        notes: '或牛肉块',
        isOptional: false
      },
      {
        ingredientId: 'ing-potato',
        ingredientName: '土豆',
        quantity: 2,
        unit: 'piece',
        notes: '中等大小，切块',
        isOptional: false
      },
      {
        ingredientId: 'ing-carrot',
        ingredientName: '胡萝卜',
        quantity: 1,
        unit: 'piece',
        notes: '切块',
        isOptional: false
      },
      {
        ingredientId: 'ing-onion',
        ingredientName: '洋葱',
        quantity: 1,
        unit: 'piece',
        notes: '切块',
        isOptional: false
      },
      {
        ingredientId: 'ing-garlic',
        ingredientName: '大蒜',
        quantity: 4,
        unit: 'clove',
        notes: '切末',
        isOptional: false
      },
      {
        ingredientId: 'ing-ginger',
        ingredientName: '姜',
        quantity: 15,
        unit: 'g',
        notes: '切片',
        isOptional: false
      },
      {
        ingredientId: 'ing-soy-sauce',
        ingredientName: '生抽',
        quantity: 30,
        unit: 'ml',
        isOptional: false
      },
      {
        ingredientId: 'ing-oyster-sauce',
        ingredientName: '蚝油',
        quantity: 15,
        unit: 'ml',
        isOptional: false
      },
      {
        ingredientId: 'ing-cooking-wine',
        ingredientName: '料酒',
        quantity: 20,
        unit: 'ml',
        isOptional: false
      },
      {
        ingredientId: 'ing-oil',
        ingredientName: '食用油',
        quantity: 30,
        unit: 'ml',
        isOptional: false
      },
      {
        ingredientId: 'ing-pepper',
        ingredientName: '黑胡椒',
        quantity: 3,
        unit: 'g',
        isOptional: true
      }
    ],
    prepSteps: [
      {
        id: 'step-1',
        stepNumber: 1,
        description: '牛肉用料酒、少许生抽腌制15分钟',
        estimatedMinutes: 20,
        canBatch: true,
        dependencies: [],
        ingredients: ['ing-ground-beef', 'ing-cooking-wine', 'ing-soy-sauce']
      },
      {
        id: 'step-2',
        stepNumber: 2,
        description: '土豆、胡萝卜、洋葱切块，泡入清水防止氧化',
        estimatedMinutes: 5,
        canBatch: true,
        dependencies: [],
        ingredients: ['ing-potato', 'ing-carrot', 'ing-onion']
      },
      {
        id: 'step-3',
        stepNumber: 3,
        description: '大蒜切末，姜切片',
        estimatedMinutes: 2,
        canBatch: true,
        dependencies: [],
        ingredients: ['ing-garlic', 'ing-ginger']
      },
      {
        id: 'step-4',
        stepNumber: 4,
        description: '热锅倒油，放入姜片蒜末爆香',
        estimatedMinutes: 2,
        canBatch: false,
        dependencies: ['step-3'],
        ingredients: ['ing-garlic', 'ing-ginger', 'ing-oil']
      },
      {
        id: 'step-5',
        stepNumber: 5,
        description: '放入牛肉翻炒至变色',
        estimatedMinutes: 5,
        canBatch: false,
        dependencies: ['step-1', 'step-4'],
        ingredients: ['ing-ground-beef']
      },
      {
        id: 'step-6',
        stepNumber: 6,
        description: '加入洋葱块炒软',
        estimatedMinutes: 3,
        canBatch: false,
        dependencies: ['step-2', 'step-5'],
        ingredients: ['ing-onion']
      },
      {
        id: 'step-7',
        stepNumber: 7,
        description: '加入生抽、蚝油调味，加入没过食材的热水',
        estimatedMinutes: 2,
        canBatch: false,
        dependencies: ['step-6'],
        ingredients: ['ing-soy-sauce', 'ing-oyster-sauce']
      },
      {
        id: 'step-8',
        stepNumber: 8,
        description: '大火烧开后转小火炖30分钟',
        estimatedMinutes: 35,
        canBatch: false,
        dependencies: ['step-7'],
        ingredients: []
      },
      {
        id: 'step-9',
        stepNumber: 9,
        description: '加入土豆、胡萝卜块，继续炖20分钟至软烂',
        estimatedMinutes: 25,
        canBatch: false,
        dependencies: ['step-2', 'step-8'],
        ingredients: ['ing-potato', 'ing-carrot']
      },
      {
        id: 'step-10',
        stepNumber: 10,
        description: '大火收汁，撒上黑胡椒调味即可出锅',
        estimatedMinutes: 5,
        canBatch: false,
        dependencies: ['step-9'],
        ingredients: ['ing-pepper']
      }
    ],
    storageInstructions: {
      storageType: 'frozen',
      shelfLifeDays: 30,
      reheatMethod: 'stovetop',
      notes: '适合冷冻保存，食用前提前解冻，用炉灶加热或蒸制'
    },
    category: '肉类',
    tags: ['炖菜', '冷冻', '下饭'],
    notes: '土豆切好后一定要泡入清水中，否则会氧化变黑'
  }
];

export const SAMPLE_CONTAINER_TYPES: ContainerType[] = [
  {
    id: 'container-glass-500',
    name: '玻璃保鲜盒 500ml',
    capacity: 500,
    capacityUnit: 'ml',
    isStackable: true,
    maxStackHeight: 3
  },
  {
    id: 'container-glass-1000',
    name: '玻璃保鲜盒 1000ml',
    capacity: 1000,
    capacityUnit: 'ml',
    isStackable: true,
    maxStackHeight: 2
  },
  {
    id: 'container-plastic-750',
    name: '塑料保鲜盒 750ml',
    capacity: 750,
    capacityUnit: 'ml',
    isStackable: true,
    maxStackHeight: 4
  }
];

export const SAMPLE_STORAGE_SLOTS: StorageSlot[] = [
  {
    id: 'slot-refrigerator-1',
    name: '冰箱冷藏上层',
    storageType: 'refrigerated',
    maxCapacity: 6,
    capacityUnit: '个',
    currentContainers: []
  },
  {
    id: 'slot-refrigerator-2',
    name: '冰箱冷藏下层',
    storageType: 'refrigerated',
    maxCapacity: 8,
    capacityUnit: '个',
    currentContainers: []
  },
  {
    id: 'slot-freezer-1',
    name: '冰箱冷冻抽屉1',
    storageType: 'frozen',
    maxCapacity: 10,
    capacityUnit: '个',
    currentContainers: []
  },
  {
    id: 'slot-freezer-2',
    name: '冰箱冷冻抽屉2',
    storageType: 'frozen',
    maxCapacity: 8,
    capacityUnit: '个',
    currentContainers: []
  }
];

export function createSampleProject(): Project {
  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setDate(targetDate.getDate() + 2);

  const selectedRecipes: SelectedRecipe[] = [
    {
      recipeId: 'recipe-garlic-chicken',
      recipeName: '蒜香鸡胸肉',
      targetServings: 4,
      multiplier: 2
    },
    {
      recipeId: 'recipe-broccoli-shrimp',
      recipeName: '西兰花炒虾仁',
      targetServings: 4,
      multiplier: 2
    },
    {
      recipeId: 'recipe-tomato-egg',
      recipeName: '番茄炒蛋',
      targetServings: 4,
      multiplier: 2
    },
    {
      recipeId: 'recipe-beef-potato',
      recipeName: '土豆炖牛肉',
      targetServings: 4,
      multiplier: 1
    }
  ];

  const existingIngredients: ExistingIngredient[] = [
    {
      ingredientId: 'ing-egg',
      ingredientName: '鸡蛋',
      quantity: 6,
      unit: 'piece',
      location: 'refrigerated'
    },
    {
      ingredientId: 'ing-garlic',
      ingredientName: '大蒜',
      quantity: 10,
      unit: 'clove',
      location: 'pantry'
    },
    {
      ingredientId: 'ing-ginger',
      ingredientName: '姜',
      quantity: 50,
      unit: 'g',
      location: 'refrigerated',
      expiryDate: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    {
      ingredientId: 'ing-soy-sauce',
      ingredientName: '生抽',
      quantity: 500,
      unit: 'ml',
      location: 'pantry'
    },
    {
      ingredientId: 'ing-oyster-sauce',
      ingredientName: '蚝油',
      quantity: 300,
      unit: 'ml',
      location: 'refrigerated'
    },
    {
      ingredientId: 'ing-cooking-wine',
      ingredientName: '料酒',
      quantity: 500,
      unit: 'ml',
      location: 'pantry'
    },
    {
      ingredientId: 'ing-starch',
      ingredientName: '淀粉',
      quantity: 200,
      unit: 'g',
      location: 'pantry'
    },
    {
      ingredientId: 'ing-oil',
      ingredientName: '食用油',
      quantity: 1000,
      unit: 'ml',
      location: 'pantry'
    },
    {
      ingredientId: 'ing-salt',
      ingredientName: '盐',
      quantity: 500,
      unit: 'g',
      location: 'pantry'
    },
    {
      ingredientId: 'ing-pepper',
      ingredientName: '黑胡椒',
      quantity: 50,
      unit: 'g',
      location: 'pantry'
    }
  ];

  return {
    id: 'project-sample-001',
    name: '周末备餐计划 - 下周午餐',
    description: '为下周工作日准备午餐，包含4道菜，共8份',
    createdDate: today.toISOString().split('T')[0],
    lastModifiedDate: today.toISOString().split('T')[0],
    targetDate: targetDate.toISOString().split('T')[0],
    selectedRecipes,
    existingIngredients,
    storageSlots: SAMPLE_STORAGE_SLOTS,
    shoppingList: [],
    prepTasks: [],
    batchGroups: [],
    storedContainers: [],
    risks: []
  };
}
