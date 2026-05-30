import { useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Text, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useSimulationStore } from '@/store/useSimulationStore';

function Ramp() {
  const { currentSimulation, selectedObjectId, selectObject } = useSimulationStore();
  const rampAngle = currentSimulation?.physicsParams.rampAngle ?? 30;
  const isSelected = selectedObjectId === 'ramp';
  const angleRad = (rampAngle * Math.PI) / 180;

  const handleClick = useCallback((e: THREE.Event) => {
    (e as unknown as { stopPropagation: () => void }).stopPropagation();
    selectObject('ramp');
  }, [selectObject]);

  return (
    <group rotation={[0, 0, -angleRad]} position={[0, 3 * Math.sin(angleRad), 0]} onClick={handleClick}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[6, 0.2, 3]} />
        <meshStandardMaterial
          color="#8B6914"
          emissive={isSelected ? '#4273c4' : '#000000'}
          emissiveIntensity={isSelected ? 0.6 : 0}
        />
      </mesh>
      {isSelected && (
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(6, 0.2, 3)]} />
          <lineBasicMaterial color="#4273c4" linewidth={2} />
        </lineSegments>
      )}
    </group>
  );
}

function Skateboard() {
  const { currentSimulation, currentTime, selectedObjectId, selectObject } = useSimulationStore();
  const groupRef = useRef<THREE.Group>(null);
  const isSelected = selectedObjectId === 'skateboard';
  const rampAngle = currentSimulation?.physicsParams.rampAngle ?? 30;
  const dataPoints = currentSimulation?.dataPoints ?? [];
  const angleRad = (rampAngle * Math.PI) / 180;

  const handleClick = useCallback((e: THREE.Event) => {
    (e as unknown as { stopPropagation: () => void }).stopPropagation();
    selectObject('skateboard');
  }, [selectObject]);

  const getInterpolatedPosition = useCallback((time: number) => {
    if (dataPoints.length === 0) return { x: 0, y: 0, alongRamp: 0 };

    if (time <= dataPoints[0].timestamp) {
      const p = dataPoints[0];
      const h = p.position * Math.sin(angleRad);
      return { x: p.position * Math.cos(angleRad), y: h + 0.15, alongRamp: p.position };
    }

    if (time >= dataPoints[dataPoints.length - 1].timestamp) {
      const p = dataPoints[dataPoints.length - 1];
      const h = p.position * Math.sin(angleRad);
      return { x: p.position * Math.cos(angleRad), y: h + 0.15, alongRamp: p.position };
    }

    for (let i = 0; i < dataPoints.length - 1; i++) {
      if (time >= dataPoints[i].timestamp && time <= dataPoints[i + 1].timestamp) {
        const t = (time - dataPoints[i].timestamp) / (dataPoints[i + 1].timestamp - dataPoints[i].timestamp);
        const pos = dataPoints[i].position + t * (dataPoints[i + 1].position - dataPoints[i].position);
        const h = pos * Math.sin(angleRad);
        return { x: pos * Math.cos(angleRad), y: h + 0.15, alongRamp: pos };
      }
    }

    return { x: 0, y: 0, alongRamp: 0 };
  }, [dataPoints, angleRad]);

  useFrame(() => {
    if (!groupRef.current) return;
    const pos = getInterpolatedPosition(currentTime);
    groupRef.current.position.set(pos.x, pos.y, 0);
    groupRef.current.rotation.z = -angleRad;
  });

  const wheelPositions: [number, number, number][] = [
    [-0.25, -0.04, 0.1],
    [-0.25, -0.04, -0.1],
    [0.25, -0.04, 0.1],
    [0.25, -0.04, -0.1],
  ];

  return (
    <group ref={groupRef} onClick={handleClick}>
      <mesh castShadow>
        <boxGeometry args={[0.8, 0.05, 0.3]} />
        <meshStandardMaterial
          color="#ff8c42"
          emissive={isSelected ? '#4273c4' : '#000000'}
          emissiveIntensity={isSelected ? 0.6 : 0}
        />
      </mesh>
      {wheelPositions.map((pos, i) => (
        <mesh key={i} position={pos} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 0.04, 16]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
      ))}
      {isSelected && (
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(0.82, 0.07, 0.32)]} />
          <lineBasicMaterial color="#4273c4" linewidth={2} />
        </lineSegments>
      )}
    </group>
  );
}

function EnergyTrail() {
  const { currentSimulation, currentTime } = useSimulationStore();
  const pointsRef = useRef<THREE.Points>(null);
  const dataPoints = currentSimulation?.dataPoints ?? [];
  const rampAngle = currentSimulation?.physicsParams.rampAngle ?? 30;
  const angleRad = (rampAngle * Math.PI) / 180;
  const maxTrailPoints = 80;

  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(maxTrailPoints * 3);
    const col = new Float32Array(maxTrailPoints * 3);
    return { positions: pos, colors: col };
  }, [maxTrailPoints]);

  useFrame(() => {
    if (!pointsRef.current || dataPoints.length === 0) return;

    const geometry = pointsRef.current.geometry;
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geometry.getAttribute('color') as THREE.BufferAttribute;

    let trailIndex = 0;
    const blue = new THREE.Color('#4273c4');
    const orange = new THREE.Color('#ff8c42');

    for (let i = 0; i < dataPoints.length && trailIndex < maxTrailPoints; i++) {
      if (dataPoints[i].timestamp > currentTime) break;
      if (i % Math.max(1, Math.floor(dataPoints.length / maxTrailPoints)) !== 0 && i !== 0) continue;

      const p = dataPoints[i];
      const h = p.position * Math.sin(angleRad);
      posAttr.setXYZ(trailIndex, p.position * Math.cos(angleRad), h + 0.3, 0);

      const ke = p.kineticEnergy;
      const pe = p.potentialEnergy;
      const total = ke + pe;
      const ratio = total > 0 ? ke / total : 0;
      const c = blue.clone().lerp(orange, ratio);
      colAttr.setXYZ(trailIndex, c.r, c.g, c.b);

      trailIndex++;
    }

    for (let i = trailIndex; i < maxTrailPoints; i++) {
      posAttr.setXYZ(i, 0, -100, 0);
      colAttr.setXYZ(i, 0, 0, 0);
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    geometry.setDrawRange(0, trailIndex);
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={maxTrailPoints}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={maxTrailPoints}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.08} vertexColors sizeAttenuation transparent opacity={0.8} />
    </points>
  );
}

