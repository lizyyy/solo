import { 
  Music, 
  Playlist, 
  Dance, 
  Painting, 
  Meditation, 
  WhiteNoise, 
  PsychologicalTest,
  User,
  EmotionType
} from '../types';

// 情绪类型映射
export const emotionMap: Record<EmotionType, { name: string; color: string; icon: string }> = {
  anxiety: { name: '焦虑', color: '#F59E0B', icon: '😰' },
  insomnia: { name: '失眠', color: '#6366F1', icon: '🌙' },
  depression: { name: '压抑', color: '#6B7280', icon: '😔' },
  fatigue: { name: '疲惫', color: '#8B5CF6', icon: '😴' },
  irritability: { name: '烦躁', color: '#EF4444', icon: '😤' }
};

// 模拟音乐数据
export const mockMusics: Music[] = [
  {
    id: 'music-1',
    title: '晨曦之光',
    artist: '心灵之声',
    duration: 300,
    emotionType: 'anxiety',
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=peaceful%20morning%20sunlight%20through%20window%20soft%20warm%20colors%20artistic%20style&image_size=square',
    audioUrl: '',
    isFavorite: false,
    category: 'emotion',
    description: '轻柔的钢琴旋律，帮助缓解焦虑情绪'
  },
  {
    id: 'music-2',
    title: '星河入梦',
    artist: '夜之精灵',
    duration: 420,
    emotionType: 'insomnia',
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=starry%20night%20sky%20gentle%20moonlight%20peaceful%20dreamy%20atmosphere%20soft%20blue%20purple%20colors&image_size=square',
    audioUrl: '',
    isFavorite: true,
    category: 'emotion',
    description: '舒缓的合成音效，引导进入深度睡眠'
  },
  {
    id: 'music-3',
    title: '山谷回响',
    artist: '自然之声',
    duration: 360,
    emotionType: 'depression',
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=peaceful%20mountain%20valley%20with%20mist%20soft%20green%20and%20blue%20colors%20calm%20atmosphere&image_size=square',
    audioUrl: '',
    isFavorite: false,
    category: 'emotion',
    description: '大自然的声音，带来内心的宁静'
  },
  {
    id: 'music-4',
    title: '能量觉醒',
    artist: '活力四射',
    duration: 240,
    emotionType: 'fatigue',
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=energetic%20sunrise%20over%20ocean%20warm%20orange%20and%20gold%20colors%20dynamic%20and%20uplifting&image_size=square',
    audioUrl: '',
    isFavorite: false,
    category: 'emotion',
    description: '轻快的节奏，帮助恢复活力'
  },
  {
    id: 'music-5',
    title: '静心禅意',
    artist: '东方韵律',
    duration: 480,
    emotionType: 'irritability',
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=zen%20garden%20with%20sand%20and%20stone%20peaceful%20Japanese%20style%20soft%20neutral%20colors&image_size=square',
    audioUrl: '',
    isFavorite: true,
    category: 'emotion',
    description: '传统乐器演奏，帮助平复烦躁心情'
  },
  {
    id: 'music-6',
    title: '微风轻拂',
    artist: '自然大师',
    duration: 600,
    emotionType: 'anxiety',
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=gentle%20wind%20through%20wheat%20field%20soft%20movement%20peaceful%20pastel%20colors&image_size=square',
    audioUrl: '',
    isFavorite: false,
    category: 'white-noise',
    description: '模拟自然风声，舒缓神经'
  }
];

