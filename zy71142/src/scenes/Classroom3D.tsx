import React from 'react';
import { Text } from '@react-three/drei';
import { useSimulationStore } from '@/store/simulationStore';

const gradeColors: Record<number, string> = {
  1: '#ef4444',
  2: '#f97316',
  3: '#eab308',
  4: '#22c55e',
  5: '#3b82f6',
  6: '#8b5cf6',
};

const Classroom3D: React.FC = () => {
  const selectedPlan = useSimulationStore(state => state.selectedPlan);
  const showLabels = useSimulationStore(state => state.showLabels);
  const statistics = useSimulationStore(state => state.statistics);
  
  if (!selectedPlan) return null;
  
  return (
    <group>
      {selectedPlan.classrooms.map(classroom => {
        const color = gradeColors[classroom.grade] || '#64748b';
        const completion = statistics.classroomCompletion[classroom.id] || 0;
        const isComplete = completion === 1;
        
        return (
          <group key={classroom.id} position={[classroom.position.x, classroom.position.y + 0.5, classroom.position.z]}>
            <mesh>
              <boxGeometry args={[7, 0.3, 7]} />
              <meshStandardMaterial 
                color={isComplete ? '#22c55e' : color} 
                transparent 
                opacity={0.6} 
              />
            </mesh>
            
            <mesh position={[0, 0.3, 0]}>
              <boxGeometry args={[7, 0.1, 7]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            
            <mesh position={[0, 0.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[7 * completion, 7]} />
              <meshStandardMaterial color="#22c55e" transparent opacity={0.5} />
            </mesh>
            
            {showLabels && (
              <Text
                position={[0, 0.6, 0]}
                fontSize={0.8}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
              >
                {classroom.name}
              </Text>
            )}
            
            {showLabels && (
              <Text
                position={[0, 1.4, 0]}
                fontSize={0.5}
                color="#94a3b8"
                anchorX="center"
                anchorY="middle"
              >
                {classroom.studentCount}人
              </Text>
            )}
          </group>
        );
      })}
    </group>
  );
};

export default Classroom3D;
