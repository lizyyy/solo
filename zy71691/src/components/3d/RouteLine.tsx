import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { TruckRoute } from '@/types';
import * as THREE from 'three';

interface RouteLineProps {
  route: TruckRoute;
}

export function RouteLine({ route }: RouteLineProps) {
  const glowRef = useRef<THREE.Mesh>(null);

  const points = useMemo(() => {
    return route.waypoints.map(
      (wp) => new THREE.Vector3(wp.x, 0.1, wp.z)
    );
  }, [route.waypoints]);

  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [points]);

  useFrame((state) => {
    if (glowRef.current) {
      const material = glowRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.3 + Math.sin(state.clock.elapsedTime * 2) * 0.2;
    }
  });

  return (
    <group>
      <primitive object={new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: '#3498DB', transparent: true, opacity: 0.8 }))} />

      {points.map((point, index) => (
        <mesh key={index} position={[point.x, 0.2, point.z]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshBasicMaterial color="#3498DB" transparent opacity={0.6} />
        </mesh>
      ))}

      <mesh ref={glowRef}>
        <tubeGeometry args={[new THREE.CatmullRomCurve3(points), 64, 0.05, 8, false]} />
        <meshBasicMaterial color="#5DADE2" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}
