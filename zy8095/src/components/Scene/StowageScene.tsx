import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { GridHelper, AxesHelper } from 'three';
import { BayMesh } from './BayMesh';
import { CargoMesh } from './CargoMesh';
import type { StowageState } from '@/types';
import { getBayLoad } from '@/calculator/stowageCalculator';

interface StowageSceneProps {
  state: StowageState;
  onBayClick: (bayId: string) => void;
  onCargoClick: (cargoId: string) => void;
}

export function StowageScene({ state, onBayClick, onCargoClick }: StowageSceneProps) {
  return (
    <Canvas camera={{ position: [15, 15, 15], fov: 50 }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} intensity={0.5} />
      
      <primitive object={new GridHelper(50, 50)} />
      <primitive object={new AxesHelper(10)} />
      
      {state.bays.map(bay => {
        const load = getBayLoad(bay.id, state);
        const loadPercentage = (load / bay.maxWeight) * 100;
        return (
          <BayMesh
            key={bay.id}
            bay={bay}
            onClick={() => onBayClick(bay.id)}
            loadPercentage={loadPercentage}
          />
        );
      })}
      
      {state.placements.map(placement => {
        const cargo = state.cargoItems.find(c => c.id === placement.cargoId);
        const bay = state.bays.find(b => b.id === placement.bayId);
        if (!cargo || !bay) return null;
        
        const absolutePosition = {
          x: bay.position.x + placement.position.x,
          y: bay.position.y + placement.position.y,
          z: bay.position.z + placement.position.z,
        };
        
        return (
          <CargoMesh
            key={placement.cargoId}
            cargo={cargo}
            position={absolutePosition}
            onClick={() => onCargoClick(placement.cargoId)}
          />
        );
      })}
      
      <OrbitControls 
        enableDamping 
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={50}
      />
    </Canvas>
  );
}