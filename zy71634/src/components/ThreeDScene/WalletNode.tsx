
import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Node3D } from '../../types';

interface WalletNodeProps {
  node: Node3D;
  onClick: () => void;
}

const statusColors: Record<string, string> = {
  normal: '#60a5fa',
  warning: '#f59e0b',
  anomaly: '#ef4444',
  pending: '#8b5cf6',
  rejected: '#dc2626',
};

export const WalletNode = ({ node, onClick }: WalletNodeProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const glowRef = useRef<THREE.Mesh>(null);

  const baseColor = statusColors[node.wallet.status] || '#60a5fa';
  const scale = node.isSelected ? 1.5 : node.isHighlighted ? 1.3 : 1;

  useFrame((_, delta) => {
    if (meshRef.current) {
      const pulseScale = 1 + Math.sin(Date.now() * 0.003) * 0.05;
      meshRef.current.scale.setScalar(scale * pulseScale);
    }
    if (glowRef.current) {
      const glowMaterial = glowRef.current.material as THREE.MeshBasicMaterial;
      glowMaterial.opacity = hovered || node.isSelected ? 0.4 : 0.15;
    }
  });

  const nodeSize = Math.max(0.8, Math.min(2, Math.log10(node.wallet.balance) / 3));

  return (
    <group position={[node.x, node.y, node.z]}>
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
        <mesh
          ref={meshRef}
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
          <icosahedronGeometry args={[nodeSize, 1]} />
          <meshStandardMaterial
            color={baseColor}
            emissive={baseColor}
            emissiveIntensity={node.isSelected ? 0.8 : node.isHighlighted ? 0.5 : 0.2}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>

        <mesh ref={glowRef}>
          <sphereGeometry args={[nodeSize * 1.5, 32, 32]} />
          <meshBasicMaterial
            color={baseColor}
            transparent
            opacity={0.2}
            side={THREE.BackSide}
          />
        </mesh>

        {(hovered || node.isSelected) && (
          <Html
            position={[0, nodeSize * 2, 0]}
            center
            style={{
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            <div className="bg-slate-900/95 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-600/50 shadow-xl min-w-max">
              <div className="text-white font-bold text-sm mb-1">
                {node.wallet.label}
              </div>
              <div className="text-slate-300 text-xs font-mono">
                {node.wallet.address.slice(0, 10)}...
                {node.wallet.address.slice(-8)}
              </div>
              <div className="text-emerald-400 text-xs mt-1">
                ${node.wallet.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
          </Html>
        )}
      </Float>
    </group>
  );
};
