import { useMemo } from 'react';
import { Grid, Line } from '@react-three/drei';
import * as THREE from 'three';

interface GroundProps {
  size?: number;
  divisions?: number;
  position?: [number, number, number];
}

export function Ground({ size = 500, divisions = 50, position = [150, -0.01, 0] }: GroundProps) {
  const gridConfig = useMemo(() => ({
    cellSize: size / divisions,
    cellThickness: 0.5,
    cellColor: '#1e293b',
    sectionSize: size / 5,
    sectionThickness: 1,
    sectionColor: '#334155',
    fadeDistance: size,
    fadeStrength: 1,
    followCamera: false,
    infiniteGrid: false,
  }), [size, divisions]);

  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial
          color="#0f172a"
          transparent
          opacity={0.8}
        />
      </mesh>
      <Grid
        position={[0, 0, 0]}
        args={[size, divisions]}
        cellSize={gridConfig.cellSize}
        cellThickness={gridConfig.cellThickness}
        cellColor={gridConfig.cellColor}
        sectionSize={gridConfig.sectionSize}
        sectionThickness={gridConfig.sectionThickness}
        sectionColor={gridConfig.sectionColor}
        fadeDistance={gridConfig.fadeDistance}
        fadeStrength={gridConfig.fadeStrength}
        infiniteGrid={gridConfig.infiniteGrid}
      />
    </group>
  );
}

export function Axes({ size = 10, position = [0, 0.01, 0] }: { size?: number; position?: [number, number, number] }) {
  return (
    <group position={position}>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={6}
            array={new Float32Array([
              0, 0, 0, size, 0, 0,
              0, 0, 0, 0, size, 0,
              0, 0, 0, 0, 0, size,
            ])}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={6}
            array={new Float32Array([
              1, 0, 0, 1, 0, 0,
              0, 1, 0, 0, 1, 0,
              0, 0, 1, 0, 0, 1,
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial vertexColors toneMapped={false} />
      </lineSegments>
    </group>
  );
}

export function RoadCenterLine() {
  const points = useMemo(() => {
    return [
      [0, 0.02, 0] as [number, number, number],
      [300, 0.02, 0] as [number, number, number],
    ];
  }, []);

  return (
    <Line
      points={points}
      color="#475569"
      lineWidth={2}
      dashed
      dashSize={4}
      gapSize={2}
    />
  );
}
