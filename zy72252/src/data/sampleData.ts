import type { Project, HoistingPoint, Route, ObstacleNote, FloorSketch, DetectionIssue } from '../types';

export const sampleProjects: Project[] = [
  {
    id: 'demo-project-1',
    name: '车展主舞台吊点系统',
    createdAt: '2026-06-01T10:00:00Z',
    updatedAt: '2026-06-02T15:30:00Z',
    status: 'normal',
    stage: 'completed',
    description: '2026国际车展A区主舞台，6个吊点，4条路线，全部正常'
  },
  {
    id: 'demo-project-2',
    name: '新品发布会舞台',
    createdAt: '2026-06-02T09:00:00Z',
    updatedAt: '2026-06-03T08:00:00Z',
    status: 'warning',
    stage: 'detection',
    description: '科技新品全球发布会，含补录路线未重新计算长度，待阿景补录草图'
  },
  {
    id: 'demo-project-3',
    name: '颁奖典礼多楼层舞台',
    createdAt: '2026-05-28T14:00:00Z',
    updatedAt: '2026-06-01T11:00:00Z',
    status: 'warning',
    stage: 'detection',
    description: '年度颁奖典礼，2楼层吊点系统，含2条补录路线未计算长度'
  }
];

export const samplePoints: Record<string, HoistingPoint[]> = {
  'demo-project-1': [
    { id: 'P1', name: '吊点A-01', x: -3, y: 0, z: 3, load: 400, status: 'normal' },
    { id: 'P2', name: '吊点A-02', x: 0, y: 0, z: 3.5, load: 600, status: 'normal' },
    { id: 'P3', name: '吊点A-03', x: 3, y: 0, z: 3, load: 400, status: 'normal' },
    { id: 'P4', name: '吊点B-01', x: -3, y: 0, z: 6, load: 500, status: 'normal' },
    { id: 'P5', name: '吊点B-02', x: 0, y: 0, z: 6.5, load: 700, status: 'normal' },
    { id: 'P6', name: '吊点B-03', x: 3, y: 0, z: 6, load: 500, status: 'normal' },
  ],
  'demo-project-2': [
    { id: 'P1', name: '吊点A-01', x: -4, y: 0, z: 3, load: 500, status: 'normal' },
    { id: 'P2', name: '吊点A-02', x: 0, y: 0, z: 3.5, load: 800, status: 'normal' },
    { id: 'P3', name: '吊点A-03', x: 4, y: 0, z: 3, load: 500, status: 'normal' },
    { id: 'P4', name: '吊点B-01', x: -4, y: 0, z: 6, load: 600, status: 'normal' },
    { id: 'P5', name: '吊点B-02', x: 0, y: 0, z: 6.5, load: 1000, status: 'warning' },
    { id: 'P6', name: '吊点B-03', x: 4, y: 0, z: 6, load: 600, status: 'normal' },
  ],
  'demo-project-3': [
    { id: 'F1-P1', name: '1F-吊点01', x: -4, y: 0, z: 3, load: 450, status: 'normal' },
    { id: 'F1-P2', name: '1F-吊点02', x: 0, y: 0, z: 4, load: 650, status: 'normal' },
    { id: 'F1-P3', name: '1F-吊点03', x: 4, y: 0, z: 3, load: 450, status: 'normal' },
    { id: 'F2-P1', name: '2F-吊点01', x: -3, y: 0, z: 7, load: 550, status: 'normal' },
    { id: 'F2-P2', name: '2F-吊点02', x: 0, y: 0, z: 7.5, load: 900, status: 'warning' },
    { id: 'F2-P3', name: '2F-吊点03', x: 3, y: 0, z: 7, load: 550, status: 'normal' },
    { id: 'F2-P4', name: '2F-吊点04', x: 0, y: 0, z: 9, load: 750, status: 'normal' },
  ]
};

