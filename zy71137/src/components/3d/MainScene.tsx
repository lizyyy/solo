import { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import { useSimulationStore } from '@/store/useSimulationStore';
import { Orchard } from './Orchard';
import { Sprinkler } from './Sprinkler';
import { Canal } from './Canal';
import { AdjacentField } from './AdjacentField';
import { ParticleSystem } from './ParticleSystem';
import { WindIndicator } from './WindIndicator';
import { CAMERA_POSITIONS } from '@/data/constants';
import * as THREE from 'three';

function CameraController() {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const { cameraView } = useSimulationStore();

  useEffect(() => {
    const viewConfig = CAMERA_POSITIONS[cameraView];
    if (viewConfig && controlsRef.current) {
      camera.position.set(...viewConfig.position);
      controlsRef.current.target.set(...viewConfig.target);
      controlsRef.current.update();
    }
  }, [cameraView, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      minDistance={10}
      maxDistance={80}
      maxPolarAngle={Math.PI / 2.1}
    />
  );
}

function SceneContent() {
  const { currentScene, isPlaying, params, alerts } = useSimulationStore();
  const { orchard, sprinklers, canal, adjacentFields } = currentScene;

  const sprinklerPositions = sprinklers.map((s) => s.position) as [number, number, number][];

  const getFieldAlertStatus = (fieldId: string) => {
    const fieldAlerts = alerts.filter((a) => a.fieldName && a.fieldName.includes(fieldId));
    if (fieldAlerts.length > 0) {
      const hasDanger = fieldAlerts.some((a) => a.severity === 'danger');
      return { hasAlert: true, severity: hasDanger ? 'danger' : 'warning' } as const;
    }
    return { hasAlert: false, severity: undefined } as const;
  };

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[30, 50, 30]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={100}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />

      <Sky
        distance={450000}
        sunPosition={[100, 50, 100]}
        inclination={0.5}
        azimuth={0.25}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#3d5a3d" />
      </mesh>

      <Orchard data={orchard} />

      <Canal data={canal} />

      {adjacentFields.map((field) => {
        const { hasAlert, severity } = getFieldAlertStatus(field.id);
        return (
          <AdjacentField
            key={field.id}
            data={field}
            hasAlert={hasAlert}
            alertSeverity={severity}
          />
        );
      })}

      {sprinklers.map((sprinkler) => (
        <Sprinkler key={sprinkler.id} data={sprinkler} isActive={isPlaying} />
      ))}

      <ParticleSystem sprinklerPositions={sprinklerPositions} />

      <WindIndicator windSpeed={params.windSpeed} windDirection={params.windDirection} />

      <CameraController />

      <fog attach="fog" args={['#87ceeb', 60, 120]} />
    </>
  );
}

export function MainScene() {
  return (
    <Canvas
      shadows
      camera={{ position: [20, 20, 20], fov: 50 }}
      gl={{ antialias: true, alpha: false }}
    >
      <SceneContent />
    </Canvas>
  );
}