function EnergyBars() {
  const { currentSimulation, currentTime } = useSimulationStore();
  const dataPoints = currentSimulation?.dataPoints ?? [];
  const meshRef = useRef<THREE.Group>(null);

  const currentPoint = useMemo(() => {
    if (dataPoints.length === 0) return null;
    for (let i = 0; i < dataPoints.length - 1; i++) {
      if (currentTime >= dataPoints[i].timestamp && currentTime <= dataPoints[i + 1].timestamp) {
        const t = (currentTime - dataPoints[i].timestamp) / (dataPoints[i + 1].timestamp - dataPoints[i].timestamp);
        return {
          potentialEnergy: dataPoints[i].potentialEnergy + t * (dataPoints[i + 1].potentialEnergy - dataPoints[i].potentialEnergy),
          kineticEnergy: dataPoints[i].kineticEnergy + t * (dataPoints[i + 1].kineticEnergy - dataPoints[i].kineticEnergy),
          frictionLoss: dataPoints[i].frictionLoss + t * (dataPoints[i + 1].frictionLoss - dataPoints[i].frictionLoss),
          airDragLoss: dataPoints[i].airDragLoss + t * (dataPoints[i + 1].airDragLoss - dataPoints[i].airDragLoss),
          totalEnergy: dataPoints[i].totalEnergy + t * (dataPoints[i + 1].totalEnergy - dataPoints[i].totalEnergy),
        };
      }
    }
    if (currentTime <= dataPoints[0].timestamp) return dataPoints[0];
    return dataPoints[dataPoints.length - 1];
  }, [dataPoints, currentTime]);

  const totalE = currentPoint?.totalEnergy ?? 1;
  const barMaxHeight = 3;

  const peRatio = currentPoint ? currentPoint.potentialEnergy / totalE : 0;
  const keRatio = currentPoint ? currentPoint.kineticEnergy / totalE : 0;
  const lossRatio = currentPoint ? (currentPoint.frictionLoss + currentPoint.airDragLoss) / totalE : 0;

  return (
    <group ref={meshRef} position={[-4, 0, 0]}>
      <Text position={[0, barMaxHeight + 0.4, 0]} fontSize={0.18} color="#4273c4" anchorX="center">
        势能
      </Text>
      <mesh position={[0, (peRatio * barMaxHeight) / 2, 0]}>
        <boxGeometry args={[0.25, peRatio * barMaxHeight || 0.01, 0.25]} />
        <meshStandardMaterial color="#4273c4" emissive="#4273c4" emissiveIntensity={0.3} />
      </mesh>

      <Text position={[0.5, barMaxHeight + 0.4, 0]} fontSize={0.18} color="#ff8c42" anchorX="center">
        动能
      </Text>
      <mesh position={[0.5, (keRatio * barMaxHeight) / 2, 0]}>
        <boxGeometry args={[0.25, keRatio * barMaxHeight || 0.01, 0.25]} />
        <meshStandardMaterial color="#ff8c42" emissive="#ff8c42" emissiveIntensity={0.3} />
      </mesh>

      <Text position={[1.0, barMaxHeight + 0.4, 0]} fontSize={0.18} color="#ef4444" anchorX="center">
        损耗
      </Text>
      <mesh position={[1.0, (lossRatio * barMaxHeight) / 2, 0]}>
        <boxGeometry args={[0.25, lossRatio * barMaxHeight || 0.01, 0.25]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function SceneContent() {
  const { isPlaying, playbackSpeed, currentTime, setCurrentTime, currentSimulation } = useSimulationStore();
  const timeRef = useRef(currentTime);

  useFrame((_, delta) => {
    if (!isPlaying || !currentSimulation) return;
    const maxTime = currentSimulation.dataPoints.length > 0
      ? currentSimulation.dataPoints[currentSimulation.dataPoints.length - 1].timestamp
      : 10;
    const newTime = timeRef.current + delta * playbackSpeed;
    if (newTime >= maxTime) {
      setCurrentTime(0);
      timeRef.current = 0;
    } else {
      setCurrentTime(newTime);
      timeRef.current = newTime;
    }
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        intensity={1.0}
        position={[10, 10, 5]}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <Environment preset="city" />

      <Grid
        position={[0, -0.01, 0]}
        args={[20, 20]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#6f6f6f"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#9d4b4b"
        fadeDistance={30}
        fadeStrength={1}
        infiniteGrid
      />

      <Ramp />
      <Skateboard />
      <EnergyTrail />
      <EnergyBars />

      <OrbitControls
        makeDefault
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2 - 0.1}
        minDistance={3}
        maxDistance={20}
      />
    </>
  );
}

export default function RampScene() {
  return (
    <Canvas shadows camera={{ position: [8, 6, 8], fov: 50 }} gl={{ antialias: true }}>
      <SceneContent />
    </Canvas>
  );
}
