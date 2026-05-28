import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useAppStore } from '@/store/useAppStore';
import { generateInterpolationPath } from '@/utils/interpolation';
import { quaternionToSphere, eulerToSphere } from '@/utils/sphereMapping';
import SphereMesh from './SphereMesh';
import AttitudePoint from './AttitudePoint';
import InterpolationPath from './InterpolationPath';
import SingularityMarker from './SingularityMarker';
import SatelliteModel from './SatelliteModel';

function Scene() {
  const currentQuaternion = useAppStore((s) => s.currentQuaternion);
  const targetQuaternion = useAppStore((s) => s.targetQuaternion);
  const interpolationConfig = useAppStore((s) => s.interpolationConfig);
  const animationProgress = useAppStore((s) => s.animationProgress);
  const singularityPoints = useAppStore((s) => s.singularityPoints);

  const currentPoint = useMemo(() => quaternionToSphere(currentQuaternion), [currentQuaternion]);
  const targetPoint = useMemo(() => quaternionToSphere(targetQuaternion), [targetQuaternion]);

  const pathQuaternions = useMemo(
    () => generateInterpolationPath(currentQuaternion, targetQuaternion, interpolationConfig.steps, interpolationConfig.method),
    [currentQuaternion, targetQuaternion, interpolationConfig.steps, interpolationConfig.method]
  );

  const pathPoints = useMemo(
    () => pathQuaternions.map((q) => quaternionToSphere(q)),
    [pathQuaternions]
  );

  const singularitySpherePoints = useMemo(
    () => singularityPoints.map((e) => eulerToSphere(e.roll, e.pitch, e.yaw)),
    [singularityPoints]
  );

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <pointLight position={[-5, -5, -5]} intensity={0.3} />

      <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />

      <SphereMesh />
      <AttitudePoint position={currentPoint} color="#00ffff" label="Current" isCurrent />
      <AttitudePoint position={targetPoint} color="#ffaa00" label="Target" isCurrent={false} />
      <InterpolationPath pathPoints={pathPoints} color="#00ff88" progress={animationProgress} />

      {singularitySpherePoints.map((pt, i) => (
        <SingularityMarker key={i} position={pt} visible />
      ))}

      <SatelliteModel quaternion={currentQuaternion} />

      <OrbitControls enableDamping dampingFactor={0.05} minDistance={1.5} maxDistance={8} />

      <EffectComposer>
        <Bloom luminanceThreshold={0.6} luminanceSmoothing={0.9} intensity={1.2} />
      </EffectComposer>
    </>
  );
}

export default function AttitudeSphere() {
  return (
    <Canvas
      camera={{ position: [3, 2, 3], fov: 50, near: 0.1, far: 1000 }}
      gl={{ antialias: true }}
      style={{ background: '#0a0e27' }}
    >
      <Scene />
    </Canvas>
  );
}
