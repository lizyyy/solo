import type { Artwork, Collector, Booth } from '../types';

export const mockArtworks: Artwork[] = [
  {
    id: 'art-001',
    title: '数字黎明',
    artist: '林晓',
    genre: 'digital',
    estimatedValue: 8000,
    baseRoyaltyRate: 10,
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=digital%20art%20sunrise%20cyberpunk%20neon%20colors&image_size=square_hd',
    tags: ['赛博朋克', '霓虹', '未来'],
    conflictStatus: 'none',
    conflictDetails: []
  },
  {
    id: 'art-002',
    title: '量子波动',
    artist: '张艺',
    genre: 'generative',
    estimatedValue: 12000,
    baseRoyaltyRate: 15,
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=generative%20art%20quantum%20waves%20flowing%20blue%20particles&image_size=square_hd',
    tags: ['生成艺术', '粒子', '流动'],
    conflictStatus: 'flagged',
    conflictDetails: ['估值区间存在冲突：数据库记录为10000-15000，当前设置为12000']
  },
  {
    id: 'art-003',
    title: '像素古城',
    artist: '王星',
    genre: 'pixel',
    estimatedValue: 5000,
    baseRoyaltyRate: 8,
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=pixel%20art%20ancient%20city%20retro%20game%20style&image_size=square_hd',
    tags: ['像素', '复古', '游戏'],
    conflictStatus: 'none',
    conflictDetails: []
  },
  {
    id: 'art-004',
    title: '抽象梦境',
    artist: '陈雨',
    genre: 'abstract',
    estimatedValue: 15000,
    baseRoyaltyRate: 12,
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=abstract%20art%20dream%20surreal%20colors%20flowing&image_size=square_hd',
    tags: ['抽象', '超现实', '梦境'],
    conflictStatus: 'none',
    conflictDetails: []
  },
  {
    id: 'art-005',
    title: '机械花园',
    artist: '林晓',
    genre: '3d',
    estimatedValue: 20000,
    baseRoyaltyRate: 18,
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=3d%20render%20mechanical%20garden%20futuristic%20plants&image_size=square_hd',
    tags: ['3D', '机械', '自然'],
    conflictStatus: 'none',
    conflictDetails: []
  },
  {
    id: 'art-006',
    title: '光影瞬间',
    artist: '刘影',
    genre: 'photography',
    estimatedValue: 6000,
    baseRoyaltyRate: 7,
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=photography%20light%20shadow%20street%20dramatic&image_size=square_hd',
    tags: ['摄影', '光影', '街头'],
    conflictStatus: 'flagged',
    conflictDetails: ['版税率冲突：艺术家合同约定为5%，当前设置为7%']
  }
];

export const mockCollectors: Collector[] = [
  {
    id: 'col-001',
    name: '张先生',
    avatar: '👨‍💼',
    budget: 50000,
    preferredGenres: ['digital', '3d'],
    preferredArtists: ['林晓', '张艺'],
    satisfaction: 85,
    bidCount: 0
  },
  {
    id: 'col-002',
    name: '李女士',
    avatar: '👩‍🎨',
    budget: 30000,
    preferredGenres: ['abstract', 'generative'],
    preferredArtists: ['陈雨', '张艺'],
    satisfaction: 90,
    bidCount: 0
  },
  {
    id: 'col-003',
    name: '王总',
    avatar: '🧑‍💻',
    budget: 100000,
    preferredGenres: ['pixel', 'photography'],
    preferredArtists: ['王星', '刘影'],
    satisfaction: 80,
    bidCount: 0
  },
  {
    id: 'col-004',
    name: '陈教授',
    avatar: '👨‍🏫',
    budget: 45000,
    preferredGenres: ['abstract', 'digital'],
    preferredArtists: ['林晓', '陈雨'],
    satisfaction: 88,
    bidCount: 0
  }
];

export const mockBooths: Booth[] = [
  { id: 'booth-1', heatLevel: 1, heatBonus: 0.8, artworkId: null, reservePrice: 0, royaltyRate: 0 },
  { id: 'booth-2', heatLevel: 2, heatBonus: 0.9, artworkId: null, reservePrice: 0, royaltyRate: 0 },
  { id: 'booth-3', heatLevel: 3, heatBonus: 1.0, artworkId: null, reservePrice: 0, royaltyRate: 0 },
  { id: 'booth-4', heatLevel: 4, heatBonus: 1.1, artworkId: null, reservePrice: 0, royaltyRate: 0 },
  { id: 'booth-5', heatLevel: 5, heatBonus: 1.2, artworkId: null, reservePrice: 0, royaltyRate: 0 },
  { id: 'booth-6', heatLevel: 6, heatBonus: 1.3, artworkId: null, reservePrice: 0, royaltyRate: 0 }
];

export const heatLevelColors: Record<number, string> = {
  1: 'from-slate-600',
  2: 'from-slate-500',
  3: 'from-emerald-600',
  4: 'from-amber-500',
  5: 'from-orange-500',
  6: 'from-rose-500'
};

export const genreLabels: Record<string, string> = {
  abstract: '抽象艺术',
  digital: '数字艺术',
  generative: '生成艺术',
  photography: '数字摄影',
  pixel: '像素艺术',
  '3d': '3D艺术'
};

export const scenarioLabels: Record<string, string> = {
  normal: '正常成交',
  reserve_too_high: '底价过高流拍',
  royalty_missing: '版税漏算警告',
  duplicate_bidder: '同藏家重复竞拍'
};
