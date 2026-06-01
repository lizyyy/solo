import { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Ground } from './Ground';
import { ComponentMarkers } from './ComponentMarkers';
import { AxesHelper } from './AxesHelper';
import { HeritageComponent, CameraState } from '@/types';

interface CameraControllerProps {
  initialCameraState: CameraState;
  onCameraChange: (state: CameraState) => void;
  selectedComponent: HeritageComponent | null;
}

function CameraController({ initialCameraState, onCameraChange, selectedComponent }: CameraControllerProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (initialCameraState.position && initialCameraState.target && controlsRef.current) {
      camera.position.set(...initialCameraState.position);
      controlsRef.current.target.set(...initialCameraState.target);
      controlsRef.current.update();
    }
  }, []);

  useEffect(() => {
    if (selectedComponent && selectedComponent.x !== null && controlsRef.current) {
      const targetPos = new THREE.Vector3(
        selectedComponent.x!,
        selectedComponent.y!,
        selectedComponent.z!
      );
      const offset = new THREE.Vector3(5, 3, 5);
      camera.position.copy(targetPos).add(offset);
      controlsRef.current.target.copy(targetPos);
      controlsRef.current.update();
    }
  }, [selectedComponent?.id]);

  const handleControlChange = () => {
    if (controlsRef.current) {
      onCameraChange({
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [
          controlsRef.current.target.x,
          controlsRef.current.target.y,
          controlsRef.current.target.z,
        ],
      });
    }
  };

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      onEnd={handleControlChange}
      enableDamping
      dampingFactor={0.05}
      minDistance={3}
      maxDistance={50}
    />
  );
}

interface ThreeSceneProps {
  components: HeritageComponent[];
  selectedComponentId: string | null;
  selectedComponent: HeritageComponent | null;
  cameraState: CameraState;
  onCameraChange: (state: CameraState) => void;
  onSelectComponent: (id: string | null) => void;
}

export function ThreeScene({
  components,
  selectedComponentId,
  selectedComponent,
  cameraState,
  onCameraChange,
  onSelectComponent,
}: ThreeSceneProps) {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [15, 12, 15], fov: 50 }}
        shadows
        onClick={() => onSelectComponent(null)}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#1a1f2e']} />
        <fog attach="fog" args={['#1a1f2e', 20, 60]} />

        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={0.8}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-5, 5, -5]} intensity={0.3} />

        <Ground />
        <AxesHelper />
        <ComponentMarkers
          components={components}
          selectedId={selectedComponentId}
          onSelect={onSelectComponent}
        />
        <CameraController
          initialCameraState={cameraState}
          onCameraChange={onCameraChange}
          selectedComponent={selectedComponent}
        />
      </Canvas>
    </div>
  );
}
