import type { CustomerPreference } from '../types/game';

export const customerPreferences: CustomerPreference[] = [
  {
    id: 'cust-001',
    name: '老张',
    avatar: '👴',
    favoriteGenres: ['Jazz'],
    budget: 80,
    willingnessToPay: 1.2,
    description: '资深爵士乐迷，退休后每天来店里听唱片。只买正宗的爵士名盘，愿意为好货多花钱。',
    source: '三年常客，每周五下午必来'
  },
  {
    id: 'cust-002',
    name: '小明',
    avatar: '👦',
    favoriteGenres: ['Rock', 'Grunge', 'Pop'],
    budget: 50,
    willingnessToPay: 0.9,
    description: '大学生，刚开始收集黑胶。预算有限，但对经典摇滚专辑很感兴趣。',
    source: '附近大学的音乐社团成员'
  },
  {
    id: 'cust-003',
    name: '李姐',
    avatar: '👩',
    favoriteGenres: ['Pop', 'Electronic'],
    budget: 100,
    willingnessToPay: 1.1,
    description: '白领上班族，周末来放松。喜欢流行和电子音乐，追求音质。',
    source: '住在附近小区的老顾客'
  },
  {
    id: 'cust-004',
    name: '老王',
    avatar: '🧔',
    favoriteGenres: ['Progressive Rock', 'Art Rock', 'Glam Rock'],
    budget: 150,
    willingnessToPay: 1.3,
    description: '资深收藏家，专门找稀有盘。预算充足，只要是好货不惜代价。',
    source: '本地黑胶收藏家协会会长'
  },
  {
    id: 'cust-005',
    name: '阿花',
    avatar: '👧',
    favoriteGenres: ['Post-Punk', 'Art Rock'],
    budget: 70,
    willingnessToPay: 1.0,
    description: '文艺青年，喜欢小众音乐。品味独特，对主流音乐不感冒。',
    source: '独立书店店员'
  },
  {
    id: 'cust-006',
    name: 'Bob',
    avatar: '🇯🇲',
    favoriteGenres: ['Reggae'],
    budget: 60,
    willingnessToPay: 1.0,
    description: '牙买加留学生，只买雷鬼音乐。对其他音乐完全没兴趣。',
    source: '附近大学的交换生'
  },
  {
    id: 'cust-007',
    name: '陈老师',
    avatar: '👨‍🏫',
    favoriteGenres: ['Jazz', 'Progressive Rock'],
    budget: 120,
    willingnessToPay: 1.15,
    description: '音乐教授，学术型买家。注重唱片的历史价值和版本。',
    source: '音乐学院的资深教授'
  },
  {
    id: 'cust-008',
    name: '小美',
    avatar: '👱‍♀️',
    favoriteGenres: ['Pop', 'Glam Rock'],
    budget: 90,
    willingnessToPay: 1.25,
    description: '时尚博主，买来做装饰品和拍照。封面好看最重要！',
    source: '社交媒体影响者'
  }
];
