import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import type { MeshData, Vec3 } from '@/types';
import { vec3, generateUUID } from './math';

export async function parseMeshFile(file: File): Promise<MeshData> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'stl') {
    return parseSTL(file);
  } else if (extension === 'obj') {
    return parseOBJ(file);
  } else {
    throw new Error(`不支持的文件格式: ${extension}。请上传 STL 或 OBJ 文件。`);
  }
}

async function parseSTL(file: File): Promise<MeshData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const loader = new STLLoader();
        const geometry = loader.parse(e.target?.result as ArrayBuffer);
        geometry.computeVertexNormals();

        const meshData = geometryToMeshData(geometry, file.name);
        resolve(meshData);
      } catch (error) {
        reject(new Error(`STL 文件解析失败: ${error instanceof Error ? error.message : '未知错误'}`));
      }
    };

    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

async function parseOBJ(file: File): Promise<MeshData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const loader = new OBJLoader();
        const object = loader.parse(content);

        let geometry: THREE.BufferGeometry | null = null;

        object.traverse((child) => {
          if (child instanceof THREE.Mesh && child.geometry) {
            geometry = child.geometry;
          }
        });

        if (!geometry) {
          reject(new Error('OBJ 文件中未找到有效网格数据'));
          return;
        }

        geometry.computeVertexNormals();
        const meshData = geometryToMeshData(geometry, file.name);
        resolve(meshData);
      } catch (error) {
        reject(new Error(`OBJ 文件解析失败: ${error instanceof Error ? error.message : '未知错误'}`));
      }
    };

    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

function geometryToMeshData(geometry: THREE.BufferGeometry, name: string): MeshData {
  const positionAttr = geometry.getAttribute('position');
  const normalAttr = geometry.getAttribute('normal');
  const indexAttr = geometry.getIndex();

  if (!positionAttr) {
    throw new Error('网格缺少顶点位置数据');
  }

  let vertices: Float32Array;
  let faces: Uint32Array;
  let normals: Float32Array;
  let vertexCount: number;
  let faceCount: number;

  if (indexAttr) {
    vertices = new Float32Array(positionAttr.array);
    vertexCount = positionAttr.count;

    const indices = new Uint32Array(indexAttr.array);
    faces = indices;
    faceCount = indices.length / 3;

    if (normalAttr) {
      normals = new Float32Array(normalAttr.array);
    } else {
      normals = computeNormals(vertices, faces);
    }
  } else {
    const positions = new Float32Array(positionAttr.array);
    vertexCount = positions.length / 3;
    faceCount = vertexCount / 3;

    vertices = new Float32Array(positions.length);
    faces = new Uint32Array(faceCount * 3);
    normals = new Float32Array(positions.length);

    const vertexMap = new Map<string, number>();
    let currentIndex = 0;

    for (let i = 0; i < vertexCount; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;

      if (!vertexMap.has(key)) {
        vertexMap.set(key, currentIndex);
        vertices[currentIndex * 3] = x;
        vertices[currentIndex * 3 + 1] = y;
        vertices[currentIndex * 3 + 2] = z;
        currentIndex++;
      }

      faces[i] = vertexMap.get(key)!;
    }

    vertexCount = currentIndex;
    vertices = vertices.slice(0, vertexCount * 3);
    normals = normals.slice(0, vertexCount * 3);

    if (normalAttr) {
      const normalData = new Float32Array(normalAttr.array);
      for (let i = 0; i < currentIndex; i++) {
        normals[i * 3] = normalData[i * 3];
        normals[i * 3 + 1] = normalData[i * 3 + 1];
        normals[i * 3 + 2] = normalData[i * 3 + 2];
      }
    } else {
      normals = computeNormals(vertices, faces);
    }
  }

  const boundingBox = computeBoundingBox(vertices);

  return {
    vertices,
    faces,
    normals,
    faceCount,
    vertexCount,
    boundingBox,
    name: name.replace(/\.[^/.]+$/, '')
  };
}

