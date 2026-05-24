import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { RepairTeam } from '../../game/types';
import { TEAM_STATUS_CONFIG } from '../../game/config';

interface RepairTeamMarkerProps {
  team: RepairTeam;
  isSelected: boolean;
  onClick: () => void;
}

export function RepairTeamMarker({ team, isSelected, onClick }: RepairTeamMarkerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const statusConfig = TEAM_STATUS_CONFIG[team.status];

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.y = 2.5 + Math.sin(state.clock.elapsedTime * 2) * 0.2;
      groupRef.current.rotation.y += 0.02;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[team.position.x, team.position.y + 1.5, team.position.z]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <mesh>
        <coneGeometry args={[0.4, 0.8, 6]} />
        <meshStandardMaterial
          color={statusConfig.color}
          emissive={isSelected ? '#fbbf24' : statusConfig.color}
          emissiveIntensity={isSelected ? 0.5 : 0.3}
        />
      </mesh>

      <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.5, 6]} />
        <meshBasicMaterial color={statusConfig.color} transparent opacity={0.6} side={2} />
      </mesh>

      {isSelected && (
        <mesh position={[0, 0.5, 0]}>
          <octahedronGeometry args={[0.25, 0]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
      )}

      {team.status === 'cooling' && team.cooldown > 0 && (
        <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.6, 32, 1, 0, Math.PI * 2 * (1 - team.cooldown / team.maxCooldown)]} />
          <meshBasicMaterial color="#718096" transparent opacity={0.8} side={2} />
        </mesh>
      )}
    </group>
  );
}
