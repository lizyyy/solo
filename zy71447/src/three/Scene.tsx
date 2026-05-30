import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { Instrument3D } from './Instrument3D';
import { SectionPlane } from './SectionPlane';
import type {
  InstrumentModel,
  ResonanceCavity,
  SectionParams,
  BandType,
  Hotspot,
  FrequencySample,
  Point3D,
} from '@/types';

interface SceneProps {
  instrument: InstrumentModel;
  cavities: ResonanceCavity[];
  hotspots: Hotspot[];
  samples: FrequencySample[];
  sectionParams: SectionParams;
  currentBand: BandType;
  selectedHotspotId: string | null;
  cameraTarget: Point3D;
  onHotspotClick: (id: string) => void;
  showHeatmap: boolean;
}

export function Scene({
  instrument,
  cavities,
  hotspots,
  samples,
  sectionParams,
  currentBand,
  selectedHotspotId,
  cameraTarget,
  onHotspotClick,
  showHeatmap,
}: SceneProps) {
  const clipPlanes = useMemo(() => {
    const plane = new THREE.Plane();
    switch (sectionParams.axis) {
      case 'x':
        plane.setFromNormalAndCoplanarPoint(
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(sectionParams.position, 0, 0)
        );
        break;
      case 'y':
        plane.setFromNormalAndCoplanarPoint(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, sectionParams.position, 0)
        );
        break;
      case 'z':
        plane.setFromNormalAndCoplanarPoint(
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(0, 0, sectionParams.position)
        );
        break;
    }
    return [plane];
  }, [sectionParams.axis, sectionParams.position]);

  const cameraDistance = useMemo(() => {
    const { width, height, depth } = instrument.dimensions;
    return Math.max(width, height, depth) * 2.5;
  }, [instrument.dimensions]);

  return (
    <Canvas
      shadows
      camera={{ position: [cameraDistance * 0.5, cameraDistance * 0.3, cameraDistance], fov: 45 }}
      gl={{ antialias: true, localClippingEnabled: true }}
      dpr={[1, 2]}
    >
      <Suspense fallback={null}>
        <color attach="background" args={['#0d0d0d']} />
        <fog attach="fog" args={['#0d0d0d', cameraDistance * 1.5, cameraDistance * 3]} />

        <ambientLight intensity={0.4} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={50}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={5}
          shadow-camera-bottom={-5}
        />
        <directionalLight position={[-3, 2, -3]} intensity={0.3} color="#B8860B" />
        <pointLight position={[0, 2, 0]} intensity={0.2} color="#DAA520" />

        <group position={[cameraTarget.x, cameraTarget.y, cameraTarget.z]}>
          <Instrument3D
            instrument={instrument}
            cavities={cavities}
            hotspots={hotspots}
            samples={samples}
            sectionParams={sectionParams}
            currentBand={currentBand}
            selectedHotspotId={selectedHotspotId}
            onHotspotClick={onHotspotClick}
            showHeatmap={showHeatmap}
          />
          <SectionPlane params={sectionParams} dimensions={instrument.dimensions} />
        </group>

        <ContactShadows
          position={[0, -instrument.dimensions.height / 2 - 0.01, 0]}
          opacity={0.4}
          scale={10}
          blur={2}
          far={4}
        />

        <Environment preset="studio" />

        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={cameraDistance * 0.5}
          maxDistance={cameraDistance * 3}
          target={[cameraTarget.x, cameraTarget.y, cameraTarget.z]}
        />

        <EffectComposer>
          <Bloom
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            height={300}
            intensity={0.8}
          />
          <Vignette offset={0.5} darkness={0.5} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
