import { useRef, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Float, Effects } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, FXAA } from '@react-three/postprocessing';
import * as THREE from 'three';
import { Cube3D, DataRange } from '../../types/data';
import { CubeMesh } from './CubeMesh';
import { Axes } from './Axes';
import { GridFloor } from './GridFloor';
import { COLORS } from '../../utils/colorMapping';
import { useDataStore } from '../../store/useDataStore';
import { useUIStore } from '../../store/useUIStore';

interface DepthCubeSceneProps {
  cubes: Cube3D[];
  dataRange: DataRange;
  visibleLevels: number[];
  showBids: boolean;
  showAsks: boolean;
  showAnomalies: boolean;
  currentTimeIndex: number;
  windowSize: number;
  showGrid: boolean;
  showAxes: boolean;
  showLabels: boolean;
  autoRotate: boolean;
  onCubeClick: (cube: Cube3D) => void;
  onCubeHover: (cube: Cube3D | null) => void;
}

function AutoRotateController({ autoRotate }: { autoRotate: boolean }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useFrame((_, delta) => {
    if (autoRotate && controlsRef.current) {
      const azimuthalAngle = controlsRef.current.getAzimuthalAngle();
      controlsRef.current.setAzimuthalAngle(azimuthalAngle + delta * 0.2);
    }
  });

  return null;
}

function DepthCubeScene({
  cubes,
  dataRange,
  visibleLevels,
  showBids,
  showAsks,
  showAnomalies,
  currentTimeIndex,
  windowSize,
  showGrid,
  showAxes,
  showLabels,
  autoRotate,
  onCubeClick,
  onCubeHover,
}: DepthCubeSceneProps) {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[-10, 5, -10]} intensity={0.4} color="#00d4ff" />
      <pointLight position={[10, 5, 10]} intensity={0.4} color="#ff4757" />
      <pointLight position={[0, 15, 0]} intensity={0.3} color="#ffffff" />

      <Float speed={0.5} rotationIntensity={0} floatIntensity={0.2}>
        <CubeMesh
          cubes={cubes}
          visibleLevels={visibleLevels}
          showBids={showBids}
          showAsks={showAsks}
          showAnomalies={showAnomalies}
          currentTimeIndex={currentTimeIndex}
          windowSize={windowSize}
          onCubeClick={onCubeClick}
          onCubeHover={onCubeHover}
        />
      </Float>

      {showGrid && <GridFloor />}
      {showAxes && <Axes dataRange={dataRange} showLabels={showLabels} />}

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={8}
        maxDistance={40}
        maxPolarAngle={Math.PI / 2.1}
        minPolarAngle={0.1}
      />
      
      <AutoRotateController autoRotate={autoRotate} />

      <Effects>
        <EffectComposer>
          <FXAA />
          <Bloom
            intensity={0.6}
            luminanceThreshold={0.4}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
          <Vignette
            offset={0.3}
            darkness={0.5}
          />
        </EffectComposer>
      </Effects>

      <fog attach="fog" args={[COLORS.neutral.background, 20, 50]} />
    </>
  );
}

interface DepthCubeProps {
  className?: string;
}

export function DepthCube({ className }: DepthCubeProps) {
  const {
    cubes,
    dataRange,
    visibleLevels,
    showBids,
    showAsks,
    showAnomalies,
    currentTimeIndex,
    selectCube,
  } = useDataStore();

  const {
    showGrid,
    showAxes,
    showLabels,
    autoRotate,
    backgroundColor,
    setHoveredCubeId,
  } = useUIStore();

  const handleCubeClick = useCallback((cube: Cube3D) => {
    selectCube(cube.id);
  }, [selectCube]);

  const handleCubeHover = useCallback((cube: Cube3D | null) => {
    setHoveredCubeId(cube?.id || null);
  }, [setHoveredCubeId]);

  if (!dataRange || cubes.length === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="text-center text-gray-400">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold mb-2">暂无数据</h3>
          <p className="text-sm">请导入盘口数据文件或生成测试数据</p>
        </div>
      </div>
    );
  }

  return (
    <Canvas
      className={className}
      camera={{ position: [15, 12, 15], fov: 50 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      dpr={[1, 2]}
      style={{ background: backgroundColor }}
      onPointerMissed={() => selectCube(null)}
    >
      <DepthCubeScene
        cubes={cubes}
        dataRange={dataRange}
        visibleLevels={visibleLevels}
        showBids={showBids}
        showAsks={showAsks}
        showAnomalies={showAnomalies}
        currentTimeIndex={currentTimeIndex}
        windowSize={20}
        showGrid={showGrid}
        showAxes={showAxes}
        showLabels={showLabels}
        autoRotate={autoRotate}
        onCubeClick={handleCubeClick}
        onCubeHover={handleCubeHover}
      />
    </Canvas>
  );
}
