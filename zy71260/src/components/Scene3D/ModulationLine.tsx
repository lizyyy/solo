import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { ModulationPath, Mode } from '../../types';
import { MODULATION_TYPE_COLORS, QUALITY_COLORS } from '../../types';
import { getModulationTypeName } from '../../utils/musicTheory';

interface ModulationLineProps {
  path: ModulationPath;
  fromMode: Mode | undefined;
  toMode: Mode | undefined;
  isHighlighted: boolean;
  onHover: (pathId: string | null) => void;
}

const ModulationLine = ({ path, fromMode, toMode, isHighlighted, onHover }: ModulationLineProps) => {
  const lineRef = useRef<any>(null);
  const [hovered, setHovered] = useState(false);

  const points = useMemo(() => {
    if (!fromMode || !toMode) return [];
    const from = new THREE.Vector3(fromMode.position.x, fromMode.position.y, fromMode.position.z);
    const to = new THREE.Vector3(toMode.position.x, toMode.position.y, toMode.position.z);
    const mid = from.clone().add(to).multiplyScalar(0.5);
    mid.y += 2;
    return [from, mid, to];
  }, [fromMode, toMode]);

  useFrame((state) => {
    if (lineRef.current && (isHighlighted || hovered)) {
      const material = lineRef.current.material;
      if (material) {
        material.dashOffset = -state.clock.elapsedTime * 0.5;
      }
    }
  });

  if (!fromMode || !toMode) return null;

  const baseColor = MODULATION_TYPE_COLORS[path.type];
  const qualityColor = QUALITY_COLORS[path.quality];
  const finalColor = path.quality === 'normal' ? baseColor : qualityColor;

  const midPoint = {
    x: (fromMode.position.x + toMode.position.x) / 2,
    y: (fromMode.position.y + toMode.position.y) / 2 + 2,
    z: (fromMode.position.z + toMode.position.z) / 2,
  };

  return (
    <group>
      <Line
        ref={lineRef}
        points={points.map((p) => [p.x, p.y, p.z]) as [number, number, number][]}
        color={finalColor}
        lineWidth={isHighlighted || hovered ? 4 : 2}
        transparent
        opacity={path.isBroken ? 0.3 : isHighlighted || hovered ? 1 : 0.6}
        dashed={path.isBroken}
        dashSize={0.3}
        gapSize={0.2}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          onHover(path.id);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
          onHover(null);
          document.body.style.cursor = 'auto';
        }}
      />

      {(isHighlighted || hovered) && (
        <Text
          position={[midPoint.x, midPoint.y + 0.5, midPoint.z]}
          fontSize={0.35}
          color={finalColor}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {getModulationTypeName(path.type)}
        </Text>
      )}

      {path.isBroken && (
        <mesh position={[midPoint.x, midPoint.y - 0.5, midPoint.z]}>
          <torusGeometry args={[0.15, 0.05, 8, 16]} />
          <meshBasicMaterial color="#e74c3c" />
        </mesh>
      )}
    </group>
  );
};

export default ModulationLine;
