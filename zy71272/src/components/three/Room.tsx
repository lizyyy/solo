import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '../../store/useStore';

export default function Room() {
  const roomConfig = useStore(state => state.roomConfig);
  const gridRef = useRef<THREE.GridHelper>(null);

  const floorGeometry = useMemo(() => {
    if (!roomConfig) return null;
    return new THREE.PlaneGeometry(roomConfig.width, roomConfig.length);
  }, [roomConfig?.width, roomConfig?.length]);

  const wallMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1a1f2e',
    roughness: 0.9,
    metalness: 0.1,
  }), []);

  const floorMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#2d1f1a',
    roughness: 0.85,
    metalness: 0.05,
  }), []);

  if (!roomConfig || !floorGeometry) return null;

  const { width, height, length } = roomConfig;
  const halfWidth = width / 2;
  const halfDepth = length / 2;

  return (
    <group>
      <mesh
        geometry={floorGeometry}
        material={floorMaterial}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
      />

      <gridHelper
        ref={gridRef}
        args={[Math.max(width, length), Math.max(width, length) * 2, '#3a4a6b', '#2a3545']}
        position={[0, 0.01, 0]}
      />

      <mesh
        position={[0, height / 2, -halfDepth]}
        material={wallMaterial}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[width, height, 0.2]} />
      </mesh>

      <mesh
        position={[-halfWidth, height / 2, 0]}
        material={wallMaterial}
        rotation={[0, Math.PI / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[length, height, 0.2]} />
      </mesh>

      <mesh
        position={[halfWidth, height / 2, 0]}
        material={wallMaterial}
        rotation={[0, Math.PI / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[length, height, 0.2]} />
      </mesh>

      <mesh
        position={[0, height, 0]}
        material={wallMaterial}
        rotation={[Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[width, length]} />
      </mesh>

      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(width, height, length)]} />
        <lineBasicMaterial color={0x00f0ff} opacity={0.3} transparent />
      </lineSegments>
    </group>
  );
}
