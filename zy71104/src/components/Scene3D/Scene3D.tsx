import { useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Sky, Stars } from '@react-three/drei';
import { useSceneStore } from '../../store/useSceneStore';
import TowerCrane from './TowerCrane';
import Building from './Building';
import DangerZone from './DangerZone';
import RadiusIndicator from './RadiusIndicator';
import LiftPath from './LiftPath';
import Ground from './Ground';

const CameraController = () => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const { selectedView, crane } = useSceneStore();
  
  useEffect(() => {
    if (!controlsRef.current) return;
    
    const controls = controlsRef.current;
    
    switch (selectedView) {
      case 'top':
        camera.position.set(crane.position.x, 150, crane.position.z + 0.1);
        controls.target.set(crane.position.x, 0, crane.position.z);
        break;
      case 'side':
        camera.position.set(crane.position.x + 100, 50, crane.position.z);
        controls.target.set(crane.position.x, 20, crane.position.z);
        break;
      case 'firstPerson':
        camera.position.set(crane.position.x, crane.height + 5, crane.position.z + 10);
        controls.target.set(crane.position.x, crane.height, crane.position.z - 20);
        break;
      default:
        camera.position.set(80, 80, 80);
        controls.target.set(0, 20, 0);
    }
    
    controls.update();
  }, [selectedView, crane.position, crane.height, camera]);
  
  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      minDistance={10}
      maxDistance={200}
      maxPolarAngle={Math.PI / 2 - 0.1}
      enableDamping
      dampingFactor={0.05}
    />
  );
};

const SceneContent = () => {
  const { buildings, dangerZones, environment } = useSceneStore();
  
  return (
    <>
      {environment.timeOfDay === 'day' ? (
        <Sky
          distance={450000}
          sunPosition={[100, 50, 100]}
          inclination={0.5}
          azimuth={0.25}
        />
      ) : (
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      )}
      
      <ambientLight intensity={environment.timeOfDay === 'day' ? 0.6 : 0.2} />
      <directionalLight
        position={[50, 100, 50]}
        intensity={environment.timeOfDay === 'day' ? 1 : 0.3}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={500}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
      />
      <hemisphereLight intensity={0.3} groundColor="#2D5A27" />
      
      <Ground />
      
      {buildings.map((building) => (
        <Building key={building.id} building={building} />
      ))}
      
      {dangerZones.map((zone) => (
        <DangerZone key={zone.id} zone={zone} />
      ))}
      
      <TowerCrane />
      <RadiusIndicator />
      <LiftPath />
      
      <CameraController />
    </>
  );
};

interface Scene3DProps {
  canvasRef?: React.RefObject<HTMLCanvasElement>;
}

const Scene3D = ({ canvasRef }: Scene3DProps) => {
  return (
    <Canvas
      ref={canvasRef as any}
      shadows
      camera={{ position: [80, 80, 80], fov: 50 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <SceneContent />
    </Canvas>
  );
};

export default Scene3D;
