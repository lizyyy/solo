import { useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import Terrain from './Terrain';
import TrajectoryLine from './TrajectoryLine';
import FallPointMarker from './FallPointMarker';
import RescueStationMarker from './RescueStationMarker';
import RiskZone from './RiskZone';
import RescueRoute from './RescueRoute';
import PlannedRoute from './PlannedRoute';

function CameraController() {
  const { cameraPreset } = useSceneStore();
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const presets = {
      overview: { position: [80, 100, -80], target: [50, 0, 80] },
      top: { position: [50, 200, 80], target: [50, 0, 80] },
      side: { position: [150, 30, 80], target: [50, 0, 80] },
      closeup: { position: [60, 40, 40], target: [50, 0, 80] }
    };

    const preset = presets[cameraPreset];
    if (preset) {
      camera.position.set(...preset.position as [number, number, number]);
      if (controlsRef.current) {
        controlsRef.current.target.set(...preset.target as [number, number, number]);
        controlsRef.current.update();
      }
    }
  }, [cameraPreset, camera]);

  return <OrbitControls ref={controlsRef} makeDefault />;
}

function PlaybackUpdater() {
  const updatePlaybackTime = useSceneStore(state => state.updatePlaybackTime);
  const lastTime = useRef(0);

  useFrame((state) => {
    const currentTime = state.clock.elapsedTime * 1000;
    if (lastTime.current > 0) {
      const delta = currentTime - lastTime.current;
      updatePlaybackTime(delta);
    }
    lastTime.current = currentTime;
  });

  return null;
}

function TerrainClickHandler() {
  const { planningMode, addRoutePoint, sceneData } = useSceneStore();
  const { camera, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());

  const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    if (!planningMode || !sceneData) return;
    
    const rect = gl.domElement.getBoundingClientRect();
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.current.setFromCamera(mouse.current, camera);
    
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectPoint = new THREE.Vector3();
    raycaster.current.ray.intersectPlane(plane, intersectPoint);

    if (intersectPoint) {
      addRoutePoint({
        x: Math.max(0, Math.min(sceneData.terrain.width, intersectPoint.x)),
        y: 0,
        z: Math.max(0, Math.min(sceneData.terrain.depth, intersectPoint.z))
      });
    }
  }, [planningMode, sceneData, camera, gl, addRoutePoint]);

  return (
    <mesh
      position={[sceneData?.terrain.width / 2 || 50, 0, sceneData?.terrain.depth / 2 || 80]}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={handleClick}
      visible={false}
    >
      <planeGeometry args={[sceneData?.terrain.width || 100, sceneData?.terrain.depth || 160]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  );
}

function SceneContent() {
  const {
    sceneData,
    layerVisibility,
    playback,
    selectedItemId,
    selectItem,
    plannedRoute
  } = useSceneStore();

  if (!sceneData) return null;

  return (
    <>
      {layerVisibility.terrain && (
        <Terrain data={sceneData.terrain} />
      )}
      
      <TerrainClickHandler />
      
      {plannedRoute && plannedRoute.length > 0 && (
        <PlannedRoute points={plannedRoute} />
      )}

      {layerVisibility.trajectories && sceneData.trajectories.map(trajectory => (
        <TrajectoryLine
          key={trajectory.id}
          trajectory={trajectory}
          currentTime={playback.currentTime}
          terrainHeightmap={sceneData.terrain.heightmap}
          terrainScale={sceneData.terrain.scale}
        />
      ))}

      {layerVisibility.fallPoints && sceneData.fallPoints.map(point => (
        <FallPointMarker
          key={point.id}
          fallPoint={point}
          isSelected={selectedItemId === point.id}
          onClick={() => selectItem(point.id, 'fallPoint')}
          terrainHeightmap={sceneData.terrain.heightmap}
          terrainScale={sceneData.terrain.scale}
        />
      ))}

      {layerVisibility.rescueStations && sceneData.rescueStations.map(station => (
        <RescueStationMarker
          key={station.id}
          station={station}
          isSelected={selectedItemId === station.id}
          onClick={() => selectItem(station.id, 'rescueStation')}
          terrainHeightmap={sceneData.terrain.heightmap}
          terrainScale={sceneData.terrain.scale}
        />
      ))}

      {layerVisibility.riskZones && sceneData.riskZones.map(zone => (
        <RiskZone
          key={zone.id}
          zone={zone}
          isSelected={selectedItemId === zone.id}
          onClick={() => selectItem(zone.id, 'riskZone')}
          terrainHeightmap={sceneData.terrain.heightmap}
          terrainScale={sceneData.terrain.scale}
        />
      ))}

      {layerVisibility.rescueRoutes && sceneData.rescueRoutes.map(route => (
        <RescueRoute
          key={route.id}
          route={route}
          isSelected={selectedItemId === route.id}
          onClick={() => selectItem(route.id, 'rescueRoute')}
          terrainHeightmap={sceneData.terrain.heightmap}
          terrainScale={sceneData.terrain.scale}
        />
      ))}
    </>
  );
}

export function Scene() {
  return (
    <Canvas
      camera={{ position: [80, 100, -80], fov: 50 }}
      gl={{ antialias: true }}
      style={{ background: 'linear-gradient(to bottom, #87CEEB, #E0F4FF)' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[50, 100, -50]}
        intensity={1}
        castShadow
      />
      <directionalLight position={[-50, 50, 50]} intensity={0.3} />
      <fog attach="fog" args={['#E0F4FF', 100, 400]} />
      
      <CameraController />
      <PlaybackUpdater />
      <SceneContent />
    </Canvas>
  );
}

export default Scene;
