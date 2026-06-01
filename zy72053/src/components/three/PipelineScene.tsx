import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Bloom } from '@react-three/postprocessing'
import { useStore } from '@/store/useStore'
import { useFilteredPoints } from '@/hooks/useDerivedData'
import PipelineLine from './PipelineLine'
import CorrosionPoint3D from './CorrosionPoint3D'

export default function PipelineScene() {
  const pipes = useStore((s) => s.pipes)
  const points = useFilteredPoints()
  const selectPoint = useStore((s) => s.selectPoint)

  return (
    <Canvas
      camera={{ position: [0, 12, 18], fov: 50 }}
      style={{ background: '#0A1628' }}
      onPointerMissed={() => selectPoint(null)}
    >
      <fog attach="fog" args={['#0a1628', 15, 40]} />
      <ambientLight color="#1a2a3a" intensity={0.6} />
      <directionalLight color="#88ccff" intensity={0.8} position={[5, 10, 5]} />
      <OrbitControls target={[0, 1, 0]} />

      {pipes.map((pipe) => (
        <PipelineLine key={pipe.id} pipe={pipe} />
      ))}

      {points.map((point) => (
        <CorrosionPoint3D key={point.id} point={point} />
      ))}

      <Bloom intensity={0.5} luminanceThreshold={0.6} />
    </Canvas>
  )
}
