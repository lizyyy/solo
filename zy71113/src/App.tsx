import { useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Scene3D from './components/Scene3D'
import Timeline from './components/Timeline'
import Toolbar from './components/Toolbar'
import PhasePanel from './components/PhasePanel'
import ConflictPanel from './components/ConflictPanel'
import FilterPanel from './components/FilterPanel'
import useSceneStore, { loadDataFromStorage } from './store/useSceneStore'
import { loadSampleData } from './data/sampleData'

function CameraController() {
  const { viewMode } = useSceneStore()
  const { camera } = useThree()
  const controlsRef = useRef<any>(null)

  useEffect(() => {
    if (viewMode === '2d') {
      camera.position.set(0, 60, 0.1)
      camera.lookAt(0, 0, 0)
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = 10
        camera.updateProjectionMatrix()
      }
    } else {
      camera.position.set(30, 30, 30)
      camera.lookAt(0, 0, 0)
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = 50
        camera.updateProjectionMatrix()
      }
    }
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0)
      controlsRef.current.update()
    }
  }, [viewMode, camera])

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={10}
      maxDistance={80}
      enablePan={true}
    />
  )
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { loadSceneData, resetScene, viewMode } = useSceneStore()

  useEffect(() => {
    const storedData = loadDataFromStorage()
    if (storedData && storedData.intersection) {
      loadSceneData(storedData, false)
    } else {
      const sampleData = loadSampleData()
      loadSceneData(sampleData, true)
    }
  }, [loadSceneData])

  const handleReset = () => {
    resetScene()
  }

  return (
    <div className="w-full h-full flex flex-col bg-dark">
      <div className="flex-1 flex relative">
        <Toolbar onReset={handleReset} canvasRef={canvasRef} />
        
        <div className="flex-1 relative">
          <Canvas
            ref={canvasRef}
            camera={{ position: [30, 30, 30], fov: viewMode === '2d' ? 10 : 50 }}
            gl={{ antialias: true, alpha: false }}
            onCreated={({ gl }) => {
              gl.setClearColor('#0a0f1a')
            }}
            key={viewMode}
          >
            <ambientLight intensity={0.4} />
            <directionalLight position={[20, 40, 20]} intensity={0.8} castShadow />
            <pointLight position={[-20, 20, -20]} intensity={0.3} />
            
            <Scene3D />
            <CameraController />
          </Canvas>
        </div>

        <div className="w-72 bg-dark-light border-l border-slate-700 flex flex-col overflow-hidden">
          <PhasePanel />
          <ConflictPanel />
          <FilterPanel />
        </div>
      </div>
      
      <Timeline />
    </div>
  )
}

export default App
