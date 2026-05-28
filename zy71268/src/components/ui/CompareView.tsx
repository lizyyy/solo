import { useMemo } from 'react'
import { X } from 'lucide-react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { useSculptureStore } from '@/store/useSculptureStore'


function SculpturePreview({ color, shape }: { color: string; shape: string }) {
  const geometry = useMemo(() => {
    switch (shape) {
      case 'torusKnot':
        return <torusKnotGeometry args={[0.6, 0.2, 64, 16]} />
      case 'icosahedron':
        return <icosahedronGeometry args={[0.8, 0]} />
      case 'cylinder':
        return <cylinderGeometry args={[0.5, 0.5, 1.5, 32]} />
      case 'cone':
        return <coneGeometry args={[0.6, 1.5, 32]} />
      case 'dodecahedron':
        return <dodecahedronGeometry args={[0.7, 0]} />
      default:
        return <boxGeometry args={[1, 1, 1]} />
    }
  }, [shape])

  return (
    <group>
      <mesh position={[0, 1.5, 0]}>
        {geometry}
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[1.6, 0.2, 1.6]} />
        <meshStandardMaterial color="#555" roughness={0.8} />
      </mesh>
    </group>
  )
}

function COGMarker({ cog }: { cog: { x: number; y: number; z: number } }) {
  return (
    <mesh position={[cog.x, cog.y, cog.z]}>
      <sphereGeometry args={[0.08, 16, 16]} />
      <meshStandardMaterial color="#ff3333" emissive="#ff0000" emissiveIntensity={0.5} />
    </mesh>
  )
}

function MiniScene({
  color,
  shape,
  cog,
}: {
  color: string
  shape: string
  cog: { x: number; y: number; z: number }
}) {
  return (
    <Canvas
      camera={{ position: [3, 3, 3], fov: 45 }}
      style={{ width: '100%', height: '250px', borderRadius: '8px' }}
      gl={{ preserveDrawingBuffer: true }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <SculpturePreview color={color} shape={shape} />
      <COGMarker cog={cog} />
      <OrbitControls enableZoom={false} />
      <Environment preset="city" />
    </Canvas>
  )
}

function DiffRow({
  label,
  left,
  right,
}: {
  label: string
  left: string
  right: string
}) {
  const isDiff = left !== right
  return (
    <div className="flex items-center justify-between py-0.5 text-xs">
      <span className="text-gray-400">{label}</span>
      <div className="flex gap-3">
        <span className={`font-mono ${isDiff ? 'text-yellow-400 font-bold' : 'text-gray-300'}`}>
          {left}
        </span>
        <span className="text-gray-600">→</span>
        <span className={`font-mono ${isDiff ? 'text-yellow-400 font-bold' : 'text-gray-300'}`}>
          {right}
        </span>
      </div>
    </div>
  )
}

export default function CompareView() {
  const compareMode = useSculptureStore((s) => s.compareMode)
  const setCompareMode = useSculptureStore((s) => s.setCompareMode)
  const sculptures = useSculptureStore((s) => s.sculptures)
  const selectedId = useSculptureStore((s) => s.selectedId)
  const sculpture = sculptures.find((s) => s.id === selectedId) ?? null
  const versionIndex = useSculptureStore((s) => s.versionIndex)
  const compareVersionIndex = useSculptureStore((s) => s.compareVersionIndex)
  const setCompareVersionIndex = useSculptureStore((s) => s.setCompareVersionIndex)

  if (!compareMode || !sculpture) return null

  const currentVersion = sculpture.versions[versionIndex]
  const compareVersion = sculpture.versions[compareVersionIndex]

  if (!currentVersion || !compareVersion) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="relative flex gap-4 p-4 rounded-xl" style={{ backgroundColor: '#16213e', maxWidth: '90vw', maxHeight: '90vh' }}>
        <button
          onClick={() => setCompareMode(false)}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-gray-700 transition-colors z-10"
        >
          <X className="w-5 h-5 text-gray-300" />
        </button>

        <div className="flex-1 min-w-[300px] rounded-lg border border-gray-600 p-3" style={{ backgroundColor: '#1a1a2e' }}>
          <h3 className="text-sm font-bold text-blue-400 mb-2">
            当前版本: {currentVersion.label}
          </h3>
          <MiniScene color={sculpture.color} shape={sculpture.shape} cog={currentVersion.cog} />
          <div className="mt-3 space-y-0.5">
            <DiffRow label="重心 X" left={currentVersion.cog.x.toFixed(3)} right={compareVersion.cog.x.toFixed(3)} />
            <DiffRow label="重心 Y" left={currentVersion.cog.y.toFixed(3)} right={compareVersion.cog.y.toFixed(3)} />
            <DiffRow label="重心 Z" left={currentVersion.cog.z.toFixed(3)} right={compareVersion.cog.z.toFixed(3)} />
            <DiffRow label="底座宽" left={`${currentVersion.baseW}m`} right={`${compareVersion.baseW}m`} />
            <DiffRow label="底座深" left={`${currentVersion.baseD}m`} right={`${compareVersion.baseD}m`} />
          </div>
        </div>

        <div className="flex-1 min-w-[300px] rounded-lg border border-gray-600 p-3" style={{ backgroundColor: '#1a1a2e' }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-purple-400">
              对比版本: {compareVersion.label}
            </h3>
            <select
              value={compareVersionIndex}
              onChange={(e) => setCompareVersionIndex(Number(e.target.value))}
              className="bg-gray-800 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none"
            >
              {sculpture.versions.map((v, i) => (
                <option key={i} value={i}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <MiniScene color={sculpture.color} shape={sculpture.shape} cog={compareVersion.cog} />
          <div className="mt-3 space-y-0.5">
            <DiffRow label="重心 X" left={compareVersion.cog.x.toFixed(3)} right={currentVersion.cog.x.toFixed(3)} />
            <DiffRow label="重心 Y" left={compareVersion.cog.y.toFixed(3)} right={currentVersion.cog.y.toFixed(3)} />
            <DiffRow label="重心 Z" left={compareVersion.cog.z.toFixed(3)} right={currentVersion.cog.z.toFixed(3)} />
            <DiffRow label="底座宽" left={`${compareVersion.baseW}m`} right={`${currentVersion.baseW}m`} />
            <DiffRow label="底座深" left={`${compareVersion.baseD}m`} right={`${currentVersion.baseD}m`} />
          </div>
        </div>
      </div>
    </div>
  )
}
