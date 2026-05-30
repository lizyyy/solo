import type { Point3D, Vector3D, DataMaterial, FilterRange } from '../../types/surface';
import type { DiagnosisIssue } from '../../types/diagnosis';
import { useFilterStore } from '../../stores/useFilterStore';
import { computeBoundingBox } from '../math/geometry';

export interface ExportOptions {
  format: 'json' | 'csv' | 'obj';
  includeMaterials: boolean;
  includeNormals: boolean;
  includeUVs: boolean;
  includeDiagnosis: boolean;
  precision: number;
  filterRange: FilterRange;
  lockedToScreen: boolean;
  screenViewport: { width: number; height: number };
}

export interface ExportData {
  vertices: Point3D[];
  normals: Vector3D[];
  uvs: { u: number; v: number }[];
  indices: number[];
  boundaryPoints: Point3D[];
  samplePoints: Point3D[];
  materials: DataMaterial[];
  diagnosisIssues: DiagnosisIssue[];
  exportOptions: ExportOptions;
  exportedAt: number;
  boundingBox: {
    min: Point3D;
    max: Point3D;
    center: Point3D;
  };
}

function filterPoints(points: Point3D[], filterRange: FilterRange): Point3D[] {
  return points.filter((p) => {
    if (filterRange.x && (p.x < filterRange.x[0] || p.x > filterRange.x[1])) return false;
    if (filterRange.y && (p.y < filterRange.y[0] || p.y > filterRange.y[1])) return false;
    if (filterRange.z && (p.z < filterRange.z[0] || p.z > filterRange.z[1])) return false;
    return true;
  });
}

function formatNumber(n: number, precision: number): string {
  return n.toFixed(precision);
}

export function exportToJson(data: ExportData): string {
  const { vertices, normals, uvs, indices, boundaryPoints, samplePoints, materials, diagnosisIssues, exportOptions } = data;

  const filteredVertices = exportOptions.filterRange ? filterPoints(vertices, exportOptions.filterRange) : vertices;

  return JSON.stringify(
    {
      exportedAt: data.exportedAt,
      boundingBox: data.boundingBox,
      exportOptions,
      vertices: filteredVertices,
      normals: exportOptions.includeNormals ? normals : undefined,
      uvs: exportOptions.includeUVs ? uvs : undefined,
      indices,
      boundaryPoints: filterPoints(boundaryPoints, exportOptions.filterRange),
      samplePoints: filterPoints(samplePoints, exportOptions.filterRange),
      materials: exportOptions.includeMaterials ? materials : undefined,
      diagnosisIssues: exportOptions.includeDiagnosis ? diagnosisIssues : undefined,
    },
    null,
    2
  );
}

export function exportToCsv(data: ExportData): string {
  const { vertices, normals, uvs, exportOptions } = data;
  const filteredVertices = exportOptions.filterRange ? filterPoints(vertices, exportOptions.filterRange) : vertices;

  const headers = ['x', 'y', 'z'];
  if (exportOptions.includeNormals) headers.push('nx', 'ny', 'nz');
  if (exportOptions.includeUVs) headers.push('u', 'v');

  const lines = [headers.join(',')];

  filteredVertices.forEach((v, i) => {
    const row = [
      formatNumber(v.x, exportOptions.precision),
      formatNumber(v.y, exportOptions.precision),
      formatNumber(v.z, exportOptions.precision),
    ];
    if (exportOptions.includeNormals && normals[i]) {
      row.push(
        formatNumber(normals[i].x, exportOptions.precision),
        formatNumber(normals[i].y, exportOptions.precision),
        formatNumber(normals[i].z, exportOptions.precision)
      );
    }
    if (exportOptions.includeUVs && uvs[i]) {
      row.push(
        formatNumber(uvs[i].u, exportOptions.precision),
        formatNumber(uvs[i].v, exportOptions.precision)
      );
    }
    lines.push(row.join(','));
  });

  return lines.join('\n');
}

export function exportToObj(data: ExportData): string {
  const { vertices, normals, uvs, indices, exportOptions } = data;
  const filteredVertices = exportOptions.filterRange ? filterPoints(vertices, exportOptions.filterRange) : vertices;

  const lines: string[] = [];
  lines.push('# 曲面积分讲台 - OBJ导出');
  lines.push(`# 导出时间: ${new Date(data.exportedAt).toISOString()}`);
  lines.push(`# 顶点数: ${filteredVertices.length}`);
  lines.push('');

  filteredVertices.forEach((v) => {
    lines.push(
      `v ${formatNumber(v.x, exportOptions.precision)} ${formatNumber(v.y, exportOptions.precision)} ${formatNumber(v.z, exportOptions.precision)}`
    );
  });

  if (exportOptions.includeNormals) {
    lines.push('');
    normals.forEach((n) => {
      lines.push(
        `vn ${formatNumber(n.x, exportOptions.precision)} ${formatNumber(n.y, exportOptions.precision)} ${formatNumber(n.z, exportOptions.precision)}`
      );
    });
  }

  if (exportOptions.includeUVs) {
    lines.push('');
    uvs.forEach((uv) => {
      lines.push(`vt ${formatNumber(uv.u, exportOptions.precision)} ${formatNumber(uv.v, exportOptions.precision)}`);
    });
  }

  if (indices.length > 0) {
    lines.push('');
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i] + 1;
      const b = indices[i + 1] + 1;
      const c = indices[i + 2] + 1;
      if (exportOptions.includeNormals && exportOptions.includeUVs) {
        lines.push(`f ${a}/${a}/${a} ${b}/${b}/${b} ${c}/${c}/${c}`);
      } else if (exportOptions.includeNormals) {
        lines.push(`f ${a}//${a} ${b}//${b} ${c}//${c}`);
      } else if (exportOptions.includeUVs) {
        lines.push(`f ${a}/${a} ${b}/${b} ${c}/${c}`);
      } else {
        lines.push(`f ${a} ${b} ${c}`);
      }
    }
  }

  return lines.join('\n');
}

export function exportData(
  data: Omit<ExportData, 'exportedAt' | 'boundingBox'>,
  options: Partial<ExportOptions> = {}
): { content: string; filename: string; mimeType: string } {
  const exportOptions: ExportOptions = {
    format: 'json',
    includeMaterials: true,
    includeNormals: true,
    includeUVs: true,
    includeDiagnosis: true,
    precision: 6,
    filterRange: {},
    lockedToScreen: false,
    screenViewport: { width: 800, height: 600 },
    ...options,
  };

  const allPoints = [...data.vertices, ...data.boundaryPoints, ...data.samplePoints];
  const bbox = computeBoundingBox(allPoints);

  const fullData: ExportData = {
    ...data,
    exportOptions,
    exportedAt: Date.now(),
    boundingBox: bbox,
  };

  let content: string;
  let filename: string;
  let mimeType: string;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  switch (exportOptions.format) {
    case 'csv':
      content = exportToCsv(fullData);
      filename = `surface_integral_${timestamp}.csv`;
      mimeType = 'text/csv';
      break;
    case 'obj':
      content = exportToObj(fullData);
      filename = `surface_integral_${timestamp}.obj`;
      mimeType = 'model/obj';
      break;
    case 'json':
    default:
      content = exportToJson(fullData);
      filename = `surface_integral_${timestamp}.json`;
      mimeType = 'application/json';
      break;
  }

  return { content, filename, mimeType };
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
