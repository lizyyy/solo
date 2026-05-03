export const sampleContexts = [
  {
    id: '1',
    name: '耕土层',
    age: '现代',
    description: '现代耕作层，包含少量现代遗物',
    inclusions: ['陶片', '瓷片', '现代垃圾'],
    elevation: { top: 5.0, bottom: 4.5 },
    geometry: {
      x_min: 0, x_max: 10,
      y_min: 0, y_max: 10,
      z_min: 4.5, z_max: 5.0
    },
    relationships: {
      overlies: ['2'],
      underlies: [],
      cuts: [],
      cutBy: [],
      equalTo: []
    },
    color: '#8B4513'
  },
  {
    id: '2',
    name: '明清层',
    age: '明清时期',
    description: '明清文化层，出土较多瓷器和陶器',
    inclusions: ['青花瓷片', '釉陶', '砖瓦'],
    elevation: { top: 4.5, bottom: 3.8 },
    geometry: {
      x_min: 0, x_max: 10,
      y_min: 0, y_max: 10,
      z_min: 3.8, z_max: 4.5
    },
    relationships: {
      overlies: ['3'],
      underlies: ['1'],
      cuts: [],
      cutBy: ['H1'],
      equalTo: []
    },
    color: '#A0522D'
  },
  {
    id: '3',
    name: '宋元层',
    age: '宋元时期',
    description: '宋元文化层，出土青白瓷和酱釉瓷',
    inclusions: ['青白瓷', '酱釉瓷', '铜钱'],
    elevation: { top: 3.8, bottom: 3.0 },
    geometry: {
      x_min: 0, x_max: 10,
      y_min: 0, y_max: 10,
      z_min: 3.0, z_max: 3.8
    },
    relationships: {
      overlies: ['4'],
      underlies: ['2'],
      cuts: [],
      cutBy: ['H1'],
      equalTo: []
    },
    color: '#CD853F'
  },
  {
    id: '4',
    name: '唐代层',
    age: '唐代',
    description: '唐代文化层，出土唐三彩和白瓷',
    inclusions: ['唐三彩', '白瓷', '青瓷'],
    elevation: { top: 3.0, bottom: 2.2 },
    geometry: {
      x_min: 0, x_max: 10,
      y_min: 0, y_max: 10,
      z_min: 2.2, z_max: 3.0
    },
    relationships: {
      overlies: ['5'],
      underlies: ['3'],
      cuts: [],
      cutBy: [],
      equalTo: []
    },
    color: '#DEB887'
  },
  {
    id: '5',
    name: '汉晋层',
    age: '汉晋时期',
    description: '汉晋文化层，出土砖瓦和陶器',
    inclusions: ['板瓦', '筒瓦', '陶釜'],
    elevation: { top: 2.2, bottom: 1.5 },
    geometry: {
      x_min: 0, x_max: 10,
      y_min: 0, y_max: 10,
      z_min: 1.5, z_max: 2.2
    },
    relationships: {
      overlies: ['6'],
      underlies: ['4'],
      cuts: [],
      cutBy: [],
      equalTo: []
    },
    color: '#D2B48C'
  },
  {
    id: '6',
    name: '生土层',
    age: '史前',
    description: '原生土层，无文化遗物',
    inclusions: ['砾石', '细砂'],
    elevation: { top: 1.5, bottom: 0 },
    geometry: {
      x_min: 0, x_max: 10,
      y_min: 0, y_max: 10,
      z_min: 0, z_max: 1.5
    },
    relationships: {
      overlies: [],
      underlies: ['5'],
      cuts: [],
      cutBy: [],
      equalTo: []
    },
    color: '#BC8F8F'
  },
  {
    id: 'H1',
    name: '灰坑H1',
    age: '明清时期',
    description: '明清时期灰坑，打破2、3层',
    inclusions: ['青花瓷片', '窑具', '炭粒'],
    elevation: { top: 4.2, bottom: 2.5 },
    geometry: {
      x_min: 3, x_max: 7,
      y_min: 3, y_max: 7,
      z_min: 2.5, z_max: 4.2
    },
    relationships: {
      overlies: [],
      underlies: ['1'],
      cuts: ['2', '3'],
      cutBy: [],
      equalTo: []
    },
    color: '#F4A460'
  }
]

