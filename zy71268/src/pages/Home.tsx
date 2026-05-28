import { useRef } from 'react'
import * as THREE from 'three'
import { useSculptureStore } from '@/store/useSculptureStore'
import Scene3D from '@/components/scene/Scene3D'
import FilterBar from '@/components/ui/FilterBar'
import DetailPanel from '@/components/ui/DetailPanel'
import RiskBanner from '@/components/ui/RiskBanner'
import CompareView from '@/components/ui/CompareView'
import ExportButton from '@/components/ui/ExportButton'

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const glRef = useRef<THREE.WebGLRenderer | null>(null)
  const selectedId = useSculptureStore((s) => s.selectedId)

  const handleGL = (gl: THREE.WebGLRenderer) => {
    glRef.current = gl
    canvasRef.current = gl.domElement
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ backgroundColor: '#0d1117' }}>
      <FilterBar exportCanvasRef={canvasRef} />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <Scene3D ref={handleGL} />
        </div>
        <DetailPanel key={selectedId} />
      </div>

      <RiskBanner />
      <CompareView />
    </div>
  )
}
