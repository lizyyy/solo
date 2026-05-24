import { useMemo } from 'react';
import * as THREE from 'three';
import { PathPoint, SweepArea } from '../../types';

interface PathLineProps {
  path: PathPoint[];
  sweepAreas: SweepArea[];
  showSweep?: boolean;
  hasCollision?: boolean;
}

export function PathLine({ path, sweepAreas, showSweep = true, hasCollision = false }: PathLineProps) {
  const linePoints = useMemo(() => {
    if (path.length === 0) return new THREE.BufferGeometry();
    const points = path.map((p) => new THREE.Vector3(p.position.x, 0.05, p.position.z));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [path]);

  const sweepMeshes = useMemo(() => {
    if (!showSweep || sweepAreas.length === 0) return [];

    return sweepAreas.map((area, index) => {
      const shape = new THREE.Shape();
      const points = area.points;
      if (points.length < 3) return null;

      shape.moveTo(points[0].x, points[0].z);
      for (let i = 1; i < points.length; i++) {
        shape.lineTo(points[i].x, points[i].z);
      }
      shape.closePath();

      const geometry = new THREE.ShapeGeometry(shape);
      const opacity = 0.15 + (index / sweepAreas.length) * 0.2;

      return { geometry, opacity, key: `sweep-${index}` };
    }).filter(Boolean);
  }, [sweepAreas, showSweep]);

  const lineColor = hasCollision ? '#F53F3F' : '#165DFF';

  return (
    <group>
      {showSweep && sweepMeshes.map((mesh) => mesh && (
        <mesh key={mesh.key} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <primitive object={mesh.geometry} attach="geometry" />
          <meshBasicMaterial
            color={hasCollision ? '#F53F3F' : '#165DFF'}
            transparent
            opacity={mesh.opacity}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {path.length > 0 && (
        <primitive object={new THREE.Line(linePoints, new THREE.LineBasicMaterial({ color: lineColor, linewidth: 3 }))} />
      )}

      {path.length > 0 && (
        <>
          <mesh position={[path[0].position.x, 0.2, path[0].position.z]}>
            <cylinderGeometry args={[0.4, 0.4, 0.1, 16]} />
            <meshBasicMaterial color="#48BB78" />
          </mesh>
          <mesh position={[path[path.length - 1].position.x, 0.2, path[path.length - 1].position.z]}>
            <cylinderGeometry args={[0.4, 0.4, 0.1, 16]} />
            <meshBasicMaterial color="#F6AD55" />
          </mesh>
        </>
      )}
    </group>
  );
}
