import type { Project, HoistingPoint, Route, ObstacleNote, FloorSketch, DetectionIssue } from '../types';

export const sampleProjects: Project[] = [
  {
    id: 'demo-project-1',
    name: '车展主舞台吊点系统',
    createdAt: '2026-06-01T10:00:00Z',
    updatedAt: '2026-06-02T15:30:00Z',
    status: 'normal',
    stage: 'completed',
    description: '2026国际车展A区主舞台，8个吊点，4条路线'
  },
  {
    id: 'demo-project-2',
    name: '新品发布会舞台',
    createdAt: '2026-06-02T09:00:00Z',
    updatedAt: '2026-06-03T08:00:00Z',
    status: 'warning',
    stage: 'review',
    description: '科技新品全球发布会，含补录路线待复核'
  },
  {
    id: 'demo-project-3',
    name: '颁奖典礼多楼层舞台',
    createdAt: '2026-05-28T14:00:00Z',
    updatedAt: '2026-06-01T11:00:00Z',
    status: 'pending_review',
    stage: 'review',
    description: '年度颁奖典礼，3楼层复杂吊点系统'
  }
];

export const samplePoints: Record<string, HoistingPoint[]> = {
  'demo-project-2': [
    { id: 'P1', name: '吊点A-01', x: -4, y: 0, z: 3, load: 500, status: 'normal' },
    { id: 'P2', name: '吊点A-02', x: 0, y: 0, z: 3.5, load: 800, status: 'normal' },
    { id: 'P3', name: '吊点A-03', x: 4, y: 0, z: 3, load: 500, status: 'normal' },
    { id: 'P4', name: '吊点B-01', x: -4, y: 0, z: 6, load: 600, status: 'normal' },
    { id: 'P5', name: '吊点B-02', x: 0, y: 0, z: 6.5, load: 1000, status: 'warning' },
    { id: 'P6', name: '吊点B-03', x: 4, y: 0, z: 6, load: 600, status: 'normal' },
  ]
};

export const sampleRoutes: Record<string, Route[]> = {
  'demo-project-2': [
    {
      id: 'R1',
      name: '主路线-1',
      fromPoint: 'P1',
      toPoint: 'P2',
      length: 4.03,
      isSupplementary: false,
      recalculated: true,
      hasWarning: false
    },
    {
      id: 'R2',
      name: '主路线-2',
      fromPoint: 'P2',
      toPoint: 'P3',
      length: 4.03,
      isSupplementary: false,
      recalculated: true,
      hasWarning: false
    },
    {
      id: 'R3',
      name: '补录路线-1（问题）',
      fromPoint: 'P4',
      toPoint: 'P5',
      length: 4.03,
      calculatedLength: 5.02,
      isSupplementary: true,
      recalculated: false,
      hasWarning: true,
      color: '#FF7D00'
    },
    {
      id: 'R4',
      name: '主路线-4',
      fromPoint: 'P5',
      toPoint: 'P6',
      length: 4.03,
      isSupplementary: false,
      recalculated: true,
      hasWarning: false
    }
  ]
};

export const sampleObstacles: Record<string, ObstacleNote[]> = {
  'demo-project-2': [
    {
      id: 'O1',
      routeId: 'R3',
      content: '现场发现LED屏后方有消防管道突出，原路线无法通过，需调整高度避让。现场测量管道突出约80cm，建议重新计算避让路线长度。',
      createdAt: '2026-06-02T14:30:00Z',
      createdBy: 'designer'
    }
  ]
};

export const sampleSketches: Record<string, FloorSketch[]> = {
  'demo-project-2': [
    {
      id: 'S1',
      projectId: 'demo-project-2',
      floor: 1,
      imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=technical%20floor%20plan%20blueprint%20with%20hoisting%20points%20marked%20and%20obstacle%20highlighted%20in%20red%20circle&image_size=landscape_16_9',
      description: '一层舞台吊点布置图，红色标注为消防管道障碍物位置',
      uploadedAt: '2026-06-02T10:00:00Z',
      uploadedBy: '阿景',
      relatedRouteIds: ['R3']
    }
  ]
};

export const sampleIssues: Record<string, DetectionIssue[]> = {
  'demo-project-2': [
    {
      id: 'ISSUE-001',
      type: 'route_not_recalculated',
      routeId: 'R3',
      severity: 'warning',
      description: '补录路线 "补录路线-1（问题）" 没有重新计算长度',
      status: 'open',
      nextAction: 'contact_designer',
      missingMaterials: ['楼层剖面草图（避让段）', '复核确认记录'],
      createdAt: '2026-06-02T15:00:00Z'
    }
  ]
};
