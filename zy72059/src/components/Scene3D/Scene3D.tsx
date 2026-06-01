import { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { GridFloor } from './GridFloor';
import { DroneModel } from './DroneModel';
import { ObstacleModel } from './ObstacleModel';
import { useFormationStore } from '@/store/formationStore';
import { useUIStore } from '@/store/uiStore';

interface SceneContentProps {
  onCameraChange: (position: THREE.Vector3, target: THREE.Vector3) => void;
}

function SceneContent({ onCameraChange }: SceneContentProps) {
  const { drones, obstacles, selectedDroneId, focusedDroneId, selectDrone, focusDrone } = useFormationStore();
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  const handleDroneClick = (id: string) => {
    selectDrone(id === selectedDroneId ? null : id);
  };

  const handleDroneDoubleClick = (id: string) => {
    focusDrone(id);
  };

  useEffect(() => {
    if (focusedDroneId && controlsRef.current) {
      const drone = drones.find((d) => d.id === focusedDroneId);
      if (drone) {
        const targetPos = new THREE.Vector3(
          drone.position.x,
          drone.position.y + 2,
          drone.position.z
        );
        const cameraOffset = new THREE.Vector3(8, 6, 8);
        const cameraTarget = targetPos.clone().add(cameraOffset);
        
        controlsRef.current.target.lerp(targetPos, 0.1);
        camera.position.lerp(cameraTarget, 0.1);
        controlsRef.current.update();
      }
    }
  }, [focusedDroneId, drones, camera]);

  const handleControlChange = () => {
    if (controlsRef.current) {
      onCameraChange(camera.position, controlsRef.current.target);
    }
  };

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={200}
        maxPolarAngle={Math.PI / 2 - 0.1}
        onChange={handleControlChange}
      />

      <ambientLight intensity={0.4} />
      <directionalLight
        position={[50, 50, 25]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[-30, 20, -30]} intensity={0.5} color="#1e88e5" />
      <pointLight position={[30, 20, 30]} intensity={0.3} color="#43a047" />

      <Stars radius={300} depth={60} count={3000} factor={4} saturation={0} fade speed={0.5} />

      <fog attach="fog" args={['#0a1628', 50, 150]} />

      <GridFloor />

      {obstacles.map((obstacle) => (
        <ObstacleModel key={obstacle.id} obstacle={obstacle} />
      ))}

      {drones.map((drone) => (
        <DroneModel
          key={drone.id}
          drone={drone}
          isSelected={selectedDroneId === drone.id}
          isFocused={focusedDroneId === drone.id}
          onClick={() => handleDroneClick(drone.id)}
          onDoubleClick={() => handleDroneDoubleClick(drone.id)}
        />
      ))}

      <EffectComposer>
        <Bloom
          intensity={0.8}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <Vignette offset={0.5} darkness={0.5} />
      </EffectComposer>
    </>
  );
}

export function Scene3D() {
  const { setCameraPosition, setCameraTarget } = useUIStore();
  const { selectDrone } = useFormationStore();

  const handleCameraChange = (position: THREE.Vector3, target: THREE.Vector3) => {
    setCameraPosition({
      x: position.x,
      y: position.y,
      z: position.z,
    });
    setCameraTarget({
      x: target.x,
      y: target.y,
      z: target.z,
    });
  };

  const handleSceneClick = () => {
    selectDrone(null);
  };

  return (
    <div
      id="scene-3d-container"
      className="w-full h-full bg-[#0a1628] relative"
      onClick={handleSceneClick}
    >
      <Canvas
        camera={{ position: [30, 30, 30], fov: 60 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor('#0a1628');
        }}
      >
        <SceneContent onCameraChange={handleCameraChange} />
      </Canvas>

      <div className="absolute bottom-4 left-4 text-xs text-gray-400 font-mono space-y-1">
        <div className="bg-black/40 px-3 py-1.5 rounded backdrop-blur-sm border border-white/10">
          <span className="text-gray-500">操作：</span>
          <span className="text-gray-300">左键旋转 | 滚轮缩放 | 右键平移 | 双击聚焦</span>
        </div>
      </div>
    </div>
  );
}
