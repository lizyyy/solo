import { useStore } from '../store/useStore';
import { BlindSpot as BlindSpotType } from '../types';

interface BlindSpotProps {
  spot: BlindSpotType;
}

function BlindSpotMarker({ spot }: BlindSpotProps) {
  const selectedBlindSpot = useStore(state => state.selectedBlindSpot);
  const selectBlindSpot = useStore(state => state.selectBlindSpot);
  
  const isSelected = selectedBlindSpot === spot.id;
  const scale = isSelected ? 1.5 : 1;
  
  const color = spot.severity === 'high' ? '#E53935' :
                spot.severity === 'medium' ? '#FB8C00' : '#FFEB3B';

  return (
    <group
      position={[spot.position.x, spot.position.y + 2, spot.position.z]}
      onClick={(e) => {
        e.stopPropagation();
        selectBlindSpot(isSelected ? null : spot.id);
      }}
    >
      <mesh scale={scale}>
        <coneGeometry args={[1.5, 3, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, -1.5, 0]} scale={scale}>
        <cylinderGeometry args={[0.5, 0.5, 1, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} />
      </mesh>
      {isSelected && (
        <mesh position={[0, 0, 0]}>
          <ringGeometry args={[2, 2.5, 32]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0.5} side={2} />
        </mesh>
      )}
    </group>
  );
}

export function BlindSpots() {
  const showBlindSpots = useStore(state => state.showBlindSpots);
  const blindSpots = useStore(state => state.blindSpots);

  if (!showBlindSpots) return null;

  return (
    <>
      {blindSpots.map(spot => (
        <BlindSpotMarker key={spot.id} spot={spot} />
      ))}
    </>
  );
}
