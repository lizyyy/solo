import * as THREE from 'three';
import type { HallModel, MaterialFace, Vec3, Seat, SoundSource, RayPath } from '../data/models/acoustic';
import { getRayColorByOrder } from './colorMap';

export function createShoeBoxHall(
  width: number,
  height: number,
  depth: number,
  name: string
): { hall: HallModel; faces: MaterialFace[] } {
  const center: Vec3 = { x: 0, y: 0, z: 0 };
  const halfW = width / 2;
  const halfD = depth / 2;

  const hall: HallModel = {
    id: 'hall_main',
    name,
    dimensions: { width, height, depth },
    center,
  };

  const faces: MaterialFace[] = [
    {
      id: 'face_floor',
      hallId: hall.id,
      surfaceName: '地板',
      materialType: 'wood',
      vertices: [
        { x: -halfW, y: 0, z: -halfD },
        { x: halfW, y: 0, z: -halfD },
        { x: halfW, y: 0, z: halfD },
        { x: -halfW, y: 0, z: halfD },
      ],
    },
    {
      id: 'face_ceiling',
      hallId: hall.id,
      surfaceName: '天花板',
      materialType: 'plaster',
      vertices: [
        { x: -halfW, y: height, z: halfD },
        { x: halfW, y: height, z: halfD },
        { x: halfW, y: height, z: -halfD },
        { x: -halfW, y: height, z: -halfD },
      ],
    },
    {
      id: 'face_wall_left',
      hallId: hall.id,
      surfaceName: '左侧墙',
      materialType: 'acoustic_panel',
      vertices: [
        { x: -halfW, y: 0, z: -halfD },
        { x: -halfW, y: 0, z: halfD },
        { x: -halfW, y: height, z: halfD },
        { x: -halfW, y: height, z: -halfD },
      ],
    },
    {
      id: 'face_wall_right',
      hallId: hall.id,
      surfaceName: '右侧墙',
      materialType: 'acoustic_panel',
      vertices: [
        { x: halfW, y: 0, z: halfD },
        { x: halfW, y: 0, z: -halfD },
        { x: halfW, y: height, z: -halfD },
        { x: halfW, y: height, z: halfD },
      ],
    },
    {
      id: 'face_wall_front',
      hallId: hall.id,
      surfaceName: '后墙',
      materialType: 'fabric',
      vertices: [
        { x: -halfW, y: 0, z: halfD },
        { x: halfW, y: 0, z: halfD },
        { x: halfW, y: height, z: halfD },
        { x: -halfW, y: height, z: halfD },
      ],
    },
    {
      id: 'face_wall_back',
      hallId: hall.id,
      surfaceName: '舞台前墙',
      materialType: 'wood',
      vertices: [
        { x: halfW, y: 0, z: -halfD },
        { x: -halfW, y: 0, z: -halfD },
        { x: -halfW, y: height, z: -halfD },
        { x: halfW, y: height, z: -halfD },
      ],
    },
  ];

  return { hall, faces };
}

export function createSeatGrid(
  startX: number,
  startZ: number,
  rows: number,
  seatsPerRow: number,
  rowSpacing: number,
  seatSpacing: number,
  vipRows: number[] = []
): Seat[] {
  const seats: Seat[] = [];
  const rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  for (let r = 0; r < rows; r++) {
    const rowLetter = rowLabels[r] || `R${r}`;
    const isVipRow = vipRows.includes(r);
    const rowOffset = r % 2 === 0 ? 0 : seatSpacing / 2;

    for (let s = 0; s < seatsPerRow; s++) {
      const seatNum = s + 1;
      seats.push({
        id: `seat_${rowLetter}_${seatNum}`,
        row: rowLetter,
        number: seatNum,
        position: {
          x: startX + s * seatSpacing + rowOffset,
          y: 0.45,
          z: startZ + r * rowSpacing,
        },
        isVip: isVipRow || (r < 3 && seatNum >= seatsPerRow / 2 - 2 && seatNum <= seatsPerRow / 2 + 2),
        area: r < 3 ? '池座前区' : r < 8 ? '池座中区' : '池座后区',
      });
    }
  }

  return seats;
}

