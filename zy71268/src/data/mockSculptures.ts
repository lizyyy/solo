export interface Sculpture {
  id: string
  name: string
  shape: 'torusKnot' | 'icosahedron' | 'cylinder' | 'cone' | 'dodecahedron'
  color: string
  position: { x: number; y: number; z: number }
  centerOfGravity: { x: number; y: number; z: number }
  cogLimit: { radius: number }
  base: { width: number; depth: number; height: number }
  baseMinRequired: { width: number; depth: number }
  windLoad: {
    direction: { x: number; z: number }
    forceKN: number
    designDirection: { x: number; z: number }
  }
  installLocation: string
  reviewReport: {
    status: 'pending' | 'approved' | 'rejected'
    summary: string
    date: string
  }
  versions: {
    timestamp: string
    label: string
    cog: { x: number; y: number; z: number }
    baseW: number
    baseD: number
  }[]
  manualCheck: {
    notes: string
    checkedBy: string
    checkedAt: string
  }
}

export const mockSculptures: Sculpture[] = [
  {
    id: 'sc-001',
    name: '风之翼',
    shape: 'torusKnot',
    color: '#8ecae6',
    position: { x: 0, y: 2.5, z: 0 },
    centerOfGravity: { x: 0.3, y: 2.8, z: 0.1 },
    cogLimit: { radius: 0.8 },
    base: { width: 1.6, depth: 1.6, height: 0.3 },
    baseMinRequired: { width: 1.8, depth: 1.8 },
    windLoad: {
      direction: { x: 0.7, z: 0.3 },
      forceKN: 12.5,
      designDirection: { x: 1.0, z: 0.0 },
    },
    installLocation: '滨江公园A区',
    reviewReport: {
      status: 'pending',
      summary: '底座尺寸不足，重心偏移超限，风载方向与设计不符',
      date: '2026-05-15',
    },
    versions: [
      {
        timestamp: '2026-05-10',
        label: '初版',
        cog: { x: 0.3, y: 2.8, z: 0.1 },
        baseW: 1.6,
        baseD: 1.6,
      },
      {
        timestamp: '2026-05-18',
        label: '修改版',
        cog: { x: 0.1, y: 2.5, z: 0.0 },
        baseW: 2.0,
        baseD: 2.0,
      },
    ],
    manualCheck: { notes: '', checkedBy: '', checkedAt: '' },
  },
  {
    id: 'sc-002',
    name: '城市脉络',
    shape: 'icosahedron',
    color: '#e0afa0',
    position: { x: 0, y: 1.8, z: 0 },
    centerOfGravity: { x: 0.0, y: 1.8, z: 0.0 },
    cogLimit: { radius: 0.6 },
    base: { width: 2.0, depth: 2.0, height: 0.25 },
    baseMinRequired: { width: 1.5, depth: 1.5 },
    windLoad: {
      direction: { x: 1.0, z: 0.0 },
      forceKN: 8.3,
      designDirection: { x: 1.0, z: 0.0 },
    },
    installLocation: '中央广场B区',
    reviewReport: {
      status: 'approved',
      summary: '各项参数满足要求，可以安装',
      date: '2026-05-20',
    },
    versions: [
      {
        timestamp: '2026-05-12',
        label: '初版',
        cog: { x: 0.0, y: 1.8, z: 0.0 },
        baseW: 2.0,
        baseD: 2.0,
      },
    ],
    manualCheck: { notes: '已现场复核，确认无误', checkedBy: '张工', checkedAt: '2026-05-22' },
  },
  {
    id: 'sc-003',
    name: '时间切片',
    shape: 'cylinder',
    color: '#b8c0ff',
    position: { x: 0, y: 3.0, z: 0 },
    centerOfGravity: { x: 0.9, y: 3.5, z: 0.5 },
    cogLimit: { radius: 0.5 },
    base: { width: 1.2, depth: 1.2, height: 0.2 },
    baseMinRequired: { width: 1.5, depth: 1.5 },
    windLoad: {
      direction: { x: 0.5, z: -0.8 },
      forceKN: 15.2,
      designDirection: { x: 0.5, z: -0.5 },
    },
    installLocation: '河岸绿地C区',
    reviewReport: {
      status: 'rejected',
      summary: '重心严重偏移，底座严重不足，风载方向偏差大，需重新设计',
      date: '2026-05-18',
    },
    versions: [
      {
        timestamp: '2026-05-08',
        label: '初版',
        cog: { x: 0.9, y: 3.5, z: 0.5 },
        baseW: 1.2,
        baseD: 1.2,
      },
      {
        timestamp: '2026-05-16',
        label: '修改版v1',
        cog: { x: 0.5, y: 3.0, z: 0.2 },
        baseW: 1.6,
        baseD: 1.6,
      },
      {
        timestamp: '2026-05-24',
        label: '修改版v2',
        cog: { x: 0.2, y: 2.8, z: 0.1 },
        baseW: 2.0,
        baseD: 2.0,
      },
    ],
    manualCheck: { notes: '', checkedBy: '', checkedAt: '' },
  },
  {
    id: 'sc-004',
    name: '共生',
    shape: 'dodecahedron',
    color: '#c8e7ed',
    position: { x: 0, y: 1.5, z: 0 },
    centerOfGravity: { x: -0.1, y: 1.6, z: 0.05 },
    cogLimit: { radius: 0.7 },
    base: { width: 1.8, depth: 1.8, height: 0.3 },
    baseMinRequired: { width: 1.6, depth: 1.6 },
    windLoad: {
      direction: { x: 0.9, z: 0.1 },
      forceKN: 6.8,
      designDirection: { x: 1.0, z: 0.0 },
    },
    installLocation: '科技园区D区',
    reviewReport: {
      status: 'approved',
      summary: '重心偏移在允许范围内，底座余量充足，风载方向基本一致',
      date: '2026-05-21',
    },
    versions: [
      {
        timestamp: '2026-05-14',
        label: '初版',
        cog: { x: -0.1, y: 1.6, z: 0.05 },
        baseW: 1.8,
        baseD: 1.8,
      },
    ],
    manualCheck: { notes: '风载方向有轻微偏差，现场需确认', checkedBy: '李工', checkedAt: '2026-05-23' },
  },
  {
    id: 'sc-005',
    name: '回响',
    shape: 'cone',
    color: '#ffd6a5',
    position: { x: 0, y: 2.0, z: 0 },
    centerOfGravity: { x: 0.4, y: 2.2, z: -0.3 },
    cogLimit: { radius: 0.6 },
    base: { width: 1.4, depth: 1.4, height: 0.25 },
    baseMinRequired: { width: 1.8, depth: 1.8 },
    windLoad: {
      direction: { x: -0.3, z: 0.9 },
      forceKN: 10.1,
      designDirection: { x: 0.0, z: 1.0 },
    },
    installLocation: '文化中心E区',
    reviewReport: {
      status: 'pending',
      summary: '底座尺寸偏小，重心偏移接近限值，需关注',
      date: '2026-05-25',
    },
    versions: [
      {
        timestamp: '2026-05-20',
        label: '初版',
        cog: { x: 0.4, y: 2.2, z: -0.3 },
        baseW: 1.4,
        baseD: 1.4,
      },
    ],
    manualCheck: { notes: '', checkedBy: '', checkedAt: '' },
  },
]
