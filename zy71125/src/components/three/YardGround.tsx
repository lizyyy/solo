import { useMemo } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { Yard } from '../../types';

const BAY_SPACING = 7;
const ROW_SPACING = 2.8;

interface YardGroundProps {
  yard: Yard;
}

export function YardGround({ yard }: YardGroundProps) {
  const gridHelper = useMemo(() => {
    return new THREE.GridHelper(100, 50, '#2a2a3e', '#1a1a2e');
  }, []);

  const yardWidth = (yard.bays - 1) * BAY_SPACING + BAY_SPACING;
  const yardDepth = (yard.rows - 1) * ROW_SPACING + ROW_SPACING * 2;

  return (
    <group>
      <primitive object={gridHelper} position={[yardWidth / 2 - BAY_SPACING / 2, -0.01, yardDepth / 2 - ROW_SPACING]} />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[yardWidth / 2 - BAY_SPACING / 2, 0, yardDepth / 2 - ROW_SPACING]}
        receiveShadow
      >
        <planeGeometry args={[yardWidth + 10, yardDepth + 10]} />
        <meshStandardMaterial
          color="#1a1a2e"
          metalness={0.1}
          roughness={0.9}
        />
      </mesh>

      {Array.from({ length: yard.bays }).map((_, bay) => (
        <group key={bay}>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[bay * BAY_SPACING, 0.01, (yard.rows - 1) * ROW_SPACING / 2]}
            receiveShadow
          >
            <planeGeometry args={[BAY_SPACING - 0.5, yardDepth]} />
            <meshStandardMaterial
              color="#252538"
              metalness={0.1}
              roughness={0.9}
            />
          </mesh>

          <Text
            position={[bay * BAY_SPACING, 0.1, -2]}
            fontSize={0.8}
            color="#86909C"
            anchorX="center"
            anchorY="middle"
          >
            {bay + 1}区
          </Text>
        </group>
      ))}

      {yard.gantryPositions.map((pos, index) => (
        <group key={`gantry-${index}`}>
          <mesh
            position={[pos * BAY_SPACING, 0.3, (yard.rows - 1) * ROW_SPACING / 2]}
          >
            <boxGeometry args={[0.6, 0.6, yardDepth + 4]} />
            <meshStandardMaterial
              color="#4a5568"
              metalness={0.8}
              roughness={0.3}
            />
          </mesh>

          <mesh
            position={[pos * BAY_SPACING, 0.65, (yard.rows - 1) * ROW_SPACING / 2]}
          >
            <boxGeometry args={[1, 0.1, yardDepth + 4]} />
            <meshStandardMaterial
              color="#718096"
              metalness={0.9}
              roughness={0.2}
            />
          </mesh>

          <Text
            position={[pos * BAY_SPACING, 1.2, (yard.rows - 1) * ROW_SPACING / 2]}
            fontSize={0.6}
            color="#A0AEC0"
            anchorX="center"
            anchorY="middle"
          >
            轨道 {index + 1}
          </Text>
        </group>
      ))}

      <mesh position={[-1, 8, (yard.rows - 1) * ROW_SPACING / 2]}>
        <boxGeometry args={[0.5, 16, yardDepth + 4]} />
        <meshStandardMaterial
          color="#2d3748"
          metalness={0.5}
          roughness={0.5}
          emissive="#1a365d"
          emissiveIntensity={0.1}
        />
      </mesh>

      <mesh position={[(yard.bays) * BAY_SPACING, 8, (yard.rows - 1) * ROW_SPACING / 2]}>
        <boxGeometry args={[0.5, 16, yardDepth + 4]} />
        <meshStandardMaterial
          color="#2d3748"
          metalness={0.5}
          roughness={0.5}
          emissive="#1a365d"
          emissiveIntensity={0.1}
        />
      </mesh>
    </group>
  );
}
