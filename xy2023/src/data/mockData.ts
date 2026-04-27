import type { ConstitutionResult, FoodItem, UserProfile, Post, Comment, OutfitSuggestion } from '@/types';

export const constitutionQuestions = [
  {
    id: 1,
    question: '你的经血颜色通常是什么样的？',
    options: [
      { value: 'dark', label: '深红色或暗红色，有血块' },
      { value: 'normal', label: '鲜红色，量适中' },
      { value: 'light', label: '淡红色，量较少' },
      { value: 'bright', label: '鲜红色，量较多' }
    ]
  },
  {
    id: 2,
    question: '你的小腹在经期感觉如何？',
    options: [
      { value: 'cold', label: '发冷，喜欢用暖水袋热敷' },
      { value: 'normal', label: '没有特别感觉' },
      { value: 'sore', label: '坠胀感，腰酸背痛' },
      { value: 'burning', label: '有灼热感，烦躁不安' }
    ]
  },
  {
    id: 3,
    question: '你的怕冷情况如何？',
    options: [
      { value: 'cold', label: '特别怕冷，手脚冰凉' },
      { value: 'normal', label: '正常，不怕冷也不怕热' },
      { value: 'heat', label: '特别怕热，容易出汗' }
    ]
  },
  {
    id: 4,
    question: '你的大便情况如何？',
    options: [
      { value: 'loose', label: '经常腹泻或大便稀溏' },
      { value: 'normal', label: '正常，每天一次' },
      { value: 'constipation', label: '经常便秘，大便干燥' }
    ]
  },
  {
    id: 5,
    question: '你的精力状态如何？',
    options: [
      { value: 'fatigue', label: '容易疲劳，不想动' },
      { value: 'normal', label: '精力充沛' },
      { value: 'irritable', label: '容易烦躁，爱发脾气' }
    ]
  },
  {
    id: 6,
    question: '你喜欢喝什么温度的水？',
    options: [
      { value: 'warm', label: '只喝热水或温水' },
      { value: 'normal', label: '冷热都喝' },
      { value: 'cold', label: '喜欢喝冰水或冷饮' }
    ]
  }
];

