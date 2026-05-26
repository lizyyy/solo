import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Float, Text } from '@react-three/drei';
import type { Group } from 'three';
import * as THREE from 'three';

function MedicineCabinet({ position, color = '#ffffff', index = 0 }: { position: [number, number, number]; color?: string; index?: number }) {
  const groupRef = useRef<Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5 + index) * 0.02;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 2.5, 0.4]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} />
      </mesh>
      
      {[-0.4, 0.4].map((x, i) => (
        <mesh key={i} position={[x, 0.3, 0.21]} castShadow>
          <boxGeometry args={[0.5, 1, 0.02]} />
          <meshStandardMaterial color="#e8f0fe" roughness={0.3} metalness={0.2} transparent opacity={0.9} />
        </mesh>
      ))}
      
      {[-0.6, 0.2, 1].map((y, i) => (
        <mesh key={i} position={[0, y, 0.22]} castShadow>
          <boxGeometry args={[1.1, 0.02, 0.35]} />
          <meshStandardMaterial color="#d0d0d0" roughness={0.6} />
        </mesh>
      ))}
      
      {[-0.5, -0.25, 0, 0.25, 0.5].map((y, yi) => (
        [-0.3, 0.3].map((x, xi) => (
          <mesh key={`${yi}-${xi}`} position={[x, y, 0.3]} castShadow>
            <boxGeometry args={[0.15, 0.12, 0.08]} />
            <meshStandardMaterial 
              color={['#165DFF', '#36CFC9', '#F7BA1E', '#F53F3F', '#722ED1', '#14C9C9'][yi + xi % 6]} 
              roughness={0.4} 
            />
          </mesh>
        ))
      ))}
    </group>
  );
}

function Counter() {
  return (
    <group position={[0, -0.5, 0]}>
      <mesh position={[0, 0, 0]} receiveShadow castShadow>
        <boxGeometry args={[6, 0.1, 2.5]} />
        <meshStandardMaterial color="#8B6914" roughness={0.8} />
      </mesh>
      
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[5.8, 0.02, 2.3]} />
        <meshStandardMaterial color="#A0522D" roughness={0.6} />
      </mesh>
      
      <mesh position={[-2.8, 0.55, 0]} castShadow>
        <boxGeometry args={[0.1, 1, 2.5]} />
        <meshStandardMaterial color="#6B4423" roughness={0.7} />
      </mesh>
      
      <mesh position={[2.8, 0.55, 0]} castShadow>
        <boxGeometry args={[0.1, 1, 2.5]} />
        <meshStandardMaterial color="#6B4423" roughness={0.7} />
      </mesh>
      
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[6, 0.1, 2.5]} />
        <meshStandardMaterial color="#6B4423" roughness={0.7} />
      </mesh>
    </group>
  );
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#f0f0f0" roughness={0.9} />
    </mesh>
  );
}

function Walls() {
  return (
    <>
      <mesh position={[0, 1.5, -6]} receiveShadow>
        <planeGeometry args={[20, 8]} />
        <meshStandardMaterial color="#e8f4ff" roughness={0.95} />
      </mesh>
      
      <mesh position={[-8, 1.5, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[12, 8]} />
        <meshStandardMaterial color="#e8f4ff" roughness={0.95} />
      </mesh>
      
      <mesh position={[8, 1.5, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[12, 8]} />
        <meshStandardMaterial color="#e8f4ff" roughness={0.95} />
      </mesh>
    </>
  );
}

function CeilingLight({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.1, 16]} />
        <meshStandardMaterial color="#ffffff" emissive="#fff8e7" emissiveIntensity={0.3} />
      </mesh>
      <pointLight position={[0, -0.3, 0]} intensity={0.5} color="#fff8e7" distance={8} />
    </group>
  );
}

function CrossLogo() {
  return (
    <group position={[0, 3.5, -5.8]}>
      <mesh>
        <boxGeometry args={[0.8, 0.15, 0.1]} />
        <meshStandardMaterial color="#F53F3F" emissive="#F53F3F" emissiveIntensity={0.2} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.15, 0.8, 0.1]} />
        <meshStandardMaterial color="#F53F3F" emissive="#F53F3F" emissiveIntensity={0.2} />
      </mesh>
      <Text
        position={[0, -0.7, 0]}
        fontSize={0.25}
        color="#165DFF"
        anchorX="center"
        anchorY="middle"
      >
        药房配药校验
      </Text>
    </group>
  );
}

function SceneContent({ isPaused }: { isPaused: boolean }) {
  const cabinetPositions = useMemo<[number, number, number][]>(() => [
    [-4, 0.5, -5],
    [-2.5, 0.5, -5],
    [-1, 0.5, -5],
    [1, 0.5, -5],
    [2.5, 0.5, -5],
    [4, 0.5, -5],
  ], []);

  const lightPositions = useMemo<[number, number, number][]>(() => [
    [-3, 3.8, -3],
    [0, 3.8, -3],
    [3, 3.8, -3],
  ], []);

  useFrame((_, delta) => {
    if (isPaused) return;
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight 
        position={[5, 8, 5]} 
        intensity={1} 
        castShadow 
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={30}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      
      <Environment preset="apartment" />
      
      <Floor />
      <Walls />
      <Counter />
      <CrossLogo />
      
      {cabinetPositions.map((pos, i) => (
        <MedicineCabinet key={i} position={pos} index={i} />
      ))}
      
      {lightPositions.map((pos, i) => (
        <CeilingLight key={i} position={pos} />
      ))}
      
      <Float speed={1} rotationIntensity={0.2} floatIntensity={0.3}>
        <group position={[0, 0.2, 1]}>
          <mesh position={[0, 0, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.12, 0.3, 16]} />
            <meshStandardMaterial color="#165DFF" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.18, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.08, 0.05, 16]} />
            <meshStandardMaterial color="#ffffff" roughness={0.3} />
          </mesh>
        </group>
      </Float>
      
      <OrbitControls 
        enablePan={false} 
        enableZoom={false} 
        enableRotate={false}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2.5}
      />
    </>
  );
}

export function PharmacyScene({ isPaused = false }: { isPaused?: boolean }) {
  return (
    <div className="absolute inset-0 -z-10">
      <Canvas
        shadows
        camera={{ position: [0, 2, 6], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#e8f4ff']} />
        <fog attach="fog" args={['#e8f4ff', 10, 25]} />
        <SceneContent isPaused={isPaused} />
      </Canvas>
    </div>
  );
}
