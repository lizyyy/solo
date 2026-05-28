import type { MeshData, ErrorSample, Vec3, ErrorAnalysis, DetailedError } from '@/types';
import { SimplificationAlgorithm } from '@/types';
import { vec3, pointToTriangleDistance, computeMean, computeStandardDeviation, computeHistogram, generateUUID, computeTriangleArea } from './math';

export class ErrorEstimator {
  private originalMesh: MeshData;
  private simplifiedMesh: MeshData;
  private originalFaceBoundingBoxes: { min: Vec3; max: Vec3 }[];
  private simplifiedFaceBoundingBoxes: { min: Vec3; max: Vec3 }[];

  constructor(originalMesh: MeshData, simplifiedMesh: MeshData) {
    this.originalMesh = originalMesh;
    this.simplifiedMesh = simplifiedMesh;
    this.originalFaceBoundingBoxes = this.computeFaceBoundingBoxes(originalMesh);
    this.simplifiedFaceBoundingBoxes = this.computeFaceBoundingBoxes(simplifiedMesh);
  }

  private computeFaceBoundingBoxes(mesh: MeshData): { min: Vec3; max: Vec3 }[] {
    const boxes: { min: Vec3; max: Vec3 }[] = [];
    const { vertices, faces, faceCount } = mesh;

    for (let i = 0; i < faceCount; i++) {
      const i0 = faces[i * 3] * 3;
      const i1 = faces[i * 3 + 1] * 3;
      const i2 = faces[i * 3 + 2] * 3;

      const v0: Vec3 = [vertices[i0], vertices[i0 + 1], vertices[i0 + 2]];
      const v1: Vec3 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
      const v2: Vec3 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];

      const min: Vec3 = [
        Math.min(v0[0], v1[0], v2[0]),
        Math.min(v0[1], v1[1], v2[1]),
        Math.min(v0[2], v1[2], v2[2])
      ];
      const max: Vec3 = [
        Math.max(v0[0], v1[0], v2[0]),
        Math.max(v0[1], v1[1], v2[1]),
        Math.max(v0[2], v1[2], v2[2])
      ];

      boxes.push({ min, max });
    }

