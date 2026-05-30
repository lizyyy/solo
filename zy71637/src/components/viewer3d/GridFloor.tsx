import { useMemo } from 'react';
import { Grid } from '@react-three/drei';
import { COLORS } from '../../utils/colorMapping';

interface GridFloorProps {
  size?: number;
  divisions?: number;
}

export function GridFloor({ size = 12, divisions = 24 }: GridFloorProps) {
  return (
    <group position={[0, -6, 0]}>
      <Grid
        args={[size, divisions]}
        cellSize={size / divisions}
        cellThickness={0.5}
        cellColor={COLORS.neutral.grid}
        sectionSize={size / 4}
        sectionThickness={1}
        sectionColor={COLORS.neutral.axis}
        fadeDistance={50}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={false}
      />
      
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial
          color="#0a0e14"
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
