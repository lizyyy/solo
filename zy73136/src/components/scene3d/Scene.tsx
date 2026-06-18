import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { Ocean } from './Ocean';
import { Terrain } from './Terrain';
import { BuoyMarker } from './BuoyMarker';
import { AnomalyArea } from './AnomalyArea';
import { useAppStore } from '../../store/useAppStore';
import { useSyncState } from '../../hooks/useSyncState';

function CameraController() {
  const { camera } = useThree();
  const { selectedBuoyId, cameraPosition, setCameraPosition, buoys } = useAppStore();
  const targetPosition = useRef(new THREE.Vector3(0, 15, 20));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    if (selectedBuoyId) {
      const buoy = buoys.find((b) => b.id === selectedBuoyId);
      if (buoy) {
        const x = (buoy.lng - 121.49) * 100;
        const z = (31.24 - buoy.lat) * 100;
        targetPosition.current.set(x + 5, 8, z + 5);
        targetLookAt.current.set(x, 0, z);
      }
    } else {
      targetPosition.current.set(0, 15, 20);
      targetLookAt.current.set(0, 0, 0);
    }
  }, [selectedBuoyId, buoys]);

  useFrame((_, delta) => {
    camera.position.lerp(targetPosition.current, delta * 2);
    camera.lookAt(targetLookAt.current);
    setCameraPosition([camera.position.x, camera.position.y, camera.position.z]);
  });

  return null;
}

function SceneContent() {
  const {
    buoys,
    selectedBuoyId,
    currentTime,
    filterParams,
    getFilteredAnomalies,
    setSceneReady,
  } = useAppStore();

  const { handleBuoyClick, handleAnomalyClick } = useSyncState();

  const visibleAnomalies = useMemo(() => {
    const anomalies = getFilteredAnomalies();
    return anomalies.filter(
      (a) => Math.abs(a.timestamp - currentTime) < 60 * 60 * 1000
    );
  }, [getFilteredAnomalies, currentTime]);

  const visibleBuoys = useMemo(() => {
    if (filterParams.buoyIds.length === 0) return buoys;
    return buoys.filter((b) => filterParams.buoyIds.includes(b.id));
  }, [buoys, filterParams.buoyIds]);

  const getBuoyHighestAnomalyLevel = (buoyId: string) => {
    const buoyAnomalies = visibleAnomalies.filter((a) => a.buoyId === buoyId);
    if (buoyAnomalies.length === 0) return undefined;

    const levelOrder = ['low', 'medium', 'high', 'critical'];
    return buoyAnomalies.reduce((highest, a) => {
      return levelOrder.indexOf(a.level) > levelOrder.indexOf(highest || 'low')
        ? a.level
        : highest;
    }, undefined as any);
  };

  useEffect(() => {
    setSceneReady(true);
    return () => setSceneReady(false);
  }, [setSceneReady]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[-10, 10, -10]} intensity={0.5} color="#00D4FF" />

      <fog attach="fog" args={['#0A1628', 20, 80]} />

      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={0.5} />

      <Terrain />
      <Ocean />

      {visibleBuoys.map((buoy) => {
        const hasAnomaly = visibleAnomalies.some((a) => a.buoyId === buoy.id);
        const highestLevel = getBuoyHighestAnomalyLevel(buoy.id);

        return (
          <BuoyMarker
            key={buoy.id}
            buoy={buoy}
            isSelected={selectedBuoyId === buoy.id}
            hasAnomaly={hasAnomaly}
            anomalyLevel={highestLevel}
            onClick={() => handleBuoyClick(buoy.id)}
          />
        );
      })}

      {visibleAnomalies.map((anomaly) => (
        <AnomalyArea
          key={anomaly.id}
          anomaly={anomaly}
          isSelected={false}
          onClick={() => handleAnomalyClick(anomaly.id)}
        />
      ))}

      <CameraController />

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={50}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.5}
      />

      <EffectComposer>
        <Bloom
          intensity={0.6}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

export function Scene3D() {
  return (
    <Canvas
      camera={{ position: [0, 15, 20], fov: 60 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#0A1628' }}
      dpr={[1, 2]}
    >
      <SceneContent />
    </Canvas>
  );
}

export const Scene = Scene3D;
