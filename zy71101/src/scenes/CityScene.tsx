import { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useAppStore } from '@/store';
import { Buildings, Ground } from './Buildings';
import { NoFlyZones } from './NoFlyZone';
import { FlightPath } from './FlightPath';
import { Drone } from './Drone';
import { interpolatePosition } from '@/utils/battery';
import { checkFullFlightPath } from '@/utils/collision';
import { defaultMission } from '@/data/mockMissions';

interface SceneControllerProps {
  cameraView: 'orbit' | 'firstPerson' | 'topDown';
}

const SceneController = ({ cameraView }: SceneControllerProps) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const { setCameraState, dronePosition, currentMission } = useAppStore();

  useEffect(() => {
    if (cameraView === 'topDown') {
      camera.position.set(0, 200, 0.1);
      camera.lookAt(0, 0, 0);
    } else if (cameraView === 'orbit') {
      camera.position.set(150, 120, 150);
      camera.lookAt(0, 30, 0);
    } else if (cameraView === 'firstPerson' && dronePosition) {
      camera.position.set(dronePosition.x + 10, dronePosition.y + 5, dronePosition.z + 10);
      camera.lookAt(dronePosition.x, dronePosition.y, dronePosition.z);
    }
  }, [cameraView, dronePosition, camera]);

  useEffect(() => {
    const updateCameraState = () => {
      if (controlsRef.current) {
        setCameraState({
          position: [camera.position.x, camera.position.y, camera.position.z],
          target: [
            controlsRef.current.target.x,
            controlsRef.current.target.y,
            controlsRef.current.target.z
          ]
        });
      }
    };

    const interval = setInterval(updateCameraState, 100);
    return () => clearInterval(interval);
  }, [camera, setCameraState]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={20}
      maxDistance={500}
      maxPolarAngle={Math.PI / 2.1}
    />
  );
};

const AnimationController = () => {
  const {
    currentMission,
    currentTime,
    isPlaying,
    setDronePosition,
    addAlert,
    clearAlerts,
    setIsPlaying,
    totalDuration
  } = useAppStore();

  useFrame(() => {
    if (!currentMission || !isPlaying) return;

    if (currentTime >= totalDuration) {
      setIsPlaying(false);
      return;
    }

    const waypoints = currentMission.flightPaths[0]?.waypoints || [];
    const result = interpolatePosition(waypoints, currentTime);
    
    if (result) {
      setDronePosition(result.position);
    }
  });

  useEffect(() => {
    if (!currentMission) return;

    clearAlerts();
    const waypoints = currentMission.flightPaths[0]?.waypoints || [];
    const collisions = checkFullFlightPath(
      waypoints,
      currentMission.buildings,
      currentMission.noFlyZones
    );

    collisions.forEach(collision => {
      addAlert({
        type: collision.type === 'height_mismatch' ? 'height_unit' : 'collision',
        severity: collision.type === 'height_mismatch' ? 'warning' : 'danger',
        message: collision.message,
        position: collision.position
      });
    });
  }, [currentMission, clearAlerts, addAlert]);

  return null;
};

const SceneContent = () => {
  const {
    currentMission,
    selectedWaypoint,
    setSelectedWaypoint,
    updateWaypoint,
    filters,
    dronePosition,
    cameraView
  } = useAppStore();

  const mission = currentMission || defaultMission;

  return (
    <>
      <Sky
        distance={450000}
        sunPosition={[100, 50, 100]}
        inclination={0.5}
        azimuth={0.25}
      />

      <ambientLight intensity={0.4} />
      <directionalLight
        position={[100, 100, 50]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={500}
        shadow-camera-left={-200}
        shadow-camera-right={200}
        shadow-camera-top={200}
        shadow-camera-bottom={-200}
      />
      <hemisphereLight args={['#87CEEB', '#1E293B', 0.3]} />

      <Ground />

      <Buildings
        buildings={mission.buildings}
        visible={filters.showBuildings}
      />

      <NoFlyZones
        zones={mission.noFlyZones}
        visible={filters.showNoFlyZones}
      />

      {mission.flightPaths.map(fp => (
        <FlightPath
          key={fp.id}
          flightPath={fp}
          selectedWaypoint={selectedWaypoint}
          onSelectWaypoint={setSelectedWaypoint}
          onUpdateWaypoint={updateWaypoint}
          visible={filters.showFlightPath}
        />
      ))}

      <Drone
        position={dronePosition || mission.flightPaths[0]?.waypoints[0]?.position || null}
        visible={filters.showFlightPath}
      />

      <SceneController cameraView={cameraView} />
      <AnimationController />

      <EffectComposer>
        <Bloom
          intensity={0.5}
          luminanceThreshold={0.8}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
};

export const CityScene = () => {
  return (
    <Canvas
      id="scene-canvas"
      shadows
      camera={{ position: [150, 120, 150], fov: 60 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#0F172A' }}
    >
      <SceneContent />
    </Canvas>
  );
};
