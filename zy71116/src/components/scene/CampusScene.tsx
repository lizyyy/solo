import { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Sky, Environment, Grid, Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';

import { CampusData, PointOfInterest as POIType } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { BuildingModel } from './Building';
import { FacilityModel } from './Facility';
import { ConstructionModel } from './Construction';
import { RouteLine } from './RouteLine';
import { PointOfInterest } from './PointOfInterest';

interface CameraControllerProps {
  onCameraChange: (position: THREE.Vector3, target: THREE.Vector3) => void;
}

const CameraController = ({ onCameraChange }: CameraControllerProps) => {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);

  useEffect(() => {
    const handleChange = () => {
      if (controlsRef.current) {
        onCameraChange(camera.position.clone(), controlsRef.current.target.clone());
      }
    };

    const controls = controlsRef.current;
    if (controls) {
      controls.addEventListener('change', handleChange);
      return () => controls.removeEventListener('change', handleChange);
    }
  }, [camera, onCameraChange]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      minDistance={10}
      maxDistance={150}
      maxPolarAngle={Math.PI / 2.1}
    />
  );
};

interface SceneContentProps {
  campusData: CampusData;
}

const SceneContent = ({ campusData }: SceneContentProps) => {
  const {
    currentRoute,
    timelinePosition,
    filters,
    selectedStartPoint,
    selectedEndPoint,
    setSelectedStartPoint,
    setSelectedEndPoint,
    setCameraState,
  } = useAppStore();

  const handleCameraChange = (position: THREE.Vector3, target: THREE.Vector3) => {
    setCameraState({
      position: { x: position.x, y: position.y, z: position.z },
      target: { x: target.x, y: target.y, z: target.z },
      fov: 50,
    });
  };

  const handlePOIClick = (point: POIType) => {
    if (point.type === 'start') {
      setSelectedStartPoint(selectedStartPoint === point.id ? null : point.id);
    } else {
      setSelectedEndPoint(selectedEndPoint === point.id ? null : point.id);
    }
  };

  return (
    <>
      <CameraController onCameraChange={handleCameraChange} />

      <ambientLight intensity={0.6} />
      <directionalLight
        position={[50, 80, 30]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-30, 40, -20]} intensity={0.4} />

      <Sky sunPosition={[100, 50, 100]} />
      <Environment preset="city" />
      <Stars radius={100} depth={50} count={1000} factor={4} saturation={0} fade speed={1} />

      <Grid
        position={[0, 0.01, 0]}
        args={[200, 200]}
        cellSize={5}
        cellThickness={0.5}
        cellColor="#4E5969"
        sectionSize={25}
        sectionThickness={1}
        sectionColor="#86909C"
        fadeDistance={100}
        fadeStrength={1}
        followCamera={false}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#1D2129" />
      </mesh>

      {campusData.buildings.map((building) => (
        <BuildingModel key={building.id} building={building} />
      ))}

      {campusData.facilities.map((facility) => (
        <FacilityModel
          key={facility.id}
          facility={facility}
          showRamps={filters.showRamps}
          showElevators={filters.showElevators}
        />
      ))}

      {campusData.constructions.map((construction) => (
        <ConstructionModel
          key={construction.id}
          construction={construction}
          visible={filters.showConstructions}
        />
      ))}

      {campusData.startPoints.map((point) => (
        <PointOfInterest
          key={point.id}
          point={point}
          isSelected={selectedStartPoint === point.id}
          onClick={handlePOIClick}
        />
      ))}

      {campusData.endPoints.map((point) => (
        <PointOfInterest
          key={point.id}
          point={point}
          isSelected={selectedEndPoint === point.id}
          onClick={handlePOIClick}
        />
      ))}

      {currentRoute && (
        <RouteLine
          route={currentRoute}
          timelinePosition={timelinePosition}
          isValid={currentRoute.validation.isValid}
        />
      )}

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          intensity={0.5}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
};

interface CampusSceneProps {
  campusData: CampusData | null;
}

export const CampusScene = ({ campusData }: CampusSceneProps) => {
  if (!campusData) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">加载中...</div>
      </div>
    );
  }

  return (
    <Canvas
      shadows
      camera={{ position: [50, 50, 50], fov: 50 }}
      gl={{ antialias: true, alpha: false }}
    >
      <SceneContent campusData={campusData} />
    </Canvas>
  );
};
