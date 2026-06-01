import { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Stars } from './Stars';
import { Earth } from './Earth';
import { Atmosphere } from './Atmosphere';
import { PointMarker } from './PointMarker';
import { useGlobeControls } from '../../hooks/useGlobeControls';
import type { Point, CameraState } from '../../types';

interface GlobeSceneContentProps {
  points: Point[];
  selectedPointId: string | null;
  autoRotate: boolean;
  onPointClick: (point: Point) => void;
  onCameraChange: (state: CameraState) => void;
  flyToTarget: CameraState | null;
}

function GlobeSceneContent({
  points,
  selectedPointId,
  autoRotate,
  onPointClick,
  onCameraChange,
  flyToTarget,
}: GlobeSceneContentProps) {
  const { controlsRef, flyTo, getCurrentCameraState } = useGlobeControls({
    autoRotate: false,
    autoRotateSpeed: 0.3,
  });
  const { camera } = useThree();
  const autoRotateRef = useRef(false);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    if (flyToTarget) {
      flyTo(flyToTarget, 1500);
    }
  }, [flyToTarget, flyTo]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const handleChange = () => {
      const state = getCurrentCameraState();
      onCameraChange(state);
    };

    controls.addEventListener('change', handleChange);
    return () => controls.removeEventListener('change', handleChange);
  }, [controlsRef, getCurrentCameraState, onCameraChange]);

  useEffect(() => {
    let animationId: number;
    
    const animate = () => {
      if (autoRotateRef.current && controlsRef.current) {
        controlsRef.current.update();
      }
      animationId = requestAnimationFrame(animate);
    };
    
    animate();
    return () => cancelAnimationFrame(animationId);
  }, []);

  const handleGlobeClick = () => {
    onPointClick(null as unknown as Point);
  };

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[5, 3, 5]}
        intensity={1.2}
        castShadow
      />
      <directionalLight
        position={[-5, -3, -5]}
        intensity={0.2}
      />

      <Stars />
      
      <group onClick={handleGlobeClick}>
        <Earth autoRotate={false} rotateSpeed={0} />
        <Atmosphere />
      </group>

      {points.map((point) => (
        <PointMarker
          key={point.id}
          point={point}
          isSelected={selectedPointId === point.id}
          onClick={onPointClick}
        />
      ))}

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={true}
        minDistance={1.5}
        maxDistance={8}
        minPolarAngle={Math.PI * 0.1}
        maxPolarAngle={Math.PI * 0.9}
        enableDamping
        dampingFactor={0.05}
        autoRotate={autoRotate}
        autoRotateSpeed={0.3}
      />
    </>
  );
}

interface GlobeSceneProps {
  points: Point[];
  selectedPointId: string | null;
  autoRotate: boolean;
  onPointClick: (point: Point) => void;
  onCameraChange: (state: CameraState) => void;
  flyToTarget: CameraState | null;
}

export function GlobeScene({
  points,
  selectedPointId,
  autoRotate,
  onPointClick,
  onCameraChange,
  flyToTarget,
}: GlobeSceneProps) {
  return (
    <Canvas
      camera={{
        position: [0, 2, 4],
        fov: 45,
        near: 0.1,
        far: 1000,
      }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      }}
      style={{
        background: 'linear-gradient(135deg, #0a1628 0%, #0f1d36 50%, #1a2744 100%)',
      }}
    >
      <GlobeSceneContent
        points={points}
        selectedPointId={selectedPointId}
        autoRotate={autoRotate}
        onPointClick={onPointClick}
        onCameraChange={onCameraChange}
        flyToTarget={flyToTarget}
      />
    </Canvas>
  );
}
