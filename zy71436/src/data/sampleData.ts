import type { Artwork, Valuation, CollectorProfile, AuctionRound } from '../types';

const ARTWORKS: Artwork[] = [
  {
    id: 'art-1',
    name: '塞纳河畔的晨雾',
    artist: '克洛德·莫兰',
    year: '1873',
    description: '一幅典型的印象派风景油画，捕捉了清晨塞纳河面上的朦胧光影。笔触自由奔放，色彩以蓝紫与淡金交织。画面右侧隐约可见教堂轮廓，左岸柳树倒影随波荡漾。近年印象派市场持续升温，但本幅尺幅偏小，且无明确展览记录。',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=impressionist%20painting%20of%20Seine%20river%20morning%20fog%20soft%20blue%20purple%20golden%20light%20willow%20trees%20reflection%20oil%20on%20canvas%20museum%20quality&image_size=landscape_16_9',
    category: '印象派油画',
  },
  {
    id: 'art-2',
    name: '汝窑天青釉洗',
    artist: '佚名（北宋汝窑）',
    year: '约1100年',
    description: '极为罕见的北宋汝窑天青釉笔洗，釉面莹润如玉，开片细密自然。底足满釉支钉烧造，三枚芝麻钉痕清晰可辨。汝窑传世品不足百件，此品相完整、釉色纯正，堪称博物馆级珍品。唯口沿有一处极细微磕碰，需仔细辨识。',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Song%20dynasty%20Ru%20ware%20celadon%20brush%20washer%20sky%20blue%20glaze%20crackle%20pattern%20elegant%20porcelain%20museum%20display%20dark%20background&image_size=square',
    category: '古代瓷器',
  },
  {
    id: 'art-3',
    name: '解构·序章',
    artist: '陈逸飞',
    year: '2019',
    description: '当代装置艺术作品，由不锈钢骨架与半透明亚克力板构成，内置可编程LED灯组。作品探讨数字时代人与空间的关系，观者可通过手机App实时改变灯光色温与律动节奏。创作理念前卫，但维护成本较高，且需要专业安装团队。',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=contemporary%20installation%20art%20steel%20frame%20translucent%20acrylic%20panels%20LED%20lights%20minimalist%20gallery%20white%20cube%20space&image_size=landscape_16_9',
    category: '当代装置',
  },
  {
    id: 'art-4',
    name: '行书七言联',
    artist: '郑板桥',
    year: '约1760年',
    description: '郑板桥行书七言对联，纸本水墨。笔法遒劲中见潇洒，结体疏密有致，尽显"六分半书"独特面貌。上联"室雅何须大"，下联"花香不在多"。铃印两方：朱文"郑燮之印"、白文"板桥"。来源清晰，著录于《中国古代书画图目》。但近年清代书法市场整体偏冷。',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Chinese%20calligraphy%20couplet%20running%20script%20ink%20on%20paper%20Qing%20dynasty%20Zheng%20Banqiao%20style%20elegant%20scroll%20museum%20quality&image_size=portrait_4_3',
    category: '古代书画',
  },
  {
    id: 'art-5',
    name: '无题（红与黑）',
    artist: '弗兰兹·克莱因',
    year: '1958',
    description: '战后抽象表现主义代表作品，大尺幅布面油画。画面以粗犷的黑色笔触横贯红色背景，张力十足。克莱因以"动作绘画"闻名，此作是其成熟期的典型风格。来源为纽约知名画廊旧藏，展览履历丰富。估价偏高但市场认可度稳固，同类作品近年拍卖记录均超预期成交。',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=abstract%20expressionist%20painting%20bold%20black%20brushstrokes%20on%20red%20background%20Franz%20Kline%20style%20large%20canvas%20museum%20quality&image_size=landscape_16_9',
    category: '战后抽象',
  },
];

const VALUATIONS: Valuation[] = [
  { lowEstimate: 800000, highEstimate: 1200000, source: '佳士得印象派部', confidence: 0.85, reservePrice: 900000 },
  { lowEstimate: 3000000, highEstimate: 5000000, source: '苏富比中国艺术部', confidence: 0.92, reservePrice: 3500000 },
  { lowEstimate: 150000, highEstimate: 300000, source: '当代艺术评估中心', confidence: 0.6, reservePrice: 180000 },
  { lowEstimate: 500000, highEstimate: 800000, source: '中国嘉德古代书画部', confidence: 0.78, reservePrice: 550000 },
  { lowEstimate: 5000000, highEstimate: 8000000, source: '菲利普斯战后艺术部', confidence: 0.88, reservePrice: 5500000 },
];

