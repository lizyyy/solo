
import { useRef } from 'react';
import * as THREE from 'three';

export function Ground3D() {
  const groundRef = useRef<THREE.Mesh>(null);

  return (
    <group>
      {/* Main Ground */}
      <mesh ref={groundRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#8BC34A" roughness={0.9} />
      </mesh>

      {/* Pavement Area */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[16, 8]} />
        <meshStandardMaterial color="#9E9E9E" roughness={0.8} />
      </mesh>

      {/* Pavement Border */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <ringGeometry args={[7.5, 7.7, 4]} />
        <meshStandardMaterial color="#616161" />
      </mesh>

      {/* Decorative Trees */}
      {[[-7, -5], [7, -5], [-7, 5], [7, 5]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          {/* Tree Trunk */}
          <mesh position={[0, 0.8, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.2, 1.6, 8]} />
            <meshStandardMaterial color="#5D4037" />
          </mesh>
          {/* Tree Foliage */}
          <mesh position={[0, 2, 0]} castShadow>
            <coneGeometry args={[0.8, 1.5, 8]} />
            <meshStandardMaterial color="#388E3C" />
          </mesh>
          <mesh position={[0, 2.8, 0]} castShadow>
            <coneGeometry args={[0.6, 1.2, 8]} />
            <meshStandardMaterial color="#43A047" />
          </mesh>
        </group>
      ))}

      {/* Decorative Flowers */}
      {[[-5, -4], [-4, -4.5], [-5.5, -3.5], [5, -4], [4.5, -4.5], [5.5, -3.5]].map(([x, z], i) => (
        <group key={`flower-${i}`} position={[x, 0, z]}>
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.3, 6]} />
            <meshStandardMaterial color="#4CAF50" />
          </mesh>
          <mesh position={[0, 0.35, 0]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#E91E63' : '#FFEB3B'} />
          </mesh>
        </group>
      ))}

      {/* Background Fence */}
      {Array.from({ length: 12 }).map((_, i) => (
        <group key={`fence-${i}`} position={[-5.5 + i, 0, -3.8]}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <boxGeometry args={[0.08, 1, 0.05]} />
            <meshStandardMaterial color="#8D6E63" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default Ground3D;
