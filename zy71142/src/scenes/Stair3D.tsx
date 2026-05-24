import React from 'react';
import { Text } from '@react-three/drei';
import { useSimulationStore } from '@/store/simulationStore';

const Stair3D: React.FC = () => {
  const selectedPlan = useSimulationStore(state => state.selectedPlan);
  const showLabels = useSimulationStore(state => state.showLabels);
  const statistics = useSimulationStore(state => state.statistics);
  const simulator = useSimulationStore(state => state.simulator);
  
  if (!selectedPlan) return null;
  
  const stairUsage = simulator?.getStairUsage() || new Map();
  
  return (
    <group>
      {selectedPlan.stairs.map(stair => {
        const usage = stairUsage.get(stair.id) || 0;
        const capacityRatio = usage / stair.capacity;
        
        let color = '#22c55e';
        if (capacityRatio >= 0.9) color = '#ef4444';
        else if (capacityRatio >= 0.7) color = '#f59e0b';
        
        const stairSteps: React.ReactElement[] = [];
        const stepCount = 20;
        const stepHeight = selectedPlan.building.floorHeight / stepCount;
        const stepDepth = stair.depth / stepCount;
        
        for (let floor = 0; floor < selectedPlan.building.floors; floor++) {
          for (let step = 0; step < stepCount; step++) {
            const y = floor * selectedPlan.building.floorHeight + step * stepHeight;
            const z = stair.position.z - stair.depth / 2 + step * stepDepth;
            
            stairSteps.push(
              <mesh
                key={`stair-${stair.id}-floor-${floor}-step-${step}`}
                position={[stair.position.x, y + stepHeight / 2, z]}
              >
                <boxGeometry args={[stair.width, stepHeight, stepDepth + 0.1]} />
                <meshStandardMaterial 
                  color={stair.isClosed ? '#64748b' : color} 
                  transparent 
                  opacity={stair.isClosed ? 0.3 : 0.8} 
                />
              </mesh>
            );
          }
        }
        
        return (
          <group key={stair.id}>
            {stairSteps}
            
            <mesh position={[stair.position.x, -0.2, stair.position.z - 5]}>
              <cylinderGeometry args={[stair.width / 2, stair.width / 2, 0.4, 16]} />
              <meshStandardMaterial color={stair.isClosed ? '#64748b' : color} />
            </mesh>
            
            {showLabels && (
              <Text
                position={[stair.position.x, 1, stair.position.z - 5]}
                fontSize={0.6}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
              >
                {stair.name}
              </Text>
            )}
            
            {showLabels && (
              <Text
                position={[stair.position.x, 2, stair.position.z - 5]}
                fontSize={0.4}
                color="#94a3b8"
                anchorX="center"
                anchorY="middle"
              >
                {usage}/{stair.capacity}
              </Text>
            )}
            
            {stair.isClosed && (
              <mesh position={[stair.position.x, selectedPlan.building.floorHeight * 2, stair.position.z]}>
                <boxGeometry args={[stair.width + 1, 1, 0.2]} />
                <meshStandardMaterial color="#ef4444" />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
};

export default Stair3D;
