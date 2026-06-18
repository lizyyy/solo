import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

export default function PostFX() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={0.9}
        luminanceThreshold={0.18}
        luminanceSmoothing={0.5}
        mipmapBlur
        radius={0.7}
      />
      <Vignette eskil={false} offset={0.2} darkness={0.85} />
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.35} />
    </EffectComposer>
  );
}
