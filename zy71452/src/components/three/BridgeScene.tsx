import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { BridgeMesh } from './BridgeMesh';
import { Nodes } from './Nodes';
import { LoadIndicator } from './LoadIndicator';
import { useBridgeStore } from '@/store/useBridgeStore';
import * as THREE from 'three';

function Ground() {
  const model = useBridgeStore(state => state.model);
  const length = model?.length || 100;
  
  return (
    <group>
      <gridHelper args={[length + 40, 40, 0x334155, 0x1e293b]} position={[0, -0.01, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[length + 60, length + 60]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
    </group>
  );
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[30, 50, 30]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-20, 20, -20]} intensity={0.3} />
      <pointLight position={[0, 30, 0]} intensity={0.3} color="#60a5fa" />
    </>
  );
}

export function BridgeScene() {
  const selectNode = useBridgeStore(state => state.selectNode);
  const selectElement = useBridgeStore(state => state.selectElement);

  return (
    <Canvas
      camera={{ position: [60, 40, 60], fov: 50 }}
      onPointerMissed={() => {
        selectNode(null);
        selectElement(null);
      }}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={['#0f172a']} />
      <fog attach="fog" args={['#0f172a', 100, 250]} />
      
      <Lights />
      <Environment preset="city" />
      
      <BridgeMesh />
      <Nodes />
      <LoadIndicator />
      <Ground />
      
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={20}
        maxDistance={200}
        maxPolarAngle={Math.PI / 2 - 0.1}
        target={new THREE.Vector3(0, 5, 0)}
      />
    </Canvas>
  );
}