    return boxes;
  }

  private getFaceVertices(mesh: MeshData, faceIndex: number): [Vec3, Vec3, Vec3] {
    const { vertices, faces } = mesh;
    const i0 = faces[faceIndex * 3] * 3;
    const i1 = faces[faceIndex * 3 + 1] * 3;
    const i2 = faces[faceIndex * 3 + 2] * 3;

    return [
      [vertices[i0], vertices[i0 + 1], vertices[i0 + 2]],
      [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]],
      [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]]
    ];
  }

  private pointToMeshDistance(
    point: Vec3,
    mesh: MeshData,
    faceBoundingBoxes: { min: Vec3; max: Vec3 }[]
  ): { distance: number; closestFace: number; closestPoint: Vec3 } {
    let minDistance = Infinity;
    let closestFace = -1;
    let closestPoint: Vec3 = [0, 0, 0];

    const pointArr = point;

    for (let i = 0; i < mesh.faceCount; i++) {
      const box = faceBoundingBoxes[i];

      const boxDist = this.pointToBoxDistance(pointArr, box.min, box.max);
      if (boxDist > minDistance) continue;

      const [v0, v1, v2] = this.getFaceVertices(mesh, i);
      const result = pointToTriangleDistance(pointArr, v0, v1, v2);

      if (result.distance < minDistance) {
        minDistance = result.distance;
        closestFace = i;
        closestPoint = result.closestPoint;
      }
    }

    return { distance: minDistance, closestFace, closestPoint };
  }

  private pointToBoxDistance(point: Vec3, min: Vec3, max: Vec3): number {
    let dx = 0, dy = 0, dz = 0;

    if (point[0] < min[0]) dx = min[0] - point[0];
    else if (point[0] > max[0]) dx = point[0] - max[0];

    if (point[1] < min[1]) dy = min[1] - point[1];
    else if (point[1] > max[1]) dy = point[1] - max[1];

    if (point[2] < min[2]) dz = min[2] - point[2];
    else if (point[2] > max[2]) dz = point[2] - max[2];

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  computePointToMeshDistance(points: Vec3[], direction: 'original_to_simplified' | 'simplified_to_original' = 'original_to_simplified'): number[] {
    const sourceMesh = direction === 'original_to_simplified' ? this.originalMesh : this.simplifiedMesh;
    const targetMesh = direction === 'original_to_simplified' ? this.simplifiedMesh : this.originalMesh;
    const targetBoxes = direction === 'original_to_simplified' ? this.simplifiedFaceBoundingBoxes : this.originalFaceBoundingBoxes;

    const distances: number[] = [];

    for (const point of points) {
      const result = this.pointToMeshDistance(point, targetMesh, targetBoxes);
      distances.push(result.distance);
    }

    return distances;
  }

  computeHausdorffDistance(): { max: number; mean: number; min: number; symmetric: boolean } {
    const sampleCount = Math.min(
      Math.max(this.originalMesh.faceCount, this.simplifiedMesh.faceCount),
      10000
    );

    const originalSamples = this.sampleMeshSurface(this.originalMesh, sampleCount);
    const simplifiedSamples = this.sampleMeshSurface(this.simplifiedMesh, sampleCount);

    const d1 = this.computePointToMeshDistance(originalSamples.map(s => s.position), 'original_to_simplified');
    const d2 = this.computePointToMeshDistance(simplifiedSamples.map(s => s.position), 'simplified_to_original');

    const max1 = Math.max(...d1);
    const max2 = Math.max(...d2);

    const symmetricMax = Math.max(max1, max2);
    const allDistances = [...d1, ...d2];

    return {
      max: symmetricMax,
      mean: computeMean(allDistances),
      min: Math.min(...allDistances),
      symmetric: true
    };
  }

  private sampleMeshSurface(mesh: MeshData, count: number): ErrorSample[] {
    const samples: ErrorSample[] = [];
    const { vertices, faces, faceCount } = mesh;

    const faceAreas: number[] = [];
    for (let i = 0; i < faceCount; i++) {
      const i0 = faces[i * 3] * 3;
      const i1 = faces[i * 3 + 1] * 3;
      const i2 = faces[i * 3 + 2] * 3;

      const v0: Vec3 = [vertices[i0], vertices[i0 + 1], vertices[i0 + 2]];
      const v1: Vec3 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
      const v2: Vec3 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];

      const ab = vec3.sub(v1, v0);
      const ac = vec3.sub(v2, v0);
      const cross = vec3.cross(ab, ac);
      faceAreas.push(vec3.length(cross) * 0.5);
    }

    const totalArea = faceAreas.reduce((sum, a) => sum + a, 0);
    const cumulativeAreas: number[] = [];
    let sum = 0;
    for (const area of faceAreas) {
      sum += area;
      cumulativeAreas.push(sum);
    }

    for (let i = 0; i < count; i++) {
      const randomArea = Math.random() * totalArea;
      let faceIndex = 0;
      for (let j = 0; j < cumulativeAreas.length; j++) {
        if (cumulativeAreas[j] >= randomArea) {
          faceIndex = j;
          break;
        }
      }

      const i0 = faces[faceIndex * 3] * 3;
      const i1 = faces[faceIndex * 3 + 1] * 3;
      const i2 = faces[faceIndex * 3 + 2] * 3;

      const v0: Vec3 = [vertices[i0], vertices[i0 + 1], vertices[i0 + 2]];
      const v1: Vec3 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
      const v2: Vec3 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];

      let r1 = Math.random();
      let r2 = Math.random();
      if (r1 + r2 > 1) {
        r1 = 1 - r1;
        r2 = 1 - r2;
      }

      const u = r1;
      const v = r2;
      const w = 1 - u - v;

      const position: Vec3 = [
        v0[0] * u + v1[0] * v + v2[0] * w,
        v0[1] * u + v1[1] * v + v2[1] * w,
        v0[2] * u + v1[2] * v + v2[2] * w
      ];

      samples.push({
        position,
        distance: 0,
        faceIndex,
        normal: [0, 0, 0]
      });
    }

    return samples;
  }

  computeErrorDistribution(bins: number = 20, samples?: ErrorSample[]): { range: [number, number]; count: number }[] {
    const actualSamples = samples || this.sampleMeshSurface(this.originalMesh, 5000);
    const distances = this.computePointToMeshDistance(actualSamples.map(s => s.position));
    return computeHistogram(distances, bins);
  }

  computePerFaceErrors(): { faceIndex: number; error: number; maxPoint: Vec3 }[] {
    const results: { faceIndex: number; error: number; maxPoint: Vec3 }[] = [];
    const { faceCount } = this.simplifiedMesh;

    for (let i = 0; i < faceCount; i++) {
      const [v0, v1, v2] = this.getFaceVertices(this.simplifiedMesh, i);

      const samplePoints: Vec3[] = [
        v0, v1, v2,
        vec3.lerp(v0, v1, 0.5),
        vec3.lerp(v1, v2, 0.5),
        vec3.lerp(v2, v0, 0.5),
        vec3.lerp(vec3.lerp(v0, v1, 0.5), v2, 0.5)
      ];

      let maxError = 0;
      let maxPoint: Vec3 = v0;

      for (const point of samplePoints) {
        const result = this.pointToMeshDistance(point, this.originalMesh, this.originalFaceBoundingBoxes);
        if (result.distance > maxError) {
          maxError = result.distance;
          maxPoint = point;
        }
      }

      results.push({ faceIndex: i, error: maxError, maxPoint });
    }

    return results;
  }

  findMaxErrorPoints(count: number = 10): { position: Vec3; error: number }[] {
    const perFaceErrors = this.computePerFaceErrors();
    perFaceErrors.sort((a, b) => b.error - a.error);
    return perFaceErrors.slice(0, count).map(e => ({
      position: e.maxPoint,
      error: e.error
    }));
  }

  computeVolume(): number {
    const { vertices, faces, faceCount } = this.originalMesh;
    let volume = 0;

    for (let i = 0; i < faceCount; i++) {
      const i0 = faces[i * 3] * 3;
      const i1 = faces[i * 3 + 1] * 3;
      const i2 = faces[i * 3 + 2] * 3;

      const v0: Vec3 = [vertices[i0], vertices[i0 + 1], vertices[i0 + 2]];
      const v1: Vec3 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
      const v2: Vec3 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];

      const cross = vec3.cross(v1, v2);
      volume += vec3.dot(v0, cross);
    }

    return Math.abs(volume) / 6.0;
  }

  computeSurfaceArea(): number {
    const { vertices, faces, faceCount } = this.originalMesh;
    let area = 0;

    for (let i = 0; i < faceCount; i++) {
      const i0 = faces[i * 3] * 3;
      const i1 = faces[i * 3 + 1] * 3;
      const i2 = faces[i * 3 + 2] * 3;

      const v0: Vec3 = [vertices[i0], vertices[i0 + 1], vertices[i0 + 2]];
      const v1: Vec3 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
      const v2: Vec3 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];

      const ab = vec3.sub(v1, v0);
      const ac = vec3.sub(v2, v0);
      area += vec3.length(vec3.cross(ab, ac)) * 0.5;
    }

    return area;
  }

  validateErrorScale(expectedScale?: number): { valid: boolean; scale: number; errors: DetailedError[] } {
    const hausdorff = this.computeHausdorffDistance();
    const diagonal = this.computeBoundingBoxDiagonal(this.originalMesh);
    const relativeError = hausdorff.max / diagonal;

    const errors: DetailedError[] = [];

    if (hausdorff.max <= 0 || hausdorff.max > diagonal * 0.5) {
      errors.push({
        type: 'error_scale',
        severity: 'error',
        message: `误差尺度异常: 最大误差 ${hausdorff.max.toFixed(4)} mm 相对于模型尺寸 ${diagonal.toFixed(4)} mm 不合理`,
        details: {
          maxError: hausdorff.max,
          diagonal,
          relativeError,
          expectedScale: expectedScale || 'auto'
        }
      });
    }

    if (expectedScale !== undefined) {
      const ratio = hausdorff.max / expectedScale;
      if (ratio < 0.01 || ratio > 100) {
        errors.push({
          type: 'error_scale',
          severity: 'warning',
          message: `误差尺度与预期偏差较大: 计算值 ${hausdorff.max.toFixed(4)} mm, 预期 ${expectedScale.toFixed(4)} mm`,
          details: {
            computed: hausdorff.max,
            expected: expectedScale,
            ratio
          }
        });
      }
    }

    return {
      valid: errors.length === 0,
      scale: hausdorff.max,
      errors
    };
  }

  private computeBoundingBoxDiagonal(mesh: MeshData): number {
    const { min, max } = mesh.boundingBox;
    return vec3.distance(min, max);
  }

  generateAnalysis(taskId: string): ErrorAnalysis {
    const hausdorff = this.computeHausdorffDistance();
    const errorDist = this.computeErrorDistribution(20);
    const maxErrorPoints = this.findMaxErrorPoints(10);
    const volume = this.computeVolume();
    const surfaceArea = this.computeSurfaceArea();

    const originalSamples = this.sampleMeshSurface(this.originalMesh, 3000);
    const allDistances = this.computePointToMeshDistance(originalSamples.map(s => s.position));
    const meanError = computeMean(allDistances);
    const stdDev = computeStandardDeviation(allDistances, meanError);

    return {
      id: generateUUID(),
      taskId,
      maxError: hausdorff.max,
      minError: hausdorff.min,
      meanError,
      stdDeviation: stdDev,
      errorDistribution: errorDist,
      maxErrorPoints,
      hasNormalFlip: false,
      normalFlipCount: 0,
      hasHoles: false,
      holeCount: 0,
      volume,
      surfaceArea,
      qualityResult: {
        hasNormalFlip: false,
        normalFlipFaces: [],
        hasHoles: false,
        holeBoundaries: [],
        nonManifoldEdges: [],
        degenerateFaces: [],
        errors: []
      }
    };
  }
}

