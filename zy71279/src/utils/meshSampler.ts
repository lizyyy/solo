import type { MeshData, ErrorSample, Vec3 } from '@/types';
import { vec3, computeTriangleArea, generateUUID } from './math';

export class MeshSampler {
  private mesh: MeshData;
  private faceAreas: number[];
  private totalArea: number;
  private cumulativeAreas: number[];

  constructor(mesh: MeshData) {
    this.mesh = mesh;
    this.faceAreas = this.computeFaceAreas();
    this.totalArea = this.faceAreas.reduce((sum, a) => sum + a, 0);
    this.cumulativeAreas = this.computeCumulativeAreas();
  }

  private computeFaceAreas(): number[] {
    const areas: number[] = [];
    const { vertices, faces, faceCount } = this.mesh;

    for (let i = 0; i < faceCount; i++) {
      const i0 = faces[i * 3] * 3;
      const i1 = faces[i * 3 + 1] * 3;
      const i2 = faces[i * 3 + 2] * 3;

      const v0: Vec3 = [vertices[i0], vertices[i0 + 1], vertices[i0 + 2]];
      const v1: Vec3 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
      const v2: Vec3 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];

      areas.push(computeTriangleArea(v0, v1, v2));
    }

    return areas;
  }

  private computeCumulativeAreas(): number[] {
    const cumulative: number[] = [];
    let sum = 0;
    for (const area of this.faceAreas) {
      sum += area;
      cumulative.push(sum);
    }
    return cumulative;
  }

  private sampleFace(faceIndex: number): { position: Vec3; normal: Vec3 } {
    const { vertices, faces, normals } = this.mesh;

    const i0 = faces[faceIndex * 3] * 3;
    const i1 = faces[faceIndex * 3 + 1] * 3;
    const i2 = faces[faceIndex * 3 + 2] * 3;

    const v0: Vec3 = [vertices[i0], vertices[i0 + 1], vertices[i0 + 2]];
    const v1: Vec3 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
    const v2: Vec3 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];

    const n0: Vec3 = [normals[i0], normals[i0 + 1], normals[i0 + 2]];
    const n1: Vec3 = [normals[i1], normals[i1 + 1], normals[i1 + 2]];
    const n2: Vec3 = [normals[i2], normals[i2 + 1], normals[i2 + 2]];

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

    const normal: Vec3 = vec3.normalize([
      n0[0] * u + n1[0] * v + n2[0] * w,
      n0[1] * u + n1[1] * v + n2[1] * w,
      n0[2] * u + n1[2] * v + n2[2] * w
    ]);

    return { position, normal };
  }

  private findFaceByArea(randomArea: number): number {
    let low = 0;
    let high = this.cumulativeAreas.length - 1;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.cumulativeAreas[mid] < randomArea) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }

  samplePoints(count: number): ErrorSample[] {
    const samples: ErrorSample[] = [];

    for (let i = 0; i < count; i++) {
      const randomArea = Math.random() * this.totalArea;
      const faceIndex = this.findFaceByArea(randomArea);
      const { position, normal } = this.sampleFace(faceIndex);

      samples.push({
        position,
        distance: 0,
        faceIndex,
        normal
      });
    }

    return samples;
  }

  sampleByFaceDensity(): ErrorSample[] {
    const samples: ErrorSample[] = [];
    const { faceCount } = this.mesh;
    const targetDensity = 10;
    const samplesPerFace = Math.max(1, Math.floor(targetDensity * this.totalArea / faceCount));

    for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
      for (let i = 0; i < samplesPerFace; i++) {
        const { position, normal } = this.sampleFace(faceIndex);
        samples.push({
          position,
          distance: 0,
          faceIndex,
          normal
        });
      }
    }

    return samples;
  }

  sampleByCurvature(adaptive: boolean = true): ErrorSample[] {
    const samples: ErrorSample[] = [];
    const { vertices, faces, normals, faceCount } = this.mesh;
    const curvatures: number[] = [];

    for (let i = 0; i < faceCount; i++) {
      const i0 = faces[i * 3] * 3;
      const i1 = faces[i * 3 + 1] * 3;
      const i2 = faces[i * 3 + 2] * 3;

      const n0: Vec3 = [normals[i0], normals[i0 + 1], normals[i0 + 2]];
      const n1: Vec3 = [normals[i1], normals[i1 + 1], normals[i1 + 2]];
      const n2: Vec3 = [normals[i2], normals[i2 + 1], normals[i2 + 2]];

      const d1 = Math.abs(vec3.dot(n0, n1));
      const d2 = Math.abs(vec3.dot(n1, n2));
      const d3 = Math.abs(vec3.dot(n2, n0));
      const curvature = 3 - (d1 + d2 + d3);

      curvatures.push(curvature);
    }

    const maxCurvature = Math.max(...curvatures);
    const baseSamplesPerFace = 2;
    const maxSamplesPerFace = adaptive ? 10 : 5;

    for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
      const curvatureRatio = maxCurvature > 0 ? curvatures[faceIndex] / maxCurvature : 0;
      const sampleCount = Math.floor(
        baseSamplesPerFace + curvatureRatio * (maxSamplesPerFace - baseSamplesPerFace)
      );

      for (let i = 0; i < sampleCount; i++) {
        const { position, normal } = this.sampleFace(faceIndex);
        samples.push({
          position,
          distance: 0,
          faceIndex,
          normal
        });
      }
    }

    return samples;
  }

  sampleVertices(): ErrorSample[] {
    const samples: ErrorSample[] = [];
    const { vertices, normals, vertexCount, faces } = this.mesh;

    for (let i = 0; i < vertexCount; i++) {
      const vi = i * 3;
      const position: Vec3 = [vertices[vi], vertices[vi + 1], vertices[vi + 2]];
      const normal: Vec3 = [normals[vi], normals[vi + 1], normals[vi + 2]];

      let faceIndex = 0;
      for (let j = 0; j < faces.length; j++) {
        if (faces[j] === i) {
          faceIndex = Math.floor(j / 3);
          break;
        }
      }

      samples.push({
        position,
        distance: 0,
        faceIndex,
        normal
      });
    }

    return samples;
  }

  sampleEdgePoints(edgeDensity: number = 5): ErrorSample[] {
    const samples: ErrorSample[] = [];
    const { vertices, faces, normals, faceCount } = this.mesh;
    const edgeMap = new Map<string, { v0: number; v1: number; faceIndex: number }>();

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
        if (!edgeMap.has(key)) {
          edgeMap.set(key, { v0: a, v1: b, faceIndex });
        }
      }
    }

    for (const { v0, v1, faceIndex } of edgeMap.values()) {
      const vi0 = v0 * 3;
      const vi1 = v1 * 3;

      const p0: Vec3 = [vertices[vi0], vertices[vi0 + 1], vertices[vi0 + 2]];
      const p1: Vec3 = [vertices[vi1], vertices[vi1 + 1], vertices[vi1 + 2]];
      const n0: Vec3 = [normals[vi0], normals[vi0 + 1], normals[vi0 + 2]];
      const n1: Vec3 = [normals[vi1], normals[vi1 + 1], normals[vi1 + 2]];

      for (let i = 1; i < edgeDensity; i++) {
        const t = i / edgeDensity;
        const position = vec3.lerp(p0, p1, t);
        const normal = vec3.normalize(vec3.lerp(n0, n1, t));

        samples.push({
          position,
          distance: 0,
          faceIndex,
          normal
        });
      }
    }

    return samples;
  }

  getOptimalSampleCount(): number {
    const { faceCount, vertexCount } = this.mesh;
    const baseCount = Math.max(faceCount * 0.5, 1000);
    const vertexFactor = vertexCount > 10000 ? 1.5 : 1;
    return Math.min(Math.floor(baseCount * vertexFactor), 50000);
  }

  static combineSamples(...sampleArrays: ErrorSample[][]): ErrorSample[] {
    const combined: ErrorSample[] = [];
    for (const samples of sampleArrays) {
      combined.push(...samples);
    }
    return combined;
  }
}

