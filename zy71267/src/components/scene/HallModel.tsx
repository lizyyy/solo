import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { HallModel as HallModelType, MaterialFace } from '../../data/models/acoustic';
import type { Anomaly } from '../../data/models/anomalies';
import { faceToBufferGeometry, vec3ToArray } from '../../utils/geometryBuilder';

interface HallModelProps {
  hall: HallModelType;
  faces: MaterialFace[];
  anomalies: Anomaly[];
  wireframe?: boolean;
}

const MATERIAL_COLORS: Record<string, [number, number, number]> = {
  wood: [0.6, 0.4, 0.2],
  plaster: [0.9, 0.85, 0.8],
  acoustic_panel: [0.3, 0.35, 0.4],
  fabric: [0.6, 0.5, 0.45],
  default: [0.5, 0.5, 0.5],
};

export function HallModel({ hall, faces, anomalies, wireframe = false }: HallModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const lineRefs = useRef<THREE.LineSegments>(null);

  const missingMaterialIds = useMemo(() => {
    const missingIds = new Set<string>();
    anomalies
      .filter((a) => a.type === 'material_missing')
      .forEach((a) => a.affectedIds.forEach((id) => missingIds.add(id)));
    return missingIds;
  }, [anomalies]);

  const { geometry, materials, missingFaceIndices } = useMemo(() => {
    const mergedGeometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const materialArray: THREE.Material[] = [];
    const missingIndices: number[] = [];

    let vertexOffset = 0;

    faces.forEach((face) => {
      const faceGeom = faceToBufferGeometry(face);
      const posAttr = faceGeom.getAttribute('position');
      const normAttr = faceGeom.getAttribute('normal');
      const idxAttr = faceGeom.getIndex();

      if (!idxAttr) return;

      const color = MATERIAL_COLORS[face.materialType] || MATERIAL_COLORS.default;
      const isMissing = missingMaterialIds.has(face.id);

      if (isMissing) {
        missingIndices.push(materialArray.length);
      }

      for (let i = 0; i < posAttr.count; i++) {
        positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
        normals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
        colors.push(color[0], color[1], color[2]);
      }

      for (let i = 0; i < idxAttr.count; i++) {
        indices.push(idxAttr.getX(i) + vertexOffset);
      }

      vertexOffset += posAttr.count;
      faceGeom.dispose();
    });

    mergedGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    mergedGeometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
    mergedGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
    mergedGeometry.setIndex(indices);

    const standardMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      opacity: wireframe ? 0.15 : 0.6,
      side: THREE.DoubleSide,
      roughness: 0.7,
      metalness: 0.1,
    });

    const wireframeMaterial = new THREE.MeshStandardMaterial({
  color: 0x1e88e5,
  wireframe: true,
  transparent: true,
  opacity: 0.8,
});

    const missingMaterial = new THREE.MeshBasicMaterial({
  color: 0xff4444,
  transparent: true,
  opacity: 0.3,
  side: THREE.DoubleSide,
});

    materialArray.push(standardMaterial, wireframeMaterial, missingMaterial);

    return {
      geometry: mergedGeometry,
      materials: materialArray,
      missingFaceIndices: missingIndices,
    };
  }, [faces, missingMaterialIds, wireframe]);

  const edgesGeometry = useMemo(() => {
    return new THREE.EdgesGeometry(geometry, 20);
  }, [geometry]);

  useFrame((state) => {
    if (lineRefs.current && missingFaceIndices.length > 0) {
      const time = state.clock.getElapsedTime();
      const pulse = (Math.sin(time * 3) + 1) / 2;
      (lineRefs.current.material as THREE.LineBasicMaterial).opacity = 0.5 + pulse * 0.5;
    }
  });

  const halfW = hall.dimensions.width / 2;
  const halfD = hall.dimensions.depth / 2;

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry} material={materials[0]}>
        {missingFaceIndices.map((idx) => (
          <group key={idx}>
            <mesh
              geometry={geometry}
              material={materials[2]}
              onUpdate={(self) => {
                self.visible = false;
              }}
            />
          </group>
        ))}
      </mesh>
      
      <lineSegments
        ref={lineRefs}
        geometry={edgesGeometry}
      >
        <lineBasicMaterial color="#1e88e5" transparent opacity={0.6} />
      </lineSegments>

      <gridHelper
        args={[hall.dimensions.width, 22, '#334155', '#1e293b']}
        position={[0, 0.01, 0]}
      />

      <mesh position={[0, hall.dimensions.height / 2, -halfD]} rotation={[0, 0, 0]}>
        <boxGeometry args={[halfW * 0.8, 0.02, 2]} />
        <meshStandardMaterial color="#4a5568" />
      </mesh>
      <mesh position={[0, 0.5, -halfD + 1]}>
        <boxGeometry args={[halfW * 0.6, 1, 0.2]} />
        <meshStandardMaterial color="#2d3748" />
      </mesh>

      {missingFaceIndices.length > 0 && (
        <group>
          {faces
            .filter((f) => missingMaterialIds.has(f.id))
            .map((face) => {
              const centerX = face.vertices.reduce((s, v) => s + v.x, 0) / face.vertices.length;
              const centerY = face.vertices.reduce((s, v) => s + v.y, 0) / face.vertices.length;
              const centerZ = face.vertices.reduce((s, v) => s + v.z, 0) / face.vertices.length;
              return (
                <mesh
                  key={`warning-${face.id}`}
                  position={vec3ToArray({ x: centerX, y: centerY, z: centerZ })}
                >
                  <sphereGeometry args={[0.3, 16, 16]} />
                  <meshBasicMaterial color="#ff4444" transparent opacity={0.8} />
                </mesh>
              );
            })}
        </group>
      )}
    </group>
  );
}
