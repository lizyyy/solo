import React, { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { useSimulationStore } from '@/store/simulationStore';
import Building3D from './Building3D';
import Classroom3D from './Classroom3D';
import Stair3D from './Stair3D';
import AssemblyPoint3D from './AssemblyPoint3D';
import Student3D from './Student3D';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

const CameraController: React.FC = () => {
  const { camera } = useThree();
  const cameraView = useSimulationStore(state => state.cameraView);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  
  useEffect(() => {
    const positions: Record<string, { x: number; y: number; z: number }> = {
      overview: { x: 0, y: 40, z: 40 },
      top: { x: 0, y: 60, z: 0.1 },
      front: { x: 0, y: 15, z: 50 },
      side: { x: 50, y: 15, z: 0 },
      free: { x: 0, y: 40, z: 40 },
    };
    
    if (cameraView !== 'free') {
      const pos = positions[cameraView];
      camera.position.set(pos.x, pos.y, pos.z);
      camera.lookAt(0, 5, 0);
    }
  }, [cameraView, camera]);
  
  return (
    <OrbitControls 
      ref={controlsRef}
      enableDamping 
      dampingFactor={0.05}
      minDistance={10}
      maxDistance={100}
      maxPolarAngle={Math.PI / 2.1}
    />
  );
};

const AnimationLoop: React.FC = () => {
  const updateSimulation = useSimulationStore(state => state.updateSimulation);
  const lastTimeRef = useRef(performance.now());
  
  useFrame(() => {
    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTimeRef.current) / 1000;
    lastTimeRef.current = currentTime;
    
    updateSimulation(deltaTime);
  });
  
  return null;
};

const ConflictHighlight: React.FC = () => {
  const conflicts = useSimulationStore(state => state.conflicts);
  const selectedPlan = useSimulationStore(state => state.selectedPlan);
  
  if (!selectedPlan) return null;
  
  return (
    <group>
      {conflicts.filter(c => !c.resolved).map((conflict, idx) => {
        let position: { x: number; y: number; z: number } = { x: 0, y: 5, z: 0 };
        
        if (conflict.type === 'stairCapacity') {
          const stair = selectedPlan.stairs.find(s => s.name === conflict.location);
          if (stair) {
            position = { x: stair.position.x, y: 8, z: stair.position.z - 5 };
          }
        } else if (conflict.type === 'assemblyCapacity') {
          position = { x: 0, y: 3, z: -25 };
        }
        
        return (
          <mesh key={conflict.id} position={[position.x, position.y + idx * 3, position.z]}>
            <coneGeometry args={[1, 2, 4]} />
            <meshBasicMaterial 
              color={conflict.severity === 'critical' ? '#ef4444' : '#f59e0b'} 
              transparent 
              opacity={0.8} 
            />
          </mesh>
        );
      })}
    </group>
  );
};

const SimulationScene: React.FC = () => {
  return (
    <Canvas
      camera={{ position: [0, 40, 40], fov: 50 }}
      gl={{ antialias: true }}
      shadows
    >
      <color attach="background" args={['#0f172a']} />
      <fog attach="fog" args={['#0f172a', 50, 150]} />
      
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[20, 40, 20]} 
        intensity={1} 
        castShadow 
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[-20, 20, -20]} intensity={0.5} color="#60a5fa" />
      
      <Grid 
        infiniteGrid 
        cellSize={5} 
        cellThickness={0.5} 
        cellColor="#1e293b" 
        sectionSize={25} 
        sectionThickness={1} 
        sectionColor="#334155" 
        fadeDistance={80} 
        fadeStrength={5} 
      />
      
      <CameraController />
      <AnimationLoop />
      
      <Building3D />
      <Classroom3D />
      <Stair3D />
      <AssemblyPoint3D />
      <Student3D />
      <ConflictHighlight />
    </Canvas>
  );
};

export default SimulationScene;
