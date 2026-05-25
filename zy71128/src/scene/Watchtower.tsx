import { useStore } from '../store/useStore';
import { Watchtower as WatchtowerType } from '../types';

interface WatchtowerProps {
  tower: WatchtowerType;
}

export function Watchtower({ tower }: WatchtowerProps) {
  const selectedWatchtower = useStore(state => state.selectedWatchtower);
  const selectWatchtower = useStore(state => state.selectWatchtower);
  
  const isSelected = selectedWatchtower === tower.id;
  const scale = tower.enabled ? 1 : 0.6;

  return (
    <group
      position={[tower.position.x, tower.position.y, tower.position.z]}
      onClick={(e) => {
        e.stopPropagation();
        selectWatchtower(isSelected ? null : tower.id);
      }}
    >
      <mesh position={[0, tower.height / 2, 0]} scale={scale}>
        <cylinderGeometry args={[0.5, 1, tower.height, 8]} />
        <meshStandardMaterial
          color={isSelected ? '#FFD700' : '#8B4513'}
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>
      
      <mesh position={[0, tower.height + 1, 0]} scale={scale}>
        <cylinderGeometry args={[2, 1.5, 2, 8]} />
        <meshStandardMaterial
          color={isSelected ? '#FFD700' : '#A0522D'}
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>
      
      <mesh position={[0, tower.height + 2.5, 0]} scale={scale}>
        <coneGeometry args={[2.5, 2, 8]} />
        <meshStandardMaterial
          color={isSelected ? '#FFA500' : '#8B0000'}
          metalness={0.2}
          roughness={0.8}
        />
      </mesh>

      {tower.enabled && (
        <mesh position={[0, tower.height + 4, 0]}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial color="#FFFF00" transparent opacity={0.8} />
        </mesh>
      )}

      {isSelected && (
        <mesh position={[0, tower.height / 2, 0]}>
          <ringGeometry args={[tower.viewDistance - 0.5, tower.viewDistance, 64]} />
          <meshBasicMaterial
            color="#1E88E5"
            transparent
            opacity={0.3}
            side={2}
          />
        </mesh>
      )}
    </group>
  );
}

export function Watchtowers() {
  const watchtowers = useStore(state => state.watchtowers);
  
  return (
    <>
      {watchtowers.map(tower => (
        <Watchtower key={tower.id} tower={tower} />
      ))}
    </>
  );
}
