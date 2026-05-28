import { EffectComposer, Bloom, FXAA, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';

interface EffectsProps {
  enableChromaticAberration?: boolean;
}

const Effects = ({ enableChromaticAberration = false }: EffectsProps) => {
  return (
    <EffectComposer>
      <FXAA />
      <Bloom
        intensity={1.5}
        radius={0.5}
        mipmapBlur
        luminanceThreshold={0.8}
        luminanceSmoothing={0.9}
      />
      {enableChromaticAberration && (
        <ChromaticAberration
          offset={new THREE.Vector2(0.0005, 0.0012)}
          radialModulation={false}
          modulationOffset={0}
        />
      )}
    </EffectComposer>
  );
};

export default Effects;
