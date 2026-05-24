import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RiskZone as RiskZoneType } from '../../types';
import { getRiskLevelColor, getRiskLevelOpacity } from '../../utils/dataValidator';

interface RiskZoneProps {
  zone: RiskZoneType;
  isSelected: boolean;
  onClick: () => void;
  terrainHeightmap?: number[][];
  terrainScale?: number;
}

export function RiskZone({
  zone,
  isSelected,
  onClick,
  terrainHeightmap,
  terrainScale = 1
}: RiskZoneProps) {
  const groupRef = useRef<THREE.Group>(null);

  const { shapeGeometry, borderGeometry } = useMemo(() => {
    const shape = new THREE.Shape();
    
    if (zone.polygon.length > 0) {
      const pointsWithHeight = zone.polygon.map(p => {
        let height = 0.1;
        if (terrainHeightmap && terrainHeightmap.length > 0) {
          const xIdx = Math.floor(p.x / 2);
          const zIdx = Math.floor(p.z / 2);
          if (terrainHeightmap[zIdx] && terrainHeightmap[zIdx][xIdx] !== undefined) {
            height = terrainHeightmap[zIdx][xIdx] * terrainScale * 0.5 + 0.1;
          }
        }
        return { x: p.x, y: height, z: p.z };
      });

      shape.moveTo(pointsWithHeight[0].x, pointsWithHeight[0].z);
      for (let i = 1; i < pointsWithHeight.length; i++) {
        shape.lineTo(pointsWithHeight[i].x, pointsWithHeight[i].z);
      }
      shape.closePath();
    }

    const shapeGeometry = new THREE.ShapeGeometry(shape);
    shapeGeometry.rotateX(-Math.PI / 2);

    const borderPoints = zone.polygon.map(p => {
      let height = 0.1;
      if (terrainHeightmap && terrainHeightmap.length > 0) {
        const xIdx = Math.floor(p.x / 2);
        const zIdx = Math.floor(p.z / 2);
        if (terrainHeightmap[zIdx] && terrainHeightmap[zIdx][xIdx] !== undefined) {
          height = terrainHeightmap[zIdx][xIdx] * terrainScale * 0.5 + 0.15;
        }
      }
      return new THREE.Vector3(p.x, height, p.z);
    });
    if (borderPoints.length > 0) {
      borderPoints.push(borderPoints[0].clone());
    }
    const borderGeometry = new THREE.BufferGeometry().setFromPoints(borderPoints);

    return { shapeGeometry, borderGeometry };
  }, [zone.polygon, terrainHeightmap, terrainScale]);

  const color = getRiskLevelColor(zone.level);
  const baseOpacity = getRiskLevelOpacity(zone.level);

  useFrame((state) => {
    if (groupRef.current) {
      const time = state.clock.elapsedTime;
      const pulseOpacity = baseOpacity + Math.sin(time * 2) * 0.05;
      groupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          child.material.opacity = zone.isClosed ? pulseOpacity + 0.2 : pulseOpacity;
        }
      });
    }
  });

  const borderLine = new THREE.Line(
    borderGeometry,
    new THREE.LineBasicMaterial({
      color,
      linewidth: zone.isClosed ? 3 : 2
    })
  );

  const selectedBorderLine = new THREE.Line(
    borderGeometry,
    new THREE.LineBasicMaterial({ color: '#ffffff', linewidth: 4 })
  );

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
    >
      <mesh geometry={shapeGeometry}>
        <meshStandardMaterial
          color={color}
          transparent
          opacity={zone.isClosed ? baseOpacity + 0.2 : baseOpacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      
      <primitive object={borderLine} />

      {isSelected && <primitive object={selectedBorderLine} />}
    </group>
  );
}

export default RiskZone;
