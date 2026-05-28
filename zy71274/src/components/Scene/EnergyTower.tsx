import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useAppStore } from '@/store/appStore';
import { EnergyLevel } from './EnergyLevel';
import { Electron } from './Electron';
import { TransitionLine } from './TransitionLine';
import { StarField } from './StarField';

export function EnergyTower() {
  const {
    energyLevels,
    transitions,
    selectedLevel,
    activeTransition,
    selectLevel
  } = useAppStore();

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [8, 4, 8], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={['#0a1628']} />
        <fog attach="fog" args={['#0a1628', 20, 60]} />
        
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, 5, -10]} intensity={0.5} color="#7c3aed" />
        
        <StarField />
        
        {energyLevels.map((level) => (
          <EnergyLevel
            key={level.id}
            level={level}
            isSelected={selectedLevel === level.id}
            onClick={() => selectLevel(selectedLevel === level.id ? null : level.id)}
          />
        ))}
        
        {energyLevels.map((level) => (
          <Electron
            key={`electron-${level.id}`}
            level={level}
            isActive={selectedLevel === level.id}
          />
        ))}
        
        {transitions.map((transition) => {
          const fromLevel = energyLevels.find(l => l.id === transition.from_level);
          const toLevel = energyLevels.find(l => l.id === transition.to_level);
          return (
            <TransitionLine
              key={transition.id}
              transition={transition}
              fromLevel={fromLevel}
              toLevel={toLevel}
              isActive={activeTransition === transition.id}
            />
          );
        })}
        
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={5}
          maxDistance={20}
          maxPolarAngle={Math.PI / 2}
        />
        
        <EffectComposer>
          <Bloom
            intensity={1}
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
      
      <div className="absolute bottom-4 left-4 text-xs text-gray-400 bg-slate-900/80 px-3 py-2 rounded-lg backdrop-blur-sm">
        <p>🖱️ 拖拽旋转 | 滚轮缩放 | 点击能级选择</p>
      </div>
    </div>
  );
}
