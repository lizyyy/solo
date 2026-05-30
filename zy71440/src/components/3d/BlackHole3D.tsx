import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { calculateSchwarzschildRadius, calculatePhotonSphereRadius } from '../../physics/constants';
import type { BlackHole } from '../../types';

interface BlackHole3DProps {
  blackHole: BlackHole;
  onClick: () => void;
  visible: boolean;
  showEventHorizon: boolean;
  showPhotonSphere: boolean;
}

export function BlackHole3D({
  blackHole,
  onClick,
  visible,
  showEventHorizon,
  showPhotonSphere,
}: BlackHole3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const accretionRef = useRef<THREE.Mesh>(null);

  const rs = useMemo(() => calculateSchwarzschildRadius(blackHole.mass), [blackHole.mass]);
  const photonRadius = useMemo(() => calculatePhotonSphereRadius(rs), [rs]);
  const accretionOuter = rs * 3;
  const accretionInner = rs * 1.5;

  const accretionGeometry = useMemo(() => {
    const geometry = new THREE.RingGeometry(accretionInner, accretionOuter, 64, 1);
    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const dist = Math.sqrt(x * x + y * y);
      const t = (dist - accretionInner) / (accretionOuter - accretionInner);

      const innerColor = new THREE.Color('#ff6b35');
      const outerColor = new THREE.Color('#4a1c00');
      const color = innerColor.clone().lerp(outerColor, t);

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geometry;
  }, [accretionInner, accretionOuter]);

  useFrame((_, delta) => {
    if (accretionRef.current) {
      accretionRef.current.rotation.z += delta * 0.2;
    }
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.05;
    }
  });

  if (!visible) return null;

  return (
    <group ref={groupRef} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <mesh>
        <sphereGeometry args={[rs, 64, 64]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {showEventHorizon && (
        <mesh>
          <sphereGeometry args={[rs * 1.01, 64, 64]} />
          <meshBasicMaterial
            color="#ff4444"
            transparent
            opacity={0.15}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {showPhotonSphere && (
        <mesh>
          <sphereGeometry args={[photonRadius, 64, 64]} />
          <meshBasicMaterial
            color="#ffaa00"
            transparent
            opacity={0.1}
            wireframe
          />
        </mesh>
      )}

      <mesh ref={accretionRef} rotation={[Math.PI / 2, 0, 0]} geometry={accretionGeometry}>
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[accretionOuter * 1.02, accretionOuter * 1.05, 64]} />
        <meshBasicMaterial
          color="#ff8c42"
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      <pointLight color="#ff6b35" intensity={2} distance={50} />
    </group>
  );
}
