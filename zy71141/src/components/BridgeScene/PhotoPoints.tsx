import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Photo } from '../../types';
import { Html } from '@react-three/drei';
import { Camera } from 'lucide-react';

interface PhotoPointsProps {
  photos: Photo[];
  onPhotoClick?: (photo: Photo) => void;
}

export const PhotoPoints: React.FC<PhotoPointsProps> = ({ photos, onPhotoClick }) => {
  return (
    <group>
      {photos.map((photo) => (
        <PhotoMarker
          key={photo.id}
          photo={photo}
          onClick={() => onPhotoClick?.(photo)}
        />
      ))}
    </group>
  );
};

interface PhotoMarkerProps {
  photo: Photo;
  onClick: () => void;
}

const PhotoMarker: React.FC<PhotoMarkerProps> = ({ photo, onClick }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      const scale = hovered ? 1.3 : 1;
      meshRef.current.scale.setScalar(scale);
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.08;
      meshRef.current.scale.multiplyScalar(pulse);
    }
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    onClick();
  };

  const handlePointerOver = (e: any) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  };

  return (
    <group position={[photo.position.x, photo.position.y, photo.position.z]}>
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <planeGeometry args={[0.25, 0.2]} />
        <meshBasicMaterial color="#60A5FA" transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[0.2, 0.15]} />
        <meshBasicMaterial color="#1E3A5F" transparent opacity={0.95} />
      </mesh>

      {(hovered) && (
        <Html position={[0.3, 0.2, 0]} center distanceFactor={8}>
          <div
            className="px-3 py-2 rounded text-xs whitespace-nowrap"
            style={{
              background: 'rgba(30, 58, 95, 0.95)',
              border: '1px solid #60A5FA',
              color: 'white',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              maxWidth: '200px',
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <svg
                className="w-3.5 h-3.5 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="font-bold text-blue-400">{photo.id}</span>
            </div>
            {photo.annotation && (
              <div className="text-gray-300 text-[10px] border-t border-blue-900 pt-1">
                {photo.annotation}
              </div>
            )}
          </div>
        </Html>
      )}

      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([0, 0, 0, 0, -0.5, 0])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#60A5FA" linewidth={1} transparent opacity={0.5} />
      </line>
    </group>
  );
};
