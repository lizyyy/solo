import { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from './RoomEnvironment';
import { Rack3D } from './Rack3D';
import { HeatLayer } from './HeatLayer';
import { ACUnit3D } from './ACUnit3D';
import { useAppStore } from '../../store/useAppStore';
import { Rack } from '../../types';

function CameraController() {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const { cameraViews, currentCameraView } = useAppStore();

  const targetView = useMemo(() => {
    return cameraViews.find((v) => v.id === currentCameraView);
  }, [cameraViews, currentCameraView]);

  useFrame(() => {
    if (targetView && controlsRef.current) {
      const targetPos = new THREE.Vector3(...targetView.position);
      const targetLookAt = new THREE.Vector3(...targetView.target);

      camera.position.lerp(targetPos, 0.02);
      controlsRef.current.target.lerp(targetLookAt, 0.02);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      minDistance={5}
      maxDistance={40}
      maxPolarAngle={Math.PI / 2 - 0.1}
      enableDamping
      dampingFactor={0.05}
    />
  );
}

function SceneContent() {
  const {
    dataCenter,
    timeSeriesData,
    currentTimeIndex,
    selectedRackId,
    setSelectedRackId,
    showHeatLayer,
    showLabels,
    showRacks,
    showAirFlow,
    getCurrentRackData,
  } = useAppStore();

  const currentRacks = useMemo(() => {
    if (!dataCenter) return [];
    
    return dataCenter.racks.map((rack) => {
      const timeData = timeSeriesData[currentTimeIndex]?.racks.find(
        (r) => r.id === rack.id
      );
      return {
        ...rack,
        power: timeData?.power ?? rack.power,
        temperature: timeData?.temperature ?? rack.temperature,
        status: timeData?.status ?? rack.status,
      } as Rack;
    });
  }, [dataCenter, timeSeriesData, currentTimeIndex]);

  if (!dataCenter) {
    return (
      <group>
        <RoomEnvironment dimensions={{ width: 30, depth: 20, height: 4 }} />
        <ambientLight intensity={0.5} />
      </group>
    );
  }

  return (
    <group>
      <RoomEnvironment dimensions={dataCenter.dimensions} />

      {showHeatLayer && (
        <HeatLayer racks={currentRacks} dimensions={dataCenter.dimensions} />
      )}

      {showRacks &&
        currentRacks.map((rack) => (
          <Rack3D
            key={rack.id}
            rack={rack}
            isSelected={selectedRackId === rack.id}
            onClick={() => setSelectedRackId(rack.id)}
            showLabel={showLabels}
          />
        ))}

      {dataCenter.acUnits.map((ac) => (
        <ACUnit3D key={ac.id} ac={ac} showAirFlow={showAirFlow} />
      ))}

      <CameraController />
    </group>
  );
}

export function DataCenterScene() {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 15, 15], fov: 50 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#0a1628' }}
    >
      <fog attach="fog" args={['#0a1628', 20, 50]} />
      <SceneContent />
    </Canvas>
  );
}
