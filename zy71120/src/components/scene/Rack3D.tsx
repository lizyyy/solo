import { useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Rack as RackType } from '../../types';
import { STATUS_COLORS } from '../../utils/colors';

interface Rack3DProps {
  rack: RackType;
  isSelected: boolean;
  onClick: () => void;
  showLabel: boolean;
}

export function Rack3D({ rack, isSelected, onClick, showLabel }: Rack3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ledRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const statusColor = useMemo(() => new THREE.Color(STATUS_COLORS[rack.status]), [rack.status]);
  const glowIntensity = useMemo(() => {
    switch (rack.status) {
      case 'critical': return 2;
      case 'warning': return 1.5;
      default: return 1;
    }
  }, [rack.status]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    if (ledRef.current) {
      const pulse = rack.status === 'critical' 
        ? 0.5 + Math.sin(time * 4) * 0.5
        : rack.status === 'warning'
        ? 0.7 + Math.sin(time * 2) * 0.3
        : 0.9;
      
      (ledRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse * glowIntensity;
    }

    if (groupRef.current) {
      const targetScale = (hovered || isSelected) ? 1.03 : 1;
      (groupRef.current as THREE.Group).scale.setScalar(
        ((groupRef.current as THREE.Group).scale.x || 1) * 0.9 + targetScale * 0.1
      );
    }
  });

  return (
    <group
      ref={groupRef}
      position={[rack.position.x, rack.position.y, rack.position.z]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[rack.dimensions.width, rack.dimensions.height, rack.dimensions.depth]} />
        <meshStandardMaterial
          color={isSelected ? '#1a365d' : '#1e293b'}
          metalness={0.7}
          roughness={0.3}
          emissive={isSelected ? '#00d2d3' : '#000000'}
          emissiveIntensity={isSelected ? 0.2 : 0}
        />
      </mesh>

      <mesh position={[0, 0, rack.dimensions.depth / 2 + 0.01]}>
        <boxGeometry args={[rack.dimensions.width * 0.95, rack.dimensions.height * 0.95, 0.02]} />
        <meshStandardMaterial
          color="#0f172a"
          metalness={0.9}
          roughness={0.2}
        />
      </mesh>

      <mesh
        ref={ledRef}
        position={[0, rack.dimensions.height / 2 - 0.1, rack.dimensions.depth / 2 + 0.03]}
      >
        <boxGeometry args={[rack.dimensions.width * 0.8, 0.08, 0.02]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={glowIntensity}
          transparent
          opacity={0.9}
        />
      </mesh>

      {[0.5, 1, 1.5].map((y, i) => (
        <mesh
          key={i}
          position={[0, y - rack.dimensions.height / 2 + 0.3, rack.dimensions.depth / 2 + 0.025]}
        >
          <boxGeometry args={[rack.dimensions.width * 0.7, 0.02, 0.01]} />
          <meshStandardMaterial color="#334155" metalness={0.8} />
        </mesh>
      ))}

      {showLabel && (
        <Html
          position={[0, rack.dimensions.height / 2 + 0.5, 0]}
          center
          distanceFactor={10}
          style={{
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <div
            style={{
              background: isSelected ? 'rgba(0, 210, 211, 0.9)' : 'rgba(10, 22, 40, 0.9)',
              color: isSelected ? '#000' : '#fff',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'JetBrains Mono, monospace',
              border: `1px solid ${isSelected ? '#00d2d3' : 'rgba(0, 210, 211, 0.3)'}`,
              boxShadow: isSelected ? '0 0 20px rgba(0, 210, 211, 0.5)' : 'none',
            }}
          >
            {rack.name}
            <br />
            <span style={{ fontSize: '10px', opacity: 0.8 }}>
              {rack.power.toFixed(1)} kW
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}