export const sampleFinds = [
  {
    id: 'F001',
    name: '青花碗残片',
    type: '陶器',
    material: '瓷',
    description: '明代青花碗口沿残片，绘缠枝莲纹',
    layerId: '2',
    coordinates: { x: 2.5, y: 3.2, z: 4.2 },
    elevation: 4.2,
    condition: '较好',
    notes: '可修复'
  },
  {
    id: 'F002',
    name: '铜钱',
    type: '金属',
    material: '铜',
    description: '康熙通宝，完整',
    layerId: '2',
    coordinates: { x: 5.5, y: 4.8, z: 4.0 },
    elevation: 4.0,
    condition: '锈蚀',
    notes: '需除锈处理'
  },
  {
    id: 'F003',
    name: '青白瓷碗',
    type: '陶器',
    material: '瓷',
    description: '宋代青白瓷碗，完整',
    layerId: '3',
    coordinates: { x: 7.2, y: 2.5, z: 3.5 },
    elevation: 3.5,
    condition: '完整',
    notes: '一级品'
  },
  {
    id: 'F004',
    name: '酱釉瓶',
    type: '陶器',
    material: '瓷',
    description: '元代酱釉梅瓶，肩部残',
    layerId: '3',
    coordinates: { x: 3.8, y: 6.2, z: 3.3 },
    elevation: 3.3,
    condition: '残',
    notes: '可拼接'
  },
  {
    id: 'F005',
    name: '唐三彩碎片',
    type: '陶器',
    material: '陶',
    description: '唐三彩枕碎片，黄绿釉',
    layerId: '4',
    coordinates: { x: 4.5, y: 5.5, z: 2.8 },
    elevation: 2.8,
    condition: '碎片',
    notes: '多片'
  },
  {
    id: 'F006',
    name: '白瓷碗',
    type: '陶器',
    material: '瓷',
    description: '唐代邢窑白瓷碗，完整',
    layerId: '4',
    coordinates: { x: 6.2, y: 4.0, z: 2.6 },
    elevation: 2.6,
    condition: '完整',
    notes: '釉色莹润'
  },
  {
    id: 'F007',
    name: '陶釜',
    type: '陶器',
    material: '陶',
    description: '汉代灰陶釜，底部残',
    layerId: '5',
    coordinates: { x: 2.8, y: 7.5, z: 1.9 },
    elevation: 1.9,
    condition: '残',
    notes: '绳纹'
  },
  {
    id: 'F008',
    name: '板瓦',
    type: '石器',
    material: '陶',
    description: '汉代板瓦，带布纹',
    layerId: '5',
    coordinates: { x: 8.0, y: 3.0, z: 2.0 },
    elevation: 2.0,
    condition: '残',
    notes: '大型建筑用瓦'
  },
  {
    id: 'F009',
    name: '青花高足杯',
    type: '陶器',
    material: '瓷',
    description: '清代青花高足杯，出自灰坑',
    layerId: 'H1',
    coordinates: { x: 5.0, y: 5.0, z: 3.8 },
    elevation: 3.8,
    condition: '完整',
    notes: '灰坑出土'
  },
  {
    id: 'F010',
    name: '窑具',
    type: '石器',
    material: '陶',
    description: '垫饼，窑具',
    layerId: 'H1',
    coordinates: { x: 4.5, y: 5.5, z: 3.2 },
    elevation: 3.2,
    condition: '完整',
    notes: '窑址附近'
  },
  {
    id: 'F011',
    name: '越界测试',
    type: '陶器',
    material: '瓷',
    description: '测试坐标越界问题',
    layerId: '2',
    coordinates: { x: 15.0, y: 5.0, z: 4.2 },
    elevation: 4.2,
    condition: '测试',
    notes: '用于测试坐标越界校验'
  },
  {
    id: 'F012',
    name: '高程测试',
    type: '石器',
    material: '石',
    description: '测试高程不匹配',
    layerId: '3',
    coordinates: { x: 2.0, y: 8.0, z: 5.5 },
    elevation: 5.5,
    condition: '测试',
    notes: '高程高于所属地层顶部'
  }
]

export const sampleRules = {
  trench: {
    id: 'T1',
    name: '探方 T1',
    dimensions: {
      x_min: 0,
      x_max: 10,
      y_min: 0,
      y_max: 10,
      z_min: 0,
      z_max: 5
    }
  },
  validation: {
    elevation: {
      enabled: true,
      allowInversion: false,
      tolerance: 0.01,
      checkLayerOrder: true,
      expectedOrder: ['1', '2', '3', '4', '5', '6']
    },
    relationships: {
      enabled: true,
      checkMutual: true,
      checkCyclic: true,
      validateCutLogic: true
    },
    coordinates: {
      enabled: true,
      checkBounds: true,
      checkElevationMatch: true,
      tolerance: 0.01,
      allowOrphanFinds: false
    }
  },
  display: {
    sections: [
      { id: 'S1', name: '南剖面', axis: 'x', position: 0 },
      { id: 'S2', name: '北剖面', axis: 'x', position: 10 },
      { id: 'S3', name: '东剖面', axis: 'y', position: 10 },
      { id: 'S4', name: '西剖面', axis: 'y', position: 0 }
    ]
  }
}
