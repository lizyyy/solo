import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats, Environment } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import Shelf3D from './Shelf3D';
import RobotModel from './RobotModel';
import PathTube from './PathTube';
import ChargingStation3D from './ChargingStation3D';
import FloorGrid from './FloorGrid';
import HeatmapVolume from './HeatmapVolume';
import SceneEffects from './SceneEffects';
import { useDataStore } from '../store/dataStore';
import { useFilterStore } from '../store/filterStore';
import { useViewStore } from '../store/viewStore';

function SceneContent() {
  const warehouse = useDataStore((s) => s.warehouse);
  const robots = useDataStore((s) => s.robots);
  const pathSegments = useDataStore((s) => s.pathSegments);
  const isLoading = useDataStore((s) => s.isLoading);
  const showPaths = useFilterStore((s) => s.showPaths);
  const showHeatmap = useFilterStore((s) => s.showHeatmap);
  const showQueue = useFilterStore((s) => s.showQueue);
  const selectedFloor = useFilterStore((s) => s.selectedFloor);
  const selectedRobotIds = useFilterStore((s) => s.selectedRobotIds);
  const clearSelection = useViewStore((s) => s.clearSelection);

  const maxDensity = useMemo(() => {
    if (pathSegments.length === 0) return 1;
    return Math.max(...pathSegments.map((s) => s.density));
  }, [pathSegments]);

  const filteredSegments = useMemo(() => {
    let segments = pathSegments;
    if (selectedRobotIds.length > 0) {
      segments = segments.filter((s) => selectedRobotIds.includes(s.robotId));
    }
    return segments;
  }, [pathSegments, selectedRobotIds]);

  const filteredRobots = useMemo(() => {
    let result = robots;
    if (selectedFloor !== null) {
      result = result.filter((r) => r.currentFloor === selectedFloor);
    }
    if (selectedRobotIds.length > 0) {
      result = result.filter((r) => selectedRobotIds.includes(r.id));
    }
    return result;
  }, [robots, selectedFloor, selectedRobotIds]);

  if (isLoading || !warehouse) {
    return null;
  }

  const FLOOR_HEIGHT = 4;

  return (
    <>
      <color attach="background" args={['#0F172A']} />
      <fog attach="fog" args={['#0F172A', 30, 80]} />

      <ambientLight intensity={0.3} />
      <directionalLight
        position={[20, 30, 20]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={100}
        shadow-camera-near={0.1}
      />
      <pointLight position={[0, 15, 0]} intensity={0.5} color="#3B82F6" />
      <pointLight position={[20, 10, 15]} intensity={0.3} color="#06B6D4" />

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={50}
        minPolarAngle={Math.PI * 0.05}
        maxPolarAngle={Math.PI * 0.47}
        enablePan
        panSpeed={0.5}
        rotateSpeed={0.5}
        makeDefault
      />

      <group onPointerMissed={clearSelection}>
        {warehouse.floors
          .filter((f) => selectedFloor === null || f.level === selectedFloor)
          .map((floor) => {
            const floorZ = (floor.level - 1) * FLOOR_HEIGHT;
            const isFloorSelected = selectedFloor === floor.level;
            return (
              <group key={floor.id}>
                <FloorGrid
                  floorLevel={floor.level}
                  floorZ={floorZ}
                  width={warehouse.width}
                  depth={warehouse.depth}
                  zones={floor.zones}
                  isSelected={isFloorSelected}
                />

                {floor.shelves.map((shelf) => (
                  <Shelf3D key={shelf.id} shelf={shelf} floorZ={floorZ} />
                ))}

                {showQueue && floor.chargingStations.map((station) => (
                  <ChargingStation3D
                    key={station.id}
                    station={station}
                    floorZ={floorZ}
                    robots={robots}
                  />
                ))}

                {showHeatmap && (
                  <HeatmapVolume
                    shelves={floor.shelves}
                    floorZ={floorZ}
                    visible={showHeatmap}
                  />
                )}
              </group>
            );
          })}

        {showPaths && filteredSegments.map((segment) => (
          <PathTube key={segment.id} segment={segment} maxDensity={maxDensity} />
        ))}

        {filteredRobots.map((robot) => (
          <RobotModel key={robot.id} robot={robot} />
        ))}
      </group>

      <SceneEffects />
    </>
  );
}

export default function WarehouseScene() {
  return (
    <div className="canvas-container">
      <Canvas
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        camera={{
          position: [35, 40, 35],
          fov: 45,
          near: 0.1,
          far: 200,
        }}
      >
        <Suspense fallback={null}>
          <SceneContent />
          <EffectComposer>
            <Bloom
              luminanceThreshold={0.2}
              luminanceSmoothing={0.9}
              height={300}
              intensity={0.8}
            />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
