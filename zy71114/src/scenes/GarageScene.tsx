import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Garage, Vehicle as VehicleType, RiskPoint, Vector3 } from '../types';
import { Vehicle } from './Vehicle';
import { Ramp } from './Ramp';
import { Beam } from './Beam';
import { RiskMarker, EntranceSign, HeightIndicator } from './RiskMarker';
import { useAppStore } from '../store/useAppStore';
import { cameraPresets } from '../data/mockGarages';

interface SceneControllerProps {
  cameraPreset: string;
}

function SceneController({ cameraPreset }: SceneControllerProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const preset = cameraPresets.find((p) => p.id === cameraPreset);
    if (preset) {
      camera.position.set(...preset.position);
      if (controlsRef.current) {
        controlsRef.current.target.set(...preset.target);
        controlsRef.current.update();
      }
    }
  }, [cameraPreset, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      minDistance={5}
      maxDistance={50}
      maxPolarAngle={Math.PI / 2.1}
    />
  );
}

interface SimulationControllerProps {
  onProgressUpdate: (progress: number) => void;
  speed: number;
  isPlaying: boolean;
  rampPoints: Vector3[];
}

function SimulationController({
  onProgressUpdate,
  speed,
  isPlaying,
  rampPoints,
}: SimulationControllerProps) {
  const progressRef = useRef(0);

  useFrame((_, delta) => {
    if (isPlaying && rampPoints.length > 1) {
      progressRef.current += delta * speed * 0.1;
      if (progressRef.current >= 1) {
        progressRef.current = 1;
      }
      onProgressUpdate(progressRef.current);
    }
  });

  useEffect(() => {
    if (!isPlaying) {
      progressRef.current = useAppStore.getState().simulation.progress;
    }
  }, [isPlaying]);

  return null;
}

interface GarageContentProps {
  garage: Garage;
  vehicle: VehicleType;
  riskPoints: RiskPoint[];
  showRiskMarkers: boolean;
  showMeasurements: boolean;
}

function GarageContent({ garage, vehicle, riskPoints, showRiskMarkers, showMeasurements }: GarageContentProps) {
  const { simulation, setProgress, togglePlay } = useAppStore();

  return (
    <>
      <SimulationController
        onProgressUpdate={setProgress}
        speed={simulation.speed}
        isPlaying={simulation.isPlaying}
        rampPoints={garage.ramps[0]?.points || []}
      />

      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      <pointLight position={[0, 8, 15]} intensity={0.5} color="#FFF5E6" />
      <pointLight position={[-10, 6, 0]} intensity={0.3} color="#FFF5E6" />

      <Grid
        position={[0, -0.01, 0]}
        args={[60, 60]}
        cellSize={2}
        cellThickness={0.5}
        cellColor="#4B5563"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#6B7280"
        fadeDistance={50}
        fadeStrength={1}
        followCamera={false}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#374151" />
      </mesh>

      {garage.ramps.map((ramp) => (
        <Ramp key={ramp.id} ramp={ramp} />
      ))}

      {garage.beams.map((beam) => (
        <Beam key={beam.id} beam={beam} showHeightLine={showMeasurements} />
      ))}

      {garage.signs.map((sign) => (
        <EntranceSign key={sign.id} position={sign.position} text={sign.text} height={sign.height} />
      ))}

      {garage.entrances.map((entrance) => (
        <group key={entrance.id} position={entrance.position}>
          <mesh position={[0, 2, 0]}>
            <boxGeometry args={[0.3, 4, 0.3]} />
            <meshStandardMaterial color="#1F2937" />
          </mesh>
          {!entrance.hasSign && (
            <mesh position={[0, 4.5, 0]}>
              <sphereGeometry args={[0.3, 16, 16]} />
              <meshBasicMaterial color="#FF7D00" transparent opacity={0.8} />
            </mesh>
          )}
        </group>
      ))}

      <Vehicle vehicle={vehicle} position={simulation.currentPosition} rotation={[0, 0, 0]} />

      {showRiskMarkers &&
        riskPoints.map((risk) => <RiskMarker key={risk.id} risk={risk} />)}

      {showMeasurements &&
        garage.ramps[0]?.points.map((point, i) => (
          <HeightIndicator
            key={`meas-${i}`}
            position={point}
            height={2.5}
          />
        ))}

      <fog attach="fog" args={['#1F2937', 30, 60]} />
    </>
  );
}

interface GarageSceneProps {
  garage: Garage;
  vehicle: VehicleType;
  riskPoints: RiskPoint[];
  cameraPreset: string;
  showRiskMarkers: boolean;
  showMeasurements: boolean;
}

export function GarageScene({
  garage,
  vehicle,
  riskPoints,
  cameraPreset,
  showRiskMarkers,
  showMeasurements,
}: GarageSceneProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 15, -25], fov: 50 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#1F2937' }}
    >
      <SceneController cameraPreset={cameraPreset} />
      <GarageContent
        garage={garage}
        vehicle={vehicle}
        riskPoints={riskPoints}
        showRiskMarkers={showRiskMarkers}
        showMeasurements={showMeasurements}
      />
    </Canvas>
  );
}
