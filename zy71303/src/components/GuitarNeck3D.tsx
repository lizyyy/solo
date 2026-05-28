import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useWorkbenchStore } from '@/store/useWorkbenchStore';
import { STRING_COLORS } from '@/utils/presets';

const NECK_LENGTH = 10;
const NECK_WIDTH = 2;
const NECK_HEIGHT = 0.3;
const FRET_COUNT = 12;

function mapGaugeToRadius(gauge: number): number {
  const clamped = Math.max(0.25, Math.min(1.2, gauge));
  return 0.02 + ((clamped - 0.25) / 0.95) * 0.06;
}

function Fret({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[0.06, NECK_HEIGHT + 0.04, NECK_WIDTH * 0.88]} />
      <meshStandardMaterial color="#C0C0C0" metalness={0.8} roughness={0.3} />
    </mesh>
  );
}

function StringTube({
  index,
  stringData,
  result,
  isFiltered,
  isAnomalous,
}: {
  index: number;
  stringData: { id: number; gauge: number };
  result: { tension: number } | undefined;
  isFiltered: boolean;
  isAnomalous: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const color = STRING_COLORS[index] ?? '#ffffff';
  const radius = mapGaugeToRadius(stringData.gauge);
  const tension = result?.tension ?? 0;
  const emissiveIntensity = Math.min(tension / 30, 1) * 2;
  const zOffset = -NECK_WIDTH * 0.35 + (index * NECK_WIDTH * 0.7) / 5;

  useFrame((state) => {
    if (isAnomalous && meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      const pulse = Math.sin(state.clock.elapsedTime * 4) * 0.5 + 0.5;
      mat.emissive.setRGB(pulse, 0, 0);
      mat.emissiveIntensity = pulse * 2;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[0, NECK_HEIGHT / 2 + radius + 0.05, zOffset]}
      rotation={[0, 0, Math.PI / 2]}
      onClick={() => console.log(stringData.id)}
    >
      <cylinderGeometry args={[radius, radius, NECK_LENGTH, 16]} />
      <meshStandardMaterial
        color={isAnomalous ? '#ff0000' : color}
        emissive={isAnomalous ? '#ff0000' : color}
        emissiveIntensity={isAnomalous ? 1 : emissiveIntensity}
        transparent
        opacity={isFiltered ? 0.15 : 1}
      />
    </mesh>
  );
}

function GuitarNeck() {
  const strings = useWorkbenchStore((s) => s.strings);
  const results = useWorkbenchStore((s) => s.results);
  const filter = useWorkbenchStore((s) => s.filter);

  const frets = useMemo(() => {
    const arr: [number, number, number][] = [];
    for (let i = 1; i <= FRET_COUNT; i++) {
      const x = -NECK_LENGTH / 2 + (i / (FRET_COUNT + 1)) * NECK_LENGTH;
      arr.push([x, NECK_HEIGHT / 2 + 0.02, 0]);
    }
    return arr;
  }, []);

  const stringData = useMemo(() => {
    return strings.map((s, i) => {
      const result = results.find((r) => r.stringId === s.id);
      const isAnomalous = result?.isAnomalous ?? false;
      const tension = result?.tension ?? 0;
      let isFiltered = false;
      if (filter.stringIds.length > 0 && !filter.stringIds.includes(s.id)) isFiltered = true;
      if (filter.anomalyOnly && !isAnomalous) isFiltered = true;
      if (filter.tensionRange && (tension < filter.tensionRange[0] || tension > filter.tensionRange[1])) isFiltered = true;
      return { stringData: s, result, isFiltered, isAnomalous, index: i };
    });
  }, [strings, results, filter]);

  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[NECK_LENGTH, NECK_HEIGHT, NECK_WIDTH]} />
        <meshStandardMaterial color="#3E2723" roughness={0.8} />
      </mesh>
      <mesh position={[-NECK_LENGTH / 2 - 0.5, 0.05, 0]}>
        <boxGeometry args={[1.2, NECK_HEIGHT * 1.6, NECK_WIDTH * 1.1]} />
        <meshStandardMaterial color="#5D4037" roughness={0.7} />
      </mesh>
      <mesh position={[NECK_LENGTH / 2 + 0.3, 0.1, 0]}>
        <boxGeometry args={[0.6, NECK_HEIGHT * 1.8, NECK_WIDTH * 0.95]} />
        <meshStandardMaterial color="#4E342E" roughness={0.6} metalness={0.2} />
      </mesh>
      {frets.map((pos, i) => (
        <Fret key={i} position={pos} />
      ))}
      {stringData.map(({ stringData: s, result, isFiltered, isAnomalous, index }) => (
        <StringTube
          key={s.id}
          index={index}
          stringData={s}
          result={result}
          isFiltered={isFiltered}
          isAnomalous={isAnomalous}
        />
      ))}
    </group>
  );
}

function Scene() {
  return (
    <>
      <directionalLight position={[-5, 8, 3]} intensity={1.2} color="#FFF3E0" />
      <directionalLight position={[5, 2, -2]} intensity={0.6} color="#E3F2FD" />
      <ambientLight intensity={0.2} />
      <Environment preset="night" />
      <GuitarNeck />
      <OrbitControls
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.2}
        enableDamping
      />
      <EffectComposer>
        <Bloom luminanceThreshold={0.6} luminanceSmoothing={0.9} intensity={1.5} />
      </EffectComposer>
    </>
  );
}

export default function GuitarNeck3D() {
  return (
    <Canvas camera={{ position: [0, 5, 8], fov: 50 }}>
      <Scene />
    </Canvas>
  );
}