export function createSoundSources(stageZ: number, hallWidth: number): SoundSource[] {
  return [
    {
      id: 'source_stage_center',
      position: { x: 0, y: 1.5, z: stageZ },
      type: 'omnidirectional',
      power_dB: 90,
      name: '舞台中央主声源',
    },
    {
      id: 'source_stage_left',
      position: { x: -hallWidth * 0.25, y: 1.2, z: stageZ + 1 },
      type: 'directional',
      power_dB: 85,
      name: '舞台左侧声源',
    },
    {
      id: 'source_stage_right',
      position: { x: hallWidth * 0.25, y: 1.2, z: stageZ + 1 },
      type: 'directional',
      power_dB: 85,
      name: '舞台右侧声源',
    },
  ];
}

export function generateRayPaths(
  sources: SoundSource[],
  hall: HallModel,
  seats: Seat[],
  numRays: number,
  maxOrder: number
): RayPath[] {
  const rays: RayPath[] = [];
  const halfW = hall.dimensions.width / 2;
  const halfD = hall.dimensions.depth / 2;
  const height = hall.dimensions.height;

  const reflections: Array<() => Vec3> = [
    () => ({ x: -halfW, y: Math.random() * height, z: (Math.random() - 0.5) * hall.dimensions.depth }),
    () => ({ x: halfW, y: Math.random() * height, z: (Math.random() - 0.5) * hall.dimensions.depth }),
    () => ({ x: (Math.random() - 0.5) * hall.dimensions.width, y: 0, z: (Math.random() - 0.5) * hall.dimensions.depth }),
    () => ({ x: (Math.random() - 0.5) * hall.dimensions.width, y: height, z: (Math.random() - 0.5) * hall.dimensions.depth }),
    () => ({ x: (Math.random() - 0.5) * hall.dimensions.width, y: Math.random() * height, z: -halfD }),
    () => ({ x: (Math.random() - 0.5) * hall.dimensions.width, y: Math.random() * height, z: halfD }),
  ];

  for (let i = 0; i < numRays; i++) {
    const source = sources[Math.floor(Math.random() * sources.length)];
    const order = Math.floor(Math.random() * maxOrder) + 1;
    const targetSeat = seats[Math.floor(Math.random() * seats.length)];

    const points: Vec3[] = [{ ...source.position }];
    let energy = 1.0;

    for (let o = 0; o < order; o++) {
      const reflectionFn = reflections[Math.floor(Math.random() * reflections.length)];
      points.push(reflectionFn());
      energy *= 0.75 + Math.random() * 0.2;
    }

    points.push({ ...targetSeat.position });

    const travelTime = calculatePathLength(points) / 343;
    const color = getRayColorByOrder(order, maxOrder);

    rays.push({
      id: `ray_${i.toString().padStart(5, '0')}`,
      sourceId: source.id,
      order,
      energy,
      travelTime,
      points,
      color,
    });
  }

  return rays;
}

function calculatePathLength(points: Vec3[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const dz = points[i].z - points[i - 1].z;
    length += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return length;
}

export function faceToBufferGeometry(face: MaterialFace): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array(face.vertices.length * 3);

  face.vertices.forEach((v, i) => {
    vertices[i * 3] = v.x;
    vertices[i * 3 + 1] = v.y;
    vertices[i * 3 + 2] = v.z;
  });

  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();

  const indices = [];
  for (let i = 1; i < face.vertices.length - 1; i++) {
    indices.push(0, i, i + 1);
  }
  geometry.setIndex(indices);

  return geometry;
}

export function vec3ToArray(v: Vec3): [number, number, number] {
  return [v.x, v.y, v.z];
}