// 模拟歌单数据
export const mockPlaylists: Playlist[] = [
  {
    id: 'playlist-1',
    name: '焦虑缓解精选',
    emotionType: 'anxiety',
    description: '精选10首舒缓音乐，帮助缓解日常焦虑',
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=peaceful%20music%20notes%20floating%20in%20warm%20soft%20light%20artistic%20style&image_size=square',
    musicIds: ['music-1', 'music-6'],
    isFavorite: true
  },
  {
    id: 'playlist-2',
    name: '深度睡眠',
    emotionType: 'insomnia',
    description: '专为失眠人群设计的舒缓歌单',
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=peaceful%20sleeping%20moon%20and%20stars%20soft%20blue%20purple%20night%20sky&image_size=square',
    musicIds: ['music-2'],
    isFavorite: false
  },
  {
    id: 'playlist-3',
    name: '走出阴霾',
    emotionType: 'depression',
    description: '温暖人心的音乐，陪伴你度过困难时刻',
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=sunlight%20breaking%20through%20clouds%20hope%20warm%20golden%20light%20artistic&image_size=square',
    musicIds: ['music-3'],
    isFavorite: false
  },
  {
    id: 'playlist-4',
    name: '能量补给站',
    emotionType: 'fatigue',
    description: '轻快活泼的音乐，帮助你恢复精力',
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=energetic%20burst%20of%20light%20and%20color%20vibrant%20orange%20yellow%20dynamic&image_size=square',
    musicIds: ['music-4'],
    isFavorite: false
  },
  {
    id: 'playlist-5',
    name: '静心冥想',
    emotionType: 'irritability',
    description: '东方禅意音乐，帮助你平复心情',
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=zen%20meditation%20candle%20light%20peaceful%20warmth%20soft%20neutral%20tones&image_size=square',
    musicIds: ['music-5'],
    isFavorite: true
  }
];

// 模拟舞蹈数据
export const mockDances: Dance[] = [
  {
    id: 'dance-1',
    title: '零基础舒缓律动',
    category: 'beginner',
    duration: 300,
    description: '适合完全没有舞蹈基础的人，简单的动作配合音乐，让身体慢慢放松',
    thumbnail: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=gentle%20dance%20movement%20soft%20silhouette%20peaceful%20warm%20light%20artistic&image_size=square',
    difficulty: 'easy',
    steps: [
      { order: 1, instruction: '双脚与肩同宽站立，双手自然下垂', duration: 30, animationHint: 'stand' },
      { order: 2, instruction: '随着音乐节奏，慢慢抬起右手，掌心朝上', duration: 20, animationHint: 'right-hand-up' },
      { order: 3, instruction: '放下右手，同时抬起左手，掌心朝上', duration: 20, animationHint: 'left-hand-up' },
      { order: 4, instruction: '双手同时抬起，在头顶上方轻轻画圈', duration: 30, animationHint: 'circles' },
      { order: 5, instruction: '慢慢放下双手，身体左右轻轻摇摆', duration: 40, animationHint: 'sway' },
      { order: 6, instruction: '深呼吸，感受身体的放松', duration: 20, animationHint: 'breathe' }
    ]
  },
  {
    id: 'dance-2',
    title: '肢体舒展舞',
    category: 'stretch',
    duration: 420,
    description: '通过缓慢的肢体伸展动作，放松全身肌肉，缓解身体紧张',
    thumbnail: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=elegant%20stretching%20pose%20soft%20lines%20peaceful%20atmosphere%20artistic%20style&image_size=square',
    difficulty: 'easy',
    steps: [
      { order: 1, instruction: '山式站立，双脚并拢，双手合十于胸前', duration: 30, animationHint: 'mountain' },
      { order: 2, instruction: '吸气，双手向上伸展，感受脊柱的拉伸', duration: 25, animationHint: 'upward-stretch' },
      { order: 3, instruction: '呼气，身体向右侧弯曲，左手保持向上', duration: 25, animationHint: 'side-bend-right' },
      { order: 4, instruction: '吸气回正，呼气向左侧弯曲', duration: 25, animationHint: 'side-bend-left' },
      { order: 5, instruction: '吸气回正，呼气前屈，双手触碰地面', duration: 30, animationHint: 'forward-fold' },
      { order: 6, instruction: '吸气起身，回到山式站立', duration: 20, animationHint: 'stand' }
    ]
  },
  {
    id: 'dance-3',
    title: '呼吸律动引导',
    category: 'breathing',
    duration: 360,
    description: '结合呼吸与动作，帮助你找到内心的平静',
    thumbnail: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=breathing%20meditation%20circles%20of%20light%20peaceful%20blue%20and%20white%20soft%20atmosphere&image_size=square',
    difficulty: 'easy',
    steps: [
      { order: 1, instruction: '舒适地坐下，闭上眼睛，专注于呼吸', duration: 40, animationHint: 'sit' },
      { order: 2, instruction: '吸气4秒，感受空气充满肺部', duration: 30, animationHint: 'inhale' },
      { order: 3, instruction: '屏息2秒，感受当下', duration: 20, animationHint: 'hold' },
      { order: 4, instruction: '呼气6秒，慢慢释放所有紧张', duration: 40, animationHint: 'exhale' },
      { order: 5, instruction: '配合呼吸，双手随着吸气抬起，呼气放下', duration: 60, animationHint: 'breath-movement' },
      { order: 6, instruction: '继续深呼吸，慢慢睁开眼睛', duration: 30, animationHint: 'finish' }
    ]
  },
  {
    id: 'dance-4',
    title: '睡前放松肢体操',
    category: 'sleep',
    duration: 480,
    description: '睡前进行的轻柔动作，帮助身体放松，准备进入睡眠状态',
    thumbnail: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=peaceful%20night%20sleeping%20figure%20soft%20moonlight%20blue%20purple%20dreamy%20atmosphere&image_size=square',
    difficulty: 'easy',
    steps: [
      { order: 1, instruction: '躺在床上，双腿伸直，双手放在身体两侧', duration: 30, animationHint: 'lie-down' },
      { order: 2, instruction: '慢慢抬起右腿，保持5秒后放下', duration: 25, animationHint: 'leg-lift-right' },
      { order: 3, instruction: '慢慢抬起左腿，保持5秒后放下', duration: 25, animationHint: 'leg-lift-left' },
      { order: 4, instruction: '双腿同时抬起，做蹬自行车动作', duration: 40, animationHint: 'bicycle' },
      { order: 5, instruction: '放下双腿，双手慢慢向上伸展', duration: 20, animationHint: 'arms-up' },
      { order: 6, instruction: '全身放松，准备进入梦乡', duration: 30, animationHint: 'relax' }
    ]
  }
];

