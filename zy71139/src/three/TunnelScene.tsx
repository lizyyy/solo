import React, { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Tunnel } from './Tunnel';
import { Fan } from './Fan';
import { SmokeParticles } from './SmokeParticles';
import { EscapeRoute } from './EscapeRoute';
import { Vehicle } from './Vehicle';
import { FireSource } from './FireSource';
import { useSimulationStore } from '../store/useSimulationStore';
import { CameraView, Fan as FanType, EscapeRoute as EscapeRouteType, SmokeParticle, SmokeSource, Vehicle as VehicleType, TimeStep, SimulationError } from '../types';
import { generateSmokeParticles, updateSmokePhysics } from '../utils/smokePhysics';
import { detectErrors } from '../utils/errorDetector';

interface CameraControllerProps {
  view: CameraView;
  tunnelLength: number;
}

const CameraController: React.FC<CameraControllerProps> = ({ view, tunnelLength }) => {
  const { camera } = useThree();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const positions: Record<CameraView, { pos: THREE.Vector3; target: THREE.Vector3 }> = {
      overview: {
        pos: new THREE.Vector3(0, 30, 40),
        target: new THREE.Vector3(0, 0, 0)
      },
      top: {
        pos: new THREE.Vector3(0, 50, 0.1),
        target: new THREE.Vector3(0, 0, 0)
      },
      side: {
        pos: new THREE.Vector3(0, 8, 35),
        target: new THREE.Vector3(0, 2, 0)
      },
      escape: {
        pos: new THREE.Vector3(-20, 5, -20),
        target: new THREE.Vector3(-20, 2, -5)
      },
      free: {
        pos: new THREE.Vector3(0, 15, 25),
        target: new THREE.Vector3(0, 0, 0)
      }
    };

    const { pos, target } = positions[view];
    camera.position.lerp(pos, 0.1);
    
    if (controlsRef.current) {
      controlsRef.current.target.lerp(target, 0.1);
      controlsRef.current.update();
    }
  }, [view, camera, tunnelLength]);

  return <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.05} />;
};

interface SceneContentProps {
  tunnelLength: number;
  fans: FanType[];
  escapeRoutes: EscapeRouteType[];
  smokeSources: SmokeSource[];
  vehicles: VehicleType[];
  smokeParticles: SmokeParticle[];
  isPlaying: boolean;
  currentStep: number;
  speed: number;
  cameraView: CameraView;
  onToggleFan: (id: string) => void;
  onUpdateSmoke: (particles: SmokeParticle[]) => void;
  onUpdateCoverage: (coverage: number) => void;
  onUpdateEscapeRoute: (id: string, isBlocked: boolean) => void;
  onAddError: (error: Omit<SimulationError, 'id'>) => void;
  onAddTimeStep: (timeStep: TimeStep) => void;
  onIncrementStep: () => void;
  timeSteps: TimeStep[];
}

const SceneContent: React.FC<SceneContentProps> = ({
  tunnelLength,
  fans,
  escapeRoutes,
  smokeSources,
  vehicles,
  smokeParticles,
  isPlaying,
  currentStep,
  speed,
  cameraView,
  onToggleFan,
  onUpdateSmoke,
  onUpdateCoverage,
  onUpdateEscapeRoute,
  onAddError,
  onAddTimeStep,
  onIncrementStep,
  timeSteps
}) => {
  const lastUpdateRef = useRef<number>(0);
  const previousFansRef = useRef<FanType[]>([]);
  const previousBlockedRef = useRef<string[]>([]);
  const lastRecordedStep = useRef<number>(-1);

  useFrame((_, delta) => {
    if (!isPlaying) return;

    lastUpdateRef.current += delta * 1000 * speed;
    
    if (lastUpdateRef.current >= 100) {
      lastUpdateRef.current = 0;
      
      const newParticles = generateSmokeParticles(smokeSources, currentStep);
      const allParticles = [...smokeParticles, ...newParticles];
      
      const result = updateSmokePhysics(allParticles, fans, escapeRoutes, 1);
      
      onUpdateSmoke(result.particles);
      onUpdateCoverage(result.coverage);
      
      escapeRoutes.forEach((route) => {
        const isBlocked = result.blockedRoutes.includes(route.id);
        if (route.isBlocked !== isBlocked) {
          onUpdateEscapeRoute(route.id, isBlocked);
        }
      });
      
      if (currentStep !== lastRecordedStep.current) {
        lastRecordedStep.current = currentStep;
        const timeStepData: TimeStep = {
          step: currentStep,
          timestamp: Date.now(),
          fanStates: JSON.parse(JSON.stringify(fans)),
          smokeCoverage: result.coverage,
          escapeRoutesBlocked: [...result.blockedRoutes]
        };
        onAddTimeStep(timeStepData);
      }
      
      const errors = detectErrors({
        fans,
        escapeRoutes,
        currentStep,
        previousFans: previousFansRef.current,
        previousBlockedRoutes: previousBlockedRef.current,
        timeSteps
      });
      
      errors.forEach((error) => onAddError(error));
      
      previousFansRef.current = [...fans];
      previousBlockedRef.current = [...result.blockedRoutes];
      
      onIncrementStep();
    }
  });

  return (
    <>
      <CameraController view={cameraView} tunnelLength={tunnelLength} />
      
      <ambientLight intensity={0.3} />
      <directionalLight 
        position={[0, 30, 30]} 
        intensity={0.5} 
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      
      <fog attach="fog" args={['#0a0a0a', 50, 150]} />
      
      <Tunnel length={tunnelLength} />
      
      {fans.map((fan) => (
        <Fan 
          key={fan.id} 
          fan={fan} 
          onClick={() => onToggleFan(fan.id)}
        />
      ))}
      
      {escapeRoutes.map((route) => (
        <EscapeRoute key={route.id} route={route} />
      ))}
      
      {smokeSources.map((source, index) => (
        <FireSource key={index} source={source} />
      ))}
      
      {vehicles.map((vehicle) => (
        <Vehicle key={vehicle.id} vehicle={vehicle} />
      ))}
      
      <SmokeParticles particles={smokeParticles} />
    </>
  );
};

export const TunnelScene: React.FC = () => {
  const {
    selectedScene,
    fans,
    escapeRoutes,
    smokeSources,
    vehicles,
    smokeParticles,
    isPlaying,
    currentStep,
    speed,
    cameraView,
    toggleFan,
    updateSmokeParticles,
    setSmokeCoverage,
    updateEscapeRoute,
    addError,
    addTimeStep,
    incrementStep,
    timeSteps
  } = useSimulationStore();

  if (!selectedScene) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900">
        <p className="text-gray-400 text-lg">请选择演练场景</p>
      </div>
    );
  }

  return (
    <Canvas
      shadows
      camera={{ position: [0, 30, 40], fov: 60 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#0a0a0a' }}
    >
      <SceneContent
        tunnelLength={selectedScene.tunnelLength}
        fans={fans}
        escapeRoutes={escapeRoutes}
        smokeSources={smokeSources}
        vehicles={vehicles}
        smokeParticles={smokeParticles}
        isPlaying={isPlaying}
        currentStep={currentStep}
        speed={speed}
        cameraView={cameraView}
        onToggleFan={toggleFan}
        onUpdateSmoke={updateSmokeParticles}
        onUpdateCoverage={setSmokeCoverage}
        onUpdateEscapeRoute={updateEscapeRoute}
        onAddError={addError}
        onAddTimeStep={addTimeStep}
        onIncrementStep={incrementStep}
        timeSteps={timeSteps}
      />
    </Canvas>
  );
};
