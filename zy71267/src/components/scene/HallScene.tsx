import { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom, FXAA } from '@react-three/postprocessing';
import type { AcousticDataset, DisplayParameter, RayFilterOptions } from '../../data/models/acoustic';
import type { Anomaly } from '../../data/models/anomalies';
import { HallModel } from './HallModel';
import { SoundSources } from './SoundSource';
import { Seats } from './Seats';
import { RayPaths } from './RayPaths';
import { SoundField } from './SoundField';

interface HallSceneContentProps {
  dataset: AcousticDataset;
  displayParam: DisplayParameter;
  rayFilter: RayFilterOptions;
  selectedSeatId: string | null;
  hoveredSeatId: string | null;
  anomalies: Anomaly[];
  showHallWireframe: boolean;
  showRays: boolean;
  showSeats: boolean;
  showSources: boolean;
  cameraView: string;
  onSeatSelect: (seatId: string | null) => void;
  onSeatHover: (seatId: string | null) => void;
  getFilteredRays: () => AcousticDataset['rayPaths'];
}

function CameraController({ cameraView }: { cameraView: string }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const positions: Record<string, [number, number, number]> = {
      perspective: [35, 25, 35],
      top: [0, 50, 0],
      front: [0, 10, 45],
      side: [45, 10, 0],
    };

    const target: [number, number, number] = [0, 3, 0];
    const pos = positions[cameraView] || positions.perspective;

    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(target[0], target[1], target[2]);

    if (controlsRef.current) {
      controlsRef.current.target.set(target[0], target[1], target[2]);
      controlsRef.current.update();
    }
  }, [cameraView, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={10}
      maxDistance={80}
      maxPolarAngle={Math.PI / 2 - 0.1}
      makeDefault
    />
  );
}

function HallSceneContent({
  dataset,
  displayParam,
  rayFilter,
  selectedSeatId,
  hoveredSeatId,
  anomalies,
  showHallWireframe,
  showRays,
  showSeats,
  showSources,
  cameraView,
  onSeatSelect,
  onSeatHover,
  getFilteredRays,
}: HallSceneContentProps) {
  const filteredRays = getFilteredRays();

  return (
    <>
      <CameraController cameraView={cameraView} />

      <ambientLight intensity={0.4} color="#4a5568" />
      <directionalLight
        position={[-15, 20, -15]}
        intensity={1}
        color="#ffecd2"
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[15, 15, 15]} intensity={0.5} color="#87ceeb" />

      <HallModel
        hall={dataset.hall}
        faces={dataset.materialFaces}
        anomalies={anomalies}
        wireframe={showHallWireframe}
      />

      {showSources && <SoundSources sources={dataset.soundSources} />}

      {showSeats && (
        <Seats
          seats={dataset.seats}
          readings={dataset.acousticReadings}
          displayParam={displayParam}
          selectedSeatId={selectedSeatId}
          hoveredSeatId={hoveredSeatId}
          anomalies={anomalies}
          onSeatClick={onSeatSelect}
          onSeatHover={onSeatHover}
        />
      )}

      {showRays && filteredRays.length > 0 && (
        <RayPaths rays={filteredRays} maxVisible={2000} />
      )}

      <SoundField
        seats={dataset.seats}
        readings={dataset.acousticReadings}
        displayParam={displayParam}
        enabled={showSeats}
      />

      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.4}
        scale={100}
        blur={2}
        far={10}
        color="#000000"
      />

      <Environment preset="city" />

      <EffectComposer>
        <Bloom
          intensity={0.8}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <FXAA />
      </EffectComposer>
    </>
  );
}

interface HallSceneProps {
  dataset: AcousticDataset;
  displayParam: DisplayParameter;
  rayFilter: RayFilterOptions;
  selectedSeatId: string | null;
  hoveredSeatId: string | null;
  anomalies: Anomaly[];
  showHallWireframe: boolean;
  showRays: boolean;
  showSeats: boolean;
  showSources: boolean;
  cameraView: string;
  onSeatSelect: (seatId: string | null) => void;
  onSeatHover: (seatId: string | null) => void;
  getFilteredRays: () => AcousticDataset['rayPaths'];
}

export function HallScene(props: HallSceneProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [35, 25, 35], fov: 50 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      style={{ background: 'linear-gradient(180deg, #0a0e1a 0%, #1a1f2e 100%)' }}
    >
      <HallSceneContent {...props} />
    </Canvas>
  );
}
