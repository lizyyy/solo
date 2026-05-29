import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useSimulationStore } from '../store/simulationStore';

function Coil({ turns, radius, selected, onClick }: {
  turns: number;
  radius: number;
  selected: boolean;
  onClick: () => void;
}) {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const coilTurns = Math.max(1, Math.min(turns / 20, 10));
    const height = coilTurns * 0.3;
    
    for (let i = 0; i <= 1000; i++) {
      const t = i / 1000;
      const angle = t * Math.PI * 2 * coilTurns;
      const y = (t - 0.5) * height;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      pts.push(new THREE.Vector3(x, y, z));
    }
    return pts;
  }, [turns, radius]);

  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [points]);

  return (
    <group onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <primitive object={new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: selected ? '#3b82f6' : '#f59e0b' }))} />
      {selected && (
        <mesh position={[0, 0, 0]}>
          <ringGeometry args={[radius * 0.9, radius * 1.1, 64]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function Magnet({ strength, velocity, direction, isPlaying, selected, onClick }: {
  strength: number;
  velocity: number;
  direction: number;
  isPlaying: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    if (groupRef.current && isPlaying) {
      timeRef.current += delta * velocity * direction;
      const offset = Math.sin(timeRef.current) * 2;
      groupRef.current.position.x = offset;
    }
  });

  const magnetColor = strength > 0.5 ? '#dc2626' : '#f97316';

  return (
    <group onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <group ref={groupRef}>
        <mesh position={[-0.5, 0, 0]}>
          <boxGeometry args={[1, 0.8, 0.8]} />
          <meshStandardMaterial color={magnetColor} metalness={0.5} roughness={0.3} />
        </mesh>
        <mesh position={[0.5, 0, 0]}>
          <boxGeometry args={[1, 0.8, 0.8]} />
          <meshStandardMaterial color="#3b82f6" metalness={0.5} roughness={0.3} />
        </mesh>
        {selected && (
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[2.2, 1, 1]} />
            <meshBasicMaterial color="#3b82f6" transparent opacity={0.2} />
          </mesh>
        )}
      </group>
      <FieldLines strength={strength} />
    </group>
  );
}

function FieldLines({ strength }: { strength: number }) {
  const lineObjects = useMemo(() => {
    const lineGroup: THREE.Line[] = [];
    const numLines = Math.floor(strength * 10) + 3;
    
    for (let i = 0; i < numLines; i++) {
      const angle = (i / numLines) * Math.PI * 2;
      const points: THREE.Vector3[] = [];
      const startRadius = 0.6;
      
      for (let t = 0; t <= 1; t += 0.05) {
        const r = startRadius + t * 3;
        const spread = t * t * 2;
        const x = -1 + t * 2;
        const y = Math.cos(angle) * (0.5 + spread) * (1 - t * 0.5);
        const z = Math.sin(angle) * (0.5 + spread) * (1 - t * 0.5);
        points.push(new THREE.Vector3(x, y, z));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: '#60a5fa', transparent: true, opacity: 0.5 });
      lineGroup.push(new THREE.Line(geometry, material));
    }
    return lineGroup;
  }, [strength]);

  return (
    <group>
      {lineObjects.map((line, i) => (
        <primitive key={i} object={line} />
      ))}
    </group>
  );
}

function GridFloor() {
  return (
    <gridHelper args={[20, 20, '#475569', '#334155']} position={[0, -1.5, 0]} />
  );
}

function SceneContent() {
  const { params, selectedObject, selectObject, isPlaying } = useSimulationStore((state) => ({
    params: state.session.params,
    selectedObject: state.selectedObject,
    selectObject: state.selectObject,
    isPlaying: state.isPlaying,
  }));

  const coilRadius = Math.sqrt(params.area / Math.PI) * 10;

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <pointLight position={[-5, 3, -5]} intensity={0.5} />
      
      <Coil
        turns={params.turns}
        radius={coilRadius}
        selected={selectedObject === 'coil'}
        onClick={() => selectObject(selectedObject === 'coil' ? null : 'coil')}
      />
      
      <Magnet
        strength={params.fieldStrength}
        velocity={params.velocity}
        direction={params.direction}
        isPlaying={isPlaying}
        selected={selectedObject === 'magnet'}
        onClick={() => selectObject(selectedObject === 'magnet' ? null : 'magnet')}
      />
      
      <GridFloor />
      
      <OrbitControls 
        enablePan={false}
        minDistance={3}
        maxDistance={15}
      />
    </>
  );
}

export function Scene3D() {
  return (
    <div className="w-full h-full bg-slate-900 rounded-lg overflow-hidden">
      <Canvas
        camera={{ position: [5, 3, 5], fov: 50 }}
        onClick={() => useSimulationStore.getState().selectObject(null)}
      >
        <color attach="background" args={['#0f172a']} />
        <fog attach="fog" args={['#0f172a', 10, 30]} />
        <SceneContent />
      </Canvas>
    </div>
  );
}
