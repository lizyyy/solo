import { useMemo } from 'react';
import { CrosstalkData, Microphone } from '@/types';
import { getCrosstalkColor } from '@/utils/acousticMath';

interface CrosstalkSphereProps {
  data: CrosstalkData;
  sourceMic: Microphone;
  targetMic: Microphone;
}

export function CrosstalkSphere({ data, sourceMic, targetMic }: CrosstalkSphereProps) {
  if (data.level <= -40) return null;
  
  const position = useMemo(() => ({
    x: (sourceMic.position.x + targetMic.position.x) / 2,
    y: (sourceMic.position.y + targetMic.position.y) / 2,
    z: (sourceMic.position.z + targetMic.position.z) / 2,
  }), [sourceMic.position, targetMic.position]);
  
  const normalizedLevel = (data.level + 60) / 60;
  const scale = 0.1 + normalizedLevel * 0.3;
  const color = getCrosstalkColor(data.level);
  const opacity = 0.2 + normalizedLevel * 0.4;
  
  return (
    <mesh position={[position.x, position.y, position.z]}>
      <sphereGeometry args={[scale, 16, 16]} />
      <meshBasicMaterial 
        color={color} 
        transparent 
        opacity={opacity}
        wireframe={data.level > -20}
      />
    </mesh>
  );
}

export function CrosstalkHeatmap() {
  return null;
}
