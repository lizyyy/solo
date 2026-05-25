import { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from './RoomEnvironment';
import { Rack3D } from './Rack3D';
import { HeatLayer } from './HeatLayer';
import { ACUnit3D } from './ACUnit3D';
import { useAppStore } from '../../store/useAppStore';
import { Rack, AlertLevel } from '../../types';

function CameraController() {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const cameraViews = useAppStore((state) => state.cameraViews);
  const currentCameraView = useAppStore((state) => state.currentCameraView);

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
  const dataCenter = useAppStore((state) => state.dataCenter);
  const timeSeriesData = useAppStore((state) => state.timeSeriesData);
  const currentTimeIndex = useAppStore((state) => state.currentTimeIndex);
  const alertFilters = useAppStore((state) => state.alertFilters);
  const selectedRackId = useAppStore((state) => state.selectedRackId);
  const setSelectedRackId = useAppStore((state) => state.setSelectedRackId);
  const showHeatLayer = useAppStore((state) => state.showHeatLayer);
  const showLabels = useAppStore((state) => state.showLabels);
  const showRacks = useAppStore((state) => state.showRacks);
  const showAirFlow = useAppStore((state) => state.showAirFlow);

  const filteredRacks = useMemo(() => {
    if (!dataCenter) return [];

    const statusToAlertLevel: Record<string, AlertLevel> = {
      critical: 'critical',
      warning: 'warning',
      normal: 'info',
      offline: 'critical',
    };

    return dataCenter.racks
      .map((rack) => {
        const timeData = timeSeriesData[currentTimeIndex]?.racks.find(
          (r) => r.id === rack.id
        );
        return {
          ...rack,
          power: timeData?.power ?? rack.power,
          temperature: timeData?.temperature ?? rack.temperature,
          status: timeData?.status ?? rack.status,
        } as Rack;
      })
      .filter((rack) => {
        const alertLevel = statusToAlertLevel[rack.status];
        return alertFilters.includes(alertLevel);
      });
  }, [dataCenter, timeSeriesData, currentTimeIndex, alertFilters]);

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
        <HeatLayer racks={filteredRacks} dimensions={dataCenter.dimensions} />
      )}

      {showRacks &&
        filteredRacks.map((rack) => (
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
