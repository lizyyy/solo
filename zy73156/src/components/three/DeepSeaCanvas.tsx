import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import * as THREE from "three";
import { STATIONS } from "@/store/useOceanStore";
import { useFilteredSamples, useOceanStore } from "@/store/useOceanStore";
import AbyssEnvironment from "./AbyssEnvironment";
import CurrentParticles from "./CurrentParticles";
import PostFX from "./PostFX";
import SamplingNode from "./SamplingNode";
import SceneLights from "./SceneLights";

const STATION_MAP = new Map(STATIONS.map((s) => [s.id, s.position]));

function Scene() {
  const filtered = useFilteredSamples();
  const selectSample = useOceanStore((s) => s.selectSample);

  return (
    <group
      onPointerMissed={() => selectSample(null)}
    >
      <SceneLights />
      <AbyssEnvironment />
      <CurrentParticles />
      {filtered.map((sample) => (
        <SamplingNode
          key={sample.id}
          sample={sample}
          position={STATION_MAP.get(sample.stationId) ?? [0, 0, 0]}
        />
      ))}
    </group>
  );
}

export default function DeepSeaCanvas() {
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ position: [0, 7, 18], fov: 48, near: 0.1, far: 100 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      onCreated={({ scene }) => {
        scene.background = new THREE.Color("#040D16");
        scene.fog = new THREE.FogExp2("#040D16", 0.028);
      }}
    >
      <Suspense fallback={null}>
        <Scene />
        <PostFX />
      </Suspense>
      <OrbitControls
        enablePan={false}
        minDistance={8}
        maxDistance={30}
        maxPolarAngle={Math.PI / 1.85}
        minPolarAngle={Math.PI / 6}
        autoRotate={false}
      />
    </Canvas>
  );
}
