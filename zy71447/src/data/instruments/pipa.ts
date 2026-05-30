import type { InstrumentModel, ResonanceCavity, FrequencySample, Hotspot, InstrumentDataBundle } from '@/types';

export const pipaInstrument: InstrumentModel = {
  id: 'pipa-001',
  name: '琵琶',
  dimensions: { width: 0.35, height: 0.08, depth: 1.0 },
  centerPoint: { x: 0, y: 0, z: 0 },
  materialGroups: [
    { id: 'mat-1', name: '面板（梧桐木）', color: '#DEB887', opacity: 1, visible: true },
    { id: 'mat-2', name: '背板（红木）', color: '#8B0000', opacity: 1, visible: true },
    { id: 'mat-3', name: '相（象牙/牛骨）', color: '#FFFFF0', opacity: 1, visible: true },
    { id: 'mat-4', name: '品（竹）', color: '#228B22', opacity: 1, visible: true },
    { id: 'mat-5', name: '琴头（红木雕刻）', color: '#8B0000', opacity: 1, visible: true },
    { id: 'mat-6', name: '弦轴（黄杨木）', color: '#F5DEB3', opacity: 1, visible: true },
  ],
  sectionReferences: [
    { id: 'sec-1', axis: 'y', position: 0, label: '水平剖面（共鸣箱）' },
    { id: 'sec-2', axis: 'x', position: 0, label: '纵向剖面（音梁）' },
    { id: 'sec-3', axis: 'z', position: 0.1, label: '复手剖面' },
  ],
  dataVersion: 'v1.8.3',
  description: '琵琶是中国传统弹拨乐器，音箱呈半梨形，上接琴颈，颈上设相品。其共鸣结构紧凑，通过面板振动和内部音梁、音柱的传导，产生明亮清脆的音色。',
};

export const pipaCavities: ResonanceCavity[] = [
  {
    id: 'cav-1',
    instrumentId: 'pipa-001',
    name: '主共鸣箱',
    boundary: [
      { x: -0.17, y: -0.035, z: 0 },
      { x: 0.17, y: -0.035, z: 0 },
      { x: 0.17, y: 0.025, z: 0 },
      { x: -0.17, y: 0.025, z: 0 },
      { x: -0.05, y: -0.035, z: 0.35 },
      { x: 0.05, y: -0.035, z: 0.35 },
      { x: 0.05, y: 0.025, z: 0.35 },
      { x: -0.05, y: 0.025, z: 0.35 },
    ],
    material: '空气腔',
    thickness: 0,
    volume: 0.0012,
    color: 'rgba(184, 134, 11, 0.15)',
  },
  {
    id: 'cav-2',
    instrumentId: 'pipa-001',
    name: '音孔（出音孔）',
    boundary: [
      { x: -0.015, y: 0.02, z: 0.08 },
      { x: 0.015, y: 0.02, z: 0.08 },
      { x: 0.015, y: 0.026, z: 0.08 },
      { x: -0.015, y: 0.026, z: 0.08 },
      { x: -0.015, y: 0.02, z: 0.12 },
      { x: 0.015, y: 0.02, z: 0.12 },
      { x: 0.015, y: 0.026, z: 0.12 },
      { x: -0.015, y: 0.026, z: 0.12 },
    ],
    material: '音孔',
    thickness: 0,
    volume: 0.000018,
    color: 'rgba(229, 57, 53, 0.2)',
  },
];

