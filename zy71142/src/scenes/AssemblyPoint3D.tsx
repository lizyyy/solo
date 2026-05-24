import React from 'react';
import { Text } from '@react-three/drei';
import { useSimulationStore } from '@/store/simulationStore';

const AssemblyPoint3D: React.FC = () => {
  const selectedPlan = useSimulationStore(state => state.selectedPlan);
  const showLabels = useSimulationStore(state => state.showLabels);
  const students = useSimulationStore(state => state.students);
  
  if (!selectedPlan) return null;
  
  return (
    <group>
      {selectedPlan.assemblyPoints.map(point => {
        const arrivedCount = students.filter(
          s => s.status === 'arrived' && 
          Math.abs(s.position.x - point.position.x) < point.radius &&
          Math.abs(s.position.z - point.position.z) < point.radius
        ).length;
        
        const capacityRatio = arrivedCount / point.capacity;
        let color = '#22c55e';
        if (capacityRatio >= 0.9) color = '#ef4444';
        else if (capacityRatio >= 0.7) color = '#f59e0b';
        
        return (
          <group key={point.id} position={[point.position.x, point.position.y, point.position.z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[point.radius - 0.3, point.radius, 32]} />
              <meshStandardMaterial color={color} side={2} />
            </mesh>
            
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
              <circleGeometry args={[point.radius - 0.3, 32]} />
              <meshStandardMaterial color={color} transparent opacity={0.2} />
            </mesh>
            
            {showLabels && (
              <Text
                position={[0, 0.5, 0]}
                fontSize={1}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
              >
                {point.name}
              </Text>
            )}
            
            {showLabels && (
              <Text
                position={[0, 1.5, 0]}
                fontSize={0.7}
                color="#94a3b8"
                anchorX="center"
                anchorY="middle"
              >
                {arrivedCount}/{point.capacity}
              </Text>
            )}
          </group>
        );
      })}
    </group>
  );
};

export default AssemblyPoint3D;