const COLLECTORS: CollectorProfile[] = [
  {
    id: 'collector-1',
    name: '张耀廷',
    avatar: '🏛️',
    preferenceType: 'aggressive',
    aggressiveness: 0.85,
    maxBudget: 15000000,
    favoriteCategory: '印象派油画',
    description: '房地产大亨，以激进出价著称。偏爱印象派与战后抽象，预算充裕但容易冲动加价。拍卖会上经常成为"价格推手"。',
  },
  {
    id: 'collector-2',
    name: '李淑芬',
    avatar: '🪭',
    preferenceType: 'conservative',
    aggressiveness: 0.35,
    maxBudget: 8000000,
    favoriteCategory: '古代瓷器',
    description: '资深收藏家，行事谨慎。专攻古代瓷器与书画，从不超出估价区间。有时因保守错失良机，但极少判断失误。',
  },
  {
    id: 'collector-3',
    name: '王思远',
    avatar: '🎨',
    preferenceType: 'selective',
    aggressiveness: 0.6,
    maxBudget: 6000000,
    favoriteCategory: '当代装置',
    description: '当代艺术画廊主，眼光独到但只追特定品类。对当代艺术出价果断，对其他品类几乎不参与。偏好有展览履历的作品。',
  },
  {
    id: 'collector-4',
    name: '赵敏慧',
    avatar: '💎',
    preferenceType: 'opportunistic',
    aggressiveness: 0.5,
    maxBudget: 10000000,
    favoriteCategory: '战后抽象',
    description: '投资型藏家，善于寻找价值洼地。偏好市场认可度高的品类，会在别人犹豫时果断出手。预算管理严格，但偶尔也会为了心仪作品超额出价。',
  },
];

function generateConflicts(artwork: Artwork, valuation: Valuation, collectors: CollectorProfile[]): AuctionRound['conflictLogs'] {
  const conflicts: AuctionRound['conflictLogs'] = [];

  if (valuation.confidence < 0.7) {
    conflicts.push({
      conflictType: 'estimate_vs_description',
      description: `"${artwork.name}"的估价置信度仅${Math.round(valuation.confidence * 100)}%，估价来源"${valuation.source}"与拍品描述中的信息存在不确定性。描述中提到的负面因素可能未被充分计入估价。`,
      resolution: 'deferred',
      roundIndex: ARTWORKS.indexOf(artwork),
    });
  }

  if (valuation.highEstimate > valuation.lowEstimate * 2) {
    conflicts.push({
      conflictType: 'estimate_vs_description',
      description: `"${artwork.name}"的估价区间跨度达${Math.round((valuation.highEstimate - valuation.lowEstimate) / 10000)}万，高低估值之比超过2:1，表明市场分歧较大，描述中的正面与负面信息可能被不同评估师做了不同解读。`,
      resolution: 'deferred',
      roundIndex: ARTWORKS.indexOf(artwork),
    });
  }

  const aggressiveCollectors = collectors.filter(c => c.preferenceType === 'aggressive' && c.favoriteCategory !== artwork.category);
  for (const c of aggressiveCollectors) {
    conflicts.push({
      conflictType: 'collector_vs_estimate',
      description: `藏家${c.name}（激进型）的偏好品类为"${c.favoriteCategory}"，与当前拍品"${artwork.category}"不符，但其激进出价风格可能导致其仍参与竞价，从而推高成交价偏离估价。`,
      resolution: 'player_judgment',
      roundIndex: ARTWORKS.indexOf(artwork),
    });
    break;
  }

  const selectiveCollectors = collectors.filter(c => c.preferenceType === 'selective' && c.favoriteCategory === artwork.category);
  if (selectiveCollectors.length > 0) {
    conflicts.push({
      conflictType: 'collector_vs_description',
      description: `藏家${selectiveCollectors[0].name}（选择型）恰好偏好"${artwork.category}"，会全力竞拍此品。但描述中提到的风险因素（维护成本、市场偏冷等）可能被其忽视，形成偏好与理性的冲突。`,
      resolution: 'player_judgment',
      roundIndex: ARTWORKS.indexOf(artwork),
    });
  }

  return conflicts;
}

function selectCollectorsForRound(artwork: Artwork): CollectorProfile[] {
  const shuffled = [...COLLECTORS].sort(() => Math.random() - 0.5);
  const selected: CollectorProfile[] = [];
  const favorite = shuffled.filter(c => c.favoriteCategory === artwork.category);
  selected.push(...favorite);
  const others = shuffled.filter(c => c.favoriteCategory !== artwork.category);
  const additionalCount = Math.random() > 0.4 ? 2 : 1;
  selected.push(...others.slice(0, additionalCount));
  return selected.slice(0, 3);
}

export function createSampleRounds(): AuctionRound[] {
  return ARTWORKS.map((artwork, index) => {
    const valuation = VALUATIONS[index];
    const activeCollectors = selectCollectorsForRound(artwork);
    const conflictLogs = generateConflicts(artwork, valuation, activeCollectors);
    return {
      artwork,
      valuation,
      activeCollectors,
      bidRecords: [],
      conflictLogs,
      anomalyEvents: [],
      finalPrice: 0,
      winner: null,
      reservePrice: valuation.reservePrice,
      status: 'pending' as const,
    };
  });
}

export { ARTWORKS, VALUATIONS, COLLECTORS };
