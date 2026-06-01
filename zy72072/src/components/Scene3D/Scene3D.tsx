import { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Stage } from './Stage';
import { LightFixture } from './LightFixture';
import { useProjectStore } from '../../store/useProjectStore';
import { LightPoint, PointStatus } from '../../types';

interface CameraControllerProps {
  onCameraChange: (position: [number, number, number], target: [number, number, number]) => void;
  initialPosition: [number, number, number];
  initialTarget: [number, number, number];
}

const CameraController = ({
  onCameraChange,
  initialPosition,
  initialTarget,
}: CameraControllerProps) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    camera.position.set(...initialPosition);
  }, []);

  const handleControlChange = () => {
    if (controlsRef.current) {
      const pos = controlsRef.current.object.position;
      const target = controlsRef.current.target;
      onCameraChange(
        [pos.x, pos.y, pos.z],
        [target.x, target.y, target.z]
      );
    }
  };

  return (
    <OrbitControls
      ref={controlsRef}
      target={initialTarget}
      makeDefault
      onChange={handleControlChange}
      enableDamping
      dampingFactor={0.05}
      minDistance={10}
      maxDistance={60}
    />
  );
};

interface Scene3DContentProps {
  points: LightPoint[];
  selectedId: string | null;
  onSelectPoint: (id: string | null) => void;
  onCameraChange: (position: [number, number, number], target: [number, number, number]) => void;
  initialCamera: { position: [number, number, number]; target: [number, number, number] };
  statusFilter: PointStatus | 'all';
  searchQuery: string;
}

const Scene3DContent = ({
  points,
  selectedId,
  onSelectPoint,
  onCameraChange,
  initialCamera,
  statusFilter,
  searchQuery,
}: Scene3DContentProps) => {
  const filteredPoints = points.filter((p) => {
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchSearch =
      searchQuery === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.source.includes(searchQuery);
    return matchStatus && matchSearch;
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} castShadow />
      <directionalLight position={[-10, 15, -10]} intensity={0.4} />

      <Stage width={30} depth={30} />

      {filteredPoints.map((point) => (
        <LightFixture
          key={point.id}
          point={point}
          isSelected={point.id === selectedId}
          onClick={() => onSelectPoint(point.id === selectedId ? null : point.id)}
        />
      ))}

      <CameraController
        onCameraChange={onCameraChange}
        initialPosition={initialCamera.position}
        initialTarget={initialCamera.target}
      />
    </>
  );
};

export const Scene3D = () => {
  const {
    lightPoints,
    selectedPointId,
    setSelectedPointId,
    setCameraState,
    cameraState,
    statusFilter,
    searchQuery,
  } = useProjectStore();

  const handleCameraChange = (
    position: [number, number, number],
    target: [number, number, number]
  ) => {
    setCameraState({ position, target });
  };

  return (
    <Canvas
      shadows
      camera={{ position: cameraState.position, fov: 50 }}
      gl={{ antialias: true }}
      style={{ background: 'linear-gradient(to bottom, #0f172a, #1e293b)' }}
    >
      <fog attach="fog" args={['#0f172a', 30, 80]} />
      <Scene3DContent
        points={lightPoints}
        selectedId={selectedPointId}
        onSelectPoint={setSelectedPointId}
        onCameraChange={handleCameraChange}
        initialCamera={cameraState}
        statusFilter={statusFilter}
        searchQuery={searchQuery}
      />
    </Canvas>
  );
};
