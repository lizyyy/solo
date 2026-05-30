import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Ground, Axes, RoadCenterLine } from './Ground';
import { PipelineGroup } from './PipelineMesh';
import { CollisionMarkersGroup } from './CollisionMarker';
import { PileNoMarkersGroup } from './PileNoMarker';
import type { PipelineSegment, CollisionPoint, PileMarker, LayerVisibility, Point3D } from '../../types';
import { useUIStore } from '../../stores/uiStore';
import { usePipelineStore } from '../../stores/pipelineStore';
import { useCollisionStore } from '../../stores/collisionStore';

interface SceneContentProps {
  segments: PipelineSegment[];
  collisions: CollisionPoint[];
  pileMarkers: PileMarker[];
  visibility: LayerVisibility;
  transparency: number;
  cameraPosition: Point3D;
  cameraTarget: Point3D;
  highlightedPileNo: string;
  onSelectSegment: (segment: PipelineSegment | null) => void;
  onSelectCollision: (collision: CollisionPoint | null) => void;
  onSelectPile: (marker: PileMarker) => void;
  onCameraMove: (pos: Point3D, target: Point3D) => void;
}

function CameraController({ position, target }: { position: Point3D; target: Point3D }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    camera.position.set(position.x, position.y, position.z);
    camera.lookAt(target.x, target.y, target.z);
    if (controlsRef.current) {
      controlsRef.current.target.set(target.x, target.y, target.z);
      controlsRef.current.update();
    }
  }, [position, target, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      minDistance={5}
      maxDistance={500}
      maxPolarAngle={Math.PI / 2 - 0.05}
    />
  );
}

function SceneContent({
  segments,
  collisions,
  pileMarkers,
  visibility,
  transparency,
  cameraPosition,
  cameraTarget,
  highlightedPileNo,
  onSelectSegment,
  onSelectCollision,
  onSelectPile,
  onCameraMove,
}: SceneContentProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const setCameraPosition = useUIStore((state) => state.setCameraPosition);

  useFrame(() => {
    if (controlsRef.current) {
      const target = controlsRef.current.target;
      setCameraPosition(
        { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        { x: target.x, y: target.y, z: target.z }
      );
    }
  });

  const selectedSegment = usePipelineStore((state) => state.selectedSegment);
  const selectedCollision = useCollisionStore((state) => state.selectedCollision);

  const handleSceneClick = () => {
    onSelectSegment(null);
    onSelectCollision(null);
  };

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[cameraPosition.x, cameraPosition.y, cameraPosition.z]}
        fov={50}
        near={0.1}
        far={2000}
      />
      <CameraController position={cameraPosition} target={cameraTarget} />
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={500}
        maxPolarAngle={Math.PI / 2 - 0.05}
      />

      <ambientLight intensity={0.4} />
      <directionalLight
        position={[200, 300, 200]}
        intensity={0.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-100, 100, -100]} intensity={0.3} />
      <pointLight position={[150, 50, 0]} intensity={0.5} color="#60a5fa" />

      <fog attach="fog" args={['#0a1929', 100, 600]} />

      {visibility.grid && <Ground size={500} divisions={50} position={[150, 0, 0]} />}
      {visibility.grid && <Axes size={20} position={[0, 0.01, 0]} />}
      {visibility.pileNo && <RoadCenterLine />}

      <group onClick={handleSceneClick}>
        <PipelineGroup
          segments={segments}
          visibility={visibility}
          selectedSegment={selectedSegment}
          transparency={transparency}
          onSelectSegment={onSelectSegment}
        />

        <CollisionMarkersGroup
          collisions={collisions}
          visible={visibility.collision}
          selectedCollision={selectedCollision}
          onSelectCollision={onSelectCollision}
        />

        <PileNoMarkersGroup
          markers={pileMarkers}
          visible={visibility.pileNo}
          highlightedPileNo={highlightedPileNo}
          onSelectPile={onSelectPile}
        />
      </group>
    </>
  );
}

interface PipelineSceneProps {
  segments: PipelineSegment[];
  collisions: CollisionPoint[];
  pileMarkers: PileMarker[];
  visibility: LayerVisibility;
  transparency: number;
  highlightedPileNo: string;
  onSelectSegment: (segment: PipelineSegment | null) => void;
  onSelectCollision: (collision: CollisionPoint | null) => void;
  onSelectPile: (marker: PileMarker) => void;
  onCameraMove: (pos: Point3D, target: Point3D) => void;
}

export function PipelineScene({
  segments,
  collisions,
  pileMarkers,
  visibility,
  transparency,
  highlightedPileNo,
  onSelectSegment,
  onSelectCollision,
  onSelectPile,
  onCameraMove,
}: PipelineSceneProps) {
  const cameraPosition = useUIStore((state) => state.cameraPosition);
  const cameraTarget = useUIStore((state) => state.cameraTarget);

  return (
    <Canvas
      shadows
      camera={{ position: [cameraPosition.x, cameraPosition.y, cameraPosition.z], fov: 50 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      style={{ background: 'linear-gradient(180deg, #0a1929 0%, #1e3a5f 100%)' }}
      dpr={[1, 2]}
    >
      <SceneContent
        segments={segments}
        collisions={collisions}
        pileMarkers={pileMarkers}
        visibility={visibility}
        transparency={transparency}
        cameraPosition={cameraPosition}
        cameraTarget={cameraTarget}
        highlightedPileNo={highlightedPileNo}
        onSelectSegment={onSelectSegment}
        onSelectCollision={onSelectCollision}
        onSelectPile={onSelectPile}
        onCameraMove={onCameraMove}
      />
    </Canvas>
  );
}
