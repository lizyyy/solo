import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Crack } from '../../types';
import { useAppStore } from '../../store/useAppStore';

interface CrackRendererProps {
  cracks: Crack[];
}

export function CrackRenderer({ cracks }: CrackRendererProps) {
  const linesRef = useRef<THREE.Group>(null);
  const selectedObject = useAppStore((state) => state.selectedObject);
  const selectObject = useAppStore((state) => state.selectObject);

  const crackData = useMemo(() => {
    return cracks.map((crack) => {
      const points = crack.coordinates.map(
        (c) => new THREE.Vector3(c[0], c[1], c[2])
      );
      const curve = new THREE.CatmullRomCurve3(points);
      const tubeGeometry = new THREE.TubeGeometry(curve, 20, crack.width * 0.1, 8, false);

      let color = '#00b42a';
      if (crack.severity === 'warning') color = '#ff7d00';
      if (crack.severity === 'critical') color = '#f53f3f';

      return {
        crack,
        geometry: tubeGeometry,
        color,
        isSelected: selectedObject?.type === 'crack' && selectedObject.id === crack.id,
      };
    });
  }, [cracks, selectedObject]);

  useFrame((state, delta) => {
    if (linesRef.current) {
      linesRef.current.children.forEach((child, i) => {
        const mesh = child as THREE.Mesh;
        const material = mesh.material as THREE.MeshBasicMaterial;
        const data = crackData[i];

        if (data?.isSelected) {
          const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.2 + 0.8;
          material.opacity = pulse;
          mesh.scale.setScalar(1 + pulse * 0.05);
        } else if (data?.crack.hasBoundaryIssue) {
          const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.3 + 0.7;
          material.opacity = pulse;
        } else {
          material.opacity = 1;
          mesh.scale.setScalar(1);
        }
      });
    }
  });

  const handleCrackClick = (crack: Crack) => {
    selectObject({ type: 'crack', id: crack.id });
  };

  return (
    <group ref={linesRef}>
      {crackData.map(({ crack, geometry, color, isSelected }) => (
        <group key={crack.id}>
          <mesh
            geometry={geometry}
            onClick={(e) => {
              e.stopPropagation();
              handleCrackClick(crack);
            }}
          >
            <meshBasicMaterial
              color={color}
              transparent
              opacity={1}
              side={THREE.DoubleSide}
            />
          </mesh>

          <mesh geometry={geometry}>
            <meshBasicMaterial
              color={isSelected ? '#ffffff' : color}
              transparent
              opacity={0.3}
              side={THREE.DoubleSide}
            />
          </mesh>

          {crack.hasBoundaryIssue && (
            <mesh position={crack.coordinates[0]}>
              <sphereGeometry args={[0.5, 16, 16]} />
              <meshBasicMaterial color="#ffff00" transparent opacity={0.8} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
