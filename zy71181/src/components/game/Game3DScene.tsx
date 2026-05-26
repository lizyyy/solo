import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';
import { SLOPE_COLORS, INJURY_COLORS } from '../../game/types';

interface SlopeMeshProps {
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: string;
  isOpen: boolean;
}

function SlopeMesh({ start, end, color, isOpen }: SlopeMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

    const geom = new THREE.BoxGeometry(8, 0.5, length);
    geom.translate(midPoint.x, midPoint.y - 0.25, midPoint.z);
    geom.lookAt(end);
    return geom;
  }, [start, end]);

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        color={isOpen ? color : '#666666'}
        transparent
        opacity={isOpen ? 0.8 : 0.4}
      />
    </mesh>
  );
}

interface PatrollerMeshProps {
  position: THREE.Vector3;
  isSelected: boolean;
  status: string;
}

function PatrollerMesh({ position, isSelected, status }: PatrollerMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const color = status === 'idle' ? '#22c55e' : status === 'dispatched' ? '#3b82f6' : '#f59e0b';

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
    }
  });

  return (
    <group ref={groupRef} position={[position.x, position.y, position.z]}>
      <mesh>
        <coneGeometry args={[0.5, 1.5, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {isSelected && (
        <mesh position={[0, 1.5, 0]}>
          <ringGeometry args={[0.6, 0.8, 32]} />
          <meshBasicMaterial color="#ffff00" side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

interface VictimMeshProps {
  position: THREE.Vector3;
  isSelected: boolean;
  injury: string;
  isRescued: boolean;
  onClick: () => void;
}

function VictimMesh({ position, isSelected, injury, isRescued, onClick }: VictimMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const color = INJURY_COLORS[injury as keyof typeof INJURY_COLORS] || '#888888';

  useFrame((state) => {
    if (groupRef.current && !isRescued) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
  });

  if (isRescued) return null;

  return (
    <group
      ref={groupRef}
      position={[position.x, position.y + 0.3, position.z]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <mesh>
        <octahedronGeometry args={[0.6, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      {isSelected && (
        <mesh position={[0, 1, 0]}>
          <torusGeometry args={[0.8, 0.1, 8, 32]} />
          <meshBasicMaterial color="#ffff00" />
        </mesh>
      )}
    </group>
  );
}

function SnowParticles() {
  const count = 1000;
  const snowRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 200;
      pos[i * 3 + 1] = Math.random() * 50;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    return pos;
  }, []);

  useFrame(() => {
    if (snowRef.current) {
      const posArray = snowRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        posArray[i * 3 + 1] -= 0.1;
        if (posArray[i * 3 + 1] < 0) {
          posArray[i * 3 + 1] = 50;
        }
      }
      snowRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <points ref={snowRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.2} color="#ffffff" transparent opacity={0.8} />
    </points>
  );
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial color="#f0f5ff" />
    </mesh>
  );
}

function Mountain() {
  const geometry = useMemo(() => {
    const geom = new THREE.ConeGeometry(80, 60, 8);
    geom.translate(0, 25, -50);
    return geom;
  }, []);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#d0e0ff" />
    </mesh>
  );
}

function SceneContent() {
  const { gameState, selectVictim } = useGameStore();

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[50, 50, 25]} intensity={1} castShadow />
      <Sky sunPosition={[100, 20, 100]} />
      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />

      <Ground />
      <Mountain />

      {gameState.slopes.map((slope) => (
        <SlopeMesh
          key={slope.id}
          start={new THREE.Vector3(slope.start.x, slope.start.y, slope.start.z)}
          end={new THREE.Vector3(slope.end.x, slope.end.y, slope.end.z)}
          color={SLOPE_COLORS[slope.difficulty]}
          isOpen={slope.isOpen}
        />
      ))}

      {gameState.patrollers.map((patroller) => (
        <PatrollerMesh
          key={patroller.id}
          position={new THREE.Vector3(
            patroller.position.x,
            patroller.position.y,
            patroller.position.z
          )}
          isSelected={gameState.selectedPatrollerId === patroller.id}
          status={patroller.status}
        />
      ))}

      {gameState.victims.map((victim) => (
        <VictimMesh
          key={victim.id}
          position={new THREE.Vector3(
            victim.position.x,
            victim.position.y,
            victim.position.z
          )}
          isSelected={gameState.selectedVictimId === victim.id}
          injury={victim.injury}
          isRescued={victim.isRescued}
          onClick={() => selectVictim(victim.id)}
        />
      ))}

      {gameState.weather !== 'clear' && <SnowParticles />}

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={10}
        maxDistance={100}
        autoRotate={false}
      />

      <fog attach="fog" args={['#87ceeb', 50, 150]} />
    </>
  );
}

export function Game3DScene() {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 30, 30], fov: 60 }}
        shadows
      >
        <SceneContent />
      </Canvas>
    </div>
  );
}
