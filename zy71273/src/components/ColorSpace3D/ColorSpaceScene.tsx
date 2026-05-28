import { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, FXAA } from '@react-three/postprocessing';
import { HSLSphere } from './HSLSphere';
import { AxesHelper } from './AxesHelper';
import { StarPoints } from './StarPoints';
import { Artwork } from '../../types/artwork';
import { useSceneStore } from '../../store/useSceneStore';
import { SPHERE_RADIUS } from '../../utils/hslCalculator';

interface ColorSpaceSceneProps {
  artworks: Artwork[];
  selectedArtworkId: string | null;
  onSelectArtwork: (id: string | null) => void;
}

function SceneContent({ artworks, selectedArtworkId, onSelectArtwork }: ColorSpaceSceneProps) {
  const settings = useSceneStore(state => state.settings);
  const cameraPosition = useSceneStore(state => state.cameraPosition);
  const cameraTarget = useSceneStore(state => state.cameraTarget);
  const isUserInteracting = useSceneStore(state => state.isUserInteracting);
  const setUserInteracting = useSceneStore(state => state.setUserInteracting);
  const setCameraPosition = useSceneStore(state => state.setCameraPosition);
  const setCameraTarget = useSceneStore(state => state.setCameraTarget);
  
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();
  const rotationGroupRef = useRef<THREE.Group>(null);

  const ambientLight = useMemo(() => new THREE.AmbientLight(0xffffff, 0.5), []);
  const pointLight1 = useMemo(() => {
    const light = new THREE.PointLight(0xff6b6b, 0.8, 10);
    light.position.set(SPHERE_RADIUS * 1.5, 0, 0);
    return light;
  }, []);
  const pointLight2 = useMemo(() => {
    const light = new THREE.PointLight(0x51cf66, 0.8, 10);
    light.position.set(0, SPHERE_RADIUS * 1.5, 0);
    return light;
  }, []);
  const pointLight3 = useMemo(() => {
    const light = new THREE.PointLight(0x4dabf7, 0.8, 10);
    light.position.set(0, 0, SPHERE_RADIUS * 1.5);
    return light;
  }, []);

  useEffect(() => {
    camera.position.copy(cameraPosition);
  }, [camera, cameraPosition]);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.target.copy(cameraTarget);
      controlsRef.current.update();
    }
  }, [cameraTarget]);

  useFrame((_, delta) => {
    if (settings.autoRotate && !isUserInteracting && rotationGroupRef.current) {
      rotationGroupRef.current.rotation.y += delta * 0.1;
    }
  });

  const handleStart = () => {
    setUserInteracting(true);
  };

  const handleEnd = () => {
    setUserInteracting(false);
    if (controlsRef.current) {
      setCameraPosition(camera.position.clone());
      setCameraTarget(controlsRef.current.target.clone());
    }
  };

  return (
    <>
      <primitive object={ambientLight} />
      <primitive object={pointLight1} />
      <primitive object={pointLight2} />
      <primitive object={pointLight3} />

      <Stars 
        radius={50} 
        depth={50} 
        count={3000} 
        factor={4} 
        saturation={0} 
        fade 
        speed={0.5} 
      />

      <group ref={rotationGroupRef}>
        <HSLSphere visible={settings.showGrid} />
        <AxesHelper visible={settings.showAxes} />
        
        <StarPoints
          artworks={artworks}
          selectedArtworkId={selectedArtworkId}
          onSelect={onSelectArtwork}
          clusterMode={settings.clusterMode}
        />
      </group>

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        minDistance={SPHERE_RADIUS * 1.5}
        maxDistance={SPHERE_RADIUS * 5}
        onStart={handleStart}
        onEnd={handleEnd}
        enablePan={false}
      />

      <EffectComposer>
        <Bloom 
          intensity={settings.bloomIntensity} 
          luminanceThreshold={0.2} 
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <FXAA />
      </EffectComposer>
    </>
  );
}

export function ColorSpaceScene(props: ColorSpaceSceneProps) {
  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 2, 5], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor('#0a0e1a');
        }}
      >
        <fog attach="fog" args={['#0a0e1a', SPHERE_RADIUS * 2, SPHERE_RADIUS * 6]} />
        <SceneContent {...props} />
      </Canvas>
    </div>
  );
}
