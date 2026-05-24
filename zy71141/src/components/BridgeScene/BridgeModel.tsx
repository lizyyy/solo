import React from 'react';

export const BridgeModel: React.FC = () => {
  const bridgeColor = '#4A5568';
  const pillarColor = '#2D3748';
  const deckColor = '#718096';

  return (
    <group>
      <mesh position={[0, 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[10, 0.4, 6]} />
        <meshStandardMaterial color={deckColor} transparent opacity={0.9} />
      </mesh>

      <mesh position={[0, 2.2, 0]} castShadow>
        <boxGeometry args={[10, 0.1, 6.2]} />
        <meshStandardMaterial color="#5A6578" roughness={0.8} />
      </mesh>

      <mesh position={[-4.5, 1.2, 2.5]} castShadow>
        <boxGeometry args={[0.5, 2, 0.5]} />
        <meshStandardMaterial color={pillarColor} />
      </mesh>
      <mesh position={[4.5, 1.2, 2.5]} castShadow>
        <boxGeometry args={[0.5, 2, 0.5]} />
        <meshStandardMaterial color={pillarColor} />
      </mesh>
      <mesh position={[-4.5, 1.2, -2.5]} castShadow>
        <boxGeometry args={[0.5, 2, 0.5]} />
        <meshStandardMaterial color={pillarColor} />
      </mesh>
      <mesh position={[4.5, 1.2, -2.5]} castShadow>
        <boxGeometry args={[0.5, 2, 0.5]} />
        <meshStandardMaterial color={pillarColor} />
      </mesh>

      <mesh position={[0, 1.2, 0]} castShadow>
        <boxGeometry args={[0.8, 1.6, 0.8]} />
        <meshStandardMaterial color={pillarColor} />
      </mesh>

      <mesh position={[0, 1.5, 3]} castShadow>
        <boxGeometry args={[10, 0.5, 0.3]} />
        <meshStandardMaterial color={bridgeColor} />
      </mesh>
      <mesh position={[0, 1.5, -3]} castShadow>
        <boxGeometry args={[10, 0.5, 0.3]} />
        <meshStandardMaterial color={bridgeColor} />
      </mesh>

      <mesh position={[-5, 2, 0]} castShadow>
        <boxGeometry args={[0.3, 1.5, 6]} />
        <meshStandardMaterial color={bridgeColor} />
      </mesh>
      <mesh position={[5, 2, 0]} castShadow>
        <boxGeometry args={[0.3, 1.5, 6]} />
        <meshStandardMaterial color={bridgeColor} />
      </mesh>

      <mesh position={[-5, 2.5, 2.5]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 1, 8]} />
        <meshStandardMaterial color="#A0AEC0" />
      </mesh>
      <mesh position={[5, 2.5, 2.5]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 1, 8]} />
        <meshStandardMaterial color="#A0AEC0" />
      </mesh>
      <mesh position={[-5, 2.5, -2.5]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 1, 8]} />
        <meshStandardMaterial color="#A0AEC0" />
      </mesh>
      <mesh position={[5, 2.5, -2.5]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 1, 8]} />
        <meshStandardMaterial color="#A0AEC0" />
      </mesh>

      <mesh position={[-5, 2.95, 0]}>
        <boxGeometry args={[0.1, 0.05, 6]} />
        <meshStandardMaterial color="#A0AEC0" />
      </mesh>
      <mesh position={[5, 2.95, 0]}>
        <boxGeometry args={[0.1, 0.05, 6]} />
        <meshStandardMaterial color="#A0AEC0" />
      </mesh>

      <mesh position={[0, 0.2, 0]} receiveShadow>
        <boxGeometry args={[12, 0.4, 8]} />
        <meshStandardMaterial color="#1A202C" />
      </mesh>

      <gridHelper args={[20, 20, '#2D3748', '#1A202C']} position={[0, 0.01, 0]} />
    </group>
  );
};