export const constitutionResults: Record<string, ConstitutionResult> = {
  cold: {
    type: 'cold',
    name: '宫寒体质',
    description: '你的体质偏寒，需要特别注意保暖，避免受凉。',
    icon: '❄️',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    dietaryAdvice: {
      avoid: ['冰淇淋', '冰饮', '西瓜', '梨', '柚子', '螃蟹', '苦瓜', '绿豆'],
      recommend: ['生姜', '红糖', '红枣', '桂圆', '枸杞', '羊肉', '牛肉', '核桃']
    },
    footBathRecipe: {
      name: '温宫泡脚方',
      ingredients: ['生姜5片', '艾草15g', '花椒10粒', '红花5g'],
      steps: [
        '将所有材料放入锅中，加水煮沸',
        '转小火煮15-20分钟',
        '将水温调至40-45°C',
        '泡脚20-30分钟，至身体微微出汗'
      ],
      temperature: '40-45°C',
      duration: '20-30分钟',
      frequency: '每天1次，连续7天'
    },
    clothingAdvice: {
      keyAreas: ['腹部', '腰部', '脚部', '背部'],
      materials: ['羊毛', '羽绒', '加绒', '棉混纺'],
      tips: [
        '经期一定要穿高腰内裤，保护腹部',
        '避免穿露脐装、露腰装',
        '冬天注意脚部保暖，穿厚袜子',
        '空调房内常备一件外套'
      ]
    }
  },
  heat: {
    type: 'heat',
    name: '体热体质',
    description: '你的体质偏热，需要注意清热降火，避免辛辣刺激食物。',
    icon: '🔥',
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    dietaryAdvice: {
      avoid: ['辣椒', '花椒', '生姜', '大蒜', '羊肉', '狗肉', '荔枝', '龙眼'],
      recommend: ['绿豆', '冬瓜', '苦瓜', '黄瓜', '西瓜', '梨', '菊花', '金银花']
    },
    footBathRecipe: {
      name: '清热泡脚方',
      ingredients: ['菊花15g', '金银花15g', '薄荷10g'],
      steps: [
        '将菊花、金银花放入锅中，加水煮沸',
        '转小火煮10分钟',
        '关火后加入薄荷，焖5分钟',
        '将水温调至37-40°C',
        '泡脚15-20分钟'
      ],
      temperature: '37-40°C',
      duration: '15-20分钟',
      frequency: '每天1次或隔天1次'
    },
    clothingAdvice: {
      keyAreas: ['保持透气', '避免闷热'],
      materials: ['棉麻', '真丝', '纯棉', '透气针织'],
      tips: [
        '选择透气性好的衣物',
        '避免穿紧身不透气的衣物',
        '经期注意保持干爽',
        '避免长时间处于高温环境'
      ]
    }
  },
  qi_deficiency: {
    type: 'qi_deficiency',
    name: '气虚体质',
    description: '你的体质偏虚，需要注意补气养血，避免过度劳累。',
    icon: '💫',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    dietaryAdvice: {
      avoid: ['生冷食物', '油腻食物', '辛辣刺激'],
      recommend: ['黄芪', '党参', '红枣', '桂圆', '山药', '莲子', '芡实', '鸡肉']
    },
    footBathRecipe: {
      name: '补气泡脚方',
      ingredients: ['黄芪20g', '当归15g', '党参15g', '红枣5颗'],
      steps: [
        '将所有材料洗净，放入锅中',
        '加水浸泡30分钟',
        '大火煮沸后转小火煮30分钟',
        '将水温调至40-42°C',
        '泡脚25-30分钟'
      ],
      temperature: '40-42°C',
      duration: '25-30分钟',
      frequency: '每天1次，连续14天'
    },
    clothingAdvice: {
      keyAreas: ['保暖', '舒适', '避免束缚'],
      materials: ['纯棉', '柔软针织', '羊毛混纺'],
      tips: [
        '选择宽松舒适的衣物',
        '避免穿紧身束缚的衣物',
        '注意气候变化，及时增减衣物',
        '经期避免过度劳累，多休息'
      ]
    }
  }
};

