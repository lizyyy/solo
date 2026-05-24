import React from 'react';
import { useSimulationStore } from '@/store/simulationStore';

const Building3D: React.FC = () => {
  const selectedPlan = useSimulationStore(state => state.selectedPlan);
  const floorOpacity = useSimulationStore(state => state.floorOpacity);
  
  if (!selectedPlan) return null;
  
  const { building } = selectedPlan;
  const floors: React.ReactElement[] = [];
  
  for (let i = 0; i < building.floors; i++) {
    const y = i * building.floorHeight;
    floors.push(
      <group key={`floor-${i}`}>
        <mesh position={[0, y + 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[building.width, building.depth]} />
          <meshStandardMaterial color={i === 0 ? '#4a5568' : '#2d3748'} transparent opacity={floorOpacity + 0.4} />
        </mesh>
        
        <mesh position={[-building.width / 2 - 0.1, y + building.floorHeight / 2, 0]}>
          <boxGeometry args={[0.2, building.floorHeight, building.depth]} />
          <meshStandardMaterial color="#1a202c" transparent opacity={floorOpacity} />
        </mesh>
        <mesh position={[building.width / 2 + 0.1, y + building.floorHeight / 2, 0]}>
          <boxGeometry args={[0.2, building.floorHeight, building.depth]} />
          <meshStandardMaterial color="#1a202c" transparent opacity={floorOpacity} />
        </mesh>
        
        <mesh position={[0, y + building.floorHeight / 2, -building.depth / 2 - 0.1]}>
          <boxGeometry args={[building.width, building.floorHeight, 0.2]} />
          <meshStandardMaterial color="#1a202c" transparent opacity={floorOpacity} />
        </mesh>
        <mesh position={[0, y + building.floorHeight / 2, building.depth / 2 + 0.1]}>
          <boxGeometry args={[building.width, building.floorHeight, 0.2]} />
          <meshStandardMaterial color="#1a202c" transparent opacity={floorOpacity} />
        </mesh>
      </group>
    );
  }
  
  return (
    <group>
      {floors}
      
      <mesh position={[0, -0.5, -10]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 60]} />
        <meshStandardMaterial color="#1e3a5f" />
      </mesh>
      
      <mesh position={[0, -0.49, -25]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, 30]} />
        <meshStandardMaterial color="#166534" />
      </mesh>
    </group>
  );
};

export default Building3D;
