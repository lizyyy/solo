import { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { TideStationAnnotation } from '@/engine/types';

const STATUS_COLOR: Record<string, string> = {
  processed: '#38e1d6',
  reprocessed: '#1f7a78',
  pending_review: '#f5b342',
  exception: '#ff5d5d',
};

interface Props {
  annotation: TideStationAnnotation;
  position: [number, number, number];
  isPending: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}

function tideHeight(ann: TideStationAnnotation): number {
  const v = ann.buoyRecord.tide?.valueMeters;
  if (v == null) return 0.4;
  return Math.max(0.4, Math.min(4.5, v * 1.1 + 0.4));
}

export function BuoyMarker({ annotation, position, isPending, selected, onSelect }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const color = STATUS_COLOR[annotation.status] ?? '#38e1d6';
  const height = tideHeight(annotation);
  const baseY = position[1];

  const colorObj = useMemo(() => new THREE.Color(color), [color]);

  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.elapsedTime;
      const breathe = 1 + Math.sin(t * 1.6 + position[0]) * 0.08;
      groupRef.current.scale.setScalar(selected ? 1.25 * breathe : hovered ? 1.15 * breathe : breathe);
      groupRef.current.position.y = baseY + Math.sin(t * 1.2 + position[2]) * 0.08;
    }
    if (ringRef.current && annotation.status === 'exception') {
      const t = state.clock.elapsedTime;
      const s = 0.8 + ((t * 0.9) % 1.8);
      ringRef.current.scale.setScalar(s);
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.9 - ((t * 0.9) % 1.8) / 2);
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(annotation.annotationId);
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
      {/* Buoy body — a glowing capsule rising with tide height */}
      <mesh position={[0, height / 2, 0]} castShadow>
        <capsuleGeometry args={[0.32, height, 8, 16]} />
        <meshStandardMaterial
          color={colorObj}
          emissive={colorObj}
          emissiveIntensity={selected ? 1.4 : 0.7}
          metalness={0.5}
          roughness={0.3}
        />
      </mesh>
      {/* Top beacon */}
      <mesh position={[0, height + 0.35, 0]}>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color={colorObj} emissive={colorObj} emissiveIntensity={2.4} />
      </mesh>
      <pointLight position={[0, height + 0.4, 0]} color={color} intensity={selected ? 4 : 1.6} distance={8} />

      {/* Exception pulse ring */}
      {annotation.status === 'exception' && (
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.5, 0.62, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Pending review platform marker */}
      {isPending && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.7, 0.85, 4]} />
          <meshBasicMaterial color="#f5b342" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Selection halo */}
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[0.95, 1.1, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Hover tooltip */}
      {(hovered || selected) && (
        <Html position={[0, height + 1.2, 0]} center distanceFactor={14} occlude>
          <div className="whitespace-nowrap rounded-md border border-glow-cyan/40 bg-abyss-900/90 px-2.5 py-1.5 font-mono text-[11px] text-signal-moon shadow-glow backdrop-blur-sm">
            <span className="text-glow-cyan">{annotation.stationName}</span>
            <span className="mx-1.5 text-glow-teal/60">|</span>
            <span style={{ color }}>{annotation.csvRow.tide_level}</span>
            {annotation.status === 'exception' && (
              <span className="ml-1.5 rounded bg-signal-coral/20 px-1 text-signal-coral">待核查</span>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}