export const foodItems: FoodItem[] = [
  {
    id: '1',
    name: '珍珠奶茶',
    category: 'beverage',
    canEat: false,
    coldLevel: 'cool',
    description: '奶茶通常是冷饮，且含咖啡因，可能加重痛经',
    tips: '可以选择热奶茶，少糖，不加冰',
    alternative: '热红茶、热牛奶、红糖姜茶'
  },
  {
    id: '2',
    name: '抹茶',
    category: 'beverage',
    canEat: false,
    coldLevel: 'neutral',
    description: '抹茶含咖啡因，可能加重经期不适和失眠',
    tips: '经期建议减少或避免抹茶饮品',
    alternative: '菊花茶、玫瑰花茶、红枣茶'
  },
  {
    id: '3',
    name: '咖啡',
    category: 'beverage',
    canEat: false,
    coldLevel: 'neutral',
    description: '咖啡因会加重乳房胀痛、焦虑，影响睡眠质量',
    tips: '经期完全避免咖啡，包括拿铁、卡布奇诺等',
    alternative: '热可可、热牛奶、花草茶'
  },
  {
    id: '4',
    name: '西瓜',
    category: 'fruit',
    canEat: false,
    coldLevel: 'cold',
    description: '西瓜性寒，可能导致子宫收缩，加重痛经',
    tips: '宫寒体质者经期绝对避免，体热者可少量食用',
    alternative: '苹果、葡萄、草莓（常温）'
  },
  {
    id: '5',
    name: '梨',
    category: 'fruit',
    canEat: false,
    coldLevel: 'cold',
    description: '梨性寒凉，可能加重宫寒症状',
    tips: '可以蒸梨或煮梨汤后食用',
    alternative: '桃子、樱桃、荔枝'
  },
  {
    id: '6',
    name: '柚子',
    category: 'fruit',
    canEat: false,
    coldLevel: 'cold',
    description: '柚子性寒，可能影响经血排出',
    tips: '经期避免，尤其是宫寒体质者',
    alternative: '橙子、柑橘（少量）'
  },
  {
    id: '7',
    name: '辣椒',
    category: 'vegetable',
    canEat: false,
    coldLevel: 'hot',
    description: '辣椒性热，可能加重经血量和炎症',
    tips: '体热体质者避免，宫寒者可少量',
    alternative: '青椒（不辣）、彩椒'
  },
  {
    id: '8',
    name: '螃蟹',
    category: 'seafood',
    canEat: false,
    coldLevel: 'cold',
    description: '螃蟹性寒，可能导致痛经加重',
    tips: '宫寒体质者绝对避免',
    alternative: '虾（适量）、鱼类'
  },
  {
    id: '9',
    name: '冰淇淋',
    category: 'snack',
    canEat: false,
    coldLevel: 'cold',
    description: '冰淇淋温度极低，直接刺激子宫',
    tips: '经期绝对避免',
    alternative: '热酸奶、温甜品'
  },
  {
    id: '10',
    name: '苹果',
    category: 'fruit',
    canEat: true,
    coldLevel: 'neutral',
    description: '苹果性平，富含维生素C和纤维素',
    tips: '常温食用最佳',
    alternative: '苹果是很好的选择'
  },
  {
    id: '11',
    name: '红枣',
    category: 'fruit',
    canEat: true,
    coldLevel: 'warm',
    description: '红枣性温，补气养血，经期佳品',
    tips: '可直接食用或泡水、煮汤',
    alternative: '桂圆、枸杞'
  },
  {
    id: '12',
    name: '生姜',
    category: 'vegetable',
    canEat: true,
    coldLevel: 'warm',
    description: '生姜性温，暖宫驱寒，缓解痛经',
    tips: '煮姜茶、炒菜时加入',
    alternative: '大蒜、葱白'
  },
  {
    id: '13',
    name: '红糖',
    category: 'snack',
    canEat: true,
    coldLevel: 'warm',
    description: '红糖性温，活血化瘀，缓解痛经',
    tips: '冲红糖水或加入姜茶中',
    alternative: '黑糖、冰糖（少量）'
  },
  {
    id: '14',
    name: '鸡蛋',
    category: 'other',
    canEat: true,
    coldLevel: 'neutral',
    description: '鸡蛋富含蛋白质，补充营养',
    tips: '煮鸡蛋、蒸蛋最佳，避免煎蛋',
    alternative: '鹌鹑蛋'
  },
  {
    id: '15',
    name: '菠菜',
    category: 'vegetable',
    canEat: true,
    coldLevel: 'neutral',
    description: '菠菜富含铁，预防贫血',
    tips: '焯水后食用，减少草酸',
    alternative: '苋菜、空心菜'
  },
  {
    id: '16',
    name: '草莓',
    category: 'fruit',
    canEat: true,
    coldLevel: 'neutral',
    description: '草莓富含维生素C，常温食用有益',
    tips: '常温食用，避免冷藏后直接吃',
    alternative: '蓝莓、树莓'
  }
];

export const foodDatabase = foodItems;

export const foodCategories = [
  { value: 'beverage', label: '饮品', icon: '🥤' },
  { value: 'fruit', label: '水果', icon: '🍎' },
  { value: 'snack', label: '零食', icon: '🍪' },
  { value: 'vegetable', label: '蔬菜', icon: '🥬' },
  { value: 'seafood', label: '海鲜', icon: '🦐' },
  { value: 'other', label: '其他', icon: '🍳' }
];

export const symptomInfo = {
  chest_pain: { name: '胸痛', icon: '💔', color: 'text-red-500' },
  abdominal_bloating: { name: '腹胀', icon: '🫁', color: 'text-orange-500' },
  acne: { name: '长痘', icon: '😤', color: 'text-yellow-500' },
  irritable: { name: '暴躁', icon: '😡', color: 'text-red-400' },
  fatigue: { name: '疲劳', icon: '😴', color: 'text-purple-400' },
  headache: { name: '头痛', icon: '🤕', color: 'text-blue-400' },
  back_pain: { name: '腰酸', icon: '🦵', color: 'text-gray-500' },
  cramps: { name: '痛经', icon: '💫', color: 'text-pink-500' }
};

