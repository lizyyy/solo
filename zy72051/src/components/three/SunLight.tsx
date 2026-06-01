import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { calculateSunPosition } from '../../utils/sunPosition';
import { useCurrentHour } from '../../store/useSandboxStore';

export function SunLight() {
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const sunMeshRef = useRef<THREE.Mesh>(null);
  const currentHour = useCurrentHour();

  const sunData = useMemo(() => {
    return calculateSunPosition(currentHour);
  }, [currentHour]);

  useFrame(() => {
    if (dirLightRef.current) {
      dirLightRef.current.position.set(...sunData.position);
      dirLightRef.current.color.copy(sunData.color);
      dirLightRef.current.intensity = sunData.intensity;
    }
    if (ambientRef.current) {
      ambientRef.current.intensity = sunData.ambientIntensity;
    }
    if (sunMeshRef.current) {
      sunMeshRef.current.position.set(...sunData.position);
      (sunMeshRef.current.material as THREE.MeshBasicMaterial).color.copy(
        sunData.color
      );
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={sunData.ambientIntensity} />
      <directionalLight
        ref={dirLightRef}
        position={sunData.position}
        intensity={sunData.intensity}
        color={sunData.color}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-camera-near={0.5}
        shadow-camera-far={200}
      />
      <mesh ref={sunMeshRef} position={sunData.position}>
        <sphereGeometry args={[3, 32, 32]} />
        <meshBasicMaterial color={sunData.color} />
      </mesh>
    </>
  );
}
