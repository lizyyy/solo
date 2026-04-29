import { Category, Item, CategoryType } from '../types';

export const categories: Category[] = [
  {
    id: 'food',
    name: '食饮',
    icon: '🍪',
    color: 'bg-orange-100 text-orange-600',
    description: '美味的零食、糖果、饮料等',
  },
  {
    id: 'home',
    name: '居家',
    icon: '🏠',
    color: 'bg-blue-100 text-blue-600',
    description: '杯子、蜡烛、雨伞等居家用品',
  },
  {
    id: 'wear',
    name: '穿戴',
    icon: '✨',
    color: 'bg-pink-100 text-pink-600',
    description: '发卡、饰品等穿戴物品',
  },
  {
    id: 'daily',
    name: '日化',
    icon: '🧴',
    color: 'bg-green-100 text-green-600',
    description: '香皂、牙膏、香水等日用品',
  },
  {
    id: 'misc',
    name: '杂货',
    icon: '📦',
    color: 'bg-purple-100 text-purple-600',
    description: '纸张、玻璃、充电宝等',
  },
  {
    id: 'handmade',
    name: '小众手工物',
    icon: '🎨',
    color: 'bg-amber-100 text-amber-600',
    description: '毛绒玩偶、陶瓷等手工艺品',
  },
];

const getRandomImage = (seed: string) => 
  `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(`minimalist clean product photography ${seed} white background soft lighting`)}&image_size=square_hd`;

const getHealingMessages = (itemName: string): { healing: string; meaning: string } => {
  const messages: Record<string, { healing: string; meaning: string }> = {
    '玻璃杯': {
      healing: '每一次轻碰，都在诉说透明的故事。你看见的不仅是水，还有光穿过的温柔。',
      meaning: '被制造，是为了承载温度——无论是热水的温暖，还是冷酒的清醒。'
    },
    '巧克力': {
      healing: '融化在舌尖的那一刻，所有的疲惫都被甜蜜温柔地包裹。',
      meaning: '从苦涩的可可豆到甜蜜的巧克力，就像我们的人生，需要时间和温度的淬炼。'
    },
    '香薰蜡烛': {
      healing: '点燃它，就像点亮了内心的一束光。在摇曳的光影中，找到属于自己的宁静。',
      meaning: '燃烧自己，温暖他人。这是蜡烛的使命，也是我们每个人心中的温柔。'
    },
    '手工香皂': {
      healing: '每一次洗手，都是一次与自然的对话。植物的香气，带走疲惫，留下清新。',
      meaning: '从油脂到泡沫，这是一场华丽的转变。就像我们，在生活中不断净化自己。'
    },
    '笔记本': {
      healing: '空白的页面，等待着你的故事。每一次书写，都是与自己的对话。',
      meaning: '纸张的使命，是承载记忆。那些写下的文字，终将成为时光的印记。'
    },
    '发卡': {
      healing: '别在发间的小确幸，是给自己的温柔礼物。抬头的瞬间，看见美好。',
      meaning: '小小的装饰，大大的改变。我们都在寻找那些让自己闪闪发光的瞬间。'
    },
    '香水': {
      healing: '喷洒的那一刻，仿佛穿上了无形的外衣。每一种香调，都是一种心情。',
      meaning: '气味是记忆的载体。多年后闻到熟悉的香味，那些时光会瞬间浮现。'
    },
    '陶瓷杯': {
      healing: '指尖触碰的温度，是泥土经过火的洗礼后，给予我们最温暖的拥抱。',
      meaning: '千锤百炼，方成一器。人生亦如此，不经历考验，怎能成器？'
    },
    '糖果': {
      healing: '放进嘴里的那一刻，甜味在舌尖散开，仿佛所有的烦恼都暂时消失了。',
      meaning: '生活需要一点甜。糖果的存在，就是为了提醒我们，美好是真实存在的。'
    },
    '雨伞': {
      healing: '撑开它，就有了一个属于自己的小天地。在雨中，聆听雨滴的节奏。',
      meaning: '为他人遮风挡雨，也为自己守护一方晴空。这是伞的哲学，也是生活的智慧。'
    },
    '充电宝': {
      healing: '当手机电量告急时，它是最可靠的伙伴。能量不足时，记得给自己也充充电。',
      meaning: '储能，是为了更好地释放。我们也需要积蓄力量，在需要的时候绽放光芒。'
    },
    '毛绒玩偶': {
      healing: '抱着它的那一刻，仿佛回到了童年。柔软的触感，治愈了所有的不安。',
      meaning: '每一个玩偶，都承载着一个孩子的梦想。它们是无声的陪伴，是永远的朋友。'
    },
    '牙膏': {
      healing: '每天早晨的第一份清新，是新一天开始的仪式感。',
      meaning: '清洁与守护，是它的使命。我们也要学会清理内心，保持纯净。'
    },
  };
  return messages[itemName] || {
    healing: `每一件${itemName}，都有它独特的故事。`,
    meaning: '被制造，就意味着被需要。每一件物品，都有它存在的意义。'
  };
};

