import React, { useMemo } from 'react';
import { StationLayout, ClosedArea } from '../../simulation/types';

interface StationModelProps {
  layout: StationLayout;
  closedAreas: ClosedArea[];
  is2DMode: boolean;
}

export const StationModel: React.FC<StationModelProps> = ({ layout, closedAreas, is2DMode }) => {
  const wallHeight = is2DMode ? 0.01 : 2;

  const walls = useMemo(() => {
    return layout.walls.map((wall, index) => (
      <mesh
        key={`wall-${index}`}
        position={[
          wall.x + wall.width / 2 - layout.width / 2,
          wallHeight / 2,
          wall.y + wall.height / 2 - layout.height / 2
        ]}
      >
        <boxGeometry args={[wall.width, wallHeight, wall.height]} />
        <meshStandardMaterial color="#4a5568" />
      </mesh>
    ));
  }, [layout.walls, layout.width, layout.height, wallHeight]);

  const stairs = useMemo(() => {
    return layout.stairs.map((stair) => (
      <group key={stair.id}>
        <mesh
          position={[
            stair.x - layout.width / 2,
            0.1,
            stair.y - layout.height / 2
          ]}
        >
          <boxGeometry args={[stair.width, 0.2, stair.height]} />
          <meshStandardMaterial 
            color={stair.direction === 'up' ? '#48bb78' : '#ed8936'} 
          />
        </mesh>
      </group>
    ));
  }, [layout.stairs, layout.width, layout.height]);

  const gates = useMemo(() => {
    return layout.gates.map((gate) => (
      <mesh
        key={gate.id}
        position={[
          gate.x - layout.width / 2,
          0.5,
          gate.y - layout.height / 2
        ]}
      >
        <boxGeometry args={[1.5, 1, 0.3]} />
        <meshStandardMaterial 
          color={gate.status === 'open' ? '#48bb78' : '#e53e3e'}
          transparent
          opacity={0.8}
        />
      </mesh>
    ));
  }, [layout.gates, layout.width, layout.height]);

  const exits = useMemo(() => {
    return layout.exits.map((exit) => (
      <group key={exit.id}>
        <mesh
          position={[
            exit.x - layout.width / 2,
            0.15,
            exit.y - layout.height / 2
          ]}
        >
          <boxGeometry args={[exit.width, 0.3, 2]} />
          <meshStandardMaterial color="#4299e1" emissive="#4299e1" emissiveIntensity={0.3} />
        </mesh>
      </group>
    ));
  }, [layout.exits, layout.width, layout.height]);

  const platforms = useMemo(() => {
    return layout.platforms.map((platform, index) => (
      <mesh
        key={`platform-${index}`}
        position={[
          platform.x + platform.width / 2 - layout.width / 2,
          0.05,
          platform.y + platform.height / 2 - layout.height / 2
        ]}
      >
        <boxGeometry args={[platform.width, 0.1, platform.height]} />
        <meshStandardMaterial color="#718096" />
      </mesh>
    ));
  }, [layout.platforms, layout.width, layout.height]);

  const closedAreasMeshes = useMemo(() => {
    return closedAreas.map((area) => (
      <mesh
        key={area.id}
        position={[
          area.x + area.width / 2 - layout.width / 2,
          0.1,
          area.y + area.height / 2 - layout.height / 2
        ]}
      >
        <boxGeometry args={[area.width, 0.2, area.height]} />
        <meshStandardMaterial 
          color="#f56565" 
          transparent
          opacity={0.5}
        />
      </mesh>
    ));
  }, [closedAreas, layout.width, layout.height]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[layout.width, layout.height]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      
      {platforms}
      {walls}
      {stairs}
      {gates}
      {exits}
      {closedAreasMeshes}
    </group>
  );
};