export const moodEmojis = {
  happy: '😊',
  normal: '😌',
  sad: '😢',
  anxious: '😰',
  irritable: '😤'
};

export const moodNames = {
  happy: '开心',
  normal: '平静',
  sad: '低落',
  anxious: '焦虑',
  irritable: '易怒'
};

export const painLevelDescriptions = [
  { level: 0, name: '无痛', description: '完全没有感觉，和平时一样', emoji: '😊' },
  { level: 1, name: '轻微', description: '有轻微不适，但不影响正常生活', emoji: '😌' },
  { level: 2, name: '轻度', description: '有明显痛感，但可以忍受', emoji: '😐' },
  { level: 3, name: '中度', description: '疼痛明显，需要休息，影响活动', emoji: '😣' },
  { level: 4, name: '重度', description: '剧烈疼痛，难以忍受，需要药物', emoji: '😫' },
  { level: 5, name: '严重', description: '极度疼痛，无法活动，可能伴随呕吐', emoji: '🤕' }
];

export const painTypes = [
  { value: 'lower_abdomen', label: '小腹坠痛', icon: '🫁' },
  { value: 'lower_back', label: '腰酸背痛', icon: '🦵' },
  { value: 'headache', label: '头痛', icon: '🤕' },
  { value: 'breast', label: '胸痛', icon: '💔' }
];

export const checkInTypes = [
  { value: 'foot_bath', name: '泡脚', icon: '🛁' },
  { value: 'hot_compress', name: '热敷', icon: '🔥' },
  { value: 'early_sleep', name: '早睡', icon: '😴' },
  { value: 'brown_sugar', name: '喝红糖', icon: '☕' }
];

export const cyclePhaseInfo = {
  menstrual: { name: '月经期', color: 'bg-pink-100 text-pink-700', icon: '🩸' },
  follicular: { name: '卵泡期', color: 'bg-green-100 text-green-700', icon: '🌱' },
  ovulatory: { name: '排卵期', color: 'bg-blue-100 text-blue-700', icon: '🥚' },
  luteal: { name: '黄体期', color: 'bg-yellow-100 text-yellow-700', icon: '🌕' }
};

export const samplePosts: Post[] = [
  {
    id: '1',
    author: '小暖',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=xiaonuan',
    title: '分享我的红糖姜茶秘方，缓解痛经真的有效！',
    content: '姐妹们，我终于找到了一个超级有效的缓解痛经的方法！\n\n材料：\n- 老姜片5-6片\n- 红糖2勺\n- 红枣5颗去核\n- 桂圆干8颗\n\n做法：\n1. 所有材料放入锅中，加入500ml水\n2. 大火煮沸后转小火煮15分钟\n3. 趁热喝，喝完会感觉肚子暖暖的\n\n我每次经期第一天都会喝，真的能缓解很多！大家可以试试看～',
    images: [],
    tags: ['痛经缓解', '红糖姜茶', '暖宫'],
    likes: 128,
    isLiked: false,
    commentCount: 24,
    createdAt: '2024-01-15T10:30:00'
  },
  {
    id: '2',
    author: '月月舒',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=yueyueshu',
    title: '记录了3个月的痛经规律，分享给大家',
    content: '我用这个APP记录了3个月的经期情况，发现了一些规律：\n\n1. 每次经期前2天开始胸痛\n2. 经期第1-2天是疼痛高峰期（3-4级）\n3. 第3天开始缓解，第5天基本无痛\n4. 黄体期情绪波动最大\n\n建议大家也记录一下，了解自己的身体规律真的很重要！',
    images: [],
    tags: ['痛经记录', '周期规律', '自我观察'],
    likes: 86,
    isLiked: false,
    commentCount: 12,
    createdAt: '2024-01-14T15:20:00'
  },
  {
    id: '3',
    author: '养生达人',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=yangsheng',
    title: '体质测试结果是宫寒，分享我的调理心得',
    content: '刚做完体质测试，结果是宫寒体质。\n\n根据APP的建议，我现在：\n✅ 每天泡脚（生姜+艾草）\n✅ 早上喝一杯红糖姜茶\n✅ 穿高腰内裤，绝对不露腰\n✅ 经期完全避免冰饮\n\n坚持了2个月，这次痛经真的减轻了很多！姐妹们一起加油！',
    images: [],
    tags: ['宫寒调理', '泡脚养生', '体质测试'],
    likes: 256,
    isLiked: false,
    commentCount: 45,
    createdAt: '2024-01-13T09:15:00'
  },
  {
    id: '4',
    author: '新手妈妈',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=newmom',
    title: '生完孩子后经期变化很大，有人一样吗？',
    content: '生完宝宝后，我的经期变化好大：\n- 周期从28天变成35天\n- 经血量比以前多\n- 痛经反而减轻了一些\n\n问了医生说是正常的，身体需要时间恢复。\n\n有没有同款经历的姐妹？来聊聊～',
    images: [],
    tags: ['产后恢复', '经期变化', '经验分享'],
    likes: 67,
    isLiked: false,
    commentCount: 28,
    createdAt: '2024-01-12T20:45:00'
  }
];