export const initialItems: Item[] = [
  {
    id: 'glass-cup',
    name: '玻璃杯',
    category: 'home',
    icon: '🥛',
    emoji: '🥛',
    description: '透明如镜，承载温度。从石英砂到精美的玻璃杯，这是一场火与光的华丽转变。',
    coverImage: getRandomImage('transparent glass cup minimalist design'),
    tags: ['透明', '日常', '实用'],
    rawMaterials: [
      { id: 'quartz', name: '石英砂', icon: '🏖️', color: 'bg-amber-50', unit: 'kg' },
      { id: 'soda', name: '纯碱', icon: '🧂', color: 'bg-white', unit: 'kg' },
      { id: 'limestone', name: '石灰石', icon: '🪨', color: 'bg-gray-100', unit: 'kg' },
    ],
    productionSteps: [
      {
        id: 'step1',
        step: 1,
        name: '原料准备',
        description: '精选石英砂、纯碱、石灰石等原料，按精确比例混合',
        duration: 2,
        icon: '📦',
        details: '石英砂是玻璃的主要成分，占比约70%。纯碱用于降低熔化温度，石灰石增加玻璃的稳定性。原料需要经过严格的筛选和研磨，确保颗粒均匀。'
      },
      {
        id: 'step2',
        step: 2,
        name: '高温熔化',
        description: '在1500℃以上的高温熔炉中，原料熔化成液态玻璃',
        duration: 3,
        icon: '🔥',
        details: '熔炉温度高达1500-1600℃，原料在高温下逐渐熔化。这个过程需要持续数小时，确保所有原料完全融合，没有气泡和杂质。'
      },
      {
        id: 'step3',
        step: 3,
        name: '吹制成型',
        description: '玻璃工匠用吹管取出玻璃液，通过吹气和旋转塑造形状',
        duration: 2,
        icon: '💨',
        details: '这是最具艺术性的步骤。工匠将吹管插入玻璃液，取出一团热熔的玻璃，然后一边吹气一边旋转和塑形。手工吹制的玻璃杯每一个都是独一无二的艺术品。'
      },
      {
        id: 'step4',
        step: 4,
        name: '冷却退火',
        description: '成型的玻璃杯放入退火炉缓慢冷却，消除内应力',
        duration: 4,
        icon: '❄️',
        details: '如果直接冷却，玻璃会因为内应力不均而轻易碎裂。退火炉内温度从500℃缓慢降至室温，这个过程可能需要数小时甚至数天。'
      },
      {
        id: 'step5',
        step: 5,
        name: '打磨抛光',
        description: '杯口和杯底经过精细打磨，确保边缘光滑圆润',
        duration: 2,
        icon: '✨',
        details: '刚成型的玻璃杯边缘粗糙锋利。工人们使用砂轮和抛光剂进行精细打磨，然后用火焰加热使边缘熔化变得圆润光滑。'
      },
      {
        id: 'step6',
        step: 6,
        name: '检验包装',
        description: '经过严格的质量检验后，精美的玻璃杯包装上架',
        duration: 1,
        icon: '📦',
        details: '每个玻璃杯都要经过透光检查、敲击声检查、耐热测试等多项检验。合格的产品用防震材料精心包装，贴上标签。'
      }
    ],
    craftingOptions: [
      {
        type: 'shape',
        name: '杯型选择',
        options: [
          { id: 'tall', name: '高身杯', value: 'tall', icon: '🥛' },
          { id: 'short', name: '矮身杯', value: 'short', icon: '☕' },
          { id: 'wide', name: '宽口杯', value: 'wide', icon: '🍺' },
        ]
      },
      {
        type: 'color',
        name: '颜色选择',
        options: [
          { id: 'clear', name: '透明', value: '#ffffff' },
          { id: 'blue', name: '天空蓝', value: '#87CEEB' },
          { id: 'pink', name: '樱花粉', value: '#FFB6C1' },
          { id: 'amber', name: '琥珀色', value: '#FFBF00' },
        ]
      },
      {
        type: 'texture',
        name: '纹理选择',
        options: [
          { id: 'smooth', name: '光滑', value: 'smooth' },
          { id: 'ribbed', name: '竖纹', value: 'ribbed' },
          { id: 'dot', name: '波点', value: 'dot' },
        ]
      }
    ],
    defects: [
      {
        id: 'd1',
        name: '气泡残留',
        icon: '💭',
        reason: '熔化过程中空气没有完全排出，或者退火时温度控制不当。气泡会影响美观，还可能导致应力集中。',
        solution: '延长熔化时间，控制熔炉温度均匀；改进搅拌工艺；检查模具排气设计。',
        frequency: 'common',
        image: getRandomImage('glass with air bubbles defect')
      },
      {
        id: 'd2',
        name: '厚薄不均',
        icon: '📏',
        reason: '吹制时力度不均，或者模具设计有问题。厚薄不均会导致受热时容易炸裂。',
        solution: '改进吹制工艺，控制旋转速度；优化模具设计；使用机器辅助成型。',
        frequency: 'common',
        image: getRandomImage('uneven thickness glass defect')
      }
    ],
    healingMessage: getHealingMessages('玻璃杯').healing,
    meaningMessage: getHealingMessages('玻璃杯').meaning,
    messages: [
      {
        id: 'm1',
        itemId: 'glass-cup',
        itemName: '玻璃杯',
        content: '每天早上用它喝水，感觉生活都变得清澈了。',
        author: '清晨的阳光',
        timestamp: Date.now() - 86400000,
        likes: 23
      }
    ],
    rarity: 'common',
    difficulty: 'medium',
    craftingTime: 10,
    created: false,
    favorite: false
  },
  {
    id: 'chocolate',
    name: '巧克力',
    category: 'food',
    icon: '🍫',
    emoji: '🍫',
    description: '从苦涩的可可豆到甜蜜的巧克力，这是一场时间与温度的浪漫邂逅。',
    coverImage: getRandomImage('luxury chocolate bar minimalist'),
    tags: ['甜蜜', '治愈', '美味'],
    rawMaterials: [
      { id: 'cocoa', name: '可可豆', icon: '🌰', color: 'bg-amber-800', unit: 'kg' },
      { id: 'sugar', name: '白砂糖', icon: '🧊', color: 'bg-white', unit: 'kg' },
      { id: 'cocoa-butter', name: '可可脂', icon: '🥥', color: 'bg-yellow-50', unit: 'kg' },
    ],
    productionSteps: [
      {
        id: 's1',
        step: 1,
        name: '可可豆发酵',
        description: '新鲜可可豆需要经过5-7天的发酵，才能产生巧克力独特的风味',
        duration: 5,
        icon: '🌰',
        details: '刚采摘的可可豆是白色的，没有巧克力的香气。工人们将豆子放入木箱或香蕉叶中发酵，温度控制在45-50℃。'
      },
      {
        id: 's2',
        step: 2,
        name: '烘焙研磨',
        description: '发酵后的可可豆经过烘焙和研磨，变成香浓的可可液块',
        duration: 3,
        icon: '🔥',
        details: '烘焙温度通常在120-140℃，时间15-30分钟。烘焙是风味形成的关键步骤。'
      },
      {
        id: 's3',
        step: 3,
        name: '调配混合',
        description: '根据配方加入糖、可可脂、奶粉等原料，精确混合',
        duration: 2,
        icon: '⚗️',
        details: '不同类型的巧克力配方不同：黑巧克力可可含量高，牛奶巧克力添加奶粉，白巧克力不含可可固形物。'
      },
      {
        id: 's4',
        step: 4,
        name: '精揉精炼',
        description: '通过长时间的研磨和搅拌，使巧克力质地细腻丝滑',
        duration: 4,
        icon: '🔄',
        details: '精揉过程可以持续数小时到数天。通过摩擦产生的热量使巧克力保持半液态，同时颗粒被研磨得越来越细。'
      },
      {
        id: 's5',
        step: 5,
        name: '调温成型',
        description: '精确控制温度变化，使可可脂形成稳定的晶体结构',
        duration: 2,
        icon: '🌡️',
        details: '调温是巧克力制作中最关键的步骤。通过升温-降温-再升温的精确控制，使可可脂形成稳定的β型晶体。'
      },
      {
        id: 's6',
        step: 6,
        name: '冷却包装',
        description: '在恒温恒湿环境中冷却凝固，然后精美包装',
        duration: 1,
        icon: '📦',
        details: '调温后的巧克力液体注入模具，振动排除气泡，然后在8-10℃的冷却隧道中凝固。'
      }
    ],
    craftingOptions: [
      {
        type: 'shape',
        name: '造型选择',
        options: [
          { id: 'bar', name: '板块', value: 'bar', icon: '🍫' },
          { id: 'heart', name: '心形', value: 'heart', icon: '💝' },
          { id: 'truffle', name: '松露', value: 'truffle', icon: '🍄' },
        ]
      },
      {
        type: 'color',
        name: '可可含量',
        options: [
          { id: 'milk', name: '牛奶巧克力', value: '#8B4513' },
          { id: 'dark', name: '黑巧克力', value: '#3D2314' },
          { id: 'white', name: '白巧克力', value: '#FFF8DC' },
        ]
      }
    ],
    defects: [
      {
        id: 'cd1',
        name: '起霜发白',
        icon: '❄️',
        reason: '调温不当或储存条件不佳，可可脂迁移到表面结晶。',
        solution: '严格执行调温工艺；控制储存温度在18-22℃。',
        frequency: 'common',
        image: getRandomImage('chocolate bloom defect white surface')
      }
    ],
    healingMessage: getHealingMessages('巧克力').healing,
    meaningMessage: getHealingMessages('巧克力').meaning,
    messages: [
      {
        id: 'cm1',
        itemId: 'chocolate',
        itemName: '巧克力',
        content: '心情不好的时候，吃一块巧克力，感觉世界又变甜了。',
        author: '甜蜜收藏家',
        timestamp: Date.now() - 86400000,
        likes: 67
      }
    ],
    rarity: 'uncommon',
    difficulty: 'hard',
    craftingTime: 15,
    created: false,
    favorite: false
  },
  {
    id: 'candle',
    name: '香薰蜡烛',
    category: 'home',
    icon: '🕯️',
    emoji: '🕯️',
    description: '点亮它，让温暖的光芒和治愈的香气，为你创造一个专属的宁静角落。',
    coverImage: getRandomImage('aromatherapy candle minimalist design'),
    tags: ['温暖', '治愈', '香氛'],
    rawMaterials: [
      { id: 'soy-wax', name: '大豆蜡', icon: '🫘', color: 'bg-yellow-50', unit: 'kg' },
      { id: 'wick', name: '烛芯', icon: '🧵', color: 'bg-gray-200', unit: '根' },
      { id: 'fragrance', name: '香精', icon: '🌸', color: 'bg-pink-50', unit: 'ml' },
    ],
    productionSteps: [
      {
        id: 'cs1',
        step: 1,
        name: '蜡料准备',
        description: '选择优质大豆蜡或蜂蜡，按比例混合称量',
        duration: 1,
        icon: '⚖️',
        details: '大豆蜡来自大豆油，天然环保，燃烧时间长。蜂蜡来自蜜蜂，香气天然，质地坚硬。'
      },
      {
        id: 'cs2',
        step: 2,
        name: '水浴熔化',
        description: '采用水浴法温和加热，避免蜡料直接接触高温',
        duration: 2,
        icon: '♨️',
        details: '蜡料不能直接用火加热，否则会烧焦或自燃。使用双层锅或水浴加热，温度控制在60-80℃。'
      },
      {
        id: 'cs3',
        step: 3,
        name: '添加香氛',
        description: '在合适的温度下加入香精，充分搅拌混合',
        duration: 1,
        icon: '🌸',
        details: '这是香薰蜡烛的灵魂步骤。香精需要在蜡液温度降至50-60℃时加入，温度太高会导致香精挥发。'
      },
      {
        id: 'cs4',
        step: 4,
        name: '固定烛芯',
        description: '将烛芯固定在容器底部，保持垂直居中',
        duration: 1,
        icon: '🧵',
        details: '烛芯的选择很重要，太细会熄灭，太粗会冒烟。使用烛芯固定器或一滴蜡液将烛芯固定在容器底部。'
      },
      {
        id: 'cs5',
        step: 5,
        name: '浇注成型',
        description: '将调好的蜡液缓慢倒入容器，控制温度和速度',
        duration: 2,
        icon: '💧',
        details: '蜡液需要缓慢倒入，避免产生气泡。浇注温度通常比熔点高5-10℃。'
      },
      {
        id: 'cs6',
        step: 6,
        name: '冷却修剪',
        description: '在室温下缓慢冷却，修剪烛芯至合适长度',
        duration: 3,
        icon: '✂️',
        details: '蜡烛需要在室温下缓慢冷却，过快冷却会导致表面开裂。通常需要24-48小时才能完全凝固。'
      }
    ],
    craftingOptions: [
      {
        type: 'shape',
        name: '容器选择',
        options: [
          { id: 'jar', name: '玻璃罐', value: 'jar', icon: '🫙' },
          { id: 'tin', name: '马口铁', value: 'tin', icon: '🥫' },
        ]
      },
      {
        type: 'color',
        name: '颜色选择',
        options: [
          { id: 'white', name: '纯白', value: '#FAFAFA' },
          { id: 'pink', name: '樱花粉', value: '#FFB6C1' },
          { id: 'green', name: '草木绿', value: '#90EE90' },
        ]
      }
    ],
    defects: [
      {
        id: 'cand1',
        name: '表面凹陷',
        icon: '🕳️',
        reason: '冷却时中心收缩，这是蜡料的物理特性。',
        solution: '进行二次浇注填补；降低浇注温度。',
        frequency: 'common',
        image: getRandomImage('candle with sinkhole defect')
      }
    ],
    healingMessage: getHealingMessages('香薰蜡烛').healing,
    meaningMessage: getHealingMessages('香薰蜡烛').meaning,
    messages: [
      {
        id: 'candm1',
        itemId: 'candle',
        itemName: '香薰蜡烛',
        content: '失眠的夜晚，点上薰衣草蜡烛，闻着香气慢慢入睡。',
        author: '夜归人',
        timestamp: Date.now() - 43200000,
        likes: 34
      }
    ],
    rarity: 'uncommon',
    difficulty: 'medium',
    craftingTime: 8,
    created: false,
    favorite: false
  },
  {
    id: 'soap',
    name: '手工香皂',
    category: 'daily',
    icon: '🧼',
    emoji: '🧼',
    description: '天然植物油与碱的神奇相遇，在时间的催化下，变成温和滋润的手工皂。',
    coverImage: getRandomImage('handmade soap bar natural minimalist'),
    tags: ['天然', '环保', '滋润'],
    rawMaterials: [
      { id: 'olive-oil', name: '橄榄油', icon: '🫒', color: 'bg-green-50', unit: 'ml' },
      { id: 'coconut-oil', name: '椰子油', icon: '🥥', color: 'bg-white', unit: 'ml' },
      { id: 'lye', name: '氢氧化钠', icon: '⚗️', color: 'bg-gray-100', unit: 'g' },
    ],
    productionSteps: [
      {
        id: 'soap1',
        step: 1,
        name: '配方计算',
        description: '精确计算各种油脂的皂化价，确定碱和水的用量',
        duration: 1,
        icon: '🧮',
        details: '这是手工皂制作中最重要的一步。每种油脂都有特定的皂化价，表示中和1克该油脂所需的氢氧化钠克数。'
      },
      {
        id: 'soap2',
        step: 2,
        name: '碱液制备',
        description: '将氢氧化钠小心溶解于水中，注意安全防护',
        duration: 1,
        icon: '⚗️',
        details: '这是最危险的步骤，必须佩戴护目镜和手套。将氢氧化钠慢慢加入冷水（不能用热水），同时不停搅拌。'
      },
      {
        id: 'soap3',
        step: 3,
        name: '油脂混合',
        description: '按配方称量各种油脂，加热混合均匀',
        duration: 1,
        icon: '🥘',
        details: '不同的油脂赋予香皂不同的特性：橄榄油滋润、椰子油起泡、棕榈油硬度。'
      },
      {
        id: 'soap4',
        step: 4,
        name: '混合搅拌',
        description: '将碱液缓慢倒入油脂中，持续搅拌至Trace状态',
        duration: 2,
        icon: '🥣',
        details: 'Trace是手工皂制作的关键节点，表示碱液和油脂已经充分乳化，达到类似浓稠酸奶的状态。'
      },
      {
        id: 'soap5',
        step: 5,
        name: '入模保温',
        description: '将皂液倒入模具，保温促进皂化反应',
        duration: 2,
        icon: '📦',
        details: '达到Trace的皂液倒入模具后，可以用保鲜膜覆盖，放入保温箱或用毛巾包裹保温。'
      },
      {
        id: 'soap6',
        step: 6,
        name: '脱模晾皂',
        description: '凝固后脱模切割，放置通风处晾干成熟',
        duration: 4,
        icon: '🌬️',
        details: '这是最需要耐心的步骤。刚脱模的香皂pH值还很高，不能使用。需要放在通风阴凉处晾皂4-6周。'
      }
    ],
    craftingOptions: [
      {
        type: 'shape',
        name: '模具选择',
        options: [
          { id: 'rectangle', name: '长方体', value: 'rectangle', icon: '▬' },
          { id: 'round', name: '圆形', value: 'round', icon: '⭕' },
        ]
      },
      {
        type: 'color',
        name: '颜色选择',
        options: [
          { id: 'natural', name: '自然原色', value: '#F5DEB3' },
          { id: 'green', name: '抹茶绿', value: '#90EE90' },
        ]
      }
    ],
    defects: [
      {
        id: 'soaper1',
        name: '松糕现象',
        icon: '🍰',
        reason: '保温过度或Trace太稀，皂化反应过于剧烈产生大量气泡。',
        solution: '降低保温温度；等待Trace更浓稠后入模。',
        frequency: 'common',
        image: getRandomImage('crumbly soap defect')
      }
    ],
    healingMessage: getHealingMessages('手工香皂').healing,
    meaningMessage: getHealingMessages('手工香皂').meaning,
    messages: [
      {
        id: 'soapm1',
        itemId: 'soap',
        itemName: '手工香皂',
        content: '用自己做的香皂洗手，感觉特别有成就感，而且皮肤真的不干燥了。',
        author: '手工达人',
        timestamp: Date.now() - 259200000,
        likes: 28
      }
    ],
    rarity: 'uncommon',
    difficulty: 'hard',
    craftingTime: 12,
    created: false,
    favorite: false
  },
  {
    id: 'notebook',
    name: '笔记本',
    category: 'misc',
    icon: '📓',
    emoji: '📓',
    description: '从树木到纸张，再到精美的笔记本。每一页空白，都在等待你的故事。',
    coverImage: getRandomImage('minimalist notebook cover design'),
    tags: ['书写', '记录', '创意'],
    rawMaterials: [
      { id: 'wood-pulp', name: '木浆', icon: '🌲', color: 'bg-amber-50', unit: 'kg' },
      { id: 'cover', name: '封面材料', icon: '📔', color: 'bg-amber-700', unit: '张' },
    ],
    productionSteps: [
      {
        id: 'nb1',
        step: 1,
        name: '纸张制造',
        description: '木浆经过打浆、抄纸、干燥等工序，制成纸张',
        duration: 3,
        icon: '📄',
        details: '现代造纸已经高度工业化。原木去皮后切成木片，经过化学或机械方法制成纸浆。'
      },
      {
        id: 'nb2',
        step: 2,
        name: '裁切备料',
        description: '将大幅纸张裁切成笔记本所需的尺寸',
        duration: 1,
        icon: '✂️',
        details: '造纸厂生产的纸张是大幅的卷筒纸或平张纸。需要根据笔记本的开本进行裁切。'
      },
      {
        id: 'nb3',
        step: 3,
        name: '内页印刷',
        description: '根据设计印刷横线、方格、点阵或空白页',
        duration: 2,
        icon: '🖨️',
        details: '笔记本的内页格式多种多样：纯空白适合绘画，横线适合写字，方格适合做笔记。'
      },
      {
        id: 'nb4',
        step: 4,
        name: '折页配页',
        description: '将印刷好的纸张折成书帖，按顺序配好',
        duration: 2,
        icon: '📑',
        details: '一张大纸对折两次就是4页，这样的一叠叫做一个书帖。一本书由多个书帖组成。'
      },
      {
        id: 'nb5',
        step: 5,
        name: '装订成册',
        description: '使用锁线胶装、骑马钉或无线胶装等方式装订',
        duration: 2,
        icon: '📚',
        details: '装订方式决定了笔记本的耐用性。锁线胶装最牢固，可以180度摊平。'
      },
      {
        id: 'nb6',
        step: 6,
        name: '上壳成型',
        description: '粘贴封面，压平定型，完成整本笔记本',
        duration: 1,
        icon: '📔',
        details: '硬壳封面的笔记本需要制作书壳。封面材料裱在硬纸板上，然后与书芯连接。'
      }
    ],
    craftingOptions: [
      {
        type: 'shape',
        name: '尺寸选择',
        options: [
          { id: 'a5', name: 'A5便携', value: 'a5', icon: '📓' },
          { id: 'b5', name: 'B5标准', value: 'b5', icon: '📔' },
        ]
      },
      {
        type: 'color',
        name: '封面颜色',
        options: [
          { id: 'black', name: '经典黑', value: '#1F2937' },
          { id: 'brown', name: '温暖棕', value: '#92400E' },
        ]
      }
    ],
    defects: [
      {
        id: 'nbd1',
        name: '页码错误',
        icon: '🔢',
        reason: '配页时书帖顺序放错；或者印刷时页码设置错误。',
        solution: '配页后仔细检查页码顺序；印刷前打样确认。',
        frequency: 'rare',
        image: getRandomImage('book with misprinted page numbers')
      }
    ],
    healingMessage: getHealingMessages('笔记本').healing,
    meaningMessage: getHealingMessages('笔记本').meaning,
    messages: [
      {
        id: 'nbm1',
        itemId: 'notebook',
        itemName: '笔记本',
        content: '喜欢在笔记本上写字的感觉，比在手机上打字更有温度。每一页都是我的人生轨迹。',
        author: '手写爱好者',
        timestamp: Date.now() - 129600000,
        likes: 56
      }
    ],
    rarity: 'common',
    difficulty: 'medium',
    craftingTime: 10,
    created: false,
    favorite: false
  },
  {
    id: 'hairpin',
    name: '发卡',
    category: 'wear',
    icon: '🎀',
    emoji: '🎀',
    description: '小小的发卡，承载着爱美的心。别在发间，点亮一天的心情。',
    coverImage: getRandomImage('elegant hairpin minimalist design'),
    tags: ['装饰', '美丽', '精致'],
    rawMaterials: [
      { id: 'metal-base', name: '金属底托', icon: '🔩', color: 'bg-gray-200', unit: '个' },
      { id: 'acrylic', name: '亚克力', icon: '💎', color: 'bg-pink-50', unit: '片' },
    ],
    productionSteps: [
      {
        id: 'hp1',
        step: 1,
        name: '设计打样',
        description: '设计师绘制款式图，制作首样确认',
        duration: 3,
        icon: '✏️',
        details: '发卡的设计需要考虑流行趋势和实用性。是简约的一字夹，还是华丽的装饰夹？'
      },
      {
        id: 'hp2',
        step: 2,
        name: '底托生产',
        description: '金属底托经过冲压、电镀等工序制成',
        duration: 2,
        icon: '⚙️',
        details: '发卡的金属底托通常使用铁、铜或合金材料。通过冲压机将金属片冲压成所需形状。'
      },
      {
        id: 'hp3',
        step: 3,
        name: '装饰件制作',
        description: '根据设计制作各种装饰元素',
        duration: 3,
        icon: '🎨',
        details: '这是展现创意的环节。亚克力装饰需要开模注塑，然后切割抛光。'
      },
      {
        id: 'hp4',
        step: 4,
        name: '弹簧组装',
        description: '将弹簧和夹片安装到底托上',
        duration: 1,
        icon: '🔧',
        details: '发卡的夹持功能来自弹簧机构。弹簧的弹力很重要：太松夹不住头发，太紧难以打开。'
      },
      {
        id: 'hp5',
        step: 5,
        name: '装饰粘合',
        description: '将装饰元素牢固地粘合到底托上',
        duration: 2,
        icon: '🔗',
        details: '使用专业的珠宝胶或强力胶，将装饰件粘贴到底托上。需要精确控制用胶量。'
      },
      {
        id: 'hp6',
        step: 6,
        name: '质检包装',
        description: '检查开合是否顺畅、装饰是否牢固，然后精美包装',
        duration: 1,
        icon: '📦',
        details: '每个发卡都要经过多项检验：弹簧开合是否顺畅？夹持力是否合适？装饰件是否牢固？'
      }
    ],
    craftingOptions: [
      {
        type: 'shape',
        name: '款式选择',
        options: [
          { id: 'clip', name: '一字夹', value: 'clip', icon: '📎' },
          { id: 'claw', name: '抓夹', value: 'claw', icon: '🦀' },
        ]
      },
      {
        type: 'color',
        name: '颜色选择',
        options: [
          { id: 'gold', name: '金色', value: '#FFD700' },
          { id: 'silver', name: '银色', value: '#C0C0C0' },
        ]
      }
    ],
    defects: [
      {
        id: 'hpd1',
        name: '弹簧失灵',
        icon: '🔧',
        reason: '弹簧质量差或安装不当；使用中金属疲劳。',
        solution: '使用优质弹簧材料；改进安装工艺。',
        frequency: 'common',
        image: getRandomImage('broken hairpin spring')
      }
    ],
    healingMessage: getHealingMessages('发卡').healing,
    meaningMessage: getHealingMessages('发卡').meaning,
    messages: [
      {
        id: 'hpm1',
        itemId: 'hairpin',
        itemName: '发卡',
        content: '妈妈送我的第一个发卡，现在还珍藏着。虽然款式过时了，但承载着满满的回忆。',
        author: '念旧的人',
        timestamp: Date.now() - 345600000,
        likes: 89
      }
    ],
    rarity: 'common',
    difficulty: 'easy',
    craftingTime: 6,
    created: false,
    favorite: false
  },
  {
    id: 'perfume',
    name: '香水',
    category: 'daily',
    icon: '🧴',
    emoji: '🧴',
    description: '气味是记忆的载体。一款好的香水，能让时光倒流，让情绪具象化。',
    coverImage: getRandomImage('luxury perfume bottle minimalist'),
    tags: ['香氛', '优雅', '记忆'],
    rawMaterials: [
      { id: 'alcohol', name: '酒精', icon: '🥃', color: 'bg-transparent', unit: 'ml' },
      { id: 'essential-oil', name: '香精油', icon: '🌸', color: 'bg-amber-50', unit: 'ml' },
    ],
    productionSteps: [
      {
        id: 'p1',
        step: 1,
        name: '香料采集',
        description: '从植物、动物或合成来源获取各种香料原料',
        duration: 5,
        icon: '🌺',
        details: '香水的香料来源极其丰富。植物香料来自花朵、果实、叶片、树脂、根茎等。'
      },
      {
        id: 'p2',
        step: 2,
        name: '精油提取',
        description: '通过蒸馏、萃取、压榨等方法提取植物中的芳香成分',
        duration: 4,
        icon: '⚗️',
        details: '不同的植物需要不同的提取方法。蒸馏法最常用，适用于玫瑰、薰衣草等。'
      },
      {
        id: 'p3',
        step: 3,
        name: '调配配方',
        description: '调香师如同艺术家，将多种香料按比例混合创作',
        duration: 3,
        icon: '🎨',
        details: '这是香水制作中最具艺术性的环节。调香师需要记住上千种香料的气味特性。'
      },
      {
        id: 'p4',
        step: 4,
        name: '混合陈化',
        description: '将调配好的香精与酒精混合，在黑暗环境中陈化',
        duration: 6,
        icon: '⏳',
        details: '刚调配好的香水气味尖锐、不和谐。需要在黑暗、恒温的环境中陈化数周甚至数年。'
      },
      {
        id: 'p5',
        step: 5,
        name: '冷冻过滤',
        description: '低温冷冻去除杂质，然后精密过滤确保澄清',
        duration: 2,
        icon: '❄️',
        details: '陈化后的香水需要冷冻到0-5℃，放置数天。这个过程中，一些不溶于酒精的蜡质和杂质会沉淀出来。'
      },
      {
        id: 'p6',
        step: 6,
        name: '装瓶包装',
        description: '灌入精美的香水瓶，密封包装，等待上市',
        duration: 1,
        icon: '🧴',
        details: '香水瓶本身就是艺术品。品牌会邀请著名设计师设计独特的瓶身。'
      }
    ],
    craftingOptions: [
      {
        type: 'shape',
        name: '瓶型选择',
        options: [
          { id: 'classic', name: '经典方瓶', value: 'classic', icon: '🧴' },
          { id: 'round', name: '圆润瓶', value: 'round', icon: '🫙' },
        ]
      },
      {
        type: 'color',
        name: '香调选择',
        options: [
          { id: 'floral', name: '花香调', value: '#FFB6C1' },
          { id: 'woody', name: '木质调', value: '#8B4513' },
        ]
      }
    ],
    defects: [
      {
        id: 'pd1',
        name: '变色变味',
        icon: '🎨',
        reason: '某些香料成分不稳定，光照或高温下发生氧化或聚合反应。',
        solution: '使用更稳定的香料或添加抗氧化剂；使用棕色瓶避光。',
        frequency: 'uncommon',
        image: getRandomImage('discolored perfume liquid')
      }
    ],
    healingMessage: getHealingMessages('香水').healing,
    meaningMessage: getHealingMessages('香水').meaning,
    messages: [
      {
        id: 'pm1',
        itemId: 'perfume',
        itemName: '香水',
        content: '那款香水是他送我的。现在每次闻到类似的香味，都会想起那个夏天。气味真的是记忆的钥匙。',
        author: ' scent memory',
        timestamp: Date.now() - 518400000,
        likes: 127
      }
    ],
    rarity: 'rare',
    difficulty: 'hard',
    craftingTime: 20,
    created: false,
    favorite: false
  },
  {
    id: 'ceramic',
    name: '陶瓷杯',
    category: 'handmade',
    icon: '☕',
    emoji: '☕',
    description: '泥土经过水的滋润、火的洗礼，最终脱胎换骨，成为温润如玉的陶瓷。',
    coverImage: getRandomImage('handmade ceramic cup minimalist'),
    tags: ['手工', '温润', '艺术'],
    rawMaterials: [
      { id: 'clay', name: '陶土/瓷土', icon: '🟤', color: 'bg-amber-200', unit: 'kg' },
      { id: 'glaze', name: '釉料', icon: '🎨', color: 'bg-white', unit: 'kg' },
    ],
    productionSteps: [
      {
        id: 'cer1',
        step: 1,
        name: '练土揉泥',
        description: '将黏土反复揉练，排出空气，使质地均匀',
        duration: 2,
        icon: '🤲',
        details: '揉泥是陶艺最基础也最重要的步骤。就像揉面一样，需要将黏土反复折叠、按压、旋转。'
      },
      {
        id: 'cer2',
        step: 2,
        name: '拉坯成型',
        description: '在旋转的辘轳上，用双手将泥土塑造成型',
        duration: 3,
        icon: '🎡',
        details: '这是陶艺最具魅力的时刻。将揉好的泥土置于辘轳中心，双手沾水，随着轮子的旋转，泥土在手中慢慢升起、塑形。'
      },
      {
        id: 'cer3',
        step: 3,
        name: '修坯晾干',
        description: '半干状态下修整器形，然后自然阴干',
        duration: 4,
        icon: '✂️',
        details: '拉坯完成的器物需要晾到皮革硬度（约半干），然后进行修坯。用修坯刀修整器形，使器壁厚薄均匀。'
      },
      {
        id: 'cer4',
        step: 4,
        name: '素烧',
        description: '第一次烧制，使黏土完全瓷化',
        duration: 3,
        icon: '🔥',
        details: '素烧通常在800-1000℃进行。这个过程中，黏土中的有机物燃烧殆尽，矿物成分发生相变。'
      },
      {
        id: 'cer5',
        step: 5,
        name: '施釉',
        description: '将釉料涂敷在素胎表面，可以浸釉、喷釉或刷釉',
        duration: 2,
        icon: '🎨',
        details: '釉是陶瓷的外衣，决定了器物最终的颜色和质感。釉料的主要成分是二氧化硅（玻璃的主要成分）。'
      },
      {
        id: 'cer6',
        step: 6,
        name: '釉烧',
        description: '第二次烧制，高温下釉料熔化形成玻璃质表层',
        duration: 4,
        icon: '🌟',
        details: '釉烧是最后的考验，温度通常在1200-1300℃以上。烧制过程中，窑内气氛（氧化或还原）至关重要。'
      }
    ],
    craftingOptions: [
      {
        type: 'shape',
        name: '器型选择',
        options: [
          { id: 'cylinder', name: '直筒杯', value: 'cylinder', icon: '☕' },
          { id: 'wide', name: '宽口杯', value: 'wide', icon: '🍵' },
        ]
      },
      {
        type: 'color',
        name: '釉色选择',
        options: [
          { id: 'white', name: '月白釉', value: '#F5F5F5' },
          { id: 'celadon', name: '青瓷', value: '#7FFFD4' },
        ]
      }
    ],
    defects: [
      {
        id: 'cerd1',
        name: '炸裂',
        icon: '💥',
        reason: '干燥太快或烧制升温太快；黏土中有气泡；坯体厚薄不均。',
        solution: '缓慢阴干；控制烧制升温曲线；充分揉泥排除气泡。',
        frequency: 'common',
        image: getRandomImage('broken ceramic piece with cracks')
      }
    ],
    healingMessage: getHealingMessages('陶瓷杯').healing,
    meaningMessage: getHealingMessages('陶瓷杯').meaning,
    messages: [
      {
        id: 'crm1',
        itemId: 'ceramic',
        itemName: '陶瓷杯',
        content: '在陶艺工作室亲手做的杯子，虽然形状不太完美，但每次用它喝水都觉得特别温暖。',
        author: '陶艺新手',
        timestamp: Date.now() - 604800000,
        likes: 102
      }
    ],
    rarity: 'rare',
    difficulty: 'hard',
    craftingTime: 18,
    created: false,
    favorite: false
  }
];