import { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Truck } from './Truck';
import { Platform } from './Platform';
import { Obstacles } from './Obstacles';
import { Ground } from './Ground';
import { PathLine } from './PathLine';
import { useSimulationStore } from '../../store/simulationStore';
import { CameraView } from '../../types';

interface CameraControllerProps {
  view: CameraView;
  vehiclePosition?: [number, number, number];
  vehicleRotation?: number;
}

function CameraController({ view, vehiclePosition, vehicleRotation = 0 }: CameraControllerProps) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);

  useEffect(() => {
    switch (view) {
      case 'top':
        camera.position.set(0, 50, 0.1);
        camera.lookAt(0, 0, 0);
        break;
      case 'side':
        camera.position.set(30, 15, 0);
        camera.lookAt(0, 0, 0);
        break;
      case 'driver':
        if (vehiclePosition) {
          const cos = Math.cos(vehicleRotation);
          const sin = Math.sin(vehicleRotation);
          const cameraOffsetX = -sin * 0.5;
          const cameraOffsetZ = cos * 0.5;
          const lookOffsetX = -sin * 10;
          const lookOffsetZ = cos * 10;
          camera.position.set(
            vehiclePosition[0] + cameraOffsetX,
            vehiclePosition[1] + 2.5,
            vehiclePosition[2] + cameraOffsetZ
          );
          camera.lookAt(
            vehiclePosition[0] + lookOffsetX,
            vehiclePosition[1] + 1,
            vehiclePosition[2] + lookOffsetZ
          );
        }
        break;
      case 'follow':
        if (vehiclePosition) {
          camera.position.set(
            vehiclePosition[0] + 10,
            vehiclePosition[1] + 8,
            vehiclePosition[2] + 15
          );
          camera.lookAt(vehiclePosition[0], vehiclePosition[1], vehiclePosition[2]);
        }
        break;
      case 'free':
      default:
        camera.position.set(20, 15, 20);
        camera.lookAt(0, 0, 0);
        break;
    }
  }, [view, vehiclePosition, vehicleRotation, camera]);

  return <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.05} />;
}

function SceneContent() {
  const { vehicle, scene, simulation } = useSimulationStore();
  const isAnimating = simulation.status === 'playing';

  const pathIndex = Math.floor(simulation.progress * (simulation.currentPath.length - 1));
  const vehiclePos: [number, number, number] | undefined =
    simulation.currentPath.length > 0
      ? [
          simulation.currentPath[pathIndex]?.position.x || 0,
          vehicle.height / 2,
          simulation.currentPath[pathIndex]?.position.z || 0,
        ]
      : undefined;

  const vehicleRotation = simulation.currentPath.length > 0
    ? simulation.currentPath[pathIndex]?.rotation || 0
    : 0;

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[20, 30, 20]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-10, 10, -10]} intensity={0.3} />

      <CameraController
        view={simulation.cameraView}
        vehiclePosition={vehiclePos}
        vehicleRotation={vehicleRotation}
      />

      <Ground
        width={scene.groundSize.width}
        depth={scene.groundSize.depth}
        boundaries={scene.boundaries}
      />

      <Platform platform={scene.platform} loadingDocks={scene.loadingDocks} />

      <Obstacles obstacles={scene.obstacles} />

      <PathLine
        path={simulation.currentPath}
        sweepAreas={simulation.sweepAreas}
        hasCollision={simulation.isCollision}
      />

      <Truck
        vehicle={vehicle}
        position={[15, vehicle.height / 2, 12]}
        rotation={[0, Math.PI * 0.1, 0]}
        isAnimating={isAnimating || simulation.status === 'paused' || simulation.status === 'finished'}
        path={simulation.currentPath}
        progress={simulation.progress}
        showCollision={simulation.isCollision}
      />
    </>
  );
}

export function Scene3D() {
  return (
    <Canvas
      shadows
      camera={{ position: [20, 15, 20], fov: 50 }}
      gl={{ antialias: true }}
      style={{ background: '#0F172A' }}
    >
      <SceneContent />
    </Canvas>
  );
}