// 模拟名画数据
export const mockPaintings: Painting[] = [
  {
    id: 'painting-1',
    title: '星月夜',
    artist: '文森特·梵高',
    era: '后印象派',
    description: '这幅画展现了梵高独特的笔触和对色彩的运用，夜空中的星星和月亮呈现出强烈的动感。',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Vincent%20van%20Gogh%20Starry%20Night%20style%20swirling%20stars%20moon%20dark%20blue%20sky%20impressionist%20art&image_size=square',
    category: 'classic',
    colors: ['#0F3460', '#1A508B', '#E94560', '#F5D061']
  },
  {
    id: 'painting-2',
    title: '睡莲',
    artist: '克劳德·莫奈',
    era: '印象派',
    description: '莫奈晚年的代表作，以柔和的色彩和模糊的轮廓展现了池塘中睡莲的美丽。',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Claude%20Monet%20water%20lilies%20pond%20soft%20colors%20impressionist%20style%20peaceful%20water%20reflections&image_size=square',
    category: 'classic',
    colors: ['#7EC8A3', '#5DADE2', '#F7DC6F', '#BB8FCE']
  },
  {
    id: 'painting-3',
    title: '向日葵',
    artist: '文森特·梵高',
    era: '后印象派',
    description: '梵高用强烈的黄色调表现了向日葵的生命力，这幅画充满了阳光和希望。',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Vincent%20van%20Gogh%20sunflowers%20painting%20vibrant%20yellow%20orange%20colors%20post%20impressionist%20art&image_size=square',
    category: 'classic',
    colors: ['#FFD700', '#FFA500', '#8B4513', '#228B22']
  },
  {
    id: 'painting-4',
    title: '治愈花朵',
    artist: '涂色本',
    era: '现代',
    description: '一个美丽的花朵图案，适合涂色放松',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=adult%20coloring%20book%20page%20intricate%20flower%20pattern%20black%20and%20white%20line%20art&image_size=square',
    category: 'coloring',
    colors: []
  },
  {
    id: 'painting-5',
    title: '神秘森林',
    artist: '涂色本',
    era: '现代',
    description: '一个神秘的森林场景，等待你用色彩点亮',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=adult%20coloring%20book%20page%20mystical%20forest%20trees%20animals%20black%20and%20white%20line%20art&image_size=square',
    category: 'coloring',
    colors: []
  }
];

