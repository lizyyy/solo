import { Point } from '../types';

export const sampleGisPoints: Partial<Point>[] = [
  {
    name: '幸福社区老年活动中心',
    address: '幸福路123号',
    lat: 31.2304,
    lng: 121.4737,
    source: 'gis',
    category: '养老服务',
    description: '社区老年活动场所',
  },
  {
    name: '阳光小区卫生站',
    address: '阳光路456号',
    lat: 31.2314,
    lng: 121.4747,
    source: 'gis',
    category: '医疗服务',
    description: '小区卫生服务站',
  },
  {
    name: '和平街菜市场',
    address: '和平路789号',
    lat: 31.2324,
    lng: 121.4757,
    source: 'gis',
    category: '商业服务',
    description: '街道便民菜市场',
  },
  {
    name: '星光幼儿园',
    address: '星光路101号',
    lat: 31.2334,
    lng: 121.4767,
    source: 'gis',
    category: '教育服务',
    description: '公办幼儿园',
  },
];

export const sampleResidentFeedback: Partial<Point>[] = [
  {
    name: '幸福路老年活动室',
    address: '幸福路123号',
    lat: 31.2304,
    lng: 121.4737,
    source: 'resident',
    category: '养老服务',
    description: '居民反馈：周末开门时间太晚，希望早上8点开放',
  },
  {
    name: '阳光卫生站',
    address: '阳光路456号',
    lat: 31.2314,
    lng: 121.4747,
    source: 'resident',
    category: '医疗服务',
    description: '居民反馈：全科医生坐诊时间太少',
  },
  {
    name: '和平菜场',
    address: '和平路789号',
    lat: 31.2324,
    lng: 121.4757,
    source: 'resident',
    category: '商业服务',
    description: '居民反馈：蔬菜摊点太少，希望增加',
  },
  {
    name: '康乐健身点',
    address: '康乐路202号',
    lat: 31.2344,
    lng: 121.4777,
    source: 'resident',
    category: '体育健身',
    description: '居民反馈：健身器材损坏需要维修',
  },
];

export const sampleInspectionPoints: Partial<Point>[] = [
  {
    name: '幸福社区活动中心',
    address: '幸福路123号',
    lat: 31.2304,
    lng: 121.4737,
    source: 'inspection',
    category: '养老服务',
    description: '巡检发现：消防器材需要检查',
  },
  {
    name: '阳光小区社区医院',
    address: '阳光大道456号',
    lat: 31.2314,
    lng: 121.4747,
    source: 'inspection',
    category: '医疗服务',
    description: '巡检发现：门口无障碍通道被占用',
  },
  {
    name: '星光托儿所',
    address: '星光路101号',
    lat: 31.2334,
    lng: 121.4767,
    source: 'inspection',
    category: '教育服务',
    description: '巡检发现：安保人员在岗情况良好',
  },
];

export const sampleStreetNotes: Partial<Point>[] = [
  {
    name: '幸福路老年活动中心',
    address: '幸福路123号',
    lat: 31.2304,
    lng: 121.4737,
    source: 'street',
    category: '养老服务',
    description: '周姐备注：此点位已列入整改计划，预计下月完成',
  },
  {
    name: '康乐路健身点',
    address: '康乐路202号',
    lat: 31.2344,
    lng: 121.4777,
    source: 'street',
    category: '体育健身',
    description: '周姐备注：需要现场确认位置是否正确',
  },
];

export function createPoint(partial: Partial<Point>): Point {
  const now = new Date().toISOString();
  return {
    id: `point-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: partial.name || '',
    address: partial.address || '',
    lat: partial.lat || 0,
    lng: partial.lng || 0,
    source: partial.source || 'gis',
    status: partial.status || 'pending',
    category: partial.category || '',
    description: partial.description || '',
    createdAt: now,
    updatedAt: now,
    feedbacks: [],
    photos: [],
    history: [
      {
        id: `hist-${Date.now()}`,
        pointId: '',
        action: 'import',
        operator: '系统导入',
        timestamp: now,
        remark: `从${partial.source === 'gis' ? 'GIS' : partial.source === 'resident' ? '居民反馈' : partial.source === 'inspection' ? '巡检记录' : '街道备注'}导入`,
      },
    ],
    conflicts: [],
  };
}

export function generateSampleData(): Point[] {
  const allPoints: Partial<Point>[] = [
    ...sampleGisPoints,
    ...sampleResidentFeedback,
    ...sampleInspectionPoints,
    ...sampleStreetNotes,
  ];

  return allPoints.map((p) => createPoint(p));
}

export function generateSmoothCaseData(): Point[] {
  const points: Partial<Point>[] = [
    {
      name: '中心公园',
      address: '中央大道1号',
      lat: 31.23,
      lng: 121.47,
      source: 'gis',
      category: '公园绿地',
      description: 'GIS系统中记录的主要公园',
      status: 'pending',
    },
    {
      name: '中央公园',
      address: '中央大道1号',
      lat: 31.23,
      lng: 121.47,
      source: 'resident',
      category: '公园绿地',
      description: '居民反映：休息座椅太少',
      status: 'pending',
    },
    {
      name: '中央大道公园',
      address: '中央大道1号',
      lat: 31.23,
      lng: 121.47,
      source: 'inspection',
      category: '公园绿地',
      description: '巡检：绿化维护良好',
      status: 'pending',
    },
  ];

  return points.map((p, idx) => ({
    ...createPoint(p),
    id: `smooth-${idx}`,
  }));
}

export function generateReworkCaseData(): Point[] {
  const points: Partial<Point>[] = [
    {
      name: '东城区图书馆',
      address: '东大街88号',
      lat: 31.24,
      lng: 121.48,
      source: 'gis',
      category: '文化服务',
      description: '东城区公共图书馆',
      status: 'pending',
    },
    {
      name: '东城街道图书馆',
      address: '东大街88号附1号',
      lat: 31.2401,
      lng: 121.4801,
      source: 'resident',
      category: '文化服务',
      description: '居民反馈：晚上不开放，希望延长时间',
      status: 'pending',
    },
    {
      name: '东区图书馆分馆',
      address: '西大街66号',
      lat: 31.25,
      lng: 121.49,
      source: 'street',
      category: '文化服务',
      description: '街道备注：此为分馆，需要与主馆区分',
      status: 'pending',
    },
  ];

  return points.map((p, idx) => ({
    ...createPoint(p),
    id: `rework-${idx}`,
  }));
}
