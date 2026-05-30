import type { DataMaterial, Point3D } from '../../types/surface';
import { generateId } from '../../data/demoData';

export interface ImportedData {
  materials: DataMaterial[];
  surfacePoints?: Point3D[];
  boundaryPoints?: Point3D[];
  samplePoints?: Point3D[];
}

export function parseJsonImport(content: string, importedBy?: string): ImportedData {
  const data = JSON.parse(content);
  const materials: DataMaterial[] = [];
  const now = Date.now();

  if (data.materials && Array.isArray(data.materials)) {
    data.materials.forEach((m: any) => {
      materials.push({
        id: m.id || generateId('mat'),
        name: m.name || '未命名材料',
        type: m.type || 'surface',
        status: 'raw',
        source: 'imported',
        importedAt: now,
        importedBy: importedBy || m.importedBy,
        equation: m.equation,
        points: m.points,
        uvRange: m.uvRange,
        sampleDensity: m.sampleDensity,
        metadata: m.metadata || {},
      });
    });
  }

  if (data.equation && !materials.find((m) => m.type === 'surface')) {
    materials.push({
      id: generateId('mat_surface'),
      name: '导入的曲面方程',
      type: 'surface',
      status: 'raw',
      source: 'imported',
      importedAt: now,
      importedBy,
      equation: data.equation,
      uvRange: data.uvRange || { u: [0, 1], v: [0, 1] },
      sampleDensity: data.resolution || 64,
      metadata: {},
    });
  }

  if (data.boundaryPoints && !materials.find((m) => m.type === 'boundary')) {
    materials.push({
      id: generateId('mat_boundary'),
      name: '导入的边界曲线',
      type: 'boundary',
      status: 'raw',
      source: 'imported',
      importedAt: now,
      importedBy,
      points: data.boundaryPoints,
      sampleDensity: data.boundaryPoints?.length || 100,
      metadata: {},
    });
  }

  if (data.samplePoints && !materials.find((m) => m.type === 'sample')) {
    materials.push({
      id: generateId('mat_sample'),
      name: '导入的采样点集',
      type: 'sample',
      status: 'raw',
      source: 'imported',
      importedAt: now,
      importedBy,
      points: data.samplePoints,
      sampleDensity: data.samplePoints?.length || 50,
      metadata: {},
    });
  }

  return {
    materials,
    surfacePoints: data.surfacePoints,
    boundaryPoints: data.boundaryPoints,
    samplePoints: data.samplePoints,
  };
}

export function parseCsvImport(content: string, type: 'surface' | 'boundary' | 'sample', importedBy?: string): ImportedData {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const points: Point3D[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => parseFloat(v.trim()));
    if (values.length >= 3 && !values.some(isNaN)) {
      const xIdx = headers.indexOf('x');
      const yIdx = headers.indexOf('y');
      const zIdx = headers.indexOf('z');
      if (xIdx >= 0 && yIdx >= 0 && zIdx >= 0) {
        points.push({
          x: values[xIdx],
          y: values[yIdx],
          z: values[zIdx],
        });
      } else {
        points.push({ x: values[0], y: values[1], z: values[2] });
      }
    }
  }

  const material: DataMaterial = {
    id: generateId(`mat_${type}`),
    name: `导入的${type === 'surface' ? '曲面点' : type === 'boundary' ? '边界曲线' : '采样点'}`,
    type,
    status: 'raw',
    source: 'imported',
    importedAt: Date.now(),
    importedBy,
    points,
    sampleDensity: points.length,
    metadata: {
      rowCount: lines.length - 1,
      validPoints: points.length,
    },
  };

  return {
    materials: [material],
    ...(type === 'boundary' ? { boundaryPoints: points } : {}),
    ...(type === 'sample' ? { samplePoints: points } : {}),
  };
}