function computeFaceCurvature(mesh: MeshData, faceIndex: number): number {
  const { vertices, faces, faceCount } = mesh;
  const i0 = faces[faceIndex * 3] * 3;
  const i1 = faces[faceIndex * 3 + 1] * 3;
  const i2 = faces[faceIndex * 3 + 2] * 3;

  const v0: Vec3 = [vertices[i0], vertices[i0 + 1], vertices[i0 + 2]];
  const v1: Vec3 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
  const v2: Vec3 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];

  const e0 = vec3.sub(v1, v0);
  const e1 = vec3.sub(v2, v0);
  const normal = vec3.normalize(vec3.cross(e0, e1));
  const area = vec3.length(vec3.cross(e0, e1)) * 0.5;

  const center: Vec3 = [
    (v0[0] + v1[0] + v2[0]) / 3,
    (v0[1] + v1[1] + v2[1]) / 3,
    (v0[2] + v1[2] + v2[2]) / 3
  ];

  const { min, max } = mesh.boundingBox;
  const diagonal = vec3.distance(min, max);
  const sampleRadius = diagonal * 0.05;

  let curvatureSum = 0;
  let neighborCount = 0;

  for (let i = 0; i < faceCount; i++) {
    if (i === faceIndex) continue;

    const j0 = faces[i * 3] * 3;
    const j1 = faces[i * 3 + 1] * 3;
    const j2 = faces[i * 3 + 2] * 3;

    const c: Vec3 = [
      (vertices[j0] + vertices[j1] + vertices[j2]) / 3,
      (vertices[j0 + 1] + vertices[j1 + 1] + vertices[j2 + 1]) / 3,
      (vertices[j0 + 2] + vertices[j1 + 2] + vertices[j2 + 2]) / 3
    ];

    if (vec3.distance(center, c) < sampleRadius) {
      const n0 = vec3.normalize(vec3.cross(
        vec3.sub([vertices[j1], vertices[j1 + 1], vertices[j1 + 2]], [vertices[j0], vertices[j0 + 1], vertices[j0 + 2]]),
        vec3.sub([vertices[j2], vertices[j2 + 1], vertices[j2 + 2]], [vertices[j0], vertices[j0 + 1], vertices[j0 + 2]])
      ));
      const dot = Math.abs(vec3.dot(normal, n0));
      curvatureSum += 1 - dot;
      neighborCount++;
    }
  }

  const curvature = neighborCount > 0 ? curvatureSum / neighborCount : 0;
  return curvature * (1 + area * 100);
}

