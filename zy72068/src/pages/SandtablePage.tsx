import { useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import type * as THREE from 'three';
import { useStore } from '@/store/useStore';
import SandtableScene from '@/components/SandtableScene';
import FilterPanel from '@/components/FilterPanel';
import DetailPanel from '@/components/DetailPanel';
import Toolbar from '@/components/Toolbar';

export default function SandtablePage() {
  const { filteredRecords, selectedRecordId, selectRecord } = useStore();
  const glRef = useRef<THREE.WebGLRenderer | null>(null);

  const handleCreated = useCallback(
    (state: { gl: THREE.WebGLRenderer }) => {
      glRef.current = state.gl;
    },
    []
  );

  return (
    <div className="relative w-full h-screen bg-[#050d1a] overflow-hidden">
      <Toolbar glRef={glRef} />
      <FilterPanel />
      <DetailPanel />

      <div className="w-full h-full">
        <Canvas
          onCreated={handleCreated}
          camera={{ position: [0, 25, 35], fov: 50, near: 0.1, far: 200 }}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
        >
          <SandtableScene
            records={filteredRecords}
            selectedRecordId={selectedRecordId}
            onSelectRecord={selectRecord}
          />
          <OrbitControls
            makeDefault
            minDistance={5}
            maxDistance={80}
            maxPolarAngle={Math.PI / 2.2}
            enableDamping
            dampingFactor={0.1}
          />
          <EffectComposer>
            <Bloom luminanceThreshold={0.6} luminanceSmoothing={0.9} intensity={0.4} />
          </EffectComposer>
        </Canvas>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#0a1628]/80 border border-cyan-500/10 rounded-lg px-4 py-2 z-10">
        <p className="text-[10px] text-zinc-500 text-center">
          鼠标拖拽旋转 · 滚轮缩放 · 点击船舶查看详情 · 右键平移
        </p>
      </div>
    </div>
  );
}
