import { useRef, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useStore } from '../../store/useStore';
import { filterArtifacts } from '../../utils/filterEngine';
import { getConflictingArtifactIds } from '../../utils/dataValidator';
import { Grid3D } from './Grid3D';
import { SoilLayer3D } from './SoilLayer3D';
import { Artifact3D } from './Artifact3D';
import { CameraView } from '../../types';

interface CameraControllerProps {
  view: CameraView;
  gridSize: { x: number; y: number; z: number };
}

const CameraController = ({ view, gridSize }: CameraControllerProps) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useMemo(() => {
    const centerX = gridSize.x / 2;
    const centerY = gridSize.z / 2;
    const centerZ = gridSize.y / 2;
    const maxDim = Math.max(gridSize.x, gridSize.y, gridSize.z);

    switch (view) {
      case 'top':
        camera.position.set(centerX, centerY + maxDim * 1.5, centerZ);
        camera.lookAt(centerX, centerY, centerZ);
        break;
      case 'front':
        camera.position.set(centerX, centerY, centerZ + maxDim * 1.5);
        camera.lookAt(centerX, centerY, centerZ);
        break;
      case 'side':
        camera.position.set(centerX + maxDim * 1.5, centerY, centerZ);
        camera.lookAt(centerX, centerY, centerZ);
        break;
      default:
        camera.position.set(
          centerX + maxDim * 0.8,
          centerY + maxDim * 0.8,
          centerZ + maxDim * 1.2
        );
        camera.lookAt(centerX, centerY * 0.5, centerZ);
    }

    if (controlsRef.current) {
      controlsRef.current.target.set(centerX, centerY * 0.5, centerZ);
      controlsRef.current.update();
    }
  }, [view, gridSize, camera]);

  return <OrbitControls ref={controlsRef} makeDefault />;
};

const SceneContent = () => {
  const excavationData = useStore((state) => state.excavationData);
  const filters = useStore((state) => state.filters);
  const visibleLayerIds = useStore((state) => state.visibleLayerIds);
  const cameraView = useStore((state) => state.cameraView);
  const validationErrors = useStore((state) => state.validationErrors);
  const selectArtifact = useStore((state) => state.selectArtifact);

  if (!excavationData) return null;

  const filteredArtifacts = filterArtifacts(excavationData.artifacts, filters);
  const filteredArtifactIds = new Set(filteredArtifacts.map((a) => a.id));
  const conflictingArtifactIds = getConflictingArtifactIds(validationErrors);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[100, 200, 100]}
        intensity={0.8}
        castShadow
      />
      <pointLight position={[50, 150, 50]} intensity={0.5} color="#D4A574" />

      <CameraController view={cameraView} gridSize={excavationData.gridSize} />

      <Grid3D size={excavationData.gridSize} />

      {excavationData.layers.map((layer) => (
        <SoilLayer3D
          key={layer.id}
          layer={layer}
          gridSize={excavationData.gridSize}
          visible={visibleLayerIds.includes(layer.id)}
          maxDepth={excavationData.gridSize.z}
        />
      ))}

      <group onClick={() => selectArtifact(null)}>
        {excavationData.artifacts.map((artifact) => (
          <Artifact3D
            key={artifact.id}
            artifact={artifact}
            isFiltered={filteredArtifactIds.has(artifact.id)}
            hasConflict={conflictingArtifactIds.includes(artifact.artifactId)}
          />
        ))}
      </group>

      <EffectComposer>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={0.5} />
      </EffectComposer>
    </>
  );
};

export const ExcavationScene = () => {
  const excavationData = useStore((state) => state.excavationData);

  if (!excavationData) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-stone-900">
        <div className="text-center">
          <div className="text-6xl mb-4">🏺</div>
          <p className="text-stone-400 text-lg">请选择探方数据开始查看</p>
          <p className="text-stone-500 text-sm mt-2">从左上角下拉菜单选择内置样例</p>
        </div>
      </div>
    );
  }

  return (
    <Canvas
      gl={{ antialias: true, alpha: false }}
      style={{ background: 'linear-gradient(180deg, #1a1410 0%, #2d1f14 100%)' }}
    >
      <fog attach="fog" args={['#1a1410', 150, 400]} />
      <SceneContent />
    </Canvas>
  );
};
