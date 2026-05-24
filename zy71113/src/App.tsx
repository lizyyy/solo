import { useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Scene3D from './components/Scene3D'
import Timeline from './components/Timeline'
import Toolbar from './components/Toolbar'
import PhasePanel from './components/PhasePanel'
import ConflictPanel from './components/ConflictPanel'
import FilterPanel from './components/FilterPanel'
import useSceneStore from './store/useSceneStore'
import { loadSampleData } from './data/sampleData'
import { detectConflicts } from './utils/conflictDetector'

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { 
    setIntersection, 
    setSignalPhases, 
    setVehicles, 
    setPedestrians, 
    setAccidentPoints,
    setConflicts,
    setTotalDuration,
    resetScene 
  } = useSceneStore()

  useEffect(() => {
    const data = loadSampleData()
    setIntersection(data.intersection)
    setSignalPhases(data.signalPhases)
    setVehicles(data.vehicles)
    setPedestrians(data.pedestrians)
    setAccidentPoints(data.accidentPoints)
    setTotalDuration(data.totalDuration)
    
    const conflicts = detectConflicts(data)
    setConflicts(conflicts)
  }, [setIntersection, setSignalPhases, setVehicles, setPedestrians, setAccidentPoints, setConflicts, setTotalDuration])

  const handleReset = () => {
    resetScene()
    const data = loadSampleData()
    const conflicts = detectConflicts(data)
    setConflicts(conflicts)
  }

  return (
    <div className="w-full h-full flex flex-col bg-dark">
      <div className="flex-1 flex relative">
        <Toolbar onReset={handleReset} canvasRef={canvasRef} />
        
        <div className="flex-1 relative">
          <Canvas
            ref={canvasRef}
            camera={{ position: [30, 30, 30], fov: 50 }}
            gl={{ antialias: true, alpha: false }}
            onCreated={({ gl }) => {
              gl.setClearColor('#0a0f1a')
            }}
          >
            <ambientLight intensity={0.4} />
            <directionalLight position={[20, 40, 20]} intensity={0.8} castShadow />
            <pointLight position={[-20, 20, -20]} intensity={0.3} />
            
            <Scene3D />
            <OrbitControls 
              enableDamping 
              dampingFactor={0.05}
              minDistance={10}
              maxDistance={80}
            />
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