export function generateSyntheticMesh(
  type: 'cube' | 'sphere' | 'bunny' | 'torus' = 'sphere',
  resolution: number = 32
): MeshData {
  const vertices: number[] = [];
  const faces: number[] = [];
  const normals: number[] = [];

  if (type === 'sphere') {
    const radius = 1;
    for (let lat = 0; lat <= resolution; lat++) {
      const theta = (lat * Math.PI) / resolution;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      for (let lon = 0; lon <= resolution; lon++) {
        const phi = (lon * 2 * Math.PI) / resolution;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);

        const x = radius * cosPhi * sinTheta;
        const y = radius * cosTheta;
        const z = radius * sinPhi * sinTheta;

        vertices.push(x, y, z);
        normals.push(x, y, z);
      }
    }

    for (let lat = 0; lat < resolution; lat++) {
      for (let lon = 0; lon < resolution; lon++) {
        const first = lat * (resolution + 1) + lon;
        const second = first + resolution + 1;

        faces.push(first, second, first + 1);
        faces.push(second, second + 1, first + 1);
      }
    }
  } else if (type === 'cube') {
    const size = 1;
    const corners = [
      [-size, -size, -size],
      [size, -size, -size],
      [size, size, -size],
      [-size, size, -size],
      [-size, -size, size],
      [size, -size, size],
      [size, size, size],
      [-size, size, size]
    ];

    const faceNormals = [
      [0, 0, -1],
      [0, 0, 1],
      [-1, 0, 0],
      [1, 0, 0],
      [0, -1, 0],
      [0, 1, 0]
    ];

    const faceIndices = [
      [0, 1, 2, 3],
      [5, 4, 7, 6],
      [4, 0, 3, 7],
      [1, 5, 6, 2],
      [4, 5, 1, 0],
      [3, 2, 6, 7]
    ];

    for (let f = 0; f < 6; f++) {
      const indices = faceIndices[f];
      const normal = faceNormals[f];

      for (let i = 0; i < 4; i++) {
        const v = corners[indices[i]];
        vertices.push(...v);
        normals.push(...normal);
      }

      const base = f * 4;
      faces.push(base, base + 1, base + 2);
      faces.push(base, base + 2, base + 3);
    }
  } else if (type === 'torus') {
    const R = 1;
    const r = 0.4;

    for (let i = 0; i <= resolution; i++) {
      const u = (i / resolution) * Math.PI * 2;
      const cosU = Math.cos(u);
      const sinU = Math.sin(u);

      for (let j = 0; j <= resolution; j++) {
        const v = (j / resolution) * Math.PI * 2;
        const cosV = Math.cos(v);
        const sinV = Math.sin(v);

        const x = (R + r * cosV) * cosU;
        const y = r * sinV;
        const z = (R + r * cosV) * sinU;

        const nx = cosV * cosU;
        const ny = sinV;
        const nz = cosV * sinU;

        vertices.push(x, y, z);
        normals.push(nx, ny, nz);
      }
    }

    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const a = i * (resolution + 1) + j;
        const b = a + resolution + 1;

        faces.push(a, b, a + 1);
        faces.push(b, b + 1, a + 1);
      }
    }
  }

  return {
    vertices: new Float32Array(vertices),
    faces: new Uint32Array(faces),
    normals: new Float32Array(normals),
    faceCount: faces.length / 3,
    vertexCount: vertices.length / 3,
    boundingBox: {
      min: [-2, -2, -2],
      max: [2, 2, 2]
    },
    name: `${type}_${generateUUID().slice(0, 8)}`
  };
}
