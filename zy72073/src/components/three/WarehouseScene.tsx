import React, { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useStore, useFilteredPoints } from '../../store/useStore';
import { warehouseConfig } from '../../data/mockData';
import { Shelf } from './Shelf';
import { PointMarker } from './PointMarker';
import { CrossFloorLink } from './CrossFloorLink';
import { Floor } from './Floor';
import { CoordinateAxes } from './CoordinateAxes';

const CameraController: React.FC = () => {
  const { camera } = useThree();
  const { cameraPosition, cameraTarget, setCameraState } = useStore();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    camera.position.set(...cameraPosition as [number, number, number]);
    if (controlsRef.current) {
      controlsRef.current.target.set(...cameraTarget as [number, number, number]);
      controlsRef.current.update();
    }
  }, [camera, cameraPosition, cameraTarget]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      minDistance={5}
      maxDistance={60}
      maxPolarAngle={Math.PI / 2.1}
      onEnd={() => {
        if (controlsRef.current) {
          setCameraState(
            [camera.position.x, camera.position.y, camera.position.z],
            [controlsRef.current.target.x, controlsRef.current.target.y, controlsRef.current.target.z]
          );
        }
      }}
    />
  );
};

const SceneContent: React.FC = () => {
  const filteredPoints = useFilteredPoints();
  const {
    selectedPointId,
    setSelectedPoint,
    activeFloor,
    showCrossFloorLinks,
    cameraTarget,
  } = useStore();

  const crossFloorPairs = React.useMemo(() => {
    const pairs: Array<{ point1: typeof filteredPoints[0]; point2: typeof filteredPoints[0] }> = [];
    const processed = new Set<string>();
    filteredPoints.forEach((p) => {
      if (p.crossFloor && !processed.has(p.id)) {
        const linked = filteredPoints.find((lp) => lp.id === p.crossFloor?.linkedPointId);
        if (linked) {
          pairs.push({ point1: p, point2: linked });
          processed.add(p.id);
          processed.add(linked.id);
        }
      }
    });
    return pairs;
  }, [filteredPoints]);

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} castShadow />
      <pointLight position={[0, 15, 0]} intensity={0.4} color="#06B6D4" />

      <CoordinateAxes visible={true} />

      {warehouseConfig.floors.map((floor) => (
        <Floor
          key={floor}
          floor={floor}
          y={(floor - 1) * warehouseConfig.floorHeight}
          visible={activeFloor === 0 || activeFloor === floor}
        />
      ))}

      {warehouseConfig.shelves.map((shelf, i) => (
        <Shelf
          key={i}
          x={shelf.x}
          y={(shelf.floor - 1) * warehouseConfig.floorHeight}
          z={shelf.z}
          width={shelf.width}
          depth={shelf.depth}
          height={shelf.height}
          name={shelf.name}
          visible={activeFloor === 0 || activeFloor === shelf.floor}
        />
      ))}

      {filteredPoints.map((point) => (
        <PointMarker
          key={point.id}
          point={point}
          isSelected={point.id === selectedPointId}
          onClick={() => setSelectedPoint(point.id)}
          visible={activeFloor === 0 || activeFloor === point.position.floor}
        />
      ))}

      {showCrossFloorLinks &&
        crossFloorPairs.map(({ point1, point2 }, i) => (
          <CrossFloorLink
            key={i}
            point1={point1}
            point2={point2}
            visible={activeFloor === 0}
          />
        ))}

      <EffectComposer>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={1.5} />
      </EffectComposer>
    </>
  );
};

export const WarehouseScene: React.FC = () => {
  return (
    <Canvas
      camera={{ position: [25, 20, 25], fov: 50 }}
      style={{ background: '#0a0f1a' }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <CameraController />
      <SceneContent />
    </Canvas>
  );
};
