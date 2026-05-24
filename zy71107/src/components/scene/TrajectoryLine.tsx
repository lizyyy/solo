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

const TrajectoryLine: React.FC<TrajectoryLineProps> = ({ trajectory, color, progress }) => {
  const movingPointRef = useRef<THREE.Mesh>(null!);

  const points = useMemo(() => {
    return trajectory.points.map((p) => new THREE.Vector3(p.position.x, p.position.y, p.position.z));
  }, [trajectory.points]);

  const curve = useMemo(() => {
    return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
  }, [points]);

  const tubeGeometry = useMemo(() => {
    return new THREE.TubeGeometry(curve, 100, 0.05, 8, false);
  }, [curve]);

  useFrame(() => {
    if (movingPointRef.current && curve) {
      const point = curve.getPoint(Math.min(progress, 1));
      movingPointRef.current.position.copy(point);
    }
  });

  if (progress <= 0) return null;

  const clipGeometry = tubeGeometry.clone();
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
            count={points.length}
            array={new Float32Array(points.flatMap((p) => [p.x, p.y, p.z]))}
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
