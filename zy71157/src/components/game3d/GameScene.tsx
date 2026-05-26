import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useGameStore } from '@/store/useGameStore';
import { AirportEnvironment } from './AirportEnvironment';
import { ConveyorBelt } from './ConveyorBelt';
import { Baggage3d } from './Baggage3d';
import { FlightGate } from './FlightGate';
import { ConveyorSwitch } from './ConveyorSwitch';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';

const RotatingBox = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.5;
      meshRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 1.5, 0]}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} />
    </mesh>
  );
};

const GameContent = () => {
  const conveyorSegments = useGameStore(state => state.conveyorSegments);
  const baggages = useGameStore(state => state.baggages);
  const flights = useGameStore(state => state.flights);
  const gates = useGameStore(state => state.gates);
  const switches = useGameStore(state => state.switches);
  const switchStates = useGameStore(state => state.switchStates);

  const activeBaggages = useMemo(
    () => baggages.filter(b => b.status === 'moving' || b.status === 'waiting' || b.status === 'error'),
    [baggages]
  );

  return (
    <group>
      <AirportEnvironment />

      {conveyorSegments.map(segment => (
        <ConveyorBelt key={segment.id} segment={segment} />
      ))}

      {switches.map(sw => {
        const segment = conveyorSegments.find(s => s.id === sw.id);
        if (!segment) return null;
        const currentGateIdx = switchStates[sw.id] ? 
          (segment.switchOptions?.indexOf(switchStates[sw.id]) === 0 ? 0 : 1) : 0;
        const currentGate = sw.options[currentGateIdx];
        return (
          <ConveyorSwitch
            key={sw.id}
            segment={segment}
            gateOptions={sw.options}
            currentGate={currentGate}
          />
        );
      })}

      {gates.map(gate => {
        const flight = flights.find(f => f.gate === gate.id);
        return (
          <FlightGate
            key={gate.id}
            gateId={gate.id}
            position={[gate.position.x, 0, gate.position.z]}
            type={gate.type}
            flight={flight}
          />
        );
      })}

      {activeBaggages.map(baggage => (
        <Baggage3d key={baggage.id} baggage={baggage} />
      ))}
    </group>
  );
};

export const GameScene = () => {
  return (
    <div className="w-full" style={{ height: '100vh' }}>
      <Canvas
        camera={{ position: [0, 12, 15], fov: 55 }}
        style={{ background: '#1e3a5f' }}
      >
        <color attach="background" args={['#1e3a5f']} />
        <fog attach="fog" args={['#1e3a5f', 20, 50]} />
        
        <ambientLight intensity={0.8} />
        <directionalLight 
          position={[10, 20, 10]} 
          intensity={1.2} 
        />
        <pointLight position={[-5, 8, -5]} intensity={0.6} color="#93C5FD" />
        <pointLight position={[5, 8, 5]} intensity={0.4} color="#FCD34D" />
        
        <GameContent />
        
        <OrbitControls 
          enablePan={true} 
          minDistance={5} 
          maxDistance={30} 
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.1}
          makeDefault 
          target={[0, 0, -2]}
          enableDamping
          dampingFactor={0.05}
        />
      </Canvas>
    </div>
  );
};
