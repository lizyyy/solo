import { useEffect, useRef, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { useAppStore } from '../../store/appStore';
import { FloorPlane } from './FloorPlane';
import { Shelf3D } from './Shelf3D';
import { Heatmap3D } from './Heatmap3D';
import { cameraPresets } from '../../data/mockData';
import { CameraPreset } from '../../types';

interface CameraControllerProps {
  preset: CameraPreset | null;
}

function CameraController({ preset }: CameraControllerProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (preset && controlsRef.current) {
      camera.position.set(...preset.position);
      controlsRef.current.target.set(...preset.target);
      controlsRef.current.update();
    }
  }, [preset, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      minDistance={5}
      maxDistance={50}
      maxPolarAngle={Math.PI / 2.1}
    />
  );
}

function SceneContent({ cameraPreset }: { cameraPreset: CameraPreset | null }) {
  const store = useAppStore((state) => state.store);
  const showHeatmap = useAppStore((state) => state.showHeatmap);
  const showGoldenLayer = useAppStore((state) => state.showGoldenLayer);
  const filterCategory = useAppStore((state) => state.filterCategory);
  const selectedSkuSlotId = useAppStore((state) => state.selectedSkuSlotId);
  const issues = useAppStore((state) => state.issues);
  const showIssues = useAppStore((state) => state.showIssues);
  const setSelectedShelf = useAppStore((state) => state.setSelectedShelf);
  const setSelectedSku = useAppStore((state) => state.setSelectedSku);

  const issueSlotIds = useMemo(() => {
    const ids = new Set<string>();
    if (showIssues) {
      issues.forEach((issue) => {
        if (issue.skuId) {
          store?.shelves.forEach((shelf) => {
            shelf.layers.forEach((layer) => {
              layer.slots.forEach((slot) => {
                if (slot.skuId === issue.skuId && shelf.id === issue.shelfId && layer.index === issue.layerIndex) {
                  ids.add(slot.id);
                }
              });
            });
          });
        }
      });
    }
    return ids;
  }, [issues, showIssues, store]);

  const handleSceneClick = () => {
    setSelectedShelf(null);
    setSelectedSku(null);
  };

  if (!store) return null;

  return (
    <group onClick={handleSceneClick}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} castShadow />
      <directionalLight position={[-10, 10, -10]} intensity={0.4} />
      <pointLight position={[0, 15, 0]} intensity={0.6} />

      <FloorPlane width={store.width} depth={store.depth} />

      <Heatmap3D points={store.heatmapData} visible={showHeatmap} />

      {store.shelves.map((shelf) => (
        <Shelf3D
          key={shelf.id}
          shelf={shelf}
          showGoldenLayer={showGoldenLayer}
          filterCategory={filterCategory}
          selectedSkuSlotId={selectedSkuSlotId}
          issueSlotIds={issueSlotIds}
        />
      ))}

      <CameraController preset={cameraPreset} />

      <Stars radius={100} depth={50} count={1000} factor={2} saturation={0} fade speed={0.5} />
    </group>
  );
}

interface Scene3DProps {
  currentView: string;
}

export function Scene3D({ currentView }: Scene3DProps) {
  const cameraPreset = (cameraPresets.find((p) => p.name === currentView) as CameraPreset) || null;

  return (
    <Canvas
      shadows
      camera={{ position: [0, 25, 20], fov: 50 }}
      gl={{ antialias: true, alpha: false }}
      onPointerMissed={() => {
        const state = useAppStore.getState();
        state.setSelectedShelf(null);
        state.setSelectedSku(null);
      }}
    >
      <color attach="background" args={['#0f172a']} />
      <fog attach="fog" args={['#0f172a', 30, 60]} />
      <SceneContent cameraPreset={cameraPreset} />
    </Canvas>
  );
}
