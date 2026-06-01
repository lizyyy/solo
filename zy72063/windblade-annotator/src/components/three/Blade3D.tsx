import { useRef, useMemo } from 'react';
import * as THREE from 'three';

interface Blade3DProps {
  onClick?: (point: THREE.Vector3) => void;
}

export const Blade3D = ({ onClick }: Blade3DProps) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const bladeGeometry = useMemo(() => {
    const points: THREE.Vector2[] = [];
    const segments = 50;
    const length = 5;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = t * length;
      let width: number;

      if (t < 0.1) {
        width = 0.4 - t * 2;
      } else if (t < 0.8) {
        width = 0.2 + 0.1 * Math.sin(t * Math.PI * 2);
      } else {
        width = 0.3 * (1 - (t - 0.8) / 0.2);
      }

      points.push(new THREE.Vector2(width, y));
    }

    const shape = new THREE.Shape(points);
    for (let i = segments; i >= 0; i--) {
      const t = i / segments;
      const y = t * length;
      let width: number;

      if (t < 0.1) {
        width = 0.4 - t * 2;
      } else if (t < 0.8) {
        width = 0.2 + 0.1 * Math.sin(t * Math.PI * 2);
      } else {
        width = 0.3 * (1 - (t - 0.8) / 0.2);
      }

      shape.lineTo(-width, y);
    }
    shape.closePath();

    const extrudeSettings = {
      steps: 2,
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.02,
      bevelOffset: 0,
      bevelSegments: 3
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();
    geometry.translate(0, length / 2, 0);
    geometry.rotateX(-Math.PI / 2);

    return geometry;
  }, []);

  const bladeMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: 0xe8e8e8,
      metalness: 0.3,
      roughness: 0.6,
      side: THREE.DoubleSide
    });
  }, []);

  const handleClick = (event: { point: THREE.Vector3 }) => {
    if (onClick) {
      onClick(event.point);
    }
  };

  return (
    <mesh
      ref={meshRef}
      geometry={bladeGeometry}
      material={bladeMaterial}
      castShadow
      receiveShadow
      onClick={handleClick}
    >
      <meshStandardMaterial
        attach="material"
        color="#e8e8e8"
        metalness={0.3}
        roughness={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};
