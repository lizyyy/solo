import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { OceanSurface, BathymetryGrid } from './OceanSurface';
import { TidalStationTower } from './TidalStationTower';
import { BuoyMarker } from './BuoyMarker';
import { SceneControls } from './SceneControls';
import { useTidalStore, annotationToWorld } from '@/store/useTidalStore';

export function TidalScene() {
  const batch = useTidalStore((s) => s.batch);
  const selectedId = useTidalStore((s) => s.selectedAnnotationId);
  const selectStation = useTidalStore((s) => s.selectStation);

  const points = batch
    ? batch.annotations.map((ann, idx) => ({
        ann,
        wp: annotationToWorld(ann, idx, batch.annotations.length),
      }))
    : [];

  return (
    <Canvas
      shadows
      camera={{ position: [22, 22, 26], fov: 48, near: 0.1, far: 400 }}
      gl={{ antialias: true, alpha: false }}
      onPointerMissed={() => selectStation(null)}
    >
      <color attach="background" args={['#06141c']} />
      <fog attach="fog" args={['#06141c', 55, 130]} />

      <ambientLight intensity={0.9} color="#38e1d6" />
      <hemisphereLight args={['#38e1d6', '#04101a', 0.5]} />
      <directionalLight
        position={[25, 35, 18]}
        intensity={1.6}
        color="#ffffff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      <directionalLight position={[-18, 12, -14]} intensity={0.6} color="#38e1d6" />

      <OceanSurface />
      <BathymetryGrid />

      {/* Pending review zone platform */}
      <mesh position={[18, -0.05, -6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#0a1f2b" emissive="#f5b342" emissiveIntensity={0.08} transparent opacity={0.55} />
      </mesh>

      <TidalStationTower position={[0, 0, 0]} />

      {points.map(({ ann, wp }) => (
        <BuoyMarker
          key={ann.annotationId}
          annotation={ann}
          position={[wp.x, wp.y, wp.z]}
          isPending={wp.isPending}
          selected={ann.annotationId === selectedId}
          onSelect={selectStation}
        />
      ))}

      <Environment preset="night" />
      <SceneControls />

      <EffectComposer>
        <Bloom intensity={1.1} luminanceThreshold={0.15} luminanceSmoothing={0.45} mipmapBlur />
        <Vignette eskil={false} offset={0.2} darkness={0.55} />
      </EffectComposer>
    </Canvas>
  );
}
