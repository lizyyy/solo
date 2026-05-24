import { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Effects } from '@react-three/drei';
import { EffectComposer, Bloom, DepthOfField } from '@react-three/postprocessing';
import * as THREE from 'three';
import { Container3D } from './Container3D';
import { YardGround } from './YardGround';
import { PathVisualizer } from './PathVisualizer';
import { useStore } from '../../store/useStore';
import { filterContainers } from '../../utils/accessibility';
import { CameraView } from '../../types';

const BAY_SPACING = 7;
const ROW_SPACING = 2.8;

interface CameraControllerProps {
  view: CameraView;
  yardWidth: number;
  yardDepth: number;
}

function CameraController({ view, yardWidth, yardDepth }: CameraControllerProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const centerX = yardWidth / 2 - BAY_SPACING / 2;
    const centerZ = yardDepth / 2 - ROW_SPACING;

    let targetPosition: [number, number, number];
    let targetLookAt: [number, number, number];

    switch (view) {
      case 'top':
        targetPosition = [centerX, 40, centerZ];
        targetLookAt = [centerX, 0, centerZ];
        break;
      case 'side':
        targetPosition = [centerX, 15, centerZ + 25];
        targetLookAt = [centerX, 5, centerZ];
        break;
      case 'gantry':
        targetPosition = [-5, 12, centerZ];
        targetLookAt = [centerX, 5, centerZ];
        break;
      default:
        targetPosition = [centerX + 15, 20, centerZ + 20];
        targetLookAt = [centerX, 3, centerZ];
    }

    const startPos = camera.position.clone();
    const endPos = new THREE.Vector3(...targetPosition);
    const duration = 800;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      camera.position.lerpVectors(startPos, endPos, eased);

      if (controlsRef.current) {
        controlsRef.current.target.lerp(
          new THREE.Vector3(...targetLookAt),
          eased
        );
        controlsRef.current.update();
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }, [view, camera, yardWidth, yardDepth]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      minDistance={5}
      maxDistance={80}
      maxPolarAngle={Math.PI / 2 - 0.1}
    />
  );
}

function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.4} color="#a0aec0" />
      
      <directionalLight
        position={[15, 30, 15]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={100}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />

      <pointLight position={[-10, 15, -10]} intensity={0.5} color="#63b3ed" />
      <pointLight position={[30, 10, 20]} intensity={0.3} color="#f6ad55" />
      
      <spotLight
        position={[10, 25, 10]}
        angle={0.5}
        penumbra={0.5}
        intensity={0.8}
        color="#fff5e6"
      />
    </>
  );
}

interface SceneContentProps {
  animationProgress: number;
}

function SceneContent({ animationProgress }: SceneContentProps) {
  const {
    containers,
    yard,
    selectedContainerId,
    currentTask,
    timeline,
    filter,
    cameraView,
  } = useStore();

  const filteredContainers = filterContainers(containers, filter);

  if (!yard) return null;

  const yardWidth = (yard.bays - 1) * BAY_SPACING + BAY_SPACING;
  const yardDepth = (yard.rows - 1) * ROW_SPACING + ROW_SPACING * 2;

  return (
    <>
      <CameraController
        view={cameraView}
        yardWidth={yardWidth}
        yardDepth={yardDepth}
      />
      
      <SceneLighting />
      <YardGround yard={yard} />

      {filteredContainers.map((container) => (
        <Container3D
          key={container.id}
          container={container}
          isSelected={container.id === selectedContainerId}
          isAnimating={timeline.isPlaying || animationProgress > 0}
          animationProgress={animationProgress}
        />
      ))}

      {currentTask && (
        <PathVisualizer
          moves={currentTask.moves}
          currentStep={timeline.currentStep}
        />
      )}

      <fog attach="fog" args={['#1a1a2e', 30, 80]} />

      <EffectComposer>
        <DepthOfField
          focusDistance={0.01}
          focalLength={0.02}
          bokehScale={2}
          height={480}
        />
        <Bloom
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          intensity={0.5}
        />
      </EffectComposer>
    </>
  );
}

export function YardScene() {
  const [animationProgress, setAnimationProgress] = useState(0);
  const { timeline, currentTask, setTimelineStep, setTimelinePlaying } =
    useStore();

  useEffect(() => {
    if (!timeline.isPlaying || !currentTask) return;

    const stepDuration = 2000 / timeline.speed;
    const startTime = Date.now();
    let animationFrameId: number;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / stepDuration;

      if (progress >= 1) {
        const nextStep = timeline.currentStep + 1;
        if (nextStep < currentTask.moves.length) {
          setTimelineStep(nextStep);
          setAnimationProgress(0);
        } else {
          setTimelinePlaying(false);
          setAnimationProgress(1);
          return;
        }
      } else {
        setAnimationProgress(progress);
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    timeline.isPlaying,
    timeline.currentStep,
    timeline.speed,
    currentTask,
    setTimelineStep,
    setTimelinePlaying,
  ]);

  return (
    <Canvas
      shadows
      gl={{ antialias: true, alpha: false }}
      style={{ background: 'linear-gradient(to bottom, #0f0f1a 0%, #1a1a2e 100%)' }}
    >
      <PerspectiveCamera
        makeDefault
        position={[25, 20, 25]}
        fov={50}
        near={0.1}
        far={200}
      />
      <SceneContent animationProgress={animationProgress} />
    </Canvas>
  );
}
