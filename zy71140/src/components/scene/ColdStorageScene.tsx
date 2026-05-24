import { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Effects } from '@react-three/drei';
import { EffectComposer, Bloom, FXAA } from '@react-three/postprocessing';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useStore } from '../../store/useStore';
import { cameraPresets, type CameraPosition } from '../../utils/cameraPresets';
import { ColdStorageShell } from './ColdStorageShell';
import { LayerPlane } from './LayerPlane';
import { SlotMesh } from './SlotMesh';

function SceneController() {
  const { cameraView } = useStore();
  const { camera, controls } = useThree();
  const controlsRef = controls as unknown as OrbitControlsImpl | null;

  useEffect(() => {
    if (cameraView !== 'free' && controlsRef) {
      const preset: CameraPosition = cameraPresets[cameraView];
      camera.position.set(...preset.position);
      controlsRef.target.set(...preset.target);
      controlsRef.update();
    }
  }, [cameraView, camera, controlsRef]);

  return null;
}

function SceneContent() {
  const {
    coldStorage,
    layers,
    slots,
    skus,
    selectedLayerIds,
    selectedSlotId,
    setSelectedSlot,
    searchQuery,
    expiryFilterDays,
  } = useStore();

  const filteredSlots = slots.filter((slot) => selectedLayerIds.includes(slot.layerId));

  const isSearchMatch = (slotId: string) => {
    if (!searchQuery) return true;
    const slot = slots.find((s) => s.id === slotId);
    const slotSKUs = skus.filter((s) => s.slotId === slotId);
    const query = searchQuery.toLowerCase();

    if (slot?.code.toLowerCase().includes(query)) return true;
    return slotSKUs.some(
      (sku) =>
        sku.name.toLowerCase().includes(query) ||
        sku.code.toLowerCase().includes(query) ||
        sku.batchNo.toLowerCase().includes(query),
    );
  };

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[15, 20, 15]} intensity={0.8} color="#e0f2fe" />
      <pointLight position={[-10, 10, -10]} intensity={0.5} color="#7dd3fc" />
      <pointLight position={[0, 15, 0]} intensity={0.3} color="#a5f3fc" />

      <Environment preset="city" />

      <ColdStorageShell dimensions={coldStorage.dimensions} />

      {layers.map((layer, index) => (
        <LayerPlane
          key={layer.id}
          layer={layer}
          y={index * 2.5 + 0.5}
          width={coldStorage.dimensions.width}
          depth={coldStorage.dimensions.depth}
          isVisible={selectedLayerIds.includes(layer.id)}
        />
      ))}

      {filteredSlots.map((slot) => {
        const layer = layers.find((l) => l.id === slot.layerId);
        const sku = skus.find((s) => s.slotId === slot.id);
        return (
          <SlotMesh
            key={slot.id}
            slot={slot}
            layer={layer}
            sku={sku}
            isSelected={selectedSlotId === slot.id}
            isSearchMatch={isSearchMatch(slot.id)}
            expiryFilterDays={expiryFilterDays}
            onClick={() => setSelectedSlot(selectedSlotId === slot.id ? null : slot.id)}
          />
        );
      })}

      <Effects>
        <EffectComposer multisampling={0}>
          <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={0.5} />
          <FXAA />
        </EffectComposer>
      </Effects>

      <SceneController />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={60}
        maxPolarAngle={Math.PI / 2 + 0.2}
      />
    </>
  );
}

export function ColdStorageScene() {
  return (
    <Canvas
      camera={{ position: [25, 20, 25], fov: 50 }}
      gl={{ antialias: true, alpha: false }}
      onPointerMissed={() => useStore.getState().setSelectedSlot(null)}
    >
      <color attach="background" args={['#030712']} />
      <fog attach="fog" args={['#030712', 30, 80]} />
      <SceneContent />
    </Canvas>
  );
}
