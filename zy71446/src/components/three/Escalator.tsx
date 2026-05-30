import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { escalators } from '../../data/stationConfig';
import { useSimulationStore } from '../../store/useSimulationStore';

interface SingleEscalatorProps {
  escalator: typeof escalators[0];
}

function SingleEscalator({ escalator }: SingleEscalatorProps) {
  const stepsRef = useRef<THREE.InstancedMesh>(null);
  const handrailRef = useRef<THREE.Mesh>(null);
  const arrowRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  const activeAnomalies = useSimulationStore((state) => state.activeAnomalies);
  const deviceStatuses = useSimulationStore((state) => state.deviceStatuses);

  const deviceStatus = deviceStatuses.find((d) => d.deviceId === escalator.id);
  const hasWrongDirection = activeAnomalies.some(
    (a) => a.type === 'wrong_direction' && a.location === escalator.name
  );
  const hasStop = activeAnomalies.some(
    (a) => a.type === 'escalator_stop' && a.location === escalator.name
  );

  const stepCount = 20;
  const stepHeight = 3 / stepCount;
  const stepDepth = 10 / stepCount;

  const dummy = useMemo(() => new THREE.Object3D(), []);

  const stepsColor = useMemo(() => {
    if (hasWrongDirection) return '#FF3B30';
    if (hasStop) return '#FFB800';
    if (escalator.direction === 'stopped') return '#666666';
    return '#4a5568';
  }, [hasWrongDirection, hasStop, escalator.direction]);

  const arrowColor = useMemo(() => {
    if (hasWrongDirection) return '#FF3B30';
    if (hasStop) return '#FFB800';
    return '#00ff88';
  }, [hasWrongDirection, hasStop]);

  useFrame((_, delta) => {
    if (stepsRef.current && escalator.direction !== 'stopped') {
      timeRef.current += delta * escalator.speed;
      const direction = escalator.direction === 'up' ? 1 : -1;

      for (let i = 0; i < stepCount; i++) {
        const progress = ((i / stepCount) + timeRef.current * direction * 0.1) % 1;
        const adjustedProgress = progress < 0 ? progress + 1 : progress;

        const x = escalator.position[0];
        const y = escalator.position[1] + adjustedProgress * 3 - 1.5;
        const z = escalator.position[2] + (adjustedProgress - 0.5) * 10;

        dummy.position.set(x, y, z);
        dummy.rotation.x = Math.atan2(3, 10) * direction;
        dummy.updateMatrix();
        stepsRef.current.setMatrixAt(i, dummy.matrix);
      }
      stepsRef.current.instanceMatrix.needsUpdate = true;
    }

    if (arrowRef.current && escalator.direction !== 'stopped') {
      const direction = escalator.direction === 'up' ? 1 : -1;
      arrowRef.current.position.z = escalator.position[2] + Math.sin(timeRef.current * 2) * 0.3;
      arrowRef.current.rotation.y = direction > 0 ? 0 : Math.PI;
    }

    if (handrailRef.current) {
      const mat = handrailRef.current.material as THREE.MeshStandardMaterial;
      if (hasWrongDirection || hasStop) {
        mat.emissiveIntensity = 0.5 + Math.sin(timeRef.current * 4) * 0.3;
      }
    }
  });

  return (
    <group position={escalator.position}>
      <mesh position={[0, -1.5, 0]}>
        <boxGeometry args={[2, 0.3, 11]} />
        <meshStandardMaterial
          color="#2d3748"
          roughness={0.6}
          metalness={0.4}
        />
      </mesh>

      <instancedMesh
        ref={stepsRef}
        args={[undefined, undefined, stepCount]}
        castShadow
      >
        <boxGeometry args={[1.8, 0.15, stepDepth * 0.9]} />
        <meshStandardMaterial
          color={stepsColor}
          roughness={0.5}
          metalness={0.5}
          emissive={hasWrongDirection || hasStop ? stepsColor : '#000000'}
          emissiveIntensity={hasWrongDirection || hasStop ? 0.3 : 0}
        />
      </instancedMesh>

      <mesh ref={handrailRef} position={[1.1, 0.2, 0]}>
        <boxGeometry args={[0.1, 0.1, 10.5]} />
        <meshStandardMaterial
          color={arrowColor}
          emissive={arrowColor}
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh position={[-1.1, 0.2, 0]}>
        <boxGeometry args={[0.1, 0.1, 10.5]} />
        <meshStandardMaterial
          color={arrowColor}
          emissive={arrowColor}
          emissiveIntensity={0.5}
        />
      </mesh>

      {escalator.direction !== 'stopped' && (
        <mesh ref={arrowRef} position={[0, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.3, 0.8, 4]} />
          <meshStandardMaterial
            color={arrowColor}
            emissive={arrowColor}
            emissiveIntensity={0.8}
            transparent
            opacity={0.9}
          />
        </mesh>
      )}

      <mesh position={[0, 1.6, 4.5]}>
        <boxGeometry args={[0.05, 0.4, 0.6]} />
        <meshStandardMaterial
          color="#1a202c"
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>
    </group>
  );
}

export function EscalatorGroup() {
  return (
    <group>
      {escalators.map((esc) => (
        <SingleEscalator key={esc.id} escalator={esc} />
      ))}
    </group>
  );
}
