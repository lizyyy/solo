import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { useMainStore } from '@/store/mainStore';
import GalleryWalls from './GalleryWalls';
import LightSource3D from './LightSource3D';
import Artwork3D from './Artwork3D';
import Heatmap from './Heatmap';
import RiskMarker from './RiskMarker';

export default function GalleryScene() {
  const {
    gallery,
    lightSources,
    artworks,
    risks,
    showHeatmap,
    showRiskMarkers,
    selectedArtworkId,
    selectArtwork
  } = useMainStore();

  if (!gallery) return null;

  const handleCanvasClick = () => {
    selectArtwork(null);
  };

  return (
    <div className="w-full h-full">
      <Canvas
        shadows
        camera={{ position: [8, 6, 10], fov: 50 }}
        onPointerMissed={handleCanvasClick}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#0a0b0d']} />
        <fog attach="fog" args={['#0a0b0d', 15, 35]} />

        <ambientLight intensity={0.15} color="#ffffff" />

        <GalleryWalls walls={gallery.walls} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
          <planeGeometry args={[gallery.width, gallery.depth]} />
          <meshStandardMaterial color="#1a1c20" roughness={0.9} />
        </mesh>

        {lightSources.map((light) => (
          <LightSource3D key={light.id} lightSource={light} />
        ))}

        {artworks.map((artwork) => (
          <Artwork3D
            key={artwork.id}
            artwork={artwork}
            isSelected={selectedArtworkId === artwork.id}
          />
        ))}

        {showHeatmap && <Heatmap gallery={gallery} />}

        {showRiskMarkers &&
          risks
            .filter((r) => r.status !== 'resolved')
            .map((risk) => <RiskMarker key={risk.id} risk={risk} />)}

        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={3}
          maxDistance={30}
          maxPolarAngle={Math.PI / 2 - 0.1}
        />

        <Environment preset="city" />

        <EffectComposer>
          <Bloom
            intensity={0.4}
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.1} darkness={0.5} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
