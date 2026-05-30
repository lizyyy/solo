import { useRef, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { BlackHole, LightRay, Star, StarField, Vec3 } from '../../types';
import { BlackHole3D } from './BlackHole3D';
import { LightRays3D } from './LightRays3D';
import { StarField3D } from './StarField3D';

interface SceneProps {
  blackHole: BlackHole;
  lightRays: LightRay[];
  starField: StarField;
  visibility: {
    blackHole: boolean;
    lightRays: boolean;
    starField: boolean;
  };
  showEventHorizon: boolean;
  showPhotonSphere: boolean;
  onBlackHoleClick: () => void;
  onRayClick: (ray: LightRay) => void;
  onStarClick: (star: Star) => void;
  selectedObject: BlackHole | LightRay | Star | null;
  cameraPosition: Vec3;
  cameraTarget: Vec3;
  onCameraUpdate: (position: Vec3, target: Vec3) => void;
}

function CameraController({
  targetPosition,
  targetLookAt,
  onUpdate,
}: {
  targetPosition: Vec3;
  targetLookAt: Vec3;
  onUpdate: (position: Vec3, target: Vec3) => void;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const isAnimating = useRef(false);

  useEffect(() => {
    isAnimating.current = true;
    const startPos = camera.position.clone();
    const startTarget = controlsRef.current?.target?.clone() || new THREE.Vector3(0, 0, 0);
    const endPos = new THREE.Vector3(...targetPosition);
    const endTarget = new THREE.Vector3(...targetLookAt);

    let progress = 0;
    const animate = () => {
      progress += 0.02;
      if (progress >= 1) {
        progress = 1;
        isAnimating.current = false;
      }

      const t = progress;
      camera.position.lerpVectors(startPos, endPos, t);
      if (controlsRef.current) {
        controlsRef.current.target.lerpVectors(startTarget, endTarget, t);
      }

      if (isAnimating.current) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }, [targetPosition, targetLookAt, camera]);

  useFrame(() => {
    if (controlsRef.current && !isAnimating.current) {
      const pos = camera.position;
      const target = controlsRef.current.target;
      onUpdate(
        [pos.x, pos.y, pos.z],
        [target.x, target.y, target.z]
      );
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      minDistance={1}
      maxDistance={200}
    />
  );
}

function SceneContent(props: SceneProps) {
  const {
    blackHole,
    lightRays,
    starField,
    visibility,
    showEventHorizon,
    showPhotonSphere,
    onBlackHoleClick,
    onRayClick,
    onStarClick,
    selectedObject,
    cameraPosition,
    cameraTarget,
    onCameraUpdate,
  } = props;

  const selectedId = selectedObject?.id;

  return (
    <>
      <ambientLight intensity={0.1} />

      <StarField3D
        starField={starField}
        visible={visibility.starField}
        onStarClick={onStarClick}
        selectedId={selectedId}
      />

      <LightRays3D
        rays={lightRays}
        visible={visibility.lightRays}
        onRayClick={onRayClick}
        selectedId={selectedId}
      />

      <BlackHole3D
        blackHole={blackHole}
        onClick={onBlackHoleClick}
        visible={visibility.blackHole}
        showEventHorizon={showEventHorizon}
        showPhotonSphere={showPhotonSphere}
      />

      <CameraController
        targetPosition={cameraPosition}
        targetLookAt={cameraTarget}
        onUpdate={onCameraUpdate}
      />

      <EffectComposer>
        <Bloom
          intensity={0.5}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <Vignette offset={0.5} darkness={0.5} />
      </EffectComposer>
    </>
  );
}

export function Scene(props: SceneProps) {
  return (
    <Canvas
      camera={{
        position: new THREE.Vector3(...props.cameraPosition),
        fov: 50,
        near: 0.1,
        far: 1000,
      }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      }}
      style={{ background: '#0a0a1a' }}
      onPointerMissed={() => props.onBlackHoleClick()}
    >
      <SceneContent {...props} />
    </Canvas>
  );
}
