import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import { Suspense } from 'react';
import { Terrain } from './Terrain';
import { Watchtowers } from './Watchtower';
import { Trees } from './Trees';
import { CoverageOverlay } from './CoverageOverlay';
import { BlindSpots } from './BlindSpots';
import { PatrolRoutes } from './PatrolRoutes';
import { FirePoints } from './FirePoints';
import { useStore } from '../store/useStore';

function SceneContent() {
  const season = useStore(state => state.season);
  
  const sunPosition = {
    x: Math.cos((season.sunAngle * Math.PI) / 180) * 100,
    y: Math.sin((season.sunAngle * Math.PI) / 180) * 100,
    z: 50
  };

  return (
    <>
      <Sky
        distance={450000}
        sunPosition={[sunPosition.x, sunPosition.y, sunPosition.z]}
        inclination={0.5}
        azimuth={0.25}
      />
      
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[sunPosition.x, sunPosition.y, sunPosition.z]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      
      <Terrain />
      <Trees />
      <Watchtowers />
      <PatrolRoutes />
      <FirePoints />
      <CoverageOverlay />
      <BlindSpots />
      
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={20}
        maxDistance={200}
        maxPolarAngle={Math.PI / 2.1}
      />
      
      <gridHelper args={[100, 20, '#444444', '#333333']} position={[0, 0.1, 0]} />
    </>
  );
}

export function Scene() {
  return (
    <Canvas
      camera={{ position: [80, 80, 80], fov: 50 }}
      shadows
      gl={{ antialias: true }}
    >
      <Suspense fallback={null}>
        <SceneContent />
      </Suspense>
    </Canvas>
  );
}
