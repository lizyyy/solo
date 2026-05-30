import type { DataMaterial } from '../types/surface';

export const DEMO_MATERIALS: DataMaterial[] = [
  {
    id: 'mat_surface_001',
    name: '抛物面方程 z = x² + y²',
    type: 'surface',
    status: 'raw',
    source: 'imported',
    importedAt: Date.now() - 3600000,
    importedBy: '李老师',
    equation: 'u^2 + v^2',
    uvRange: { u: [-1, 1], v: [-1, 1] },
    sampleDensity: 64,
    metadata: {
      description: '标准旋转抛物面，用于曲面积分入门教学',
      course: '高等数学II',
      chapter: '第10章 曲面积分',
    },
  },
  {
    id: 'mat_boundary_001',
    name: '边界曲线（单位圆）',
    type: 'boundary',
    status: 'raw',
    source: 'imported',
    importedAt: Date.now() - 3500000,
    importedBy: '王助教',
    uvRange: { u: [0, 2 * Math.PI], v: [0, 0] },
    sampleDensity: 128,
    metadata: {
      description: 'z=1平面上的单位圆，作为曲面边界',
      gap: 0.05,
    },
  },
  {
    id: 'mat_sample_001',
    name: '采样点集（稀疏）',
    type: 'sample',
    status: 'raw',
    source: 'imported',
    importedAt: Date.now() - 3400000,
    importedBy: '张同学',
    sampleDensity: 20,
    metadata: {
      description: '学生提交的采样点，密度不足',
      assignment: '作业3-2',
    },
  },
];

export const DEMO_SURFACE_CONFIG = {
  equation: 'u^2 + v^2',
  uvRange: { u: [-1, 1], v: [-1, 1] } as { u: [number, number]; v: [number, number] },
  resolution: 64,
  normalLength: 0.3,
  normalDensity: 8,
};

export const QUALITY_THRESHOLDS = {
  minSampleDensity: 50,
  maxNormalAngleDeviation: Math.PI / 4,
  maxBoundaryGap: 0.02,
};

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
