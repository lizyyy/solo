import { AdjacentField as AdjacentFieldType } from '@/types';
import { COLORS } from '@/data/constants';

interface AdjacentFieldProps {
  data: AdjacentFieldType;
  hasAlert: boolean;
  alertSeverity?: 'warning' | 'danger';
}

export function AdjacentField({ data, hasAlert, alertSeverity }: AdjacentFieldProps) {
  const { position, size, bufferZone, name } = data;
  const [width, depth] = size;

  const fieldColor = name.includes('蔬菜') ? '#8b7355' : '#9b8365';

  return (
    <group position={position}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.005, 0]}
        receiveShadow
      >
        <planeGeometry args={[width + bufferZone * 2, depth + bufferZone * 2]} />
        <meshBasicMaterial
          color={hasAlert && alertSeverity === 'danger' ? COLORS.bufferDanger : COLORS.bufferWarning}
          transparent
          opacity={hasAlert ? 0.5 : 0.15}
        />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.008, 0]}
      >
        <planeGeometry args={[width + bufferZone * 2, depth + bufferZone * 2]} />
        <meshBasicMaterial
          color={hasAlert ? '#ff6b35' : '#666'}
          wireframe
          transparent
          opacity={hasAlert ? 0.6 : 0.3}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={fieldColor} />
      </mesh>

      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[width + 0.1, 0.1, depth + 0.1]} />
        <meshBasicMaterial
          color={fieldColor}
          wireframe
          transparent
          opacity={0.5}
        />
      </mesh>
    </group>
  );
}