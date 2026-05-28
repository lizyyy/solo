import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import type { LightSource } from '@/types';
import { useMainStore } from '@/store/mainStore';

interface LightSource3DProps {
  lightSource: LightSource;
}

function kelvinToRGB(kelvin: number): string {
  const temp = kelvin / 100;
  let r, g, b;
  if (temp <= 66) {
    r = 255;
    g = Math.min(255, Math.max(0, 99.4708025861 * Math.log(temp) - 161.1195681661));
    b = temp <= 19 ? 0 : Math.min(255, Math.max(0, 138.5177312231 * Math.log(temp - 10) - 305.0447927307));
  } else {
    r = Math.min(255, Math.max(0, 329.698727446 * Math.pow(temp - 60, -0.1332047592)));
    g = Math.min(255, Math.max(0, 288.1221695283 * Math.pow(temp - 60, -0.0755148492)));
    b = 255;
  }
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

export default function LightSource3D({ lightSource }: LightSource3DProps) {
  const lightRef = useRef<THREE.SpotLight>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const { selectedLightSourceId, selectLightSource, showLightRays } = useMainStore();

  const isSelected = selectedLightSourceId === lightSource.id;
  const color = useMemo(() => kelvinToRGB(lightSource.colorTemperature), [lightSource.colorTemperature]);

  const targetPosition = useMemo(() => {
    const radX = (lightSource.angleX * Math.PI) / 180;
    const radY = (lightSource.angleY * Math.PI) / 180;
    return [
      lightSource.posX + Math.sin(radY) * Math.cos(radX) * 5,
      lightSource.posY + Math.sin(radX) * 5,
      lightSource.posZ + Math.cos(radY) * Math.cos(radX) * 5
    ];
  }, [lightSource]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    selectLightSource(lightSource.id);
  };

  return (
    <group position={[lightSource.posX, lightSource.posY, lightSource.posZ]}>
      <spotLight
        ref={lightRef}
        color={color}
        intensity={lightSource.intensity / 1000}
        angle={(lightSource.beamAngle * Math.PI) / 180}
        penumbra={0.3}
        decay={2}
        distance={15}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        target-position={targetPosition}
      />

      {showLightRays && (
        <mesh
          ref={meshRef}
          onClick={handleClick}
          position={[0, 0, 0]}
        >
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} />
        </mesh>
      )}

      <mesh onClick={handleClick}>
        <cylinderGeometry args={[0.1, 0.15, 0.2, 16]} />
        <meshStandardMaterial
          color={isSelected ? '#fbbf24' : '#4a4e57'}
          emissive={isSelected ? '#fbbf24' : '#000000'}
          emissiveIntensity={isSelected ? 0.3 : 0}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {showLightRays && (
        <mesh rotation={[Math.PI - (lightSource.angleX * Math.PI) / 180, (lightSource.angleY * Math.PI) / 180, 0]}>
          <coneGeometry args={[Math.tan((lightSource.beamAngle * Math.PI) / 360) * 3, 3, 32, 1, true]} />
          <meshBasicMaterial color={color} transparent opacity={0.08} side={THREE.DoubleSide} />
        </mesh>
      )}

      {isSelected && (
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport axisColors={['#E5484D', '#27AE60', '#2F80ED']} labelColor="white" />
        </GizmoHelper>
      )}
    </group>
  );
}
