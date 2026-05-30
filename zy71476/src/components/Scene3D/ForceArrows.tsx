import React, { useMemo } from 'react';
import * as THREE from 'three';
import { ForceAnalysis } from '../../types';
import { FORCE_INFO } from '../../types';

interface ForceArrowsProps {
  forces: ForceAnalysis;
  angle: number;
  blockPosition: number;
  status: 'static' | 'sliding' | 'critical';
}

const ForceArrows: React.FC<ForceArrowsProps> = ({ forces, angle, blockPosition, status }) => {
  const angleRad = (angle * Math.PI) / 180;
  const scale = 0.08;

  const blockPos = useMemo(() => {
    const startX = 1.5;
    const x = startX + blockPosition;
    const y = 0.1 + 0.4 + x * Math.sin(angleRad);
    return new THREE.Vector3(x, y, 0);
  }, [blockPosition, angleRad]);

  const arrows = useMemo(() => {
    const result = [];
    const center = blockPos.clone();

    const gravityDir = new THREE.Vector3(0, -1, 0);
    const gravityLen = Math.max(0.3, forces.gravity * scale);
    result.push({
      dir: gravityDir,
      length: gravityLen,
      color: FORCE_INFO.gravity.color,
      label: `${FORCE_INFO.gravity.symbol}`,
      value: forces.gravity,
    });

    const normalDir = new THREE.Vector3(-Math.sin(angleRad), Math.cos(angleRad), 0);
    const normalLen = Math.max(0.3, forces.normalForce * scale);
    result.push({
      dir: normalDir,
      length: normalLen,
      color: FORCE_INFO.normalForce.color,
      label: `${FORCE_INFO.normalForce.symbol}`,
      value: forces.normalForce,
    });

    const parallelDir = new THREE.Vector3(Math.cos(angleRad), -Math.sin(angleRad), 0);
    const parallelLen = Math.max(0.3, forces.parallelForce * scale);
    result.push({
      dir: parallelDir,
      length: parallelLen,
      color: FORCE_INFO.parallelForce.color,
      label: `${FORCE_INFO.parallelForce.symbol}`,
      value: forces.parallelForce,
    });

    const frictionDir = new THREE.Vector3(-Math.cos(angleRad), Math.sin(angleRad), 0);
    const frictionLen = Math.max(0.3, forces.frictionForce * scale);
    result.push({
      dir: frictionDir,
      length: frictionLen,
      color: FORCE_INFO.frictionForce.color,
      label: `${FORCE_INFO.frictionForce.symbol}`,
      value: forces.frictionForce,
    });

    if (status !== 'static') {
      const perpDir = new THREE.Vector3(-Math.sin(angleRad), -Math.cos(angleRad), 0);
      const perpLen = Math.max(0.3, forces.perpendicularForce * scale);
      result.push({
        dir: perpDir,
        length: perpLen,
        color: FORCE_INFO.perpendicularForce.color,
        label: `${FORCE_INFO.perpendicularForce.symbol}`,
        value: forces.perpendicularForce,
        dashed: true,
      });
    }

    return result;
  }, [forces, angleRad, blockPos, status]);

  const createArrowGeometry = (dir: THREE.Vector3, length: number, color: string, dashed: boolean = false) => {
    const arrowHelper = new THREE.ArrowHelper(
      dir.normalize(),
      new THREE.Vector3(0, 0, 0),
      length,
      new THREE.Color(color),
      0.15,
      0.08
    );

    return arrowHelper;
  };

  return (
    <group position={blockPos}>
      {arrows.map((arrow, index) => {
        const arrowHelper = createArrowGeometry(arrow.dir, arrow.length, arrow.color, arrow.dashed);
        return (
          <primitive
            key={index}
            object={arrowHelper}
            position={[0, 0, 0]}
          />
        );
      })}

      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
};

export default ForceArrows;