function isFaceOnBorder(mesh: MeshData, faceIndex: number): boolean {
  const { faces, faceCount } = mesh;
  const edgeCount = new Map<string, number>();

  for (let i = 0; i < faceCount; i++) {
    for (let j = 0; j < 3; j++) {
      const a = faces[i * 3 + j];
      const b = faces[i * 3 + (j + 1) % 3];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
    }
  }

  for (let j = 0; j < 3; j++) {
    const a = faces[faceIndex * 3 + j];
    const b = faces[faceIndex * 3 + (j + 1) % 3];
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (edgeCount.get(key) === 1) return true;
  }

  return false;
}

function buildSimplifiedMesh(
  mesh: MeshData,
  sortedFaceIndices: number[],
  targetFaceCount: number,
  algorithmName: string
): MeshData {
  const vertices: number[] = [];
  const faces: number[] = [];
  const normals: number[] = [];
  const vertexMap = new Map<number, number>();

  let newVertexIndex = 0;

  for (let i = 0; i < targetFaceCount && i < sortedFaceIndices.length; i++) {
    const faceIdx = sortedFaceIndices[i] * 3;

    for (let j = 0; j < 3; j++) {
      const oldVertexIdx = mesh.faces[faceIdx + j];
      if (!vertexMap.has(oldVertexIdx)) {
        const vi = oldVertexIdx * 3;
        vertices.push(mesh.vertices[vi], mesh.vertices[vi + 1], mesh.vertices[vi + 2]);
        normals.push(mesh.normals[vi], mesh.normals[vi + 1], mesh.normals[vi + 2]);
        vertexMap.set(oldVertexIdx, newVertexIndex);
        newVertexIndex++;
      }
      faces.push(vertexMap.get(oldVertexIdx)!);
    }
  }

  return {
    vertices: new Float32Array(vertices),
    faces: new Uint32Array(faces),
    normals: new Float32Array(normals),
    faceCount: faces.length / 3,
    vertexCount: vertices.length / 3,
    boundingBox: mesh.boundingBox,
    name: `${mesh.name}_${algorithmName}_${faces.length / 3}`
  };
}

