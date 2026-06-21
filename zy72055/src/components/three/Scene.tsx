import React, { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Effects } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { Bridge } from './Bridge';
import { Equipment } from './Equipment';
import { AnomalyMarkers } from './AnomalyMarker';
import type { Anomaly, InspectionRecord, CameraState } from '../../types';
import { DEFAULT_CAMERA_STATE } from '../../types';

interface SceneContentProps {
  records: InspectionRecord[];
  anomalies: Anomaly[];
  selectedAnomalyId: string | null;
  hoveredAnomalyId: string | null;
  cameraState: CameraState;
  onSelectAnomaly: (id: string | null) => void;
  onHoverAnomaly: (id: string | null) => void;
  onCameraChange: (state: CameraState) => void;
}

function SceneContent({
  records,
  anomalies,
  selectedAnomalyId,
  hoveredAnomalyId,
  cameraState,
  onSelectAnomaly,
  onHoverAnomaly,
  onCameraChange,
}: SceneContentProps) {
  const { camera } = useThree();
  const controlsRef = useRef<{ target: THREE.Vector3; update: () => void } | null>(null);
  const initialized = useRef(false);
  
  useEffect(() => {
    if (!initialized.current && cameraState) {
      camera.position.set(...cameraState.position);
      camera.lookAt(...cameraState.target);
      (camera as THREE.PerspectiveCamera).fov = cameraState.fov;
      camera.updateProjectionMatrix();
      initialized.current = true;
    }
  }, [camera, cameraState]);
  
  useEffect(() => {
    if (selectedAnomalyId) {
      const anomaly = anomalies.find(a => a.id === selectedAnomalyId);
      if (anomaly) {
        const targetPos = new THREE.Vector3(
          anomaly.reportedPosition.x,
          anomaly.reportedPosition.y + 2,
          anomaly.reportedPosition.z
        );
        
        const offset = new THREE.Vector3(8, 6, 8);
        const newCameraPos = targetPos.clone().add(offset);
        
        const startPos = camera.position.clone();
        const startTarget = controlsRef.current?.target.clone() || new THREE.Vector3();
        const duration = 800;
        const startTime = performance.now();
        
        const animate = (time: number) => {
          const elapsed = time - startTime;
          const t = Math.min(elapsed / duration, 1);
          const easeT = 1 - Math.pow(1 - t, 3);
          
          camera.position.lerpVectors(startPos, newCameraPos, easeT);
          
          if (controlsRef.current) {
            controlsRef.current.target.lerpVectors(startTarget, targetPos, easeT);
            controlsRef.current.update();
          }
          
          if (t < 1) {
            requestAnimationFrame(animate);
          }
        };
        
        requestAnimationFrame(animate);
      }
    }
  }, [selectedAnomalyId, anomalies, camera]);
  
  const handleControlsChange = () => {
    if (controlsRef.current) {
      const target = controlsRef.current.target;
      onCameraChange({
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [target.x, target.y, target.z],
        fov: (camera as THREE.PerspectiveCamera).fov,
      });
    }
  };
  
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[30, 40, 30]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      <directionalLight position={[-20, 10, -20]} intensity={0.3} />
      
      <fog attach="fog" args={['#0f172a', 50, 120]} />
      
      <Bridge />
      <Equipment records={records} />
      <AnomalyMarkers
        anomalies={anomalies}
        selectedId={selectedAnomalyId}
        hoveredId={hoveredAnomalyId}
        onSelect={onSelectAnomaly}
        onHover={onHoverAnomaly}
      />
      
      <OrbitControls
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={controlsRef as React.Ref<any>}
        enableDamping
        dampingFactor={0.05}
        minDistance={10}
        maxDistance={100}
        minPolarAngle={Math.PI / 18}
        maxPolarAngle={Math.PI / 2.1}
        target={DEFAULT_CAMERA_STATE.target}
        onChange={handleControlsChange}
      />
      
      <Effects>
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            intensity={0.5}
            mipmapBlur
          />
          <Vignette offset={0.5} darkness={0.5} />
        </EffectComposer>
      </Effects>
    </>
  );
}

interface SceneProps {
  records: InspectionRecord[];
  anomalies: Anomaly[];
  selectedAnomalyId: string | null;
  hoveredAnomalyId: string | null;
  cameraState: CameraState;
  onSelectAnomaly: (id: string | null) => void;
  onHoverAnomaly: (id: string | null) => void;
  onCameraChange: (state: CameraState) => void;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

export function Scene({
  records,
  anomalies,
  selectedAnomalyId,
  hoveredAnomalyId,
  cameraState,
  onSelectAnomaly,
  onHoverAnomaly,
  onCameraChange,
  canvasRef,
}: SceneProps) {
  return (
    <Canvas
      ref={canvasRef}
      camera={{ fov: cameraState.fov, near: 0.1, far: 1000 }}
      gl={{
        antialias: true,
        pixelRatio: Math.min(window.devicePixelRatio, 1.5),
        preserveDrawingBuffer: true,
      }}
      style={{ background: 'linear-gradient(to bottom, #0f172a, #1e3a5f)' }}
      onPointerMissed={() => onSelectAnomaly(null)}
      shadows
    >
      <SceneContent
        records={records}
        anomalies={anomalies}
        selectedAnomalyId={selectedAnomalyId}
        hoveredAnomalyId={hoveredAnomalyId}
        cameraState={cameraState}
        onSelectAnomaly={onSelectAnomaly}
        onHoverAnomaly={onHoverAnomaly}
        onCameraChange={onCameraChange}
      />
    </Canvas>
  );
}
