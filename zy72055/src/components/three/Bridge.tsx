import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { BRIDGE_DIMENSIONS } from '../../types';

export function Bridge() {
  const groupRef = useRef<THREE.Group>(null);
  
  const { length, width, pierCount, floorHeights } = BRIDGE_DIMENSIONS;
  
  const halfLength = length / 2;
  const halfWidth = width / 2;
  
  const piers = useMemo(() => {
    const result: Array<{ x: number; z: number; height: number }> = [];
    const spacing = length / (pierCount + 1);
    for (let i = 0; i < pierCount; i++) {
      result.push({
        x: -halfLength + spacing * (i + 1),
        z: 0,
        height: floorHeights[1],
      });
    }
    return result;
  }, [length, pierCount, halfLength, floorHeights]);
  
  const gridHelper = useMemo(() => {
    return new THREE.GridHelper(length * 1.5, 40, '#3d4f6f', '#2a3f5f');
  }, [length]);
  
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#6b7280',
      metalness: 0.3,
      roughness: 0.7,
    });
  }, []);
  
  const deckMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#4b5563',
      metalness: 0.2,
      roughness: 0.8,
    });
  }, []);
  
  const pierMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#9ca3af',
      metalness: 0.1,
      roughness: 0.9,
    });
  }, []);
  
  const lineMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({ color: '#2a9d8f', transparent: true, opacity: 0.6 });
  }, []);
  
  const floorLines = useMemo(() => {
    const lines: Array<{ y: number; start: [number, number, number]; end: [number, number, number] }> = [];
    
    floorHeights.forEach((y, i) => {
      if (i > 0) {
        lines.push({
          y,
          start: [-halfLength, y, -halfWidth],
          end: [halfLength, y, -halfWidth],
        });
        lines.push({
          y,
          start: [-halfLength, y, halfWidth],
          end: [halfLength, y, halfWidth],
        });
        lines.push({
          y,
          start: [-halfLength, y, -halfWidth],
          end: [-halfLength, y, halfWidth],
        });
        lines.push({
          y,
          start: [halfLength, y, -halfWidth],
          end: [halfLength, y, halfWidth],
        });
      }
    });
    
    return lines;
  }, [floorHeights, halfLength, halfWidth]);
  
  return (
    <group ref={groupRef}>
      <primitive object={gridHelper} position={[0, -0.01, 0]} />
      
      {piers.map((pier, i) => (
        <mesh
          key={`pier-${i}`}
          position={[pier.x, pier.height / 2, pier.z]}
          material={pierMaterial}
          castShadow
        >
          <boxGeometry args={[1.2, pier.height, 1.2]} />
        </mesh>
      ))}
      
      <mesh
        position={[0, floorHeights[1] + 0.4, 0]}
        material={deckMaterial}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[length, 0.8, width]} />
      </mesh>
      
      <mesh
        position={[0, floorHeights[1] + 0.01, 0]}
        material={material}
      >
        <boxGeometry args={[length, 0.02, width]} />
      </mesh>
      
      {floorLines.map((line, i) => (
        <line key={`floor-line-${i}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([...line.start, ...line.end])}
              itemSize={3}
            />
          </bufferGeometry>
          <primitive object={lineMaterial} attach="material" />
        </line>
      ))}
      
      {[...Array(5)].map((_, i) => (
        <mesh
          key={`railing-left-${i}`}
          position={[-halfLength + 2 + i * 9, floorHeights[1] + 1.5, -halfWidth + 0.3]}
          material={material}
        >
          <boxGeometry args={[0.1, 1.5, 0.1]} />
        </mesh>
      ))}
      
      {[...Array(5)].map((_, i) => (
        <mesh
          key={`railing-right-${i}`}
          position={[-halfLength + 2 + i * 9, floorHeights[1] + 1.5, halfWidth - 0.3]}
          material={material}
        >
          <boxGeometry args={[0.1, 1.5, 0.1]} />
        </mesh>
      ))}
      
      <mesh position={[0, floorHeights[1] + 1.2, -halfWidth + 0.3]} material={material}>
        <boxGeometry args={[length, 0.05, 0.05]} />
      </mesh>
      
      <mesh position={[0, floorHeights[1] + 1.2, halfWidth - 0.3]} material={material}>
        <boxGeometry args={[length, 0.05, 0.05]} />
      </mesh>
      
      <mesh position={[-halfLength - 2, 4, 0]} material={material}>
        <cylinderGeometry args={[0.3, 0.3, 8, 8]} />
      </mesh>
      <mesh position={[halfLength + 2, 4, 0]} material={material}>
        <cylinderGeometry args={[0.3, 0.3, 8, 8]} />
      </mesh>
      
      <mesh position={[0, 8.2, 0]} material={material}>
        <cylinderGeometry args={[0.15, 0.15, length + 4, 8]} />
      </mesh>
    </group>
  );
}