export function simulateMeshSimplification(
  mesh: MeshData,
  targetFaceCount: number,
  algorithm: string
): MeshData {
  const ratio = Math.min(1, targetFaceCount / mesh.faceCount);

  if (ratio >= 0.99) {
    return { ...mesh };
  }

  const targetFaces = Math.max(4, Math.floor(mesh.faceCount * ratio));
  const { vertices, faces, faceCount } = mesh;

  switch (algorithm) {
    case SimplificationAlgorithm.QUADRIC_EDGE_COLLAPSE: {
      const faceImportance: { index: number; importance: number }[] = [];

      for (let i = 0; i < faceCount; i++) {
        const curvature = computeFaceCurvature(mesh, i);
        const isBorder = isFaceOnBorder(mesh, i);
        const importance = curvature * (isBorder ? 2 : 1) + Math.random() * 0.001;
        faceImportance.push({ index: i, importance });
      }

      faceImportance.sort((a, b) => b.importance - a.importance);
      return buildSimplifiedMesh(mesh, faceImportance.map(f => f.index), targetFaces, 'qem');
    }

    case SimplificationAlgorithm.CLUSTERING: {
      const { min, max } = mesh.boundingBox;
      const gridSize = Math.ceil(Math.pow(targetFaces, 1/3)) * 2;
      const cellSize = [
        (max[0] - min[0]) / gridSize,
        (max[1] - min[1]) / gridSize,
        (max[2] - min[2]) / gridSize
      ];

      const gridMap = new Map<string, number[]>();

      for (let i = 0; i < faceCount; i++) {
        const i0 = faces[i * 3] * 3;
        const i1 = faces[i * 3 + 1] * 3;
        const i2 = faces[i * 3 + 2] * 3;

        const cx = (vertices[i0] + vertices[i1] + vertices[i2]) / 3;
        const cy = (vertices[i0 + 1] + vertices[i1 + 1] + vertices[i2 + 1]) / 3;
        const cz = (vertices[i0 + 2] + vertices[i1 + 2] + vertices[i2 + 2]) / 3;

        const gx = Math.min(gridSize - 1, Math.floor((cx - min[0]) / cellSize[0]));
        const gy = Math.min(gridSize - 1, Math.floor((cy - min[1]) / cellSize[1]));
        const gz = Math.min(gridSize - 1, Math.floor((cz - min[2]) / cellSize[2]));

        const key = `${gx},${gy},${gz}`;
        if (!gridMap.has(key)) gridMap.set(key, []);
        gridMap.get(key)!.push(i);
      }

      const selectedFaces: number[] = [];
      const cells = Array.from(gridMap.values());
      const facesPerCell = Math.ceil(targetFaces / cells.length);

      for (const cellFaces of cells) {
        const shuffled = [...cellFaces].sort(() => Math.random() - 0.5);
        selectedFaces.push(...shuffled.slice(0, facesPerCell));
      }

      return buildSimplifiedMesh(mesh, selectedFaces, targetFaces, 'cluster');
    }

    case SimplificationAlgorithm.VERTEX_CLUSTERING: {
      const vertexValence = new Map<number, number>();
      for (let i = 0; i < faceCount * 3; i++) {
        const v = faces[i];
        vertexValence.set(v, (vertexValence.get(v) || 0) + 1);
      }

      const faceImportance: { index: number; importance: number }[] = [];
      for (let i = 0; i < faceCount; i++) {
        const v0 = faces[i * 3];
        const v1 = faces[i * 3 + 1];
        const v2 = faces[i * 3 + 2];

        const avgValence = (
          (vertexValence.get(v0) || 0) +
          (vertexValence.get(v1) || 0) +
          (vertexValence.get(v2) || 0)
        ) / 3;

        const i0 = v0 * 3;
        const i1 = v1 * 3;
        const i2 = v2 * 3;
        const area = computeTriangleArea(
          [vertices[i0], vertices[i0 + 1], vertices[i0 + 2]],
          [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]],
          [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]]
        );

        const isBorder = isFaceOnBorder(mesh, i);
        const importance = (1 / avgValence) * (1 + area * 50) * (isBorder ? 1.5 : 1);
        faceImportance.push({ index: i, importance });
      }

      faceImportance.sort((a, b) => b.importance - a.importance);
      return buildSimplifiedMesh(mesh, faceImportance.map(f => f.index), targetFaces, 'vcluster');
    }

    case SimplificationAlgorithm.MESHDECIMATOR:
    default: {
      const faceScores: { index: number; score: number }[] = [];

      for (let i = 0; i < faceCount; i++) {
        const curvature = computeFaceCurvature(mesh, i);
        const i0 = faces[i * 3] * 3;
        const i1 = faces[i * 3 + 1] * 3;
        const i2 = faces[i * 3 + 2] * 3;

        const area = computeTriangleArea(
          [vertices[i0], vertices[i0 + 1], vertices[i0 + 2]],
          [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]],
          [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]]
        );

        const isBorder = isFaceOnBorder(mesh, i);
        const score = curvature * 0.4 + (1 / (1 + area)) * 0.4 + (isBorder ? 0.2 : 0);
        faceScores.push({ index: i, score: score + Math.random() * 0.001 });
      }

      faceScores.sort((a, b) => b.score - a.score);
      return buildSimplifiedMesh(mesh, faceScores.map(f => f.index), targetFaces, 'decimator');
    }
  }
}
