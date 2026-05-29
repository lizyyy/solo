import { useMemo } from 'react';
import * as THREE from 'three';

interface ResonanceBoxProps {
  length: number;
  width: number;
  height: number;
  position?: [number, number, number];
}

export function ResonanceBox({ length, width, height, position = [0, 0, 0] }: ResonanceBoxProps) {
  const scale = useMemo(() => {
    const maxDim = Math.max(length, width, height);
    return 0.4 / maxDim;
  }, [length, width, height]);

  const woodMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      metalness: 0.1,
      roughness: 0.8,
    });
  }, []);

  const innerMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: 0x654321,
      metalness: 0.05,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
  }, []);

  const outerLength = length * scale;
  const outerWidth = width * scale;
  const outerHeight = height * scale;
  const thickness = 0.02;

  return (
    <group position={position}>
      <mesh position={[0, -outerHeight / 2, 0]} material={woodMaterial} castShadow receiveShadow>
        <boxGeometry args={[outerLength, thickness, outerWidth]} />
      </mesh>

      <mesh position={[-outerLength / 2 + thickness / 2, 0, 0]} material={woodMaterial} castShadow receiveShadow>
        <boxGeometry args={[thickness, outerHeight, outerWidth]} />
      </mesh>

      <mesh position={[outerLength / 2 - thickness / 2, 0, 0]} material={woodMaterial} castShadow receiveShadow>
        <boxGeometry args={[thickness, outerHeight, outerWidth]} />
      </mesh>

      <mesh position={[0, 0, -outerWidth / 2 + thickness / 2]} material={woodMaterial} castShadow receiveShadow>
        <boxGeometry args={[outerLength, outerHeight, thickness]} />
      </mesh>

      <mesh position={[0, 0, outerWidth / 2 - thickness / 2]} material={woodMaterial} castShadow receiveShadow>
        <boxGeometry args={[outerLength, outerHeight, thickness]} />
      </mesh>

      <mesh position={[0, 0, 0]} material={innerMaterial}>
        <boxGeometry args={[
          outerLength - thickness * 2,
          outerHeight - thickness,
          outerWidth - thickness * 2
        ]} />
      </mesh>

      <mesh position={[0, 0.1, 0]}>
        <ringGeometry args={[0.01, 0.02, 32]} />
        <meshBasicMaterial color={0x00f5d4} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
