import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { useStore } from '../../store/useStore'
import ShelfMesh from './ShelfMesh'
import TrajectoryCloud from './TrajectoryCloud'
import HeatmapOverlay from './HeatmapOverlay'
import BatteryMarkers from './BatteryMarkers'
import PathAnomalyMarkers from './PathAnomalyMarkers'

export default function WarehouseScene() {
  const shelves = useStore((s) => s.shelves)

  return (
    <Canvas
      camera={{ position: [0, 30, 30], fov: 50, near: 0.1, far: 500 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#0a0e1a' }}
      onCreated={({ gl }) => {
        gl.setClearColor('#0a0e1a')
      }}
    >
      <fog attach="fog" args={['#0a0e1a', 40, 120]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 30, 10]} intensity={0.5} color="#aaccff" />
      <pointLight position={[-20, 15, -20]} intensity={1.0} color="#aaccff" distance={80} />
      <pointLight position={[20, 15, 20]} intensity={1.0} color="#aaccff" distance={80} />
      <pointLight position={[0, 15, 0]} intensity={0.8} color="#ffffff" distance={80} />
      <pointLight position={[-20, 15, 20]} intensity={0.6} color="#00f0ff" distance={80} />
      <pointLight position={[20, 15, -20]} intensity={0.6} color="#00f0ff" distance={80} />

      <Grid
        position={[0, -0.01, 0]}
        cellSize={2}
        cellThickness={0.5}
        cellColor="#1a2744"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#2a3f6a"
        fadeDistance={80}
        fadeStrength={1}
        infiniteGrid
      />

      <ShelfMesh shelves={shelves} />
      <TrajectoryCloud />
      <HeatmapOverlay />
      <BatteryMarkers />
      <PathAnomalyMarkers />

      <OrbitControls
        maxPolarAngle={(85 * Math.PI) / 180}
        minDistance={5}
        maxDistance={80}
        enableDamping
        dampingFactor={0.1}
      />

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.4}
          luminanceSmoothing={0.5}
          intensity={0.6}
        />
      </EffectComposer>
    </Canvas>
  )
}
