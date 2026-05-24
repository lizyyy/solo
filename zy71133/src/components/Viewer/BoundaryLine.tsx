import { useMemo } from 'react';
import * as THREE from 'three';
import { Shape, ShapeGeometry, Vector3 } from 'three';
import { Boundary, BoundaryVertex } from '@/types';
import { getMaterialColor } from '@/data/materials';

interface BoundaryLineProps {
  boundary: Boundary;
  isSelected: boolean;
  baseHeight: number;
  onClick?: (event: { stopPropagation: () => void }) => void;
}

export function BoundaryLine({ boundary, isSelected, baseHeight, onClick }: BoundaryLineProps) {
  const color = getMaterialColor(boundary.materialId);
  const height = baseHeight + 0.05;

  const edgeGeometry = useMemo(() => {
    const points: Vector3[] = [];
    boundary.vertices.forEach(v => {
      points.push(new Vector3(v.x, height, v.z));
    });
    if (boundary.vertices.length > 0) {
      points.push(new Vector3(boundary.vertices[0].x, height, boundary.vertices[0].z));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [boundary.vertices, height]);

  const fillGeometry = useMemo(() => {
    if (boundary.vertices.length < 3) return null;

    const shape = new Shape();
    shape.moveTo(boundary.vertices[0].x, boundary.vertices[0].z);
    for (let i = 1; i < boundary.vertices.length; i++) {
      shape.lineTo(boundary.vertices[i].x, boundary.vertices[i].z);
    }
    shape.closePath();

    const geometry = new ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, height, 0);
    return geometry;
  }, [boundary.vertices, height]);

  return (
    <group onClick={onClick}>
      {fillGeometry && (
        <mesh geometry={fillGeometry}>
          <meshBasicMaterial
            color={color}
            transparent
            opacity={isSelected ? 0.3 : 0.15}
            side={2}
          />
        </mesh>
      )}
      <primitive object={new THREE.Line(edgeGeometry, new THREE.LineBasicMaterial({
        color: isSelected ? '#FF7D00' : color,
        linewidth: isSelected ? 3 : 2,
      }))} />
      {boundary.vertices.map((vertex, index) => (
        <mesh
          key={index}
          position={[vertex.x, height + 0.1, vertex.z]}
        >
          <sphereGeometry args={[isSelected ? 0.4 : 0.25, 8, 8]} />
          <meshBasicMaterial color={isSelected ? '#FF7D00' : color} />
        </mesh>
      ))}
    </group>
  );
}

interface DrawingBoundaryProps {
  vertices: BoundaryVertex[];
  baseHeight: number;
}

export function DrawingBoundary({ vertices, baseHeight }: DrawingBoundaryProps) {
  const height = baseHeight + 0.05;

  const edgeGeometry = useMemo(() => {
    const points: Vector3[] = vertices.map(v => new Vector3(v.x, height, v.z));
    if (vertices.length > 1) {
      points.push(new Vector3(vertices[0].x, height, vertices[0].z));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [vertices, height]);

  return (
    <group>
      {vertices.length > 1 && (
        <primitive object={new THREE.Line(edgeGeometry, new THREE.LineBasicMaterial({
          color: '#165DFF',
          linewidth: 2,
        }))} />
      )}
      {vertices.map((vertex, index) => (
        <mesh
          key={index}
          position={[vertex.x, height + 0.1, vertex.z]}
        >
          <sphereGeometry args={[0.35, 8, 8]} />
          <meshBasicMaterial color="#165DFF" />
        </mesh>
      ))}
    </group>
  );
}
