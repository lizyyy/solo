import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Star, StarField } from '../../types';
import { getStarColor } from '../../physics/constants';

interface StarField3DProps {
  starField: StarField;
  visible: boolean;
  onStarClick: (star: Star) => void;
  selectedId?: string;
}

export function StarField3D({ starField, visible, onStarClick, selectedId }: StarField3DProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const animationRef = useRef(0);

  const { positions, colors, sizes, starMap } = useMemo(() => {
    const positions = new Float32Array(starField.stars.length * 3);
    const colors = new Float32Array(starField.stars.length * 3);
    const sizes = new Float32Array(starField.stars.length);
    const starMap = new Map<number, Star>();

    starField.stars.forEach((star, index) => {
      const pos = star.isLensed && star.lensedPosition ? star.lensedPosition : star.position;
      positions[index * 3] = pos[0];
      positions[index * 3 + 1] = pos[1];
      positions[index * 3 + 2] = pos[2];

      const color = new THREE.Color(getStarColor(star.temperature));
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;

      const baseSize = 0.15 + (6 - star.magnitude) * 0.05;
      const magnification = star.magnification || 1;
      sizes[index] = baseSize * Math.min(magnification, 3);

      starMap.set(index, star);
    });

    return { positions, colors, sizes, starMap };
  }, [starField]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, [positions, colors, sizes]);

  useFrame(() => {
    animationRef.current = (animationRef.current + 0.01) % (Math.PI * 2);
    if (pointsRef.current) {
      const material = pointsRef.current.material as THREE.PointsMaterial;
      material.opacity = 0.8 + 0.2 * Math.sin(animationRef.current);
    }
  });

  const handleClick = (event: any) => {
    const intersect = event.intersects?.[0];
    if (intersect && intersect.index !== undefined) {
      const star = starMap.get(intersect.index);
      if (star) {
        event.stopPropagation?.();
        onStarClick(star);
      }
    }
  };

  if (!visible) return null;

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      onClick={handleClick}
    >
      <pointsMaterial
        size={0.3}
        vertexColors
        transparent
        opacity={0.9}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
