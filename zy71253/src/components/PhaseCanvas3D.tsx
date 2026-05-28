import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Text, Billboard } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useStore } from '@/store/useStore';
import { EQ_TYPE_COLORS, EQ_TYPE_LABELS, type EqType } from '@/utils/mathEngine';

function PhaseGrid() {
  const lines = useMemo(() => {
    const result: JSX.Element[] = [];
    const range = 5;
    const step = 1;
    for (let i = -range; i <= range; i += step) {
      result.push(
        <Line
          key={`h${i}`}
          points={[[-range, i, 0], [range, i, 0]]}
          color={i === 0 ? '#334455' : '#1a2a3a'}
          lineWidth={i === 0 ? 2 : 1}
        />
      );
      result.push(
        <Line
          key={`v${i}`}
          points={[[i, -range, 0], [i, range, 0]]}
          color={i === 0 ? '#334455' : '#1a2a3a'}
          lineWidth={i === 0 ? 2 : 1}
        />
      );
    }
    return result;
  }, []);

  return <group>{lines}</group>;
}

function AxisLabels() {
  const labels = useMemo(() => {
    const result: JSX.Element[] = [];
    for (let i = -4; i <= 4; i += 2) {
      if (i === 0) continue;
      result.push(
        <Billboard key={`xl${i}`} position={[i, -0.4, 0]}>
          <Text fontSize={0.3} color="#667788" anchorX="center" anchorY="middle">
            {i}
          </Text>
        </Billboard>
      );
      result.push(
        <Billboard key={`yl${i}`} position={[-0.4, i, 0]}>
          <Text fontSize={0.3} color="#667788" anchorX="center" anchorY="middle">
            {i}
          </Text>
        </Billboard>
      );
    }
    result.push(
      <Billboard key="xlabel" position={[5.3, -0.4, 0]}>
        <Text fontSize={0.35} color="#FF6B4A" anchorX="center" anchorY="middle" fontWeight="bold">
          x
        </Text>
      </Billboard>
    );
    result.push(
      <Billboard key="ylabel" position={[-0.4, 5.3, 0]}>
        <Text fontSize={0.35} color="#00D4AA" anchorX="center" anchorY="middle" fontWeight="bold">
          y
        </Text>
      </Billboard>
    );
    return result;
  }, []);

  return <group>{labels}</group>;
}

function VectorFieldArrows() {
  const vectorField = useStore((s) => s.vectorField);

  const arrows = useMemo(() => {
    return vectorField.map((v, i) => {
      const mag = Math.sqrt(v.dx * v.dx + v.dy * v.dy);
      if (mag < 0.01) return null;
      const len = Math.min(mag * 0.8, 0.4);
      const nx = v.dx / mag;
      const ny = v.dy / mag;
      return (
        <group key={i} position={[v.x, v.y, 0.01]}>
          <Line
            points={[[0, 0, 0], [nx * len, ny * len, 0]]}
            color="#2a4a5a"
            lineWidth={1}
          />
        </group>
      );
    });
  }, [vectorField]);

  return <group>{arrows}</group>;
}

function TrajectoryLine() {
  const trajectories = useStore((s) => s.trajectories);
  const playbackStep = useStore((s) => s.playbackStep);

  const visiblePoints = useMemo(() => {
    const end = Math.min(playbackStep + 1, trajectories.length);
    if (end < 2) return [];
    return trajectories.slice(0, end).map((p) => new THREE.Vector3(p.x, p.y, 0.02));
  }, [trajectories, playbackStep]);

  if (visiblePoints.length < 2) return null;

  return (
    <Line
      points={visiblePoints}
      color="#FF6B4A"
      lineWidth={2.5}
      dashed={false}
    />
  );
}

