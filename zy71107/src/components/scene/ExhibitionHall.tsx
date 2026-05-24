import React from 'react';
import { useSceneStore } from '../../store/useSceneStore';

const ExhibitionHall: React.FC = () => {
  const hallData = useSceneStore((state) => state.hallData);

  if (!hallData) return null;

  const { dimensions, walls } = hallData;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[dimensions.width, dimensions.depth]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>

      <gridHelper args={[dimensions.width, 30, '#2a2a4e', '#1a1a3e']} position={[0, 0.01, 0]} />

      {walls.map((wall) => {
        const dx = wall.end.x - wall.start.x;
        const dz = wall.end.z - wall.start.z;
        const length = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dz, dx);

        return (
          <mesh
            key={wall.id}
            position={[
              wall.start.x + dx / 2,
              wall.height / 2,
              wall.start.z + dz / 2,
            ]}
            rotation={[0, -angle, 0]}
            castShadow
          >
            <boxGeometry args={[length, wall.height, 0.2]} />
            <meshStandardMaterial color="#2d2d44" side={2} />
          </mesh>
        );
      })}

      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[0, 5, 0]} intensity={0.5} color="#00d4ff" distance={30} />
    </group>
  );
};

export default ExhibitionHall;
