import type { InstrumentModel, ResonanceCavity, FrequencySample, Hotspot, InstrumentDataBundle } from '@/types';

export const violinInstrument: InstrumentModel = {
  id: 'violin-001',
  name: '提琴',
  dimensions: { width: 0.2, height: 0.12, depth: 0.6 },
  centerPoint: { x: 0, y: 0, z: 0 },
  materialGroups: [
    { id: 'mat-1', name: '面板（云杉木）', color: '#F5DEB3', opacity: 1, visible: true },
    { id: 'mat-2', name: '背板（枫木）', color: '#8B4513', opacity: 1, visible: true },
    { id: 'mat-3', name: '侧板（枫木）', color: '#A0522D', opacity: 1, visible: true },
    { id: 'mat-4', name: '琴颈（枫木）', color: '#D2691E', opacity: 1, visible: true },
    { id: 'mat-5', name: '指板（乌木）', color: '#1C1C1C', opacity: 1, visible: true },
    { id: 'mat-6', name: '漆层（油性漆）', color: '#CD853F', opacity: 0.8, visible: true },
  ],
  sectionReferences: [
    { id: 'sec-1', axis: 'y', position: 0, label: '水平剖面（f孔）' },
    { id: 'sec-2', axis: 'x', position: 0, label: '纵向剖面（音柱）' },
    { id: 'sec-3', axis: 'z', position: 0, label: '琴马剖面' },
  ],
  dataVersion: 'v3.0.1',
  description: '小提琴是弓弦乐器家族中的高音乐器，其共鸣结构经过数百年发展已臻完美。弧形面板和背板通过音柱和低音梁连接，形成复杂而高效的振动系统。',
};

export const violinCavities: ResonanceCavity[] = [
  {
    id: 'cav-1',
    instrumentId: 'violin-001',
    name: '主共鸣体',
    boundary: [
      { x: -0.09, y: -0.055, z: -0.17 },
      { x: 0.09, y: -0.055, z: -0.17 },
      { x: 0.09, y: 0.035, z: -0.17 },
      { x: -0.09, y: 0.035, z: -0.17 },
      { x: -0.09, y: -0.055, z: 0.17 },
      { x: 0.09, y: -0.055, z: 0.17 },
      { x: 0.09, y: 0.035, z: 0.17 },
      { x: -0.09, y: 0.035, z: 0.17 },
    ],
    material: '空气腔',
    thickness: 0,
    volume: 0.00095,
    color: 'rgba(184, 134, 11, 0.15)',
  },
  {
    id: 'cav-2',
    instrumentId: 'violin-001',
    name: '左f孔',
    boundary: [
      { x: -0.055, y: 0.03, z: -0.04 },
      { x: -0.035, y: 0.03, z: -0.04 },
      { x: -0.035, y: 0.036, z: -0.04 },
      { x: -0.055, y: 0.036, z: -0.04 },
      { x: -0.055, y: 0.03, z: 0.04 },
      { x: -0.035, y: 0.03, z: 0.04 },
      { x: -0.035, y: 0.036, z: 0.04 },
      { x: -0.055, y: 0.036, z: 0.04 },
    ],
    material: '音孔',
    thickness: 0,
    volume: 0.0000096,
    color: 'rgba(30, 136, 229, 0.2)',
  },
  {
    id: 'cav-3',
    instrumentId: 'violin-001',
    name: '右f孔',
    boundary: [
      { x: 0.035, y: 0.03, z: -0.04 },
      { x: 0.055, y: 0.03, z: -0.04 },
      { x: 0.055, y: 0.036, z: -0.04 },
      { x: 0.035, y: 0.036, z: -0.04 },
      { x: 0.035, y: 0.03, z: 0.04 },
      { x: 0.055, y: 0.03, z: 0.04 },
      { x: 0.055, y: 0.036, z: 0.04 },
      { x: 0.035, y: 0.036, z: 0.04 },
    ],
    material: '音孔',
    thickness: 0,
    volume: 0.0000096,
    color: 'rgba(229, 57, 53, 0.2)',
  },
];

