import { useCallback, useRef, useState } from "react"
import { Canvas, useThree, useFrame } from "@react-three/fiber"
import { OrbitControls, Grid } from "@react-three/drei"
import * as THREE from "three"
import { useSchemeStore } from "@/store/useSchemeStore"
import { useUIStore } from "@/store/useUIStore"
import { Camera, Download } from "lucide-react"

function SunLight({ altitude, azimuth }: { altitude: number; azimuth: number }) {
  const altRad = (altitude * Math.PI) / 180
  const aziRad = (azimuth * Math.PI) / 180
  const dist = 50
  const x = dist * Math.cos(altRad) * Math.sin(aziRad)
  const y = Math.max(dist * Math.sin(altRad), 1)
  const z = dist * Math.cos(altRad) * Math.cos(aziRad)

  return (
    <directionalLight
      position={[x, y, z]}
      intensity={1.5}
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-far={100}
      shadow-camera-left={-40}
      shadow-camera-right={40}
      shadow-camera-top={40}
      shadow-camera-bottom={-40}
    />
  )
}

function BuildingMesh({ building, isSelected, onClick }: {
  building: { id: string; name: string; x: number; y: number; width: number; depth: number; height: number }
  isSelected: boolean
  onClick: () => void
}) {
  const pos: [number, number, number] = [building.x, building.height / 2, building.y]
  return (
    <mesh position={pos} castShadow receiveShadow onClick={onClick}>
      <boxGeometry args={[building.width, building.height, building.depth]} />
      <meshStandardMaterial
        color={isSelected ? "#60a5fa" : "#ffffff"}
        transparent
        opacity={isSelected ? 0.7 : 0.5}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

function PanelMesh({ panel, isSelected, onClick }: {
  panel: { id: string; name: string; x: number; y: number; width: number; height: number; tiltAngle: number; shadowCoverage: number }
  isSelected: boolean
  onClick: () => void
}) {
  const tiltRad = (panel.tiltAngle * Math.PI) / 180
  const panelHeight = 0.15
  const pos: [number, number, number] = [panel.x, panelHeight + (panel.width / 2) * Math.sin(tiltRad), panel.y]
  const hasShadow = panel.shadowCoverage > 0.01

  return (
    <group position={pos} onClick={onClick}>
      <mesh rotation={[-tiltRad, 0, 0]} castShadow receiveShadow>
        <planeGeometry args={[panel.width, panel.height]} />
        <meshStandardMaterial color={isSelected ? "#3b82f6" : "#1e3a5f"} side={THREE.DoubleSide} />
      </mesh>
      {hasShadow && (
        <mesh rotation={[-tiltRad, 0, 0]} position={[0, 0.01, 0]}>
          <planeGeometry args={[panel.width, panel.height]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={panel.shadowCoverage * 0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

function CameraResetter({ shouldReset, onDone }: { shouldReset: boolean; onDone: () => void }) {
  const { camera } = useThree()
  useFrame(() => {
    if (shouldReset) {
      const target = new THREE.Vector3(30, 25, 30)
      camera.position.lerp(target, 0.15)
      camera.lookAt(0, 0, 0)
      if (camera.position.distanceTo(target) < 0.5) {
        onDone()
      }
    }
  })
  return null
}

function SceneContent({ resetSignal, onResetDone }: { resetSignal: number; onResetDone: () => void }) {
  const currentScheme = useSchemeStore((s) => s.currentScheme)
  const selectedItemId = useUIStore((s) => s.selectedItemId)
  const selectItem = useUIStore((s) => s.selectItem)
  const { buildings, panels, sunAltitude, sunAzimuth } = currentScheme

  return (
    <>
      <ambientLight intensity={0.3} />
      <SunLight altitude={sunAltitude} azimuth={sunAzimuth} />
      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.1} />
      <CameraResetter shouldReset={resetSignal > 0} onDone={onResetDone} />

      <Grid
        args={[100, 100]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#e2e8f0"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#94a3b8"
        fadeDistance={60}
        position={[0, 0, 0]}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>

      {buildings.map((b) => (
        <BuildingMesh
          key={b.id}
          building={b}
          isSelected={selectedItemId === b.id}
          onClick={() => selectItem(selectedItemId === b.id ? null : b.id)}
        />
      ))}

      {panels.map((p) => (
        <PanelMesh
          key={p.id}
          panel={p}
          isSelected={selectedItemId === p.id}
          onClick={() => selectItem(selectedItemId === p.id ? null : p.id)}
        />
      ))}
    </>
  )
}

export default function Scene3D() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [resetSignal, setResetSignal] = useState(0)

  const handleScreenshot = useCallback(() => {
    const canvas = containerRef.current?.querySelector("canvas")
    if (!canvas) return
    const dataUrl = canvas.toDataURL("image/png")
    const link = document.createElement("a")
    link.href = dataUrl
    link.download = "光伏园区阴影模型.png"
    link.click()
  }, [])

  const handleReset = useCallback(() => {
    setResetSignal((prev) => prev + 1)
  }, [])

  const handleResetDone = useCallback(() => {
    setResetSignal(0)
  }, [])

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <Canvas
        shadows
        camera={{ position: [30, 25, 30], fov: 50, near: 0.1, far: 200 }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <SceneContent resetSignal={resetSignal} onResetDone={handleResetDone} />
      </Canvas>

      <div className="absolute top-3 right-3 flex gap-2">
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur rounded-lg shadow text-sm text-gray-700 hover:bg-white transition-colors"
        >
          <Camera size={14} />
          重置视角
        </button>
        <button
          onClick={handleScreenshot}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur rounded-lg shadow text-sm text-gray-700 hover:bg-white transition-colors"
        >
          <Download size={14} />
          截图
        </button>
      </div>
    </div>
  )
}
