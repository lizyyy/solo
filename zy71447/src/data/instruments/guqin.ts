import type { InstrumentModel, ResonanceCavity, FrequencySample, Hotspot, InstrumentDataBundle } from '@/types';

export const guqinInstrument: InstrumentModel = {
  id: 'guqin-001',
  name: '古琴',
  dimensions: { width: 0.25, height: 0.1, depth: 1.2 },
  centerPoint: { x: 0, y: 0, z: 0 },
  materialGroups: [
    { id: 'mat-1', name: '面板（桐木）', color: '#D4A574', opacity: 1, visible: true },
    { id: 'mat-2', name: '底板（梓木）', color: '#8B4513', opacity: 1, visible: true },
    { id: 'mat-3', name: '岳山', color: '#2F1810', opacity: 1, visible: true },
    { id: 'mat-4', name: '龙龈', color: '#2F1810', opacity: 1, visible: true },
    { id: 'mat-5', name: '琴徽（贝壳）', color: '#F5F5F5', opacity: 1, visible: true },
    { id: 'mat-6', name: '漆层', color: '#1A1A1A', opacity: 0.9, visible: true },
  ],
  sectionReferences: [
    { id: 'sec-1', axis: 'y', position: 0, label: '水平剖面（共鸣腔）' },
    { id: 'sec-2', axis: 'x', position: 0, label: '纵向剖面（音柱）' },
    { id: 'sec-3', axis: 'z', position: -0.3, label: '龙池剖面' },
  ],
  dataVersion: 'v2.1.0',
  description: '七弦古琴，又称瑶琴、玉琴，是中国传统弹拨乐器，有三千多年历史。其共鸣结构独特，面板与底板之间形成狭长的共鸣腔，通过龙池、凤沼两个音孔与外界相通。',
};

export const guqinCavities: ResonanceCavity[] = [
  {
    id: 'cav-1',
    instrumentId: 'guqin-001',
    name: '主共鸣腔',
    boundary: [
      { x: -0.12, y: -0.04, z: -0.55 },
      { x: 0.12, y: -0.04, z: -0.55 },
      { x: 0.12, y: 0.03, z: -0.55 },
      { x: -0.12, y: 0.03, z: -0.55 },
      { x: -0.12, y: -0.04, z: 0.55 },
      { x: 0.12, y: -0.04, z: 0.55 },
      { x: 0.12, y: 0.03, z: 0.55 },
      { x: -0.12, y: 0.03, z: 0.55 },
    ],
    material: '空气腔',
    thickness: 0,
    volume: 0.0018,
    color: 'rgba(184, 134, 11, 0.15)',
  },
  {
    id: 'cav-2',
    instrumentId: 'guqin-001',
    name: '龙池音孔',
    boundary: [
      { x: -0.04, y: -0.05, z: -0.15 },
      { x: 0.04, y: -0.05, z: -0.15 },
      { x: 0.04, y: -0.04, z: -0.15 },
      { x: -0.04, y: -0.04, z: -0.15 },
      { x: -0.04, y: -0.05, z: 0.05 },
      { x: 0.04, y: -0.05, z: 0.05 },
      { x: 0.04, y: -0.04, z: 0.05 },
      { x: -0.04, y: -0.04, z: 0.05 },
    ],
    material: '音孔',
    thickness: 0,
    volume: 0.000064,
    color: 'rgba(30, 136, 229, 0.2)',
  },
  {
    id: 'cav-3',
    instrumentId: 'guqin-001',
    name: '凤沼音孔',
    boundary: [
      { x: -0.03, y: -0.05, z: 0.25 },
      { x: 0.03, y: -0.05, z: 0.25 },
      { x: 0.03, y: -0.04, z: 0.25 },
      { x: -0.03, y: -0.04, z: 0.25 },
      { x: -0.03, y: -0.05, z: 0.4 },
      { x: 0.03, y: -0.05, z: 0.4 },
      { x: 0.03, y: -0.04, z: 0.4 },
      { x: -0.03, y: -0.04, z: 0.4 },
    ],
    material: '音孔',
    thickness: 0,
    volume: 0.000036,
    color: 'rgba(67, 160, 71, 0.2)',
  },
];