function computeNormals(vertices: Float32Array, faces: Uint32Array): Float32Array {
  const normals = new Float32Array(vertices.length);
  const vertexNormalCount = new Uint32Array(vertices.length / 3);

  for (let i = 0; i < faces.length; i += 3) {
    const i0 = faces[i] * 3;
    const i1 = faces[i + 1] * 3;
    const i2 = faces[i + 2] * 3;

    const v0: Vec3 = [vertices[i0], vertices[i0 + 1], vertices[i0 + 2]];
    const v1: Vec3 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
    const v2: Vec3 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];

    const ab = vec3.sub(v1, v0);
    const ac = vec3.sub(v2, v0);
    const normal = vec3.normalize(vec3.cross(ab, ac));

    for (const vi of [faces[i], faces[i + 1], faces[i + 2]]) {
      normals[vi * 3] += normal[0];
      normals[vi * 3 + 1] += normal[1];
      normals[vi * 3 + 2] += normal[2];
      vertexNormalCount[vi]++;
    }
  }

  for (let i = 0; i < vertexNormalCount.length; i++) {
    if (vertexNormalCount[i] > 0) {
      const count = vertexNormalCount[i];
      normals[i * 3] /= count;
      normals[i * 3 + 1] /= count;
      normals[i * 3 + 2] /= count;

      const len = Math.sqrt(
        normals[i * 3] ** 2 +
        normals[i * 3 + 1] ** 2 +
        normals[i * 3 + 2] ** 2
      );

      if (len > 0) {
        normals[i * 3] /= len;
        normals[i * 3 + 1] /= len;
        normals[i * 3 + 2] /= len;
      }
    }
  }

  return normals;
}

function computeBoundingBox(vertices: Float32Array): { min: Vec3; max: Vec3 } {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < vertices.length; i += 3) {
    minX = Math.min(minX, vertices[i]);
    minY = Math.min(minY, vertices[i + 1]);
    minZ = Math.min(minZ, vertices[i + 2]);
    maxX = Math.max(maxX, vertices[i]);
    maxY = Math.max(maxY, vertices[i + 1]);
    maxZ = Math.max(maxZ, vertices[i + 2]);
  }

  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ]
  };
}

export function meshDataToThreeGeometry(meshData: MeshData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(meshData.vertices, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(meshData.faces, 1));

  return geometry;
}

export function meshDataToThreeMesh(
  meshData: MeshData,
  material?: THREE.Material
): THREE.Mesh {
  const geometry = meshDataToThreeGeometry(meshData);

  const defaultMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a90d9,
    metalness: 0.1,
    roughness: 0.7,
    side: THREE.DoubleSide
  });

  return new THREE.Mesh(geometry, material || defaultMaterial);
}

export function validateMeshFile(file: File): { valid: boolean; message?: string } {
  const maxSize = 100 * 1024 * 1024;
  const validExtensions = ['stl', 'obj'];

  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !validExtensions.includes(extension)) {
    return {
      valid: false,
      message: `不支持的文件格式。请上传 ${validExtensions.join(', ').toUpperCase()} 格式的文件。`
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      message: `文件过大 (${(file.size / 1024 / 1024).toFixed(2)} MB)。最大支持 ${maxSize / 1024 / 1024} MB。`
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      message: '文件为空。'
    };
  }

  return { valid: true };
}

export function getMeshInfo(meshData: MeshData): {
  faceCount: number;
  vertexCount: number;
  edgeCount: number;
  volume: number;
  surfaceArea: number;
  boundingBox: { min: Vec3; max: Vec3 };
  dimensions: Vec3;
} {
  const edgeSet = new Set<string>();
  const { faces, faceCount, vertices, boundingBox } = meshData;

  for (let i = 0; i < faceCount; i++) {
    const i0 = faces[i * 3];
    const i1 = faces[i * 3 + 1];
    const i2 = faces[i * 3 + 2];

    const edges = [
      [Math.min(i0, i1), Math.max(i0, i1)],
      [Math.min(i1, i2), Math.max(i1, i2)],
      [Math.min(i2, i0), Math.max(i2, i0)]
    ];

    for (const [a, b] of edges) {
      edgeSet.add(`${a}-${b}`);
    }
  }

  let volume = 0;
  let surfaceArea = 0;

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

    volume += vec3.dot(v0, cross);
    surfaceArea += vec3.length(cross) * 0.5;
  }

  volume = Math.abs(volume) / 6.0;

  const dimensions: Vec3 = [
    boundingBox.max[0] - boundingBox.min[0],
    boundingBox.max[1] - boundingBox.min[1],
    boundingBox.max[2] - boundingBox.min[2]
  ];

  return {
    faceCount,
    vertexCount: meshData.vertexCount,
    edgeCount: edgeSet.size,
    volume,
    surfaceArea,
    boundingBox,
    dimensions
  };
}
