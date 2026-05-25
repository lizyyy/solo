import React, { useMemo } from 'react';
import { useSimulationStore } from '@/store/simulationStore';
import * as THREE from 'three';

const Student3D: React.FC = () => {
  const students = useSimulationStore(state => state.students);
  const showPaths = useSimulationStore(state => state.showPaths);
  const filteredClassrooms = useSimulationStore(state => state.filteredClassrooms);
  const studentFilter = useSimulationStore(state => state.studentFilter);
  
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      if (filteredClassrooms.length > 0 && !filteredClassrooms.includes(student.classroomId)) {
        return false;
      }
      
      if (studentFilter !== 'all' && student.status !== studentFilter) {
        return false;
      }
      
      return true;
    });
  }, [students, filteredClassrooms, studentFilter]);
  
  const { positions, colors } = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    
    filteredStudents.forEach(student => {
      positions.push(student.position.x, student.position.y + 0.5, student.position.z);
      
      let color = new THREE.Color('#3b82f6');
      if (student.status === 'waiting') color = new THREE.Color('#64748b');
      else if (student.status === 'queued') color = new THREE.Color('#ef4444');
      else if (student.status === 'inStair') color = new THREE.Color('#f59e0b');
      else if (student.status === 'arrived') color = new THREE.Color('#22c55e');
      
      colors.push(color.r, color.g, color.b);
    });
    
    return {
      positions: new Float32Array(positions),
      colors: new Float32Array(colors)
    };
  }, [filteredStudents]);
  
  const pathLines = useMemo(() => {
    if (!showPaths) return [];
    
    const displayedStudents = filteredStudents.slice(0, 50);
    return displayedStudents.map(student => {
      const points = student.path.map(p => new THREE.Vector3(p.x, p.y + 0.5, p.z));
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      
      const color = student.status === 'arrived' ? '#22c55e' : 
                    student.status === 'inStair' ? '#f59e0b' : '#3b82f6';
      
      return (
        <line key={student.id}>
          <bufferGeometry attach="geometry" {...geometry} />
          <lineBasicMaterial attach="material" color={color} transparent opacity={0.3} />
        </line>
      );
    });
  }, [filteredStudents, showPaths]);
  
  return (
    <group>
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={positions.length / 3}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={colors.length / 3}
            array={colors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.5}
          vertexColors
          transparent
          opacity={0.8}
          sizeAttenuation
        />
      </points>
      
      {pathLines}
    </group>
  );
};

export default Student3D;
