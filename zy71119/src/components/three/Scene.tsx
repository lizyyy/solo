import { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import Building from './Building';
import WindowUnit from './WindowUnit';
import Sun from './Sun';
import Ground from './Ground';
import { useAppStore } from '../../store/useAppStore';
import { calculateSunPosition, getSunlightColor, getSkyColor, isSunVisible } from '../../utils/sunCalculation';
import { checkWindowShadowed } from '../../utils/shadowDetection';
import { SunPosition } from '../../types';

interface CameraControllerProps {
  targetLookAt: [number, number, number];
}

function CameraController({ targetLookAt }: CameraControllerProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.target.set(targetLookAt[0], targetLookAt[1], targetLookAt[2]);
      controlsRef.current.update();
    }
  }, [targetLookAt]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={30}
      maxDistance={200}
      maxPolarAngle={Math.PI / 2 - 0.1}
    />
  );
}

function SceneContent() {
  const { 
    buildings, 
    windows, 
    currentDate, 
    currentTime,
    isPlaying,
    playSpeed,
    setTime,
    shadowRecords,
  } = useAppStore();

  const sunPosition: SunPosition = useMemo(() => {
    return calculateSunPosition(currentDate, currentTime);
  }, [currentDate, currentTime]);

  const lightColor = getSunlightColor(sunPosition.altitude);
  const skyColor = getSkyColor(sunPosition.altitude);
  const sunVisible = isSunVisible(sunPosition.altitude);

  const { scene } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color(skyColor[0], skyColor[1], skyColor[2]);
  }, [skyColor, scene]);

  useFrame((state, delta) => {
    if (isPlaying && sunVisible) {
      const newTime = currentTime + delta * playSpeed * 30;
      if (newTime >= 1080) {
        setTime(360);
      } else {
        setTime(newTime);
      }
    }
  });

  const windowShadowStatus = useMemo(() => {
    const status: Record<string, boolean> = {};
    windows.forEach(window => {
      if (sunVisible && sunPosition.direction) {
        const shadowed = checkWindowShadowed(window, buildings, sunPosition.direction);
        status[window.id] = !!shadowed;
      } else {
        status[window.id] = false;
      }
    });
    return status;
  }, [windows, buildings, sunPosition.direction, sunVisible]);

  const shadowedBuildings = useMemo(() => {
    const buildingIds = new Set<string>();
    shadowRecords.forEach(record => {
      if (currentTime >= record.startTime && currentTime <= record.endTime) {
        buildingIds.add(record.buildingId);
      }
    });
    return buildingIds;
  }, [shadowRecords, currentTime]);

  return (
    <>
      <ambientLight intensity={0.3} color="#94a3b8" />
      
      <Sun sunPosition={sunPosition} lightColor={lightColor} />
      
      <Ground />
      
      {buildings.map(building => (
        <Building 
          key={building.id} 
          building={{
            ...building,
            color: shadowedBuildings.has(building.id) ? '#ef4444' : building.color,
          }}
        />
      ))}
      
      {windows.map(window => (
        <WindowUnit
          key={window.id}
          window={window}
          isShadowed={windowShadowStatus[window.id]}
        />
      ))}

      <fog attach="fog" args={[`rgb(${skyColor[0] * 255}, ${skyColor[1] * 255}, ${skyColor[2] * 255})`, 100, 250]} />
    </>
  );
}

export default function ThreeScene() {
  const { cameraPosition, cameraTarget } = useAppStore();

  return (
    <Canvas
      shadows
      camera={{ position: cameraPosition, fov: 50 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
    >
      <CameraController targetLookAt={cameraTarget} />
      <SceneContent />
    </Canvas>
  );
}
