import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { SwingFrame, Anomaly } from '@/types';
import { generateSplinePoints, toDegrees } from '@/utils/swingMath';
import { getSeverityColor } from '@/utils/anomalyDetector';

interface SwingTrajectoryProps {
  frames: SwingFrame[];
  currentFrameIndex: number;
  anomalies: Anomaly[];
  visible: boolean;
  onFrameClick?: (frameIndex: number) => void;
  selectedFrameId?: string | null;
}

export function SwingTrajectory({ 
  frames, 
  currentFrameIndex, 
  anomalies,
  visible,
  onFrameClick,
  selectedFrameId,
}: SwingTrajectoryProps) {
  const tubeRef = useRef<THREE.Mesh>(null);
  const lineRef = useRef<THREE.Mesh>(null);
  const pointsRef = useRef<THREE.Points>(null);
  
  const { curve, tubeGeometry, lineGeometry, pointGeometry, pointColors } = useMemo(() => {
    if (frames.length < 2) {
      return {
        curve: null,
        tubeGeometry: null,
        lineGeometry: null,
        pointGeometry: null,
        pointColors: [],
      };
    }
    
    const splinePoints = generateSplinePoints(frames, 3);
    const threePoints = splinePoints.map(p => new THREE.Vector3(p.x, p.y, p.z));
    const curve = new THREE.CatmullRomCurve3(threePoints);
    
    const tubeGeometry = new THREE.TubeGeometry(curve, 200, 0.015, 8, false);
    const lineGeometry = new THREE.TubeGeometry(curve, 200, 0.005, 4, false);
    
    const pointGeometry = new THREE.TubeGeometry(curve, 200, 0.02, 8, false);
    
    const pointColors: number[] = [];
    const anomalyFrameIds = new Set<string>();
    const anomalyFrameRanges = new Map<number, string>();
    
    anomalies.forEach(anomaly => {
      if (anomaly.frameId) {
        anomalyFrameIds.add(anomaly.frameId);
      }
      if (anomaly.frameRange) {
        for (let i = anomaly.frameRange.start; i <= anomaly.frameRange.end; i++) {
          const frame = frames[i];
          if (frame) {
            anomalyFrameRanges.set(i, getSeverityColor(anomaly.severity));
          }
        }
      }
    });
    
    splinePoints.forEach((_, i) => {
      const frameIdx = Math.floor(i / 3);
      const frame = frames[frameIdx];
      
      if (frame && anomalyFrameIds.has(frame.frameId)) {
        pointColors.push(1, 0.2, 0.4);
      } else if (anomalyFrameRanges.has(frameIdx)) {
        const color = anomalyFrameRanges.get(frameIdx);
        if (color === 'golf-red') {
          pointColors.push(1, 0.2, 0.4);
        } else {
          pointColors.push(1, 0.53, 0);
        }
      } else if (frame?.isSupplemented) {
        pointColors.push(1, 0.53, 0);
      } else if (i / 3 <= currentFrameIndex) {
        pointColors.push(0, 1, 0.53);
      } else {
        pointColors.push(0.4, 0.4, 0.5);
      }
    });
    
    return { curve, tubeGeometry, lineGeometry, pointGeometry, pointColors };
  }, [frames, currentFrameIndex, anomalies]);
  
  useFrame((_, delta) => {
    if (lineRef.current) {
      const material = lineRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.8 + Math.sin(Date.now() * 0.002) * 0.2;
    }
  });
  
  if (!visible || !tubeGeometry || !curve) return null;
  
  const currentPosition = frames[currentFrameIndex]?.position;
  const currentFaceAngle = frames[currentFrameIndex]?.faceAngle;
  
  return (
    <group>
      <mesh geometry={tubeGeometry}>
        <meshBasicMaterial 
          color="#2A3547" 
          transparent 
          opacity={0.6}
        />
      </mesh>
      
      <mesh ref={lineRef} geometry={lineGeometry}>
        <meshBasicMaterial 
          color="#00FF88" 
          transparent 
          opacity={0.9}
        />
      </mesh>
      
      {currentPosition && (
        <group position={[currentPosition.x, currentPosition.y, currentPosition.z]}>
          <mesh>
            <sphereGeometry args={[0.04, 16, 16]} />
            <meshBasicMaterial color="#00FF88" transparent opacity={0.9} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshBasicMaterial color="#00FF88" transparent opacity={0.3} />
          </mesh>
          
          <group rotation={[currentFaceAngle?.x || 0, currentFaceAngle?.y || 0, currentFaceAngle?.z || 0]}>
            <mesh position={[0, 0, 0.08]}>
              <coneGeometry args={[0.02, 0.1, 8]} />
              <meshBasicMaterial color="#00AAFF" />
            </mesh>
          </group>
        </group>
      )}
      
      {frames.filter(f => f.isSupplemented).map((frame, idx) => (
        <mesh 
          key={`supplemented-${idx}`}
          position={[frame.position.x, frame.position.y, frame.position.z]}
        >
          <sphereGeometry args={[0.025, 12, 12]} />
          <meshBasicMaterial color="#FF8800" transparent opacity={0.8} />
        </mesh>
      ))}
      
      {anomalies.map(anomaly => {
        if (anomaly.frameId) {
          const frameIdx = frames.findIndex(f => f.frameId === anomaly.frameId);
          if (frameIdx >= 0) {
            const frame = frames[frameIdx];
            return (
              <group key={anomaly.anomalyId} position={[frame.position.x, frame.position.y + 0.15, frame.position.z]}>
                <mesh>
                  <sphereGeometry args={[0.035, 16, 16]} />
                  <meshBasicMaterial 
                    color={anomaly.severity === 'high' ? '#FF3366' : '#FF8800'} 
                    transparent 
                    opacity={0.8 + Math.sin(Date.now() * 0.005) * 0.2}
                  />
                </mesh>
              </group>
            );
          }
        }
        return null;
      })}
    </group>
  );
}
