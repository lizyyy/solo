import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Building } from '@/components/Scene3D/Building';
import { SunLight } from '@/components/Scene3D/SunLight';
import { Ground } from '@/components/Scene3D/Ground';
import { SceneControls } from '@/components/Scene3D/SceneControls';
import { BuildingInfoPanel } from '@/components/Scene3D/BuildingInfoPanel';
import { useBuildingStore } from '@/store/useBuildingStore';

export function ScenePage() {
  const buildings = useBuildingStore((state) => state.buildings);

  return (
    <div className="relative w-full h-screen bg-sky-200">
      <Canvas
        shadows
        camera={{ position: [80, 60, 80], fov: 50 }}
        onClick={() => useBuildingStore.getState().setSelectedBuildingId(null)}
      >
        <color attach="background" args={['#87ceeb']} />
        <fog attach="fog" args={['#87ceeb', 100, 300]} />
        <SunLight />
        <Ground />
        {buildings.map((building) => (
          <Building key={building.id} building={building} />
        ))}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={30}
          maxDistance={200}
          maxPolarAngle={Math.PI / 2.1}
        />
      </Canvas>

      <SceneControls />
      <BuildingInfoPanel />
    </div>
  );
}
