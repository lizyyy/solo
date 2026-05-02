import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { SceneProvider, useScene } from '@/store/sceneStore'
import { ShipyardScene } from '@/components/3d/ShipyardScene'
import { Sidebar } from '@/components/ui/Sidebar'

const SceneCanvas: React.FC = () => {
  const { scene } = useScene()

  return (
    <div className="flex-1 bg-gray-900 relative">
      <Canvas
        camera={{
          position: [80, 60, 80],
          fov: 50,
          near: 0.1,
          far: 1000
        }}
      >
        <Suspense fallback={null}>
          <ShipyardScene
            segments={scene.segments}
            crane={scene.crane}
            obstacles={scene.obstacles}
            keyframes={scene.keyframes}
            currentKeyframeIndex={scene.currentKeyframeIndex}
            collisionResults={scene.collisionResults}
          />
        </Suspense>
      </Canvas>
      <div className="absolute top-4 left-4 bg-gray-800 bg-opacity-90 rounded-lg px-4 py-2 text-sm text-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-green-400">●</span>
          <span>分段吊装避碰沙盘</span>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          鼠标左键拖动旋转 | 右键拖动平移 | 滚轮缩放
        </div>
      </div>
      {scene.collisionResults.length > 0 && (
        <div className="absolute top-4 right-4 bg-red-600 bg-opacity-90 rounded-lg px-4 py-2 text-sm text-white">
          <div className="flex items-center gap-2">
            <span className="animate-pulse">⚠️</span>
            <span>检测到 {scene.collisionResults.length} 个风险</span>
          </div>
          <div className="text-xs text-red-200 mt-1">
            {scene.collisionResults.filter((c) => c.severity === 'critical').length} 个严重风险
          </div>
        </div>
      )}
    </div>
  )
}

const AppContent: React.FC = () => {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <SceneCanvas />
    </div>
  )
}

export const App: React.FC = () => {
  return (
    <SceneProvider>
      <AppContent />
    </SceneProvider>
  )
}