export const sampleRoutes: Record<string, Route[]> = {
  'demo-project-1': [
    {
      id: 'R1',
      name: '主路线-1',
      fromPoint: 'P1',
      toPoint: 'P2',
      length: 3.91,
      isSupplementary: false,
      recalculated: true,
      hasWarning: false
    },
    {
      id: 'R2',
      name: '主路线-2',
      fromPoint: 'P2',
      toPoint: 'P3',
      length: 3.91,
      isSupplementary: false,
      recalculated: true,
      hasWarning: false
    },
    {
      id: 'R3',
      name: '主路线-3',
      fromPoint: 'P4',
      toPoint: 'P5',
      length: 3.91,
      isSupplementary: false,
      recalculated: true,
      hasWarning: false
    },
    {
      id: 'R4',
      name: '主路线-4',
      fromPoint: 'P5',
      toPoint: 'P6',
      length: 3.91,
      isSupplementary: false,
      recalculated: true,
      hasWarning: false
    }
  ],
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
      name: '补录路线-1',
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
  ],
  'demo-project-3': [
    {
      id: 'R1',
      name: '1F-主路线-1',
      fromPoint: 'F1-P1',
      toPoint: 'F1-P2',
      length: 5.12,
      isSupplementary: false,
      recalculated: true,
      hasWarning: false
    },
    {
      id: 'R2',
      name: '1F-主路线-2',
      fromPoint: 'F1-P2',
      toPoint: 'F1-P3',
      length: 5.12,
      isSupplementary: false,
      recalculated: true,
      hasWarning: false
    },
    {
      id: 'R3',
      name: '2F-补录路线-1',
      fromPoint: 'F2-P1',
      toPoint: 'F2-P2',
      length: 3.91,
      calculatedLength: 4.85,
      isSupplementary: true,
      recalculated: false,
      hasWarning: true,
      color: '#FF7D00'
    },
    {
      id: 'R4',
      name: '2F-主路线-3',
      fromPoint: 'F2-P2',
      toPoint: 'F2-P3',
      length: 3.91,
      isSupplementary: false,
      recalculated: true,
      hasWarning: false
    },
    {
      id: 'R5',
      name: '2F-补录路线-2',
      fromPoint: 'F2-P3',
      toPoint: 'F2-P4',
      length: 2.50,
      calculatedLength: 3.20,
      isSupplementary: true,
      recalculated: false,
      hasWarning: true,
      color: '#FF7D00'
    }
  ]
};

export const sampleObstacles: Record<string, ObstacleNote[]> = {
  'demo-project-1': [],
  'demo-project-2': [
    {
      id: 'O1',
      routeId: 'R3',
      content: '现场发现LED屏后方有消防管道突出，原路线无法通过，需调整高度避让。现场测量管道突出约80cm，建议重新计算避让路线长度。',
      createdAt: '2026-06-02T14:30:00Z',
      createdBy: 'designer'
    }
  ],
  'demo-project-3': [
    {
      id: 'O1',
      routeId: 'R3',
      content: '二楼看台下方有空调风管遮挡，原路线需要绕行。实测绕行增加约0.94m。',
      createdAt: '2026-05-30T10:00:00Z',
      createdBy: 'designer'
    },
    {
      id: 'O2',
      routeId: 'R5',
      content: '二层转角处新增灯光桁架，路线需下穿通过，长度需重新计算。',
      createdAt: '2026-05-30T10:30:00Z',
      createdBy: 'designer'
    }
  ]
};

export const sampleSketches: Record<string, FloorSketch[]> = {
  'demo-project-1': [],
  'demo-project-2': [],
  'demo-project-3': []
};

export const sampleIssues: Record<string, DetectionIssue[]> = {
  'demo-project-1': [],
  'demo-project-2': [
    {
      id: 'ISSUE-001',
      type: 'route_not_recalculated',
      routeId: 'R3',
      severity: 'warning',
      description: '补录路线 "补录路线-1" 没有重新计算长度',
      status: 'open',
      nextAction: 'contact_designer',
      missingMaterials: ['楼层剖面草图（避让段）', '复核确认记录'],
      createdAt: '2026-06-02T15:00:00Z'
    }
  ],
  'demo-project-3': [
    {
      id: 'ISSUE-002',
      type: 'route_not_recalculated',
      routeId: 'R3',
      severity: 'warning',
      description: '补录路线 "2F-补录路线-1" 没有重新计算长度',
      status: 'open',
      nextAction: 'contact_designer',
      missingMaterials: ['楼层剖面草图（避让段）', '复核确认记录'],
      createdAt: '2026-05-30T11:00:00Z'
    },
    {
      id: 'ISSUE-003',
      type: 'route_not_recalculated',
      routeId: 'R5',
      severity: 'warning',
      description: '补录路线 "2F-补录路线-2" 没有重新计算长度',
      status: 'open',
      nextAction: 'contact_designer',
      missingMaterials: ['楼层剖面草图（转角段）', '复核确认记录'],
      createdAt: '2026-05-30T11:00:00Z'
    }
  ]
};
