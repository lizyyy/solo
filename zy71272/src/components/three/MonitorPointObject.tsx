import { useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { MonitorPoint } from '../../types';
import { useStore } from '../../store/useStore';
import { isObjectInvolvedInIssue } from '../../utils/sceneDetection';
import { calculateCombinedSoundPressure } from '../../utils/soundField';
import { dbToColorHex, roundTo } from '../../utils/helpers';

interface MonitorPointObjectProps {
  monitor: MonitorPoint;
}

export default function MonitorPointObject({ monitor }: MonitorPointObjectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [rotation, setRotation] = useState(0);

  const selectedObjectId = useStore(state => state.selectedObjectId);
  const selectObject = useStore(state => state.selectObject);
  const updateMonitorPoint = useStore(state => state.updateMonitorPoint);
  const sceneIssues = useStore(state => state.sceneIssues);
  const roomConfig = useStore(state => state.roomConfig);
  const musicians = useStore(state => state.musicians);

  const isSelected = selectedObjectId === monitor.id;
  const issue = isObjectInvolvedInIssue(monitor.id, sceneIssues);
  const hasWarning = issue?.severity === 'warning';

  const soundPressure = useMemo(() => {
    if (musicians.length === 0) return 0;
    return calculateCombinedSoundPressure(musicians, monitor.position);
  }, [musicians, monitor.position]);

  const indicatorColor = useMemo(() => {
    if (hasWarning) return '#ff6b35';
    return dbToColorHex(soundPressure);
  }, [soundPressure, hasWarning]);

  useFrame((_, delta) => {
    setRotation(prev => prev + delta * 2);
  });

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setIsDragging(true);
    selectObject(monitor.id, 'monitor');
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging || !roomConfig) return;
    e.stopPropagation();

    const point = e.point;
    const halfWidth = roomConfig.width / 2 - 0.3;
    const halfDepth = roomConfig.length / 2 - 0.3;

    const newX = Math.max(-halfWidth, Math.min(halfWidth, point.x));
    const newZ = Math.max(-halfDepth, Math.min(halfDepth, point.z));

    updateMonitorPoint(monitor.id, {
      position: { ...monitor.position, x: newX, z: newZ },
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  return (
    <group
      ref={groupRef}
      position={[monitor.position.x, monitor.position.y, monitor.position.z]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
    >
      <mesh rotation={[-Math.PI / 2, 0, rotation]}>
        <ringGeometry args={[0.2, 0.3, 32]} />
        <meshBasicMaterial
          color={indicatorColor}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, -rotation * 1.5]}>
        <ringGeometry args={[0.32, 0.35, 32]} />
        <meshBasicMaterial
          color={indicatorColor}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.15, 0.18, 0.04, 32]} />
        <meshStandardMaterial
          color={indicatorColor}
          emissive={indicatorColor}
          emissiveIntensity={isSelected ? 0.8 : 0.4}
          metalness={0.3}
          roughness={0.5}
        />
      </mesh>

      <mesh position={[0, 0.3, 0]}>
        <octahedronGeometry args={[0.12, 0]} />
        <meshStandardMaterial
          color={hasWarning ? '#ff6b35' : '#00ff88'}
          emissive={hasWarning ? '#ff6b35' : '#00ff88'}
          emissiveIntensity={0.6}
        />
      </mesh>

      <Text
        position={[0, 0.6, 0]}
        fontSize={0.16}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {monitor.name}
      </Text>

      <Text
        position={[0, -0.3, 0]}
        fontSize={0.14}
        color={indicatorColor}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {roundTo(soundPressure, 1)} dB
      </Text>

      {(isSelected || hovered) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[0.4, 0.45, 32]} />
          <meshBasicMaterial
            color="#00ff88"
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}