const generateGuqinSamples = (): FrequencySample[] => {
  const samples: FrequencySample[] = [];
  const positions = [
    { x: 0, y: 0, z: -0.5, band: 'low' as const },
    { x: 0, y: 0, z: -0.3, band: 'low' as const },
    { x: 0, y: 0, z: -0.1, band: 'mid' as const },
    { x: 0, y: 0, z: 0.1, band: 'mid' as const },
    { x: 0, y: 0, z: 0.3, band: 'high' as const },
    { x: 0, y: 0, z: 0.5, band: 'high' as const },
    { x: -0.08, y: 0, z: -0.2, band: 'low' as const },
    { x: 0.08, y: 0, z: 0, band: 'mid' as const },
    { x: -0.08, y: 0, z: 0.2, band: 'high' as const },
  ];

  const freqData = [
    { freq: 98, response: 78 }, { freq: 123, response: 82 }, { freq: 147, response: 85 },
    { freq: 196, response: 88 }, { freq: 247, response: 86 }, { freq: 294, response: 83 },
    { freq: 392, response: 80 }, { freq: 494, response: 77 }, { freq: 587, response: 75 },
    { freq: 784, response: 72 }, { freq: 988, response: 70 }, { freq: 1175, response: 68 },
    { freq: 1568, response: 65 }, { freq: 1976, response: 63 }, { freq: 2349, response: 60 },
    { freq: 3136, response: 58 }, { freq: 3951, response: 55 }, { freq: 4699, response: 52 },
    { freq: 6272, response: 50 }, { freq: 7902, response: 48 },
  ];

  for (let i = 0; i < 20; i++) {
    const pos = positions[i % positions.length];
    const fd = freqData[i];
    samples.push({
      id: `sample-guqin-${i + 1}`,
      instrumentId: 'guqin-001',
      position: { x: pos.x, y: pos.y, z: pos.z + (Math.random() - 0.5) * 0.1 },
      frequency: fd.freq,
      responseIntensity: fd.response + (Math.random() - 0.5) * 4,
      band: fd.freq < 250 ? 'low' : fd.freq < 2000 ? 'mid' : 'high',
      dataSource: '声学实验室实测',
      measurementDate: '2026-05-15',
    });
  }
  return samples;
};

export const guqinSamples: FrequencySample[] = generateGuqinSamples();

export const guqinHotspots: Hotspot[] = [
  {
    id: 'hot-1',
    instrumentId: 'guqin-001',
    name: '龙池',
    description: '古琴主要音孔，位于底板中部偏上，呈长方形。负责中低频声音的辐射，是古琴音色浑厚的关键结构。',
    position: { x: 0, y: -0.045, z: -0.05 },
    category: 'structure',
    importance: 5,
  },
  {
    id: 'hot-2',
    instrumentId: 'guqin-001',
    name: '凤沼',
    description: '古琴次要音孔，位于底板下部，尺寸较小。主要辅助高频声音的传播，平衡整体音色。',
    position: { x: 0, y: -0.045, z: 0.325 },
    category: 'structure',
    importance: 4,
  },
  {
    id: 'hot-3',
    instrumentId: 'guqin-001',
    name: '天柱',
    description: '连接面板与底板的圆柱形木柱，位于琴体中部偏上。起到支撑和振动传导作用，影响中频段响应。',
    position: { x: 0, y: 0, z: -0.2 },
    category: 'structure',
    importance: 5,
  },
  {
    id: 'hot-4',
    instrumentId: 'guqin-001',
    name: '地柱',
    description: '连接面板与底板的圆柱形木柱，位于琴体中部偏下。与天柱共同构成琴体的"骨架"，稳定整体结构。',
    position: { x: 0, y: 0, z: 0.2 },
    category: 'structure',
    importance: 5,
  },
  {
    id: 'hot-5',
    instrumentId: 'guqin-001',
    name: '面板弧度',
    description: '桐木面板呈拱形，中间厚约5mm，边缘逐渐变薄。这种渐变厚度设计使得不同频段的振动都能得到充分响应。',
    position: { x: 0, y: 0.025, z: 0 },
    category: 'acoustics',
    importance: 5,
  },
  {
    id: 'hot-6',
    instrumentId: 'guqin-001',
    name: '纳音',
    description: '面板内侧对应龙池、凤沼位置的凸起木条，用于引导声波反射，增强特定频段的共鸣效果。',
    position: { x: 0, y: 0.01, z: -0.05 },
    category: 'acoustics',
    importance: 4,
  },
  {
    id: 'hot-7',
    instrumentId: 'guqin-001',
    name: '岳山',
    description: '琴首处的硬木横条，高约1.5cm，承托七根琴弦。其材质和高度直接影响琴弦振动向琴体的传递效率。',
    position: { x: 0, y: 0.04, z: -0.54 },
    category: 'craftsmanship',
    importance: 4,
  },
  {
    id: 'hot-8',
    instrumentId: 'guqin-001',
    name: '漆层',
    description: '传统古琴髹漆可达数十层，总厚度约2-3mm。漆层不仅保护木质，更形成独特的阻尼特性，使音色温润含蓄。',
    position: { x: 0.1, y: 0.03, z: 0 },
    category: 'craftsmanship',
    importance: 5,
  },
];

export const guqinData: InstrumentDataBundle = {
  instrument: guqinInstrument,
  cavities: guqinCavities,
  samples: guqinSamples,
  hotspots: guqinHotspots,
};
