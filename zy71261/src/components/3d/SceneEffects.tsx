import { EffectComposer, Bloom } from "@react-three/postprocessing"

export default function SceneEffects() {
  return (
    <EffectComposer>
      <Bloom
        intensity={0.3}
        luminanceThreshold={0.8}
        luminanceSmoothing={0.9}
      />
    </EffectComposer>
  )
}