const generatePipaSamples = (): FrequencySample[] => {
  const samples: FrequencySample[] = [];
  const freqData = [
    { freq: 110, response: 75 }, { freq: 147, response: 79 }, { freq: 196, response: 82 },
    { freq: 247, response: 85 }, { freq: 294, response: 87 }, { freq: 392, response: 89 },
    { freq: 494, response: 86 }, { freq: 587, response: 84 }, { freq: 784, response: 81 },
    { freq: 988, response: 78 }, { freq: 1175, response: 76 }, { freq: 1568, response: 73 },
    { freq: 1976, response: 70 }, { freq: 2349, response: 68 }, { freq: 3136, response: 65 },
    { freq: 3951, response: 62 }, { freq: 4699, response: 60 }, { freq: 6272, response: 57 },
    { freq: 7902, response: 55 }, { freq: 9000, response: 52 },
  ];

  for (let i = 0; i < 20; i++) {
    const fd = freqData[i];
    const angle = (i / 20) * Math.PI * 2;
    const radius = 0.08 + Math.random() * 0.06;
    samples.push({
      id: `sample-pipa-${i + 1}`,
      instrumentId: 'pipa-001',
      position: {
        x: Math.cos(angle) * radius,
        y: 0,
        z: 0.05 + (i / 20) * 0.25,
      },
      frequency: fd.freq,
      responseIntensity: fd.response + (Math.random() - 0.5) * 3,
      band: fd.freq < 250 ? 'low' : fd.freq < 2000 ? 'mid' : 'high',
      dataSource: '声学实验室实测',
      measurementDate: '2026-05-18',
    });
  }
  return samples;
};

export const pipaSamples: FrequencySample[] = generatePipaSamples();

export const pipaHotspots: Hotspot[] = [
  {
    id: 'hot-1',
    instrumentId: 'pipa-001',
    name: '复手',
    description: '琵琶面板中部的固定弦的部件，通常用红木或竹制成。琴弦振动通过复手传递到面板，是振动传导的第一站。',
    position: { x: 0, y: 0.02, z: 0.1 },
    category: 'structure',
    importance: 5,
  },
  {
    id: 'hot-2',
    instrumentId: 'pipa-001',
    name: '音梁',
    description: '共鸣箱内部的纵向木条，连接面板和背板。起到增强结构刚性和调整振动频率的作用，直接影响低频响应。',
    position: { x: -0.08, y: 0, z: 0.15 },
    category: 'structure',
    importance: 5,
  },
  {
    id: 'hot-3',
    instrumentId: 'pipa-001',
    name: '音柱',
    description: '共鸣箱内部的细小立柱，支撑面板与背板。位置微调可显著改变音色，是琵琶制作中最精细的调整环节。',
    position: { x: 0.05, y: 0, z: 0.12 },
    category: 'structure',
    importance: 5,
  },
  {
    id: 'hot-4',
    instrumentId: 'pipa-001',
    name: '面板弧度',
    description: '琵琶面板呈微拱形，中部略高，向边缘逐渐降低。这种设计使得面板各区域振动特性不同，音色层次丰富。',
    position: { x: 0, y: 0.015, z: 0.15 },
    category: 'acoustics',
    importance: 4,
  },
  {
    id: 'hot-5',
    instrumentId: 'pipa-001',
    name: '出音孔',
    description: '位于复手两侧的一对小音孔，是声音辐射的主要通道。孔的大小和位置决定了高频成分的辐射效率。',
    position: { x: 0, y: 0.02, z: 0.1 },
    category: 'acoustics',
    importance: 4,
  },
  {
    id: 'hot-6',
    instrumentId: 'pipa-001',
    name: '背板造型',
    description: '琵琶背板呈半梨形，由整木挖制或多块拼接而成。背板的弧度和厚度分布是决定琵琶基本音色的关键。',
    position: { x: 0.1, y: -0.02, z: 0.1 },
    category: 'craftsmanship',
    importance: 5,
  },
  {
    id: 'hot-7',
    instrumentId: 'pipa-001',
    name: '相品系统',
    description: '琵琶颈上的"相"和面板上的"品"共同构成按音系统。相品的高度和角度直接影响音准和演奏手感。',
    position: { x: 0, y: 0.02, z: 0.28 },
    category: 'craftsmanship',
    importance: 4,
  },
  {
    id: 'hot-8',
    instrumentId: 'pipa-001',
    name: '琴头雕刻',
    description: '琵琶琴头通常雕刻成如意、凤首等传统造型，不仅是装饰，其重量分布也会影响琴体的振动平衡。',
    position: { x: 0, y: 0.02, z: 0.45 },
    category: 'craftsmanship',
    importance: 3,
  },
];

export const pipaData: InstrumentDataBundle = {
  instrument: pipaInstrument,
  cavities: pipaCavities,
  samples: pipaSamples,
  hotspots: pipaHotspots,
};
