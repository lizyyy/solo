import { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import Stage from './Stage';
import LightComponent from './Light';
import ForbiddenZoneComponent from './ForbiddenZone';
import { useSceneStore, getFilteredLights } from '../../store/useSceneStore';

function CameraController() {
  const { camera } = useThree();
  const cameraView = useSceneStore((state) => state.cameraView);
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const views: Record<string, THREE.Vector3> = {
      front: new THREE.Vector3(0, 3, 15),
      top: new THREE.Vector3(0, 20, 0.01),
      side: new THREE.Vector3(15, 5, 0),
      free: new THREE.Vector3(8, 8, 12)
    };

    if (cameraView !== 'free' && views[cameraView]) {
      camera.position.lerp(views[cameraView], 0.5);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 2, 0);
        controlsRef.current.update();
      }
    }
  }, [cameraView, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={[0, 2, 0]}
      minDistance={5}
      maxDistance={50}
      maxPolarAngle={Math.PI / 2.1}
    />
  );
}

function SceneContent() {
  const { lights, forbiddenZones, selectedLightId, filters, updateLight } = useSceneStore();
  const filteredLights = getFilteredLights(lights, filters);

  const handleLightDrag = (id: string, position: THREE.Vector3) => {
    updateLight(id, {
      position: { x: position.x, y: position.y, z: position.z }
    });
  };

  const handleTargetDrag = (id: string, target: THREE.Vector3) => {
    updateLight(id, {
      target: { x: target.x, y: target.y, z: target.z }
    });
  };

  return (
    <>
      <ambientLight intensity={0.2} />
      
      <Stage />
      
      <Grid
        position={[0, 0.01, 0]}
        args={[30, 30]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#2a2a2e"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#3a3a3e"
        fadeDistance={50}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
      />

      {forbiddenZones.map((zone) => (
        <ForbiddenZoneComponent key={zone.id} zone={zone} />
      ))}

      {filteredLights.map((light) => (
        <LightComponent
          key={light.id}
          light={light}
          isSelected={selectedLightId === light.id}
          onPositionDrag={(pos) => handleLightDrag(light.id, pos)}
          onTargetDrag={(pos) => handleTargetDrag(light.id, pos)}
        />
      ))}
    </>
  );
}

export default function Stage3D() {
  return (
    <Canvas
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 2]}
      style={{ background: '#0a0a0f' }}
    >
      <PerspectiveCamera makeDefault position={[8, 8, 12]} fov={50} />
      <CameraController />
      <SceneContent />
    </Canvas>
  );
}
