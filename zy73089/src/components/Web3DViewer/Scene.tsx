import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Grid } from '@react-three/drei';
import { EffectComposer, Bloom, FXAA } from '@react-three/postprocessing';
import { useChecklistStore } from '@/store/checklistStore';
import { useUiStore } from '@/store/uiStore';
import { StructureMesh } from './StructureMesh';
import { SelectedBubble } from './SelectedBubble';

export function Scene() {
  const components = useChecklistStore((s) => s.modelComponents);
  const selectComponent = useUiStore((s) => s.selectComponent);
  const list = Object.values(components);
  const hasComponents = list.length > 0;

  return (
    <Canvas
      shadows
      camera={{ position: [22, 18, 22], fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: false }}
      onPointerMissed={() => selectComponent(null)}
    >
      <color attach="background" args={['#0F172A']} />
      <fog attach="fog" args={['#0F172A', 30, 75]} />

      <ambientLight intensity={0.45} />
      <directionalLight
        position={[15, 20, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={80}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
      />
      <directionalLight position={[-10, 8, -8]} intensity={0.35} color="#93C5FD" />
      <pointLight position={[8, 3, 8]} intensity={0.3} color="#F59E0B" />

      <Environment preset="city" />

      {hasComponents ? (
        <>
          {list.map((c) => (
            <group key={c.id}>
              <StructureMesh component={c} />
              <SelectedBubble component={c} />
            </group>
          ))}
        </>
      ) : (
        <group>
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[8, 0.4, 8]} />
            <meshStandardMaterial color="#334155" wireframe />
          </mesh>
          <mesh position={[4, 2.5, 0]}>
            <boxGeometry args={[0.6, 5, 0.6]} />
            <meshStandardMaterial color="#475569" transparent opacity={0.5} />
          </mesh>
          <mesh position={[-4, 2.5, 0]}>
            <boxGeometry args={[0.6, 5, 0.6]} />
            <meshStandardMaterial color="#475569" transparent opacity={0.5} />
          </mesh>
          <mesh position={[0, 5.05, 0]}>
            <boxGeometry args={[10, 0.2, 6]} />
            <meshStandardMaterial color="#64748B" transparent opacity={0.6} />
          </mesh>
        </group>
      )}

      <Grid
        position={[8, -0.01, 6]}
        args={[40, 40]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1E293B"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#1E40AF"
        fadeDistance={50}
        fadeStrength={1.2}
        followCamera={false}
        infiniteGrid
      />

      <ContactShadows position={[0, 0, 0]} opacity={0.55} scale={60} blur={2.4} far={20} />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={6}
        maxDistance={60}
        maxPolarAngle={Math.PI / 2 - 0.08}
      />

      <EffectComposer multisampling={0} enableNormalPass={false}>
        <FXAA />
        <Bloom
          intensity={0.55}
          luminanceThreshold={0.35}
          luminanceSmoothing={0.25}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  );
}
