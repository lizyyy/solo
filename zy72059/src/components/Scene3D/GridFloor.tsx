import { useRef, useMemo } from 'react';
import * as THREE from 'three';

interface GridFloorProps {
  size?: number;
  divisions?: number;
}

export function GridFloor({ size = 200, divisions = 100 }: GridFloorProps) {
  const gridRef = useRef<THREE.GridHelper>(null);

  const gridMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: 0x1e3a5f,
      transparent: true,
      opacity: 0.4,
    });
  }, []);

  const centerLineMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: 0x1e88e5,
      transparent: true,
      opacity: 0.6,
    });
  }, []);

  const lines = useMemo(() => {
    const lineArray: THREE.Line[] = [];
    const step = size / divisions;
    const halfSize = size / 2;

    for (let i = 0; i <= divisions; i++) {
      const pos = i * step - halfSize;
      const isCenter = i === divisions / 2;
      const material = isCenter ? centerLineMaterial : gridMaterial;

      const hPoints = [
        new THREE.Vector3(-halfSize, 0, pos),
        new THREE.Vector3(halfSize, 0, pos),
      ];
      const hGeo = new THREE.BufferGeometry().setFromPoints(hPoints);
      lineArray.push(new THREE.Line(hGeo, material));

      const vPoints = [
        new THREE.Vector3(pos, 0, -halfSize),
        new THREE.Vector3(pos, 0, halfSize),
      ];
      const vGeo = new THREE.BufferGeometry().setFromPoints(vPoints);
      lineArray.push(new THREE.Line(vGeo, material));
    }

    return lineArray;
  }, [size, divisions, gridMaterial, centerLineMaterial]);

  return (
    <group>
      {lines.map((line, i) => (
        <primitive key={i} object={line} />
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial
          color={0x0a1628}
          transparent
          opacity={0.8}
        />
      </mesh>
    </group>
  );
}
