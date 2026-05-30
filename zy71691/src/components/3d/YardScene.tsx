import { useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import { useYardStore } from '@/store/useYardStore';
import { ContainerSlot3D } from './ContainerSlot3D';
import { Crane3D } from './Crane3D';
import { Truck3D } from './Truck3D';
import { RouteLine } from './RouteLine';
import * as THREE from 'three';

function CameraController() {
  const { camera } = useThree();
  const { cameraPosition, cameraTarget, setCameraPosition, setCameraTarget } = useYardStore();
  const controlsRef = useRef<any>(null);

  camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);

  return (
    <OrbitControls
      ref={controlsRef}
      target={[cameraTarget.x, cameraTarget.y, cameraTarget.z]}
      makeDefault
      minDistance={10}
      maxDistance={50}
      maxPolarAngle={Math.PI / 2.2}
      onEnd={() => {
        if (controlsRef.current) {
          setCameraPosition({
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
          });
          setCameraTarget({
            x: controlsRef.current.target.x,
            y: controlsRef.current.target.y,
            z: controlsRef.current.target.z,
          });
        }
      }}
    />
  );
}

function SceneContent() {
  const { getFilteredSlots, getFilteredCranes, getFilteredTrucks, conflicts, setSelectedObject } = useYardStore();

  const slots = getFilteredSlots();
  const cranes = getFilteredCranes();
  const trucks = getFilteredTrucks();

  const conflictObjectIds = conflicts
    .filter((c) => !c.resolved)
    .flatMap((c) => c.affectedObjects);

  const activeRoutes = trucks
    .filter((t) => t.currentRoute)
    .map((t) => t.currentRoute!);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[-10, 10, -10]} intensity={0.5} color="#4A90D9" />

      <CameraController />

      <Grid
        args={[50, 50]}
        cellSize={2}
        cellThickness={0.5}
        cellColor="#1a2a3a"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#0F4C81"
        fadeDistance={50}
        fadeStrength={1}
        followCamera={false}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#0a1520" />
      </mesh>

      <mesh position={[-15, 3, 0]}>
        <boxGeometry args={[1, 6, 12]} />
        <meshStandardMaterial color="#1a2530" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[15, 3, 0]}>
        <boxGeometry args={[1, 6, 12]} />
        <meshStandardMaterial color="#1a2530" metalness={0.8} roughness={0.3} />
      </mesh>

      {slots.map((slot) => (
        <ContainerSlot3D
          key={slot.id}
          slot={slot}
          isInConflict={conflictObjectIds.includes(slot.id)}
        />
      ))}

      {cranes.map((crane) => (
        <Crane3D
          key={crane.id}
          crane={crane}
          isInConflict={conflictObjectIds.includes(crane.id)}
        />
      ))}

      {trucks.map((truck) => (
        <Truck3D
          key={truck.id}
          truck={truck}
          isInConflict={conflictObjectIds.includes(truck.id)}
        />
      ))}

      {activeRoutes.map((route) => (
        <RouteLine key={route.id} route={route} />
      ))}

      <mesh
        position={[0, -0.5, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={() => setSelectedObject(null, null)}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </>
  );
}

export function YardScene() {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 15, 20], fov: 50 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#0a0f1a' }}
    >
      <fog attach="fog" args={['#0a0f1a', 30, 60]} />
      <SceneContent />
    </Canvas>
  );
}
