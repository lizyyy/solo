import { Canvas } from '@react-three/fiber'
import { DataCenterScene } from '@/components/scene/DataCenterScene'
import TopNavbar from '@/components/ui/TopNavbar'
import ParamPanel from '@/components/ui/ParamPanel'
import AnomalyPanel from '@/components/ui/AnomalyPanel'
import Toolbar from '@/components/ui/Toolbar'
import SectionSlider from '@/components/ui/SectionSlider'

export default function Home() {
  return (
    <div className="w-full h-screen flex flex-col bg-dc-bg">
      <TopNavbar />
      <div className="flex-1 relative overflow-hidden">
        <Canvas
          camera={{ position: [12, 10, 18], fov: 50 }}
          gl={{ antialias: true, alpha: false, localClippingEnabled: true }}
          shadows
        >
          <color attach="background" args={['#0f1923']} />
          <fog attach="fog" args={['#0f1923', 20, 50]} />
          <DataCenterScene />
        </Canvas>
        <Toolbar />
        <SectionSlider />
        <ParamPanel />
        <AnomalyPanel />
      </div>
    </div>
  )
}
