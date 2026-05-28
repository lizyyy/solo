import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useThermalStore } from '@/store/useThermalStore';
import { useView3DStore } from '@/store/useView3DStore';

export const AirFlowArrows = () => {
  const groupRef = useRef<THREE.Group>(null);
  const { chipPackage } = useThermalStore();
  const { showAirFlow } = useView3DStore();

  const arrowData = useMemo(() => {
    return chipPackage.airChannels.map(channel => {
      const arrows = [];
      const arrowCount = 5;
      const length = 4;
      
      for (let i = 0; i < arrowCount; i++) {
        const progress = i / arrowCount;
        const basePos = {
          x: -2 + channel.direction.x * progress * length,
          y: 1.2,
          z: -2 + channel.direction.z * progress * length
        };
        arrows.push({
          position: basePos,
          direction: channel.direction,
          speed: channel.speed,
          isReversed: channel.isReversed,
          channelName: channel.name,
          progress: progress
        });
      }
      return arrows;
    }).flat();
  }, [chipPackage.airChannels]);

  useFrame((state) => {
    if (!groupRef.current || !showAirFlow) return;
    
    const time = state.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      const arrow = arrowData[i];
      if (!arrow) return;
      
      const offset = (time * arrow.speed * 0.5 + arrow.progress) % 1;
      const newX = -2 + arrow.direction.x * offset * 4;
      const newZ = -2 + arrow.direction.z * offset * 4;
      
      child.position.x = newX;
      child.position.z = newZ;
      
      const scale = 0.5 + Math.sin(time * 3 + i) * 0.2;
      child.scale.setScalar(scale * arrow.speed * 0.4);
    });
  });

  if (!showAirFlow) return null;

  return (
    <group ref={groupRef}>
      {arrowData.map((arrow, i) => (
        <group key={i} position={[arrow.position.x, arrow.position.y, arrow.position.z]}>
          <mesh
            rotation={[
              arrow.direction.z !== 0 ? Math.PI / 2 : 0,
              0,
              arrow.direction.x !== 0 ? -Math.PI / 2 : 0
            ]}
          >
            <coneGeometry args={[0.15, 0.4, 8]} />
            <meshBasicMaterial 
              color={arrow.isReversed ? '#ef4444' : '#00bcd4'}
              transparent
              opacity={0.8}
            />
          </mesh>
          
          <mesh
            position={[0, -0.15, 0]}
            rotation={[
              arrow.direction.z !== 0 ? Math.PI / 2 : 0,
              0,
              arrow.direction.x !== 0 ? -Math.PI / 2 : 0
            ]}
          >
            <cylinderGeometry args={[0.08, 0.08, 0.3, 8]} />
            <meshBasicMaterial 
              color={arrow.isReversed ? '#ef4444' : '#00bcd4'}
              transparent
              opacity={0.6}
            />
          </mesh>

          {arrow.isReversed && (
            <mesh position={[0, 0.3, 0]}>
              <ringGeometry args={[0.1, 0.15, 16]} />
              <meshBasicMaterial color="#ef4444" transparent opacity={0.8} side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
      ))}

      {chipPackage.airChannels.map((channel, i) => (
        <line key={`line-${i}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([
                -2, 1.2, -2,
                -2 + channel.direction.x * 4, 1.2, -2 + channel.direction.z * 4
              ])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial 
            color={channel.isReversed ? '#ef4444' : '#00bcd4'} 
            transparent 
            opacity={0.3}
            linewidth={2}
          />
        </line>
      ))}
    </group>
  );
};
