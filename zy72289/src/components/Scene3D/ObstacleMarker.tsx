import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { statusColors } from '@/types';
import type { DetectedObstacle } from '@/types';
import { Info, AlertTriangle, CheckCircle, XCircle, RefreshCw, MessageSquare } from 'lucide-react';

interface ObstacleMarkerProps {
  obstacle: DetectedObstacle;
  isActive: boolean;
  onClick: () => void;
}

const statusIcons: Record<string, typeof Info> = {
  normal: CheckCircle,
  pending_review: AlertTriangle,
  conflict: XCircle,
  corrected: RefreshCw,
};

export function ObstacleMarker({ obstacle, isActive, onClick }: ObstacleMarkerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const color = statusColors[obstacle.status];
  const IconComponent = statusIcons[obstacle.status] || Info;

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.2;
    }
  });

  const position: [number, number, number] = [
    obstacle.position.x,
    obstacle.position.y,
    obstacle.position.z,
  ];

  return (
    <group ref={groupRef} position={position}>
      <mesh
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
        scale={hovered || isActive ? [1.3, 1.3, 1.3] : [1, 1, 1]}
      >
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered || isActive ? 0.5 : 0.2}
          metalness={0.5}
          roughness={0.3}
        />
      </mesh>

      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {(hovered || isActive) && (
        <Html
          position={[0, 1.8, 0]}
          center
          distanceFactor={10}
          zIndexRange={[100, 0]}
        >
          <div
            className={`
              px-3 py-2 rounded-lg text-xs whitespace-nowrap
              bg-primary-900/95 backdrop-blur-sm border-2
              shadow-xl animate-fade-in
            `}
            style={{ borderColor: color }}
          >
            <div className="flex items-center gap-2 mb-1">
              <IconComponent size={14} color={color} />
              <span className="font-bold text-white">{obstacle.name}</span>
            </div>
            {obstacle.alias && (
              <div className="text-yellow-400 text-[10px] mb-1">
                别名: {obstacle.alias}
              </div>
            )}
            <div className="text-gray-300 text-[10px]">
              安全半径: {obstacle.detectedRadius}m
            </div>
            <div className="text-gray-300 text-[10px]">
              电压等级: {obstacle.voltageLevel}
            </div>
            {obstacle.conflictNote && (
              <div className="mt-1 pt-1 border-t border-gray-600 text-[10px] text-yellow-300 max-w-[200px] whitespace-normal">
                {obstacle.conflictNote}
              </div>
            )}
            {obstacle.manualNote && (
              <div className="mt-1 pt-1 border-t border-gray-600 flex items-start gap-1 text-[10px] text-blue-300 max-w-[200px] whitespace-normal">
                <MessageSquare size={10} className="flex-shrink-0 mt-0.5" />
                <span>{obstacle.manualNote}</span>
              </div>
            )}
          </div>
        </Html>
      )}

      <pointLight
        color={color}
        intensity={isActive ? 2 : 0.5}
        distance={3}
        decay={2}
      />
    </group>
  );
}
