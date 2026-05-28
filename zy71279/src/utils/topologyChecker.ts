import type { MeshData, Vec3, MeshQualityResult, DetailedError } from '@/types';
import { vec3, computeTriangleNormal, generateUUID } from './math';

export class TopologyChecker {
  private mesh: MeshData;

  constructor(mesh: MeshData) {
    this.mesh = mesh;
  }

  checkNormals(): { flipped: number[]; consistent: boolean; errors: DetailedError[] } {
    const { vertices, faces, normals, faceCount } = this.mesh;
    const flipped: number[] = [];
    const errors: DetailedError[] = [];

    const faceNormals: Vec3[] = [];
    for (let i = 0; i < faceCount; i++) {
      const i0 = faces[i * 3] * 3;
      const i1 = faces[i * 3 + 1] * 3;
      const i2 = faces[i * 3 + 2] * 3;

      const v0: Vec3 = [vertices[i0], vertices[i0 + 1], vertices[i0 + 2]];
      const v1: Vec3 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
      const v2: Vec3 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];

      faceNormals.push(computeTriangleNormal(v0, v1, v2));
    }

    for (let i = 0; i < faceCount; i++) {
      const i0 = faces[i * 3] * 3;
      const i1 = faces[i * 3 + 1] * 3;
      const i2 = faces[i * 3 + 2] * 3;

      const n0: Vec3 = [normals[i0], normals[i0 + 1], normals[i0 + 2]];
      const n1: Vec3 = [normals[i1], normals[i1 + 1], normals[i1 + 2]];
      const n2: Vec3 = [normals[i2], normals[i2 + 1], normals[i2 + 2]];

      const avgNormal = vec3.normalize([
        (n0[0] + n1[0] + n2[0]) / 3,
        (n0[1] + n1[1] + n2[1]) / 3,
        (n0[2] + n1[2] + n2[2]) / 3
      ]);

      const dotProduct = vec3.dot(avgNormal, faceNormals[i]);

      if (dotProduct < -0.1) {
        flipped.push(i);

        const faceCenter: Vec3 = [
          (vertices[i0] + vertices[i1] + vertices[i2]) / 3,
          (vertices[i0 + 1] + vertices[i1 + 1] + vertices[i2 + 1]) / 3,
          (vertices[i0 + 2] + vertices[i1 + 2] + vertices[i2 + 2]) / 3
        ];

        errors.push({
          type: 'normal_flip',
          severity: 'error',
          message: `第 ${i} 个面法线方向与几何计算法线不一致`,
          location: faceCenter,
          faceIndex: i,
          details: {
            dotProduct,
            storedNormal: avgNormal,
            computedNormal: faceNormals[i],
            angle: Math.acos(Math.abs(dotProduct)) * 180 / Math.PI
          }
        });
      }
    }

