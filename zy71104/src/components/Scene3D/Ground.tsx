const Ground = () => {
  const gridSize = 200;
  const gridDivisions = 40;
  
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[gridSize, gridSize]} />
        <meshStandardMaterial 
          color="#2D5A27" 
          roughness={1} 
          metalness={0} 
        />
      </mesh>
      
      <gridHelper
        args={[gridSize, gridDivisions, '#444444', '#333333']}
        position={[0, 0.01, 0]}
      />
      
      {Array.from({ length: 20 }).map((_, i) => (
        <mesh
          key={`road-h-${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.02, -80 + i * 10]}
        >
          <planeGeometry args={[gridSize, 0.3]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0.1} />
        </mesh>
      ))}
      
      {Array.from({ length: 20 }).map((_, i) => (
        <mesh
          key={`road-v-${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[-80 + i * 10, 0.02, 0]}
        >
          <planeGeometry args={[0.3, gridSize]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0.1} />
        </mesh>
      ))}
    </group>
  );
};

export default Ground;
