import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import { VisitorTrajectory } from '../../data/types';

interface TrajectoryLineProps {
  trajectory: VisitorTrajectory;
  color: string;
  progress: number;
}

const MIN_CURVE_POINTS = 2;

const TrajectoryLine: React.FC<TrajectoryLineProps> = ({ trajectory, color, progress }) => {
  const movingPointRef = useRef<THREE.Mesh>(null!);

  const validPoints = useMemo(() => {
    return trajectory.points
      .filter((p) => p.confidence > 0.1)
      .map((p) => new THREE.Vector3(p.position.x, p.position.y, p.position.z));
  }, [trajectory.points]);

  const hasValidCurve = validPoints.length >= MIN_CURVE_POINTS;

  const curve = useMemo(() => {
    if (!hasValidCurve) return null;
    return new THREE.CatmullRomCurve3(validPoints, false, 'catmullrom', 0.5);
  }, [validPoints, hasValidCurve]);

  const lineGeometry = useMemo(() => {
    if (!hasValidCurve) return null;
    return new THREE.TubeGeometry(curve!, 100, 0.05, 8, false);
  }, [curve, hasValidCurve]);

  useFrame(() => {
    if (movingPointRef.current && curve) {
      const point = curve.getPoint(Math.min(progress, 1));
      movingPointRef.current.position.copy(point);
    }
  });

  if (progress <= 0) return null;

  if (!hasValidCurve) {
    return (
      <group>
        {validPoints.map((point, i) => (
          <mesh key={i} position={[point.x, point.y, point.z]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshBasicMaterial color="#ff6b35" transparent opacity={0.6} />
          </mesh>
        ))}
        <mesh position={[validPoints[0]?.x || 0, validPoints[0]?.y || 1.2, validPoints[0]?.z || 0]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshBasicMaterial color="#ff3333" />
        </mesh>
      </group>
    );
  }

  const clipGeometry = lineGeometry!.clone();
  const positions = clipGeometry.attributes.position;
  const totalPoints = positions.count;
  const visiblePoints = Math.floor(totalPoints * progress);

  for (let i = visiblePoints; i < totalPoints; i++) {
    positions.setY(i, -1000);
  }
  positions.needsUpdate = true;

  return (
    <group>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={validPoints.length}
            array={new Float32Array(validPoints.flatMap((p) => [p.x, p.y, p.z]))}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={color} transparent opacity={0.8} linewidth={2} />
      </line>

      {progress > 0 && progress < 1 && (
        <mesh ref={movingPointRef}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
    </group>
  );
};

const Trajectories: React.FC = () => {
  const trajectories = useSceneStore((state) => state.trajectories);
  const currentTime = useSceneStore((state) => state.currentTime);
  const showTrajectories = useSceneStore((state) => state.showTrajectories);
  const selectedBatch = useSceneStore((state) => state.selectedBatch);
  const selectedVisitor = useSceneStore((state) => state.selectedVisitor);

  if (!showTrajectories) return null;

  const colors = [
    '#00d4ff',
    '#00ff88',
    '#ffdd00',
    '#ff6b35',
    '#ff00ff',
    '#8800ff',
    '#0088ff',
    '#00ffcc',
  ];

  const filteredTrajectories = trajectories.filter((t) => {
    if (selectedBatch && t.batchId !== selectedBatch) return false;
    if (selectedVisitor && t.visitorId !== selectedVisitor) return false;
    return true;
  });

  return (
    <group>
      {filteredTrajectories.map((trajectory, index) => {
        const progress = trajectory.endTime > trajectory.startTime
          ? Math.max(0, Math.min(1, (currentTime - trajectory.startTime) / (trajectory.endTime - trajectory.startTime)))
          : 0;
        
        return (
          <TrajectoryLine
            key={trajectory.visitorId}
            trajectory={trajectory}
            color={colors[index % colors.length]}
            progress={progress}
          />
        );
      })}
    </group>
  );
};

export default Trajectories;