    return {
      flipped,
      consistent: flipped.length === 0,
      errors
    };
  }

  checkHoles(): { count: number; boundaries: number[][]; errors: DetailedError[] } {
    const { faces, faceCount } = this.mesh;
    const edgeMap = new Map<string, { count: number; faces: number[] }>();
    const errors: DetailedError[] = [];

    for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
      const i0 = faces[faceIndex * 3];
      const i1 = faces[faceIndex * 3 + 1];
      const i2 = faces[faceIndex * 3 + 2];

      const edges = [
        [i0, i1],
        [i1, i2],
        [i2, i0]
      ];

      for (const [a, b] of edges) {
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        const existing = edgeMap.get(key) || { count: 0, faces: [] };
        existing.count++;
        existing.faces.push(faceIndex);
        edgeMap.set(key, existing);
      }
    }

    const boundaryEdges: [number, number][] = [];
    const boundaryEdgeMap = new Map<number, number[]>();

    for (const [key, value] of edgeMap) {
      if (value.count === 1) {
        const [a, b] = key.split('-').map(Number);
        boundaryEdges.push([a, b]);
        if (!boundaryEdgeMap.has(a)) boundaryEdgeMap.set(a, []);
        if (!boundaryEdgeMap.has(b)) boundaryEdgeMap.set(b, []);
        boundaryEdgeMap.get(a)!.push(b);
        boundaryEdgeMap.get(b)!.push(a);
      }
    }

    const boundaries: number[][] = [];
    const visitedEdges = new Set<string>();

    for (const [start, next] of boundaryEdges) {
      const startKey = `${start}-${next}`;
      const reverseKey = `${next}-${start}`;

      if (visitedEdges.has(startKey) || visitedEdges.has(reverseKey)) continue;

      const boundary: number[] = [start, next];
      let current = next;
      let prev = start;

      visitedEdges.add(startKey);
      visitedEdges.add(reverseKey);

      while (current !== start) {
        const neighbors = boundaryEdgeMap.get(current) || [];
        const nextVertex = neighbors.find(n => n !== prev);

        if (nextVertex === undefined) break;

        const edgeKey = current < nextVertex ? `${current}-${nextVertex}` : `${nextVertex}-${current}`;
        visitedEdges.add(edgeKey);

        boundary.push(nextVertex);
        prev = current;
        current = nextVertex;
      }

      if (boundary.length > 3) {
        boundaries.push(boundary);
      }
    }

    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i];
      const { vertices } = this.mesh;

      const center: Vec3 = [0, 0, 0];
      for (const vi of boundary) {
        center[0] += vertices[vi * 3];
        center[1] += vertices[vi * 3 + 1];
        center[2] += vertices[vi * 3 + 2];
      }
      center[0] /= boundary.length;
      center[1] /= boundary.length;
      center[2] /= boundary.length;

      errors.push({
        type: 'hole',
        severity: 'warning',
        message: `检测到第 ${i + 1} 个孔洞，包含 ${boundary.length} 条边界边`,
        location: center,
        details: {
          boundaryIndex: i,
          edgeCount: boundary.length,
          boundaryVertices: boundary
        }
      });
    }

    return {
      count: boundaries.length,
      boundaries,
      errors
    };
  }

  checkManifold(): { nonManifoldEdges: number[]; isManifold: boolean; errors: DetailedError[] } {
    const { faces, faceCount } = this.mesh;
    const edgeMap = new Map<string, { count: number; faces: number[] }>();
    const errors: DetailedError[] = [];
    const nonManifoldEdges: number[] = [];

    for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
      const i0 = faces[faceIndex * 3];
      const i1 = faces[faceIndex * 3 + 1];
      const i2 = faces[faceIndex * 3 + 2];

      const edges = [
        [i0, i1],
        [i1, i2],
        [i2, i0]
      ];

      for (const [a, b] of edges) {
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        const existing = edgeMap.get(key) || { count: 0, faces: [] };
        existing.count++;
        existing.faces.push(faceIndex);
        edgeMap.set(key, existing);
      }
    }

    let edgeIndex = 0;
    for (const [key, value] of edgeMap) {
      if (value.count > 2) {
        nonManifoldEdges.push(edgeIndex);

        const [a, b] = key.split('-').map(Number);
        const { vertices } = this.mesh;
        const center: Vec3 = [
          (vertices[a * 3] + vertices[b * 3]) / 2,
          (vertices[a * 3 + 1] + vertices[b * 3 + 1]) / 2,
          (vertices[a * 3 + 2] + vertices[b * 3 + 2]) / 2
        ];

        errors.push({
          type: 'non_manifold',
          severity: 'error',
          message: `非流形边: 边 ${key} 被 ${value.count} 个面共享`,
          location: center,
          details: {
            edgeKey: key,
            sharedFaceCount: value.count,
            sharedFaces: value.faces
          }
        });
      }
      edgeIndex++;
    }

    return {
      nonManifoldEdges,
      isManifold: nonManifoldEdges.length === 0,
      errors
    };
  }

  checkDegenerateFaces(): { degenerateFaces: number[]; errors: DetailedError[] } {
    const { vertices, faces, faceCount } = this.mesh;
    const degenerateFaces: number[] = [];
    const errors: DetailedError[] = [];
    const areaThreshold = 1e-8;

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
      const area = vec3.length(cross) * 0.5;

      if (area < areaThreshold) {
        degenerateFaces.push(i);

        const center: Vec3 = [
          (v0[0] + v1[0] + v2[0]) / 3,
          (v0[1] + v1[1] + v2[1]) / 3,
          (v0[2] + v1[2] + v2[2]) / 3
        ];

        errors.push({
          type: 'degenerate_face',
          severity: 'warning',
          message: `退化三角形: 第 ${i} 个面面积为 ${area.toExponential(4)}，小于阈值 ${areaThreshold}`,
          location: center,
          faceIndex: i,
          details: {
            area,
            threshold: areaThreshold,
            vertices: [v0, v1, v2]
          }
        });
      }
    }

    return { degenerateFaces, errors };
  }

  checkAll(): MeshQualityResult {
    const normalResult = this.checkNormals();
    const holeResult = this.checkHoles();
    const manifoldResult = this.checkManifold();
    const degenerateResult = this.checkDegenerateFaces();

    const allErrors = [
      ...normalResult.errors,
      ...holeResult.errors,
      ...manifoldResult.errors,
      ...degenerateResult.errors
    ];

    return {
      hasNormalFlip: !normalResult.consistent,
      normalFlipFaces: normalResult.flipped,
      hasHoles: holeResult.count > 0,
      holeBoundaries: holeResult.boundaries,
      nonManifoldEdges: manifoldResult.nonManifoldEdges,
      degenerateFaces: degenerateResult.degenerateFaces,
      errors: allErrors
    };
  }

  static createMeshWithNormalsFlipped(originalMesh: MeshData, flipRatio: number = 0.1): MeshData {
    const newNormals = new Float32Array(originalMesh.normals);
    const facesToFlip = Math.floor(originalMesh.faceCount * flipRatio);
    const flippedSet = new Set<number>();

    while (flippedSet.size < facesToFlip) {
      const faceIndex = Math.floor(Math.random() * originalMesh.faceCount);
      if (flippedSet.has(faceIndex)) continue;
      flippedSet.add(faceIndex);

      for (let j = 0; j < 3; j++) {
        const vi = originalMesh.faces[faceIndex * 3 + j] * 3;
        newNormals[vi] = -newNormals[vi];
        newNormals[vi + 1] = -newNormals[vi + 1];
        newNormals[vi + 2] = -newNormals[vi + 2];
      }
    }

    return {
      ...originalMesh,
      normals: newNormals,
      name: `${originalMesh.name}_normals_flipped`
    };
  }

  static createMeshWithHoles(originalMesh: MeshData, holeCount: number = 3, holeSize: number = 0.05): MeshData {
    const { vertices, faces, faceCount } = originalMesh;
    const facesToRemove = new Set<number>();

    for (let h = 0; h < holeCount; h++) {
      const centerFace = Math.floor(Math.random() * faceCount);
      const i0 = faces[centerFace * 3] * 3;
      const i1 = faces[centerFace * 3 + 1] * 3;
      const i2 = faces[centerFace * 3 + 2] * 3;

      const center: Vec3 = [
        (vertices[i0] + vertices[i1] + vertices[i2]) / 3,
        (vertices[i0 + 1] + vertices[i1 + 1] + vertices[i2 + 1]) / 3,
        (vertices[i0 + 2] + vertices[i1 + 2] + vertices[i2 + 2]) / 3
      ];

      const diagonal = vec3.distance(originalMesh.boundingBox.min, originalMesh.boundingBox.max);
      const radius = diagonal * holeSize;

      for (let i = 0; i < faceCount; i++) {
        const fi0 = faces[i * 3] * 3;
        const fi1 = faces[i * 3 + 1] * 3;
        const fi2 = faces[i * 3 + 2] * 3;

        const faceCenter: Vec3 = [
          (vertices[fi0] + vertices[fi1] + vertices[fi2]) / 3,
          (vertices[fi0 + 1] + vertices[fi1 + 1] + vertices[fi2 + 1]) / 3,
          (vertices[fi0 + 2] + vertices[fi1 + 2] + vertices[fi2 + 2]) / 3
        ];

        if (vec3.distance(center, faceCenter) < radius) {
          facesToRemove.add(i);
        }
      }
    }

    const newFaces: number[] = [];
    for (let i = 0; i < faceCount; i++) {
      if (!facesToRemove.has(i)) {
        newFaces.push(faces[i * 3], faces[i * 3 + 1], faces[i * 3 + 2]);
      }
    }

    return {
      ...originalMesh,
      faces: new Uint32Array(newFaces),
      faceCount: newFaces.length / 3,
      name: `${originalMesh.name}_with_holes`
    };
  }
}
