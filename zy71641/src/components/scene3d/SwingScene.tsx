import { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useSwingStore } from '@/store/useSwingStore';
import { SwingTrajectory } from './SwingTrajectory';
import { ClubHead } from './ClubHead';
import { ImpactPoint } from './ImpactPoint';
import { GroundGrid } from './GroundGrid';

interface CameraControllerProps {
  targetPosition: { x: number; y: number; z: number };
  targetLookAt: { x: number; y: number; z: number };
}

function CameraController({ targetPosition, targetLookAt }: CameraControllerProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  
  useEffect(() => {
    if (!camera) return;
    
    const startPos = camera.position.clone();
    const startTarget = controlsRef.current?.target?.clone() || new THREE.Vector3();
    const endPos = new THREE.Vector3(targetPosition.x, targetPosition.y, targetPosition.z);
    const endTarget = new THREE.Vector3(targetLookAt.x, targetLookAt.y, targetLookAt.z);
    
    let progress = 0;
    const duration = 800;
    const startTime = Date.now();
    
    const animate = () => {
      progress = Math.min(1, (Date.now() - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      
      camera.position.lerpVectors(startPos, endPos, eased);
      
      if (controlsRef.current) {
        controlsRef.current.target.lerpVectors(startTarget, endTarget, eased);
        controlsRef.current.update();
      }
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [targetPosition, targetLookAt, camera]);
  
  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={1}
      maxDistance={10}
      target={[targetLookAt.x, targetLookAt.y, targetLookAt.z]}
    />
  );
}

function SceneContent() {
  const { 
    currentSession, 
    selectedFrameIndex, 
    isPlaying,
    cameraState,
    showTrajectory,
    showClubHead,
    showImpactPoint,
    showGrid,
    setSelectedFrame,
    flyToFrame,
  } = useSwingStore();
  
  if (!currentSession) {
    return (
      <group>
        <Text
          position={[0, 0, 0]}
          fontSize={0.15}
          color="#94A3B8"
          anchorX="center"
          anchorY="middle"
        >
          请导入挥杆数据
        </Text>
      </group>
    );
  }
  
  const handleFrameClick = (frameIndex: number) => {
    setSelectedFrame(frameIndex);
    flyToFrame(frameIndex);
  };
  
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[5, 8, 5]} 
        intensity={1} 
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight 
        position={[-3, 2, -3]} 
        intensity={0.5} 
        color="#FFD700"
      />
      <pointLight 
        position={[0, 3, 0]} 
        intensity={0.8} 
        color="#00FF88"
        distance={10}
      />
      
      <CameraController 
        targetPosition={cameraState.position}
        targetLookAt={cameraState.target}
      />
      
      <GroundGrid visible={showGrid} size={8} divisions={16} />
      
      <SwingTrajectory
        frames={currentSession.frames}
        currentFrameIndex={selectedFrameIndex}
        anomalies={currentSession.anomalies}
        visible={showTrajectory}
        onFrameClick={handleFrameClick}
      />
      
      <ClubHead
        frames={currentSession.frames}
        currentFrameIndex={selectedFrameIndex}
        anomalies={currentSession.anomalies}
        visible={showClubHead}
        isPlaying={isPlaying}
        showTrail={isPlaying}
      />
      
      <ImpactPoint
        impactPoint={currentSession.impactPoint}
        visible={showImpactPoint}
        onClick={() => {
          if (currentSession.impactPoint) {
            const impactIndex = Math.floor(currentSession.frames.length * 0.7);
            handleFrameClick(impactIndex);
          }
        }}
      />
      
      {currentSession.keyframes.map((keyframe, idx) => {
        const frameIdx = currentSession.frames.findIndex(f => f.frameId === keyframe.frameId);
        if (frameIdx < 0) return null;
        const frame = currentSession.frames[frameIdx];
        
        return (
          <group 
            key={keyframe.keyframeId}
            position={[frame.position.x, frame.position.y + 0.2, frame.position.z]}
            onClick={() => handleFrameClick(frameIdx)}
          >
            <mesh>
              <sphereGeometry args={[0.03, 12, 12]} />
              <meshBasicMaterial color={keyframe.color} />
            </mesh>
            <mesh position={[0, 0.05, 0]}>
              <ringGeometry args={[0.04, 0.06, 16]} />
              <meshBasicMaterial color={keyframe.color} transparent opacity={0.6} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
      
      <EffectComposer>
        <Bloom 
          luminanceThreshold={0.2} 
          luminanceSmoothing={0.9} 
          intensity={0.5}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.1} darkness={0.5} />
      </EffectComposer>
    </>
  );
}

export function SwingScene() {
  return (
    <Canvas
      camera={{ position: [3, 2, 4], fov: 50 }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 2]}
      style={{ background: 'linear-gradient(180deg, #0B0F17 0%, #141B26 100%)' }}
    >
      <fog attach="fog" args={['#0B0F17', 5, 15]} />
      <SceneContent />
    </Canvas>
  );
}
