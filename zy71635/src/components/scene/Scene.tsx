import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useHallStore } from '@/store/useHallStore';
import { HallModel } from '@/components/scene/HallModel';
import { ReflectSurface3D } from '@/components/scene/ReflectSurface3D';
import { SoundSource3D } from '@/components/scene/SoundSource3D';
import { SeatZone3D } from '@/components/scene/SeatZone3D';
import { ReflectPathLine } from '@/components/scene/ReflectPathLine';
import { useCameraFocus } from '@/hooks/useCameraFocus';

interface SceneProps {
  canvasRef?: React.RefObject<HTMLCanvasElement>;
}

function SceneContent() {
  const hall = useHallStore((s) => s.hall);
  const surfaces = useHallStore((s) => s.surfaces);
  const sources = useHallStore((s) => s.sources);
  const zones = useHallStore((s) => s.zones);
  const paths = useHallStore((s) => s.paths);
  const showPaths = useHallStore((s) => s.showPaths);

  useCameraFocus();

  if (!hall) return null;

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      <directionalLight position={[-10, 10, -10]} intensity={0.5} />

      <Environment preset="city" />

      <HallModel hall={hall} />

      {surfaces.map((surface) => (
        <ReflectSurface3D key={surface.id} surface={surface} />
      ))}

      {sources.map((source) => (
        <SoundSource3D key={source.id} source={source} />
      ))}

      {zones.map((zone) => (
        <SeatZone3D key={zone.id} zone={zone} />
      ))}

      {showPaths && paths.map((path) => (
        <ReflectPathLine key={path.id} path={path} />
      ))}

      <EffectComposer>
        <Bloom intensity={0.5} luminanceThreshold={0.9} luminanceSmoothing={0.9} />
      </EffectComposer>

      <OrbitControls makeDefault />
    </>
  );
}

export default function Scene({ canvasRef }: SceneProps) {
  return (
    <Canvas
      ref={canvasRef}
      camera={{ position: [15, 15, 15], fov: 50 }}
      gl={{ preserveDrawingBuffer: true }}
      shadows
    >
      <SceneContent />
    </Canvas>
  );
}
