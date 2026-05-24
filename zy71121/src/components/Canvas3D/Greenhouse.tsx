import { useRef } from 'react';
import { Mesh } from 'three';
import { useSimulationStore } from '../../store/useSimulationStore';

export function Greenhouse() {
  const { greenhouse } = useSimulationStore();
  const frameRef = useRef<Mesh>(null);
  
  const width = greenhouse.width;
  const length = greenhouse.length;
  const height = greenhouse.height;
  const roofHeight = height * 0.4;
  
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color="#4a5568" />
      </mesh>
      
      <mesh position={[0, height / 2, -length / 2]}>
        <boxGeometry args={[0.1, height, 0.1]} />
        <meshStandardMaterial color="#718096" />
      </mesh>
      <mesh position={[0, height / 2, length / 2]}>
        <boxGeometry args={[0.1, height, 0.1]} />
        <meshStandardMaterial color="#718096" />
      </mesh>
      <mesh position={[-width / 2, height / 2, -length / 2]}>
        <boxGeometry args={[0.1, height, 0.1]} />
        <meshStandardMaterial color="#718096" />
      </mesh>
      <mesh position={[-width / 2, height / 2, length / 2]}>
        <boxGeometry args={[0.1, height, 0.1]} />
        <meshStandardMaterial color="#718096" />
      </mesh>
      <mesh position={[width / 2, height / 2, -length / 2]}>
        <boxGeometry args={[0.1, height, 0.1]} />
        <meshStandardMaterial color="#718096" />
      </mesh>
      <mesh position={[width / 2, height / 2, length / 2]}>
        <boxGeometry args={[0.1, height, 0.1]} />
        <meshStandardMaterial color="#718096" />
      </mesh>
      
      <mesh position={[0, height, 0]}>
        <boxGeometry args={[0.1, 0.1, length]} />
        <meshStandardMaterial color="#718096" />
      </mesh>
      <mesh position={[-width / 2, height, 0]}>
        <boxGeometry args={[0.1, 0.1, length]} />
        <meshStandardMaterial color="#718096" />
      </mesh>
      <mesh position={[width / 2, height, 0]}>
        <boxGeometry args={[0.1, 0.1, length]} />
        <meshStandardMaterial color="#718096" />
      </mesh>
      
      <mesh position={[0, height, 0]}>
        <boxGeometry args={[width, 0.1, 0.1]} />
        <meshStandardMaterial color="#718096" />
      </mesh>
      <mesh position={[0, height, -length / 2]}>
        <boxGeometry args={[width, 0.1, 0.1]} />
        <meshStandardMaterial color="#718096" />
      </mesh>
      <mesh position={[0, height, length / 2]}>
        <boxGeometry args={[width, 0.1, 0.1]} />
        <meshStandardMaterial color="#718096" />
      </mesh>
      
      <mesh position={[0, height + roofHeight / 2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, width, 8]} />
        <meshStandardMaterial color="#718096" />
      </mesh>
      
      <mesh position={[-width / 4, height + roofHeight / 2, 0]}>
        <boxGeometry args={[0.1, roofHeight, length]} />
        <meshStandardMaterial 
          color="#e2e8f0" 
          transparent 
          opacity={0.3}
          side={2}
        />
      </mesh>
      <mesh position={[width / 4, height + roofHeight / 2, 0]}>
        <boxGeometry args={[0.1, roofHeight, length]} />
        <meshStandardMaterial 
          color="#e2e8f0" 
          transparent 
          opacity={0.3}
          side={2}
        />
      </mesh>
      
      <mesh position={[0, height / 2, -length / 2]}>
        <boxGeometry args={[width, height, 0.05]} />
        <meshStandardMaterial 
          color="#bee3f8" 
          transparent 
          opacity={0.2}
          side={2}
        />
      </mesh>
      <mesh position={[0, height / 2, length / 2]}>
        <boxGeometry args={[width, height, 0.05]} />
        <meshStandardMaterial 
          color="#bee3f8" 
          transparent 
          opacity={0.2}
          side={2}
        />
      </mesh>
      <mesh position={[-width / 2, height / 2, 0]}>
        <boxGeometry args={[0.05, height, length]} />
        <meshStandardMaterial 
          color="#bee3f8" 
          transparent 
          opacity={0.2}
          side={2}
        />
      </mesh>
      <mesh position={[width / 2, height / 2, 0]}>
        <boxGeometry args={[0.05, height, length]} />
        <meshStandardMaterial 
          color="#bee3f8" 
          transparent 
          opacity={0.2}
          side={2}
        />
      </mesh>
    </group>
  );
}
