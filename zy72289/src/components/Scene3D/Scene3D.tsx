import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import { PointCloud } from './PointCloud';
import { SafetySphere } from './SafetySphere';
import { ObstacleMarker } from './ObstacleMarker';
import { useAppStore } from '@/store/useAppStore';
import type { DetectedObstacle } from '@/types';

function SceneContent() {
  const { pointCloudLogs, activeObstacleId, selectObstacle, scenarioType } = useAppStore();

  const obstacles = useMemo<DetectedObstacle[]>(() => {
    if (pointCloudLogs.length === 0) return [];
    const latestLog = pointCloudLogs[pointCloudLogs.length - 1];
    return latestLog.detectedObstacles;
  }, [pointCloudLogs]);

  const gridSize = useMemo(() => {
    if (!scenarioType) return 15;
    switch (scenarioType) {
      case 'normal':
        return 12;
      case 'duplicate_name':
        return 10;
      case 'old_caliber':
        return 10;
      default:
        return 15;
    }
  }, [scenarioType]);

  return (
    <>
      <color attach="background" args={['#0a0f1a']} />
      <fog attach="fog" args={['#0a0f1a', 15, 40]} />

      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} castShadow />
      <directionalLight position={[-10, 10, -10]} intensity={0.4} />
      <pointLight position={[0, 8, 0]} intensity={0.5} color="#4da6ff" />

      <Environment preset="city" />

      <Grid
        args={[gridSize, gridSize]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1e3a5f"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#2563eb"
        fadeDistance={30}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={false}
      />

      <PointCloud count={3000} />

      {obstacles.map((obstacle) => (
        <group key={obstacle.id}>
          <SafetySphere
            position={[obstacle.position.x, obstacle.position.y, obstacle.position.z]}
            radius={obstacle.detectedRadius}
            status={obstacle.status}
            isActive={activeObstacleId === obstacle.id}
          />
          <ObstacleMarker
            obstacle={obstacle}
            isActive={activeObstacleId === obstacle.id}
            onClick={() => selectObstacle(activeObstacleId === obstacle.id ? null : obstacle.id)}
          />
        </group>
      ))}

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2 - 0.1}
      />
    </>
  );
}

export function Scene3D() {
  return (
    <div className="w-full h-full relative">
      <div className="absolute top-4 left-4 z-10 bg-primary-900/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-primary-600/30">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span className="text-primary-400">⚡</span>
          三维标注视图
        </h3>
        <p className="text-xs text-gray-400 mt-1">
          鼠标左键旋转 | 滚轮缩放 | 右键平移
        </p>
      </div>

      <Canvas
        shadows
        camera={{ position: [12, 10, 12], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
      >
        <SceneContent />
      </Canvas>

      <div className="absolute bottom-4 left-4 z-10 bg-primary-900/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-primary-600/30">
        <div className="flex flex-col gap-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-status-normal"></span>
            <span className="text-gray-300">正常</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-status-pending"></span>
            <span className="text-gray-300">待复核</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-status-conflict"></span>
            <span className="text-gray-300">口径冲突</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-status-corrected"></span>
            <span className="text-gray-300">已修正</span>
          </div>
        </div>
      </div>
    </div>
  );
}
