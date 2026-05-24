import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Move } from '../../types';
import { getContainerPosition } from './Container3D';
import { useStore } from '../../store/useStore';

interface PathVisualizerProps {
  moves: Move[];
  currentStep: number;
}

export function PathVisualizer({ moves, currentStep }: PathVisualizerProps) {
  const glowRef = useRef<THREE.Mesh>(null);
  const { timeline } = useStore();

  const paths = useMemo(() => {
    return moves.map((move, index) => {
      const from = getContainerPosition(
        move.from.bay,
        move.from.row,
        move.from.tier
      );
      const to = move.to
        ? getContainerPosition(move.to.bay, move.to.row, move.to.tier)
        : [from[0], from[1] + 15, from[2]];

      const points: THREE.Vector3[] = [];
      const liftHeight = 5;
      const segments = 20;

      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        if (t < 0.25) {
          const p = t / 0.25;
          points.push(
            new THREE.Vector3(from[0], from[1] + liftHeight * p, from[2])
          );
        } else if (t < 0.75) {
          const p = (t - 0.25) / 0.5;
          points.push(
            new THREE.Vector3(
              from[0] + (to[0] - from[0]) * p,
              from[1] + liftHeight,
              from[2] + (to[2] - from[2]) * p
            )
          );
        } else {
          const p = (t - 0.75) / 0.25;
          points.push(
            new THREE.Vector3(to[0], to[1] + liftHeight * (1 - p), to[2])
          );
        }
      }

      const curve = new THREE.CatmullRomCurve3(points);
      const tubeGeometry = new THREE.TubeGeometry(curve, 64, 0.08, 8, false);

      return {
        move,
        index,
        tubeGeometry,
        from,
        to,
        isActive: index === currentStep,
        isCompleted: index < currentStep,
        color:
          move.type === 'retrieval'
            ? '#00B42A'
            : index === currentStep
            ? '#165DFF'
            : index < currentStep
            ? '#86909C'
            : '#FF7D00',
      };
    });
  }, [moves, currentStep]);

  useFrame(({ clock }) => {
    if (glowRef.current) {
      const glowIntensity = 0.3 + Math.sin(clock.getElapsedTime() * 3) * 0.2;
      (glowRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        glowIntensity;
    }
  });

  return (
    <group>
      {paths.map((path, idx) => (
        <group key={idx}>
          <mesh
            geometry={path.tubeGeometry}
            visible={path.index <= currentStep}
          >
            <meshStandardMaterial
              color={path.color}
              transparent
              opacity={path.isActive ? 0.9 : path.isCompleted ? 0.4 : 0.6}
              emissive={path.color}
              emissiveIntensity={path.isActive ? 0.5 : 0.2}
            />
          </mesh>

          {path.isActive && (
            <mesh ref={glowRef}>
              <sphereGeometry args={[0.4, 32, 32]} />
              <meshStandardMaterial
                color={path.color}
                emissive={path.color}
                emissiveIntensity={1}
                transparent
                opacity={0.8}
              />
            </mesh>
          )}

          <group position={path.from} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh>
              <ringGeometry args={[0.5, 0.7, 32]} />
              <meshBasicMaterial
                color={path.color}
                transparent
                opacity={path.isActive ? 0.8 : 0.4}
                side={THREE.DoubleSide}
              />
            </mesh>
            <mesh position={[0, 0, 0.02]}>
              <ringGeometry args={[0.3, 0.5, 32]} />
              <meshBasicMaterial
                color={path.color}
                transparent
                opacity={path.isActive ? 0.6 : 0.3}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>

          {path.to && (
            <group position={path.to as [number, number, number]} rotation={[-Math.PI / 2, 0, 0]}>
              <mesh>
                <ringGeometry args={[0.5, 0.7, 32]} />
                <meshBasicMaterial
                  color={path.color}
                  transparent
                  opacity={path.isCompleted ? 0.8 : 0.3}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          )}
        </group>
      ))}
    </group>
  );
}
