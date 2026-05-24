import { useMemo } from 'react';
import * as THREE from 'three';
import { SoilLayer } from '../../types';

interface SoilLayer3DProps {
  layer: SoilLayer;
  gridSize: { x: number; y: number; z: number };
  visible: boolean;
  maxDepth: number;
}

export const SoilLayer3D = ({
  layer,
  gridSize,
  visible,
  maxDepth,
}: SoilLayer3DProps) => {
  const height = layer.depthBottom - layer.depthTop;
  const centerY = (layer.depthTop + layer.depthBottom) / 2;

  const sideMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: layer.color,
      transparent: true,
      opacity: visible ? 0.4 : 0.05,
      side: THREE.DoubleSide,
    });
  }, [layer.color, visible]);

  const edgeLines = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const hw = gridSize.x / 2;
    const hd = gridSize.y / 2;

    const topY = layer.depthTop;
    const bottomY = layer.depthBottom;

    points.push(new THREE.Vector3(0, topY, 0));
    points.push(new THREE.Vector3(gridSize.x, topY, 0));
    points.push(new THREE.Vector3(gridSize.x, topY, gridSize.y));
    points.push(new THREE.Vector3(0, topY, gridSize.y));
    points.push(new THREE.Vector3(0, topY, 0));

    points.push(new THREE.Vector3(0, bottomY, 0));
    points.push(new THREE.Vector3(gridSize.x, bottomY, 0));
    points.push(new THREE.Vector3(gridSize.x, bottomY, gridSize.y));
    points.push(new THREE.Vector3(0, bottomY, gridSize.y));
    points.push(new THREE.Vector3(0, bottomY, 0));

    points.push(new THREE.Vector3(0, topY, 0));
    points.push(new THREE.Vector3(0, bottomY, 0));

    points.push(new THREE.Vector3(gridSize.x, topY, 0));
    points.push(new THREE.Vector3(gridSize.x, bottomY, 0));

    points.push(new THREE.Vector3(gridSize.x, topY, gridSize.y));
    points.push(new THREE.Vector3(gridSize.x, bottomY, gridSize.y));

    points.push(new THREE.Vector3(0, topY, gridSize.y));
    points.push(new THREE.Vector3(0, bottomY, gridSize.y));

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [layer, gridSize]);

  if (!visible) {
    return (
      <lineSegments
        geometry={edgeLines}
        position={[0, 0, 0]}
      >
        <lineBasicMaterial color={layer.color} transparent opacity={0.2} />
      </lineSegments>
    );
  }

  return (
    <group>
      <mesh position={[gridSize.x / 2, centerY, gridSize.y / 2]}>
        <boxGeometry args={[gridSize.x, height, gridSize.y]} />
        <primitive object={sideMaterial} attach="material" />
      </mesh>

      <lineSegments geometry={edgeLines} position={[0, 0, 0]}>
        <lineBasicMaterial color={layer.color} transparent opacity={0.8} />
      </lineSegments>
    </group>
  );
};
