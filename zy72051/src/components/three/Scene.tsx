import { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { SunLight } from './SunLight';
import { Buildings } from './Buildings';
import { Ground } from './Ground';
import {
  useCameraState,
  useSandboxStore,
  useCurrentHour,
} from '../../store/useSandboxStore';
import { getSkyGradient } from '../../utils/sunPosition';

interface CameraControllerProps {
  savedCameraState: {
    position: [number, number, number];
    target: [number, number, number];
  };
}

function CameraController({ savedCameraState }: CameraControllerProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const saveCameraState = useSandboxStore(s => s.saveCameraState);

  useEffect(() => {
    camera.position.set(...savedCameraState.position);
    if (controlsRef.current) {
      controlsRef.current.target.set(...savedCameraState.target);
      controlsRef.current.update();
    }
  }, [camera, savedCameraState]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      minDistance={20}
      maxDistance={150}
      maxPolarAngle={Math.PI / 2 - 0.1}
      onEnd={() => {
        if (controlsRef.current) {
          const pos = camera.position;
          const target = controlsRef.current.target;
          saveCameraState(
            [pos.x, pos.y, pos.z],
            [target.x, target.y, target.z]
          );
        }
      }}
    />
  );
}

export function ThreeScene() {
  const savedCameraState = useCameraState();
  const currentHour = useCurrentHour();
  const setSelected = useSandboxStore(s => s.setSelectedBuilding);

  const skyGradient = getSkyGradient(currentHour);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: skyGradient,
        transition: 'background 0.5s ease',
      }}
      onClick={() => setSelected(null)}
    >
      <Canvas
        shadows
        camera={{ fov: 60, near: 0.1, far: 1000 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        onPointerMissed={() => setSelected(null)}
      >
        <CameraController savedCameraState={savedCameraState} />
        <fog attach="fog" args={[0x0a1628, 60, 150]} />
        <SunLight />
        <Buildings />
        <Ground />
        <EffectComposer>
          <Bloom
            intensity={0.5}
            luminanceThreshold={0.9}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