// 模拟冥想数据
export const mockMeditations: Meditation[] = [
  {
    id: 'meditation-1',
    title: '4-7-8 呼吸法',
    duration: 300,
    category: 'breathing',
    description: '通过调整呼吸节奏，帮助缓解焦虑和压力',
    audioUrl: '',
    steps: [
      { order: 1, instruction: '用鼻子吸气4秒，感受腹部隆起', duration: 4, breathingHint: 'inhale' },
      { order: 2, instruction: '屏息7秒，保持平静', duration: 7, breathingHint: 'hold' },
      { order: 3, instruction: '用嘴呼气8秒，发出"嘘"的声音', duration: 8, breathingHint: 'exhale' },
      { order: 4, instruction: '重复以上循环，保持专注', duration: 281, breathingHint: 'inhale' }
    ]
  },
  {
    id: 'meditation-2',
    title: '身体扫描',
    duration: 480,
    category: 'body-scan',
    description: '从头到脚逐步觉察身体的每个部位，释放紧张',
    audioUrl: '',
    steps: [
      { order: 1, instruction: '闭上眼睛，专注于头顶的感觉', duration: 30, breathingHint: 'inhale' },
      { order: 2, instruction: '将注意力移到额头，感受任何紧张或放松', duration: 30, breathingHint: 'exhale' },
      { order: 3, instruction: '继续向下，关注眼睛、脸颊、嘴巴', duration: 40, breathingHint: 'inhale' },
      { order: 4, instruction: '移到颈部和肩膀，释放任何紧绷感', duration: 40, breathingHint: 'exhale' },
      { order: 5, instruction: '继续向下扫描手臂、胸部、腹部', duration: 60, breathingHint: 'inhale' },
      { order: 6, instruction: '最后扫描双腿和双脚，完全放松', duration: 280, breathingHint: 'exhale' }
    ]
  },
  {
    id: 'meditation-3',
    title: '慈心禅',
    duration: 420,
    category: 'loving-kindness',
    description: '培养对自己和他人的慈爱之心',
    audioUrl: '',
    steps: [
      { order: 1, instruction: '先对自己说：愿我平安，愿我快乐', duration: 60, breathingHint: 'inhale' },
      { order: 2, instruction: '想象一个你爱的人，愿他/她平安快乐', duration: 60, breathingHint: 'exhale' },
      { order: 3, instruction: '想象一个普通朋友，同样送出祝福', duration: 60, breathingHint: 'inhale' },
      { order: 4, instruction: '想象一个你不太喜欢的人，尝试送出祝福', duration: 60, breathingHint: 'exhale' },
      { order: 5, instruction: '将慈爱扩展到所有众生', duration: 180, breathingHint: 'inhale' }
    ]
  },
  {
    id: 'meditation-4',
    title: '睡前冥想',
    duration: 600,
    category: 'sleep',
    description: '帮助你放下一天的思绪，轻松入眠',
    audioUrl: '',
    steps: [
      { order: 1, instruction: '舒适地躺下，放松全身', duration: 60, breathingHint: 'inhale' },
      { order: 2, instruction: '回顾今天，感谢所有美好的事情', duration: 120, breathingHint: 'exhale' },
      { order: 3, instruction: '放下任何担忧，它们可以等到明天', duration: 120, breathingHint: 'inhale' },
      { order: 4, instruction: '专注于呼吸，让身体越来越沉重', duration: 180, breathingHint: 'exhale' },
      { order: 5, instruction: '允许自己进入甜美的梦乡', duration: 120, breathingHint: 'inhale' }
    ]
  }
];

