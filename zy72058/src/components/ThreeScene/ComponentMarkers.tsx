import { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { HeritageComponent, COORDINATE_COLORS } from '@/types';

interface ComponentMarkerProps {
  component: HeritageComponent;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function ComponentMarker({ component, isSelected, onSelect }: ComponentMarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const baseColor = component.isAnomaly
    ? '#c94c4c'
    : COORDINATE_COLORS[component.coordinateSystem] || COORDINATE_COLORS['默认'];

  const scale = isSelected ? 1.5 : hovered ? 1.2 : 1;
  const hasValidCoords = component.x !== null && component.y !== null && component.z !== null;

  useFrame((state) => {
    if (meshRef.current) {
      if (component.isAnomaly) {
        const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
        meshRef.current.scale.setScalar(scale * pulse);
      } else {
        meshRef.current.scale.setScalar(scale);
      }
    }
  });

  if (!hasValidCoords) {
    return null;
  }

  return (
    <group position={[component.x!, component.y!, component.z!]}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(component.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={baseColor}
          emissiveIntensity={component.isAnomaly ? 0.5 : isSelected ? 0.3 : 0.1}
          transparent
          opacity={0.9}
        />
      </mesh>

      {component.isAnomaly && (
        <mesh>
          <ringGeometry args={[0.35, 0.45, 32]} />
          <meshBasicMaterial
            color="#ff6b6b"
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {isSelected && (
        <mesh>
          <ringGeometry args={[0.4, 0.5, 32]} />
          <meshBasicMaterial
            color="#c9a227"
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {(hovered || isSelected) && (
        <Html center distanceFactor={10} zIndexRange={[100, 0]}>
          <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm whitespace-nowrap shadow-xl">
            <div className="font-semibold text-amber-400">{component.name}</div>
            <div className="text-xs text-slate-400 mt-1">
              {component.coordinateSystem} · ({component.x?.toFixed(1)}, {component.y?.toFixed(1)}, {component.z?.toFixed(1)})
            </div>
            {component.isAnomaly && (
              <div className="text-xs text-red-400 mt-1">⚠ 异常标记</div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

interface ComponentMarkersProps {
  components: HeritageComponent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function ComponentMarkers({ components, selectedId, onSelect }: ComponentMarkersProps) {
  return (
    <group>
      {components.map((component) => (
        <ComponentMarker
          key={component.id}
          component={component}
          isSelected={component.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}
