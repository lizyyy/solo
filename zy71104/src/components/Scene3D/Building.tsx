import { Building as BuildingType } from '../../types';

interface BuildingProps {
  building: BuildingType;
}

const Building = ({ building }: BuildingProps) => {
  const { position, dimensions, color } = building;
  
  return (
    <group position={[position.x, 0, position.z]}>
      <mesh position={[0, dimensions.height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[dimensions.width, dimensions.height, dimensions.depth]} />
        <meshStandardMaterial color={color} metalness={0.1} roughness={0.8} />
      </mesh>
      
      <mesh position={[0, dimensions.height / 2, dimensions.depth / 2 + 0.01]}>
        <boxGeometry args={[dimensions.width * 0.95, dimensions.height * 0.95, 0.02]} />
        <meshStandardMaterial 
          color="#1a1a2e" 
          transparent 
          opacity={0.3} 
          metalness={0.9} 
          roughness={0.1} 
        />
      </mesh>
      
      <mesh position={[0, dimensions.height + 0.1, 0]}>
        <boxGeometry args={[dimensions.width + 1, 0.2, dimensions.depth + 1]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      
      {Array.from({ length: Math.floor(dimensions.height / 5) }).map((_, row) => (
        Array.from({ length: Math.floor(dimensions.width / 6) }).map((_, col) => (
          <mesh
            key={`window-${row}-${col}`}
            position={[
              -dimensions.width / 2 + 3 + col * 6,
              3 + row * 5,
              dimensions.depth / 2 + 0.03
            ]}
          >
            <planeGeometry args={[2, 2]} />
            <meshStandardMaterial 
              color={Math.random() > 0.3 ? '#87CEEB' : '#FFFF00'} 
              emissive={Math.random() > 0.7 ? '#FFFF88' : '#000000'}
              emissiveIntensity={0.5}
              transparent 
              opacity={0.8} 
            />
          </mesh>
        ))
      ))}
    </group>
  );
};

export default Building;