// 模拟白噪音数据
export const mockWhiteNoises: WhiteNoise[] = [
  {
    id: 'noise-1',
    name: '雨声',
    icon: '🌧️',
    audioUrl: '',
    category: 'rain',
    volume: 0.8
  },
  {
    id: 'noise-2',
    name: '森林',
    icon: '🌲',
    audioUrl: '',
    category: 'forest',
    volume: 0.8
  },
  {
    id: 'noise-3',
    name: '晚风',
    icon: '🌬️',
    audioUrl: '',
    category: 'wind',
    volume: 0.8
  },
  {
    id: 'noise-4',
    name: '溪流',
    icon: '🌊',
    audioUrl: '',
    category: 'stream',
    volume: 0.8
  }
];

// 模拟心理测试数据
export const mockTests: PsychologicalTest[] = [
  {
    id: 'test-1',
    title: '情绪状态自评量表',
    description: '评估你当前的情绪状态，帮助你更好地了解自己',
    category: 'emotion',
    questions: [
      {
        id: 'q1',
        text: '最近一周，你是否经常感到情绪低落？',
        options: [
          { id: 'q1a', text: '几乎没有', score: 0 },
          { id: 'q1b', text: '偶尔', score: 1 },
          { id: 'q1c', text: '经常', score: 2 },
          { id: 'q1d', text: '几乎总是', score: 3 }
        ]
      },
      {
        id: 'q2',
        text: '你是否对以前喜欢的事情失去了兴趣？',
        options: [
          { id: 'q2a', text: '完全没有', score: 0 },
          { id: 'q2b', text: '有点', score: 1 },
          { id: 'q2c', text: '比较明显', score: 2 },
          { id: 'q2d', text: '非常明显', score: 3 }
        ]
      },
      {
        id: 'q3',
        text: '你的睡眠质量如何？',
        options: [
          { id: 'q3a', text: '很好', score: 0 },
          { id: 'q3b', text: '一般', score: 1 },
          { id: 'q3c', text: '较差', score: 2 },
          { id: 'q3d', text: '很差', score: 3 }
        ]
      },
      {
        id: 'q4',
        text: '你是否感到容易疲劳？',
        options: [
          { id: 'q4a', text: '几乎没有', score: 0 },
          { id: 'q4b', text: '偶尔', score: 1 },
          { id: 'q4c', text: '经常', score: 2 },
          { id: 'q4d', text: '几乎总是', score: 3 }
        ]
      },
      {
        id: 'q5',
        text: '你是否容易感到焦虑或担心？',
        options: [
          { id: 'q5a', text: '几乎没有', score: 0 },
          { id: 'q5b', text: '偶尔', score: 1 },
          { id: 'q5c', text: '经常', score: 2 },
          { id: 'q5d', text: '几乎总是', score: 3 }
        ]
      }
    ]
  }
];

// 模拟用户数据
export const mockUser: User = {
  id: 'user-1',
  name: '疗愈者',
  avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=peaceful%20meditation%20avatar%20soft%20warm%20colors%20gentle%20smile%20artistic%20style&image_size=square',
  bio: '在艺术中寻找内心的平静',
  privatePassword: '123456',
  createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
  preferences: {
    theme: 'light',
    defaultEmotion: 'anxiety',
    notifications: {
      dailyCheckin: true,
      meditationReminder: true,
      newContent: false
    }
  }
};