const generateViolinSamples = (): FrequencySample[] => {
  const samples: FrequencySample[] = [];
  const freqData = [
    { freq: 196, response: 72 }, { freq: 247, response: 76 }, { freq: 294, response: 80 },
    { freq: 392, response: 84 }, { freq: 440, response: 88 }, { freq: 494, response: 90 },
    { freq: 587, response: 87 }, { freq: 659, response: 85 }, { freq: 784, response: 82 },
    { freq: 880, response: 80 }, { freq: 988, response: 78 }, { freq: 1175, response: 76 },
    { freq: 1319, response: 74 }, { freq: 1568, response: 72 }, { freq: 1760, response: 70 },
    { freq: 2093, response: 68 }, { freq: 2637, response: 65 }, { freq: 3136, response: 63 },
    { freq: 3520, response: 61 }, { freq: 4186, response: 59 },
  ];

  for (let i = 0; i < 20; i++) {
    const fd = freqData[i];
    const angle = (i / 20) * Math.PI * 2;
    const radius = 0.05 + Math.random() * 0.04;
    samples.push({
      id: `sample-violin-${i + 1}`,
      instrumentId: 'violin-001',
      position: {
        x: Math.cos(angle) * radius,
        y: 0,
        z: Math.sin(angle) * radius * 0.8,
      },
      frequency: fd.freq,
      responseIntensity: fd.response + (Math.random() - 0.5) * 3,
      band: fd.freq < 250 ? 'low' : fd.freq < 2000 ? 'mid' : 'high',
      dataSource: '声学实验室实测',
      measurementDate: '2026-05-20',
    });
  }
  return samples;
};

export const violinSamples: FrequencySample[] = generateViolinSamples();

export const violinHotspots: Hotspot[] = [
  {
    id: 'hot-1',
    instrumentId: 'violin-001',
    name: '琴马',
    description: '位于面板中部f孔之间的木质桥形部件，将琴弦振动传递到面板。琴马的形状、高度和位置对音色有决定性影响。',
    position: { x: 0, y: 0.03, z: 0 },
    category: 'structure',
    importance: 5,
  },
  {
    id: 'hot-2',
    instrumentId: 'violin-001',
    name: '音柱',
    description: '位于琴马右脚下方的细小云杉立柱，连接面板与背板。被称为"提琴的灵魂"，其位置和直径精确到0.1mm。',
    position: { x: 0.025, y: 0, z: 0.005 },
    category: 'structure',
    importance: 5,
  },
  {
    id: 'hot-3',
    instrumentId: 'violin-001',
    name: '低音梁',
    description: '面板内侧沿纵向粘接的云杉木条，位于琴马左脚下方。增强面板刚性，控制低频振动，是提琴低频响应的关键。',
    position: { x: -0.04, y: 0.01, z: 0 },
    category: 'structure',
    importance: 5,
  },
  {
    id: 'hot-4',
    instrumentId: 'violin-001',
    name: 'f孔',
    description: '面板两侧对称的f形音孔，是提琴标志性特征。其精确的形状和位置决定了空气共振频率（约280Hz）。',
    position: { x: 0.045, y: 0.02, z: 0 },
    category: 'acoustics',
    importance: 5,
  },
  {
    id: 'hot-5',
    instrumentId: 'violin-001',
    name: '面板弧度',
    description: '提琴面板呈优美的弧形，从琴马处最高点向边缘逐渐降低。弧度设计遵循数百年的传统，影响着各频段的振动模式。',
    position: { x: 0, y: 0.02, z: -0.08 },
    category: 'acoustics',
    importance: 5,
  },
  {
    id: 'hot-6',
    instrumentId: 'violin-001',
    name: '背板花纹',
    description: '提琴背板通常选用有美丽虎纹的枫木，不仅是装饰，木纹的方向和密度也影响振动传导特性。',
    position: { x: 0.06, y: -0.03, z: -0.05 },
    category: 'craftsmanship',
    importance: 4,
  },
  {
    id: 'hot-7',
    instrumentId: 'violin-001',
    name: '漆面',
    description: '传统提琴使用油性漆，厚度仅约0.1mm。漆的成分和涂刷工艺是制琴师的秘密，对最终音色有微妙但重要的影响。',
    position: { x: 0.08, y: 0.015, z: 0.08 },
    category: 'craftsmanship',
    importance: 5,
  },
  {
    id: 'hot-8',
    instrumentId: 'violin-001',
    name: '指板',
    description: '琴颈上的乌木指板，经过精确的弧度打磨。其表面平整度和硬度直接影响演奏精度和延音特性。',
    position: { x: 0, y: 0.04, z: 0.2 },
    category: 'craftsmanship',
    importance: 4,
  },
];

export const violinData: InstrumentDataBundle = {
  instrument: violinInstrument,
  cavities: violinCavities,
  samples: violinSamples,
  hotspots: violinHotspots,
};
