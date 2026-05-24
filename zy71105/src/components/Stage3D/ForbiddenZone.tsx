import { useMemo } from 'react';
import * as THREE from 'three';
import { ForbiddenZone } from '../../types';
import { useSceneStore } from '../../store/useSceneStore';
import { checkLightCollision } from '../../services/collision';

interface ForbiddenZoneProps {
  zone: ForbiddenZone;
}

export default function ForbiddenZoneComponent({ zone }: ForbiddenZoneProps) {
  const { lights, currentTime } = useSceneStore();
  
  const hasCollision = useMemo(() => {
    return lights.some((light) => {
      const warning = checkLightCollision(light, [zone], currentTime);
      return warning !== null;
    });
  }, [lights, zone, currentTime]);

  const size = useMemo(() => ({
    x: zone.bounds.max.x - zone.bounds.min.x,
    y: zone.bounds.max.y - zone.bounds.min.y,
    z: zone.bounds.max.z - zone.bounds.min.z
  }), [zone]);

  const position = useMemo(() => ({
    x: (zone.bounds.max.x + zone.bounds.min.x) / 2,
    y: (zone.bounds.max.y + zone.bounds.min.y) / 2,
    z: (zone.bounds.max.z + zone.bounds.min.z) / 2
  }), [zone]);

  const edgeColor = zone.type === 'subtitle' ? '#ff3b30' : '#ff9500';
  const fillColor = hasCollision 
    ? (zone.type === 'subtitle' ? 'rgba(255, 59, 48, 0.3)' : 'rgba(255, 149, 0, 0.25)')
    : zone.color;

  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh>
        <boxGeometry args={[size.x, size.y, size.z]} />
        <meshBasicMaterial
          color={fillColor}
          transparent
          opacity={hasCollision ? 0.6 : 0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(size.x, size.y, size.z)]} />
        <lineBasicMaterial 
          color={edgeColor} 
          transparent 
          opacity={hasCollision ? 1 : 0.6} 
        />
      </lineSegments>

      <mesh position={[0, size.y / 2 + 0.3, 0]}>
        <planeGeometry args={[2, 0.5]} />
        <meshBasicMaterial
          color={zone.type === 'subtitle' ? '#ff3b30' : '#ff9500'}
          transparent
          opacity={0.8}
        />
      </mesh>
    </group>
  );
}