function TrajectoryHead() {
  const trajectories = useStore((s) => s.trajectories);
  const playbackStep = useStore((s) => s.playbackStep);
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(1 + Math.sin(Date.now() * 0.005) * 0.15);
    }
  });

  if (playbackStep >= trajectories.length) return null;
  const pt = trajectories[Math.min(playbackStep, trajectories.length - 1)];
  if (!pt) return null;

  return (
    <mesh ref={meshRef} position={[pt.x, pt.y, 0.04]}>
      <sphereGeometry args={[0.12, 16, 16]} />
      <meshStandardMaterial color="#FF6B4A" emissive="#FF6B4A" emissiveIntensity={2} />
    </mesh>
  );
}

function EquilibriumMarkers() {
  const equilibria = useStore((s) => s.equilibria);

  return (
    <group>
      {equilibria.map((eq) => {
        const color = EQ_TYPE_COLORS[eq.type] || '#888888';
        return (
          <group key={eq.id} position={[eq.x, eq.y, 0.03]}>
            <mesh>
              <sphereGeometry args={[0.18, 24, 24]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={3}
                transparent
                opacity={0.9}
              />
            </mesh>
            <Billboard position={[0, 0.45, 0]}>
              <Text fontSize={0.28} color={color} anchorX="center" anchorY="bottom" fontWeight="bold">
                {EQ_TYPE_LABELS[eq.type]}
              </Text>
            </Billboard>
            <Billboard position={[0, -0.35, 0]}>
              <Text fontSize={0.2} color="#aabbcc" anchorX="center" anchorY="top">
                {`(${eq.x.toFixed(1)}, ${eq.y.toFixed(1)})`}
              </Text>
            </Billboard>
          </group>
        );
      })}
    </group>
  );
}

function StabilityRegion() {
  const equilibria = useStore((s) => s.equilibria);
  const isStable = equilibria.length > 0 && (
    equilibria[0].type === 'stable_node' ||
    equilibria[0].type === 'stable_spiral' ||
    equilibria[0].type === 'center'
  );

  if (!isStable) return null;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.01]}>
      <circleGeometry args={[4.5, 64]} />
      <meshStandardMaterial
        color="#00D4AA"
        transparent
        opacity={0.06}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function InitialConditionMarker() {
  const ic = useStore((s) => s.initialCondition);

  return (
    <group position={[ic.x0, ic.y0, 0.05]}>
      <mesh>
        <ringGeometry args={[0.1, 0.18, 24]} />
        <meshStandardMaterial color="#FFB84D" emissive="#FFB84D" emissiveIntensity={1} side={THREE.DoubleSide} />
      </mesh>
      <Billboard position={[0, 0.4, 0]}>
        <Text fontSize={0.22} color="#FFB84D" anchorX="center" anchorY="bottom">
          初值
        </Text>
      </Billboard>
    </group>
  );
}

function Stars() {
  const positions = useMemo(() => {
    const pos = new Float32Array(300);
    for (let i = 0; i < 300; i += 3) {
      pos[i] = (Math.random() - 0.5) * 40;
      pos[i + 1] = (Math.random() - 0.5) * 40;
      pos[i + 2] = -10 - Math.random() * 20;
    }
    return pos;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={100}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#446688" sizeAttenuation />
    </points>
  );
}

function SceneContent() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 10]} intensity={0.8} />
      <Stars />
      <PhaseGrid />
      <AxisLabels />
      <VectorFieldArrows />
      <StabilityRegion />
      <TrajectoryLine />
      <TrajectoryHead />
      <EquilibriumMarkers />
      <InitialConditionMarker />
      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate
        maxPolarAngle={Math.PI / 2}
        minDistance={3}
        maxDistance={25}
      />
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.4}
          luminanceSmoothing={0.9}
          intensity={1.2}
        />
      </EffectComposer>
    </>
  );
}

export default function PhaseCanvas3D() {
  return (
    <div className="w-full h-full bg-[#060e1a]">
      <Canvas
        camera={{ position: [0, 0, 12], fov: 50, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#060e1a']} />
        <SceneContent />
      </Canvas>
    </div>
  );
}