export const sampleComments: Comment[] = [
  {
    id: 'c1',
    postId: '1',
    author: '暖宝宝',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nuannuan',
    content: '这个方法真的有效！我喝了之后确实缓解了很多',
    likes: 12,
    isLiked: false,
    replies: [],
    createdAt: '2024-01-15T12:00:00'
  },
  {
    id: 'c2',
    postId: '1',
    author: '月月',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=yueyue',
    content: '请问红糖用什么牌子的比较好？',
    likes: 5,
    isLiked: false,
    replies: [],
    createdAt: '2024-01-15T14:30:00'
  },
  {
    id: 'c3',
    postId: '2',
    author: '调理达人',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=tiaoli',
    content: '记录真的很重要！我也发现了自己的规律',
    likes: 8,
    isLiked: false,
    replies: [],
    createdAt: '2024-01-14T18:00:00'
  }
];

export const outfitSuggestions: OutfitSuggestion[] = [
  {
    phase: 'menstrual',
    tempRange: [-10, 0],
    tops: ['加绒保暖内衣', '厚羊毛衫', '高领毛衣'],
    bottoms: ['加绒厚棉裤', '羊毛裤', '保暖打底裤'],
    outerwear: ['长款羽绒服', '厚呢子大衣', '加厚棉服'],
    accessories: ['暖宝宝', '厚围巾', '手套', '帽子', '高腰保暖内裤', '加绒袜子'],
    warnings: ['绝对不能露腰露腹', '注意脚部保暖，穿厚袜子加棉鞋', '避免穿紧身裤影响血液循环', '外出时一定要戴好帽子围巾']
  },
  {
    phase: 'menstrual',
    tempRange: [0, 10],
    tops: ['加绒保暖内衣', '羊毛衫', '厚毛衣'],
    bottoms: ['加绒裤', '厚毛裤', '保暖打底裤'],
    outerwear: ['长款羽绒服', '厚大衣', '棉服'],
    accessories: ['暖宝宝', '围巾', '手套', '帽子', '高腰内裤'],
    warnings: ['绝对不能露腰露腹', '注意脚部保暖，穿厚袜子', '避免穿紧身裤影响血液循环']
  },
  {
    phase: 'menstrual',
    tempRange: [10, 20],
    tops: ['保暖内衣', '针织衫', '薄毛衣'],
    bottoms: ['打底裤', '厚裤袜', '长裤'],
    outerwear: ['风衣', '薄大衣', '夹棉外套'],
    accessories: ['暖宝宝', '披肩', '高腰内裤'],
    warnings: ['仍需注意腹部保暖', '早晚温差大，适时增减衣物', '避免穿露脚踝的裤子']
  },
  {
    phase: 'menstrual',
    tempRange: [20, 30],
    tops: ['棉质T恤', '薄针织衫', '衬衫'],
    bottoms: ['长裙', '宽松长裤', '棉质打底裤'],
    outerwear: ['薄外套', '开衫', '防晒衣'],
    accessories: ['小披肩', '高腰内裤'],
    warnings: ['即使天热也不要穿露脐装', '避免穿超短裙', '空调房内注意保暖']
  },
  {
    phase: 'menstrual',
    tempRange: [30, 45],
    tops: ['宽松棉质T恤', '透气衬衫', '薄款针织'],
    bottoms: ['宽松长裙', '阔腿裤', '棉质长裤'],
    outerwear: ['防晒衣', '薄开衫（空调房用）'],
    accessories: ['高腰内裤', '小披肩'],
    warnings: ['绝对不能穿露脐装', '避免超短裙、热裤', '空调房一定要披外套', '不要直接吹冷风']
  },
  {
    phase: 'follicular',
    tempRange: [-10, 15],
    tops: ['保暖内衣', '毛衣', '针织衫'],
    bottoms: ['长裤', '厚打底裤'],
    outerwear: ['大衣', '羽绒服'],
    accessories: ['围巾'],
    warnings: ['身体逐渐恢复，但仍需注意保暖']
  },
  {
    phase: 'follicular',
    tempRange: [15, 28],
    tops: ['T恤', '衬衫', '薄针织'],
    bottoms: ['牛仔裤', '长裙', '休闲裤'],
    outerwear: ['薄外套', '开衫'],
    accessories: [],
    warnings: ['可以适当穿着轻松舒适的衣物']
  },
  {
    phase: 'follicular',
    tempRange: [28, 45],
    tops: ['T恤', '衬衫', '薄款上衣'],
    bottoms: ['牛仔裤', '长裙', '休闲裤'],
    outerwear: ['防晒衣'],
    accessories: [],
    warnings: ['身体状态良好，可以穿自己喜欢的衣物']
  },
  {
    phase: 'ovulatory',
    tempRange: [-10, 35],
    tops: ['根据气温选择舒适的衣物'],
    bottoms: ['舒适为主'],
    outerwear: ['适时增减'],
    accessories: [],
    warnings: ['排卵期身体状态最佳，可以穿自己喜欢的衣服']
  },
  {
    phase: 'ovulatory',
    tempRange: [35, 45],
    tops: ['透气舒适的衣物'],
    bottoms: ['宽松舒适为主'],
    outerwear: ['防晒衣'],
    accessories: [],
    warnings: ['排卵期状态最佳，注意防晒即可']
  },
  {
    phase: 'luteal',
    tempRange: [-10, 15],
    tops: ['保暖内衣', '毛衣'],
    bottoms: ['保暖裤'],
    outerwear: ['厚外套'],
    accessories: ['暖宝宝', '披肩'],
    warnings: ['经前期，开始注意保暖', '避免穿紧身衣物']
  },
  {
    phase: 'luteal',
    tempRange: [15, 30],
    tops: ['舒适的T恤', '衬衫'],
    bottoms: ['宽松长裤', '长裙'],
    outerwear: ['薄外套', '开衫'],
    accessories: [],
    warnings: ['选择宽松舒适的衣物', '避免束缚感']
  },
  {
    phase: 'luteal',
    tempRange: [30, 45],
    tops: ['宽松T恤', '透气衬衫'],
    bottoms: ['宽松长裤', '长裙'],
    outerwear: ['防晒衣', '开衫（空调房用）'],
    accessories: [],
    warnings: ['选择宽松透气的衣物', '避免紧身束缚', '空调房注意保暖']
  }
];

export const relaxationTexts = [
  '深呼吸，现在的一切不适都会过去的。给自己一个温柔的拥抱。',
  '你正在经历的是正常的生理现象，你的身体很强大，它一直在照顾你。',
  '找一个舒适的姿势，闭上眼睛，想象温暖的阳光洒在你的小腹上。',
  '经期是身体自我调节的时期，让自己慢下来，好好休息。',
  '喝一杯温水，感受温暖从喉咙到胃部，慢慢扩散到全身。',
  '你的情绪波动是正常的，允许自己感受这些情绪，然后让它们自然流过。',
  '轻轻地按摩你的小腹，顺时针画圈，告诉自己：我会好起来的。',
  '记住，你不是一个人在经历这些，很多姐妹都和你一样。'
];

export const defaultUserProfile: UserProfile = {
  id: 'user-001',
  name: '用户',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=default',
  constitutionType: 'unknown',
  averageCycleLength: 28,
  averagePeriodLength: 5,
  lastPeriodStart: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  constitutionTestCompleted: false
};
