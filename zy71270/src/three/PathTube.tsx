import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PathSegment } from '../types';
import { densityToColor } from '../utils/colors';
import { useViewStore } from '../store/viewStore';
import { useFilterStore } from '../store/filterStore';

interface PathTubeProps {
  segment: PathSegment;
  maxDensity: number;
}

export default function PathTube({ segment, maxDensity }: PathTubeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { selectedElementId, setSelectedElement } = useViewStore();
  const densityThreshold = useFilterStore((s) => s.densityThreshold);

  const normalizedDensity = maxDensity > 0 ? segment.density / maxDensity : 0;
  const isSelected = selectedElementId === segment.id;

  const color = useMemo(() => {
    if (segment.isBroken) return new THREE.Color('#64748B');
    const rgb = densityToColor(normalizedDensity);
    return new THREE.Color(rgb.r / 255, rgb.g / 255, rgb.b / 255);
  }, [normalizedDensity, segment.isBroken]);

  const curve = useMemo(() => {
    const sp = segment.startPoint.position;
    const ep = segment.endPoint.position;
    const midX = (sp.x + ep.x) / 2;
    const midY = (sp.z + ep.z) / 2;
    const midZ = (sp.y + ep.y) / 2 + 0.3;
    return new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(sp.x, sp.z, sp.y),
      new THREE.Vector3(midX, midZ, midY),
      new THREE.Vector3(ep.x, ep.z, ep.y)
    );
  }, [segment.startPoint.position, segment.endPoint.position]);

  const tubeGeometry = useMemo(() => {
    const radius = Math.max(0.02, normalizedDensity * 0.08 + 0.02);
    return new THREE.TubeGeometry(curve, 20, radius, 8, false);
  }, [curve, normalizedDensity]);

  const opacity = useMemo(() => {
    if (segment.isBroken) return 0.3;
    if (normalizedDensity < densityThreshold) return 0;
    return 0.4 + normalizedDensity * 0.6;
  }, [segment.isBroken, normalizedDensity, densityThreshold]);

  useFrame(() => {
    if (!meshRef.current) return;
    if (isSelected) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.5 + Math.sin(Date.now() * 0.005) * 0.3;
    }
  });

  if (!segment.isBroken && normalizedDensity < densityThreshold) return null;

  const handleClick = (e: THREE.Event) => {
    (e as unknown as { stopPropagation: () => void }).stopPropagation();
    setSelectedElement(segment.id, 'path');
  };

  return (
    <mesh
      ref={meshRef}
      geometry={tubeGeometry}
      onClick={handleClick}
    >
      <meshStandardMaterial
        color={color}
        transparent
        opacity={opacity}
        emissive={color}
        emissiveIntensity={segment.isBroken ? 0 : normalizedDensity * 0.4}
        side={THREE.DoubleSide}
        wireframe={segment.isBroken}
      />
    </mesh>
  );
}
