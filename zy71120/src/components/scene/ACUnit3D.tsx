import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { ACUnit } from '../../types';

interface ACUnit3DProps {
  ac: ACUnit;
  showAirFlow: boolean;
}

export function ACUnit3D({ ac, showAirFlow }: ACUnit3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const fanRef = useRef<THREE.Mesh>(null);
  const airflowRef = useRef<THREE.Mesh>(null);

  const directionVector = useMemo(() => {
    switch (ac.direction) {
      case 'north': return new THREE.Vector3(0, 0, -1);
      case 'south': return new THREE.Vector3(0, 0, 1);
      case 'east': return new THREE.Vector3(1, 0, 0);
      case 'west': return new THREE.Vector3(-1, 0, 0);
    }
  }, [ac.direction]);

  const rotation = useMemo(() => {
    switch (ac.direction) {
      case 'north': return [0, 0, 0];
      case 'south': return [0, Math.PI, 0];
      case 'east': return [0, -Math.PI / 2, 0];
      case 'west': return [0, Math.PI / 2, 0];
    }
  }, [ac.direction]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    if (fanRef.current && ac.status === 'running') {
      fanRef.current.rotation.y = time * 8;
    }

    if (airflowRef.current && showAirFlow && ac.status === 'running') {
      const material = airflowRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.2 + Math.sin(time * 3) * 0.15;
    }
  });

  const statusColor = ac.status === 'running' ? '#00d2d3' : ac.status === 'standby' ? '#feca57' : '#576574';

  return (
    <group
      ref={groupRef}
      position={[ac.position.x, 1.2, ac.position.z]}
      rotation={rotation as [number, number, number]}
    >
      <mesh castShadow>
        <boxGeometry args={[1.5, 2.4, 0.8]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
      </mesh>

      <mesh position={[0, 0, 0.41]}>
        <boxGeometry args={[1.2, 1.8, 0.02]} />
        <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
      </mesh>

      <mesh ref={fanRef} position={[0, 0.2, 0.45]}>
        <cylinderGeometry args={[0.35, 0.35, 0.05, 6]} />
        <meshStandardMaterial 
          color={statusColor} 
          emissive={statusColor} 
          emissiveIntensity={0.5} 
        />
      </mesh>

      <mesh position={[0, 1, 0.45]}>
        <boxGeometry args={[1, 0.1, 0.1]} />
        <meshStandardMaterial 
          color={statusColor} 
          emissive={statusColor} 
          emissiveIntensity={0.8} 
        />
      </mesh>

      {showAirFlow && ac.status === 'running' && (
        <mesh
          ref={airflowRef}
          position={directionVector.clone().multiplyScalar(2).toArray() as [number, number, number]}
        >
          <coneGeometry args={[0.8, 4, 8, 1, true]} />
          <meshBasicMaterial
            color="#00d2d3"
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      <Html
        position={[0, 2, 0]}
        center
        distanceFactor={15}
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            background: 'rgba(10, 22, 40, 0.9)',
            color: '#fff',
            padding: '4px 10px',
            borderRadius: '4px',
            fontSize: '10px',
            fontFamily: 'JetBrains Mono, monospace',
            border: `1px solid ${statusColor}`,
            whiteSpace: 'nowrap',
          }}
        >
          {ac.name}
        </div>
      </Html>
    </group>
  );
}
