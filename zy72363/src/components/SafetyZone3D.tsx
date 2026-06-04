import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html, Grid } from '@react-three/drei'
import * as THREE from 'three'
import { useNavigate } from 'react-router-dom'
import { X, Eye, RotateCcw, ArrowUp, ArrowRight, Move } from 'lucide-react'
import type { SafetyZone, SensorData } from '@/types'

interface SafetyZone3DProps {
  safetyZones: (SafetyZone & { sensor?: SensorData })[]
  loading: boolean
}

interface ZoneInstanceData {
  id: string
  position: [number, number, number]
  height: number
  color: string
  safetyZone: SafetyZone & { sensor?: SensorData }
}

const STATUS_COLORS: Record<string, string> = {
  approved: '#10B981',
  pending: '#F59E0B',
  rollback: '#64748B',
  manual_no_reason: '#EF4444',
}

const STATUS_LABELS: Record<string, string> = {
  approved: '已通过',
  pending: '待复核',
  rollback: '已回滚',
  manual_no_reason: '人工修改无原因',
}

function getZoneColor(zone: SafetyZone): string {
  if (zone.coefficient_source === 'manual' && !zone.coefficient_reason) {
    return STATUS_COLORS.manual_no_reason
  }
  return STATUS_COLORS[zone.review_status] || STATUS_COLORS.pending
}

function SafetyZoneCylinders({
  zones,
  onHover,
  onSelect,
  onDoubleClick,
  selectedId,
  hoveredId,
}: {
  zones: ZoneInstanceData[]
  onHover: (id: string | null) => void
  onSelect: (zone: SafetyZone & { sensor?: SensorData }) => void
  onDoubleClick: (zone: SafetyZone & { sensor?: SensorData }) => void
  selectedId: string | null
  hoveredId: string | null
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const colorArray = useMemo(() => new Float32Array(zones.length * 3), [zones.length])

  const radius = 0.4

  useFrame(() => {
    if (!meshRef.current) return

    zones.forEach((zone, i) => {
      const isSelected = selectedId === zone.id
      const isHovered = hoveredId === zone.id
      const scale = isSelected ? 1.15 : isHovered ? 1.1 : 1

      dummy.position.set(zone.position[0], zone.position[1], zone.position[2])
      dummy.scale.set(radius * scale, zone.height * scale, radius * scale)
      dummy.updateMatrix()

      meshRef.current!.setMatrixAt(i, dummy.matrix)

      const color = new THREE.Color(zone.color)
      colorArray[i * 3] = color.r
      colorArray[i * 3 + 1] = color.g
      colorArray[i * 3 + 2] = color.b
    })

    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }
  })

  useEffect(() => {
    if (meshRef.current) {
      zones.forEach((zone, i) => {
        const color = new THREE.Color(zone.color)
        colorArray[i * 3] = color.r
        colorArray[i * 3 + 1] = color.g
        colorArray[i * 3 + 2] = color.b
      })
      meshRef.current.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3)
    }
  }, [zones, colorArray])

  const handlePointerMove = (e: any) => {
    if (e.stopPropagation) e.stopPropagation()
    const instanceId = e.instanceId as number
    if (instanceId !== undefined && zones[instanceId]) {
      onHover(zones[instanceId].id)
      document.body.style.cursor = 'pointer'
    } else {
      onHover(null)
      document.body.style.cursor = 'auto'
    }
  }

  const handleClick = (e: any) => {
    if (e.stopPropagation) e.stopPropagation()
    const instanceId = e.instanceId as number
    if (instanceId !== undefined && zones[instanceId]) {
      onSelect(zones[instanceId].safetyZone)
    }
  }

  const handleDoubleClick = (e: any) => {
    if (e.stopPropagation) e.stopPropagation()
    const instanceId = e.instanceId as number
    if (instanceId !== undefined && zones[instanceId]) {
      onDoubleClick(zones[instanceId].safetyZone)
    }
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, zones.length]}
      onPointerMove={handlePointerMove}
      onPointerOut={() => {
        onHover(null)
        document.body.style.cursor = 'auto'
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <cylinderGeometry args={[1, 1, 1, 16]} />
      <meshStandardMaterial
        transparent
        opacity={0.7}
        roughness={0.3}
        metalness={0.1}
      />
    </instancedMesh>
  )
}

function HoverLabel({
  hoveredZone,
  zones,
}: {
  hoveredZone: string | null
  zones: ZoneInstanceData[]
}) {
  if (!hoveredZone) return null

  const zone = zones.find((z) => z.id === hoveredZone)
  if (!zone) return null

  const sensor = zone.safetyZone.sensor
  const labelPosition: [number, number, number] = [
    zone.position[0],
    zone.position[1] + zone.height / 2 + 0.5,
    zone.position[2],
  ]

  return (
    <Html position={labelPosition}>
      <div className="bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-xl border border-gray-200 whitespace-nowrap">
        <p className="text-xs font-mono font-semibold text-gray-900">
          {sensor?.sensor_code || zone.id}
        </p>
        <p className="text-xs text-muted">
          {sensor?.material_type || '未知'} | {zone.safetyZone.rpm_min}-{zone.safetyZone.rpm_max} RPM
        </p>
      </div>
    </Html>
  )
}

function DetailPanel({
  selectedZone,
  onClose,
  onDoubleClick,
}: {
  selectedZone: (SafetyZone & { sensor?: SensorData }) | null
  onClose: () => void
  onDoubleClick: (zone: SafetyZone & { sensor?: SensorData }) => void
}) {
  const navigate = useNavigate()

  if (!selectedZone) return null

  const sensor = selectedZone.sensor
  const statusColor = getZoneColor(selectedZone)
  const statusLabel = selectedZone.coefficient_source === 'manual' && !selectedZone.coefficient_reason
    ? STATUS_LABELS.manual_no_reason
    : STATUS_LABELS[selectedZone.review_status] || '待复核'

  const handleGoToReview = () => {
    navigate('/review')
  }

  return (
    <Html position={[-4, 3, 0]}>
      <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-200 w-[300px] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-gray-900">安全区详情</h3>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">传感器编号</span>
            <span className="font-mono text-sm font-semibold text-gray-900">
              {sensor?.sensor_code || '-'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">物料类型</span>
            <span className="text-sm text-gray-700">{sensor?.material_type || '-'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">转速范围</span>
            <span className="font-mono text-sm text-gray-700">
              {selectedZone.rpm_min} - {selectedZone.rpm_max} RPM
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">安全系数</span>
            <span className="font-mono text-sm text-gray-700">{selectedZone.coefficient}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">状态</span>
            <span
              className="text-xs px-2 py-1 rounded-full font-medium text-white"
              style={{ backgroundColor: statusColor }}
            >
              {statusLabel}
            </span>
          </div>
          {selectedZone.coefficient_reason && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-muted mb-1">修改原因</p>
              <p className="text-sm text-gray-700">{selectedZone.coefficient_reason}</p>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDoubleClick(selectedZone)
              }}
              className="flex-1 px-3 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              前往复核
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleGoToReview()
              }}
              className="px-3 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              复核页
            </button>
          </div>
          <p className="text-xs text-muted text-center pt-1">
            双击圆柱体可直接跳转
          </p>
        </div>
      </div>
    </Html>
  )
}

function ViewControls({
  onViewChange,
}: {
  onViewChange: (view: 'top' | 'front' | 'side' | 'reset') => void
}) {
  const controls = [
    { key: 'top', label: '俯视', icon: ArrowUp },
    { key: 'front', label: '正视', icon: ArrowRight },
    { key: 'side', label: '侧视', icon: Move },
    { key: 'reset', label: '重置', icon: RotateCcw },
  ] as const

  return (
    <Html position={[4, -2.5, 0]}>
      <div className="flex gap-1 bg-white/95 backdrop-blur-sm rounded-lg p-1 shadow-lg border border-gray-200">
        {controls.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={(e) => {
              e.stopPropagation()
              onViewChange(key)
            }}
            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors"
            title={label}
          >
            <Icon className="h-4 w-4 text-gray-600" />
            <span className="text-[10px] text-gray-500">{label}</span>
          </button>
        ))}
      </div>
    </Html>
  )
}

function Legend() {
  const items = [
    { color: STATUS_COLORS.approved, label: STATUS_LABELS.approved },
    { color: STATUS_COLORS.pending, label: STATUS_LABELS.pending },
    { color: STATUS_COLORS.rollback, label: STATUS_LABELS.rollback },
    { color: STATUS_COLORS.manual_no_reason, label: STATUS_LABELS.manual_no_reason },
  ]

  return (
    <Html position={[4, 3, 0]}>
      <div className="bg-white/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-200">
        <p className="text-xs font-semibold text-gray-900 mb-2">状态图例</p>
        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm opacity-70"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-gray-600">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </Html>
  )
}

function AxisLabels({ materialTypes, batchIds }: { materialTypes: string[]; batchIds: string[] }) {
  return (
    <>
      {materialTypes.map((type, i) => (
        <Html key={`x-${type}`} position={[(i - (materialTypes.length - 1) / 2) * 2, -3, 0]}>
          <div className="text-xs text-gray-400 whitespace-nowrap font-medium">{type}</div>
        </Html>
      ))}
      {batchIds.map((id, i) => (
        <Html key={`z-${id}`} position={[-4.5, -3, (i - (batchIds.length - 1) / 2) * 2]}>
          <div className="text-xs text-gray-400 whitespace-nowrap font-medium">Batch {id.slice(-4)}</div>
        </Html>
      ))}
      <Html position={[-5.5, 0, 0]}>
        <div className="text-xs text-gray-400 font-medium whitespace-nowrap" style={{ writingMode: 'vertical-lr' }}>
          转速 (RPM)
        </div>
      </Html>
    </>
  )
}

function Scene({
  safetyZones,
  loading,
}: SafetyZone3DProps) {
  const { camera } = useThree()
  const [hoveredZone, setHoveredZone] = useState<string | null>(null)
  const [selectedZone, setSelectedZone] = useState<(SafetyZone & { sensor?: SensorData }) | null>(null)
  const navigate = useNavigate()

  const { zoneInstances, materialTypes, batchIds } = useMemo(() => {
    const types = Array.from(new Set(safetyZones.map((z) => z.sensor?.material_type).filter(Boolean)))
    const batches = Array.from(new Set(safetyZones.map((z) => z.sensor?.batch_id).filter(Boolean)))

    const maxRpm = Math.max(...safetyZones.map((z) => z.rpm_max), 1)
    const minRpm = Math.min(...safetyZones.map((z) => z.rpm_min), 0)
    const rpmRange = maxRpm - minRpm || 1

    const instances: ZoneInstanceData[] = safetyZones.map((zone) => {
      const materialIndex = types.indexOf(zone.sensor?.material_type || '')
      const batchIndex = batches.indexOf(zone.sensor?.batch_id || '')

      const x = (materialIndex - (types.length - 1) / 2) * 2
      const z = (batchIndex - (batches.length - 1) / 2) * 2

      const height = Math.max(((zone.rpm_max - zone.rpm_min) / rpmRange) * 4, 0.2)
      const y = ((zone.rpm_min + zone.rpm_max) / 2 - minRpm) / rpmRange * 4 - 2

      return {
        id: zone.id,
        position: [x, y, z] as [number, number, number],
        height,
        color: getZoneColor(zone),
        safetyZone: zone,
      }
    })

    return { zoneInstances: instances, materialTypes: types, batchIds: batches }
  }, [safetyZones])

  const handleViewChange = (view: 'top' | 'front' | 'side' | 'reset') => {
    const distance = 10
    switch (view) {
      case 'top':
        camera.position.set(0, distance, 0.01)
        break
      case 'front':
        camera.position.set(0, 0, distance)
        break
      case 'side':
        camera.position.set(distance, 0, 0)
        break
      case 'reset':
        camera.position.set(5, 4, 5)
        break
    }
    camera.lookAt(0, 0, 0)
  }

  const handleDoubleClick = (zone: SafetyZone & { sensor?: SensorData }) => {
    navigate('/review')
  }

  if (loading) {
    return (
      <Html center>
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-500">加载 3D 场景...</p>
        </div>
      </Html>
    )
  }

  if (safetyZones.length === 0) {
    return (
      <Html center>
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">暂无数据</p>
          <p className="text-sm mt-1">请先导入传感器数据</p>
        </div>
      </Html>
    )
  }

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
      <directionalLight position={[-5, 3, -5]} intensity={0.3} />

      <Grid
        position={[0, -2.5, 0]}
        args={[10, 10]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#2a2a4a"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#3a3a5a"
        fadeDistance={30}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
      />

      <SafetyZoneCylinders
        zones={zoneInstances}
        onHover={setHoveredZone}
        onSelect={setSelectedZone}
        onDoubleClick={handleDoubleClick}
        selectedId={selectedZone?.id || null}
        hoveredId={hoveredZone}
      />

      <HoverLabel hoveredZone={hoveredZone} zones={zoneInstances} />

      <DetailPanel
        selectedZone={selectedZone}
        onClose={() => setSelectedZone(null)}
        onDoubleClick={handleDoubleClick}
      />

      <ViewControls onViewChange={handleViewChange} />
      <Legend />
      <AxisLabels materialTypes={materialTypes} batchIds={batchIds} />

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={3}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2 + 0.1}
      />
    </>
  )
}

export default function SafetyZone3D({ safetyZones, loading }: SafetyZone3DProps) {
  return (
    <div className="w-full h-[600px] rounded-xl overflow-hidden" style={{ background: '#1a1a2e' }}>
      <Canvas
        camera={{ position: [5, 4, 5], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#1a1a2e']} />
        <fog attach="fog" args={['#1a1a2e', 10, 30]} />
        <Scene safetyZones={safetyZones} loading={loading} />
      </Canvas>
    </div>
  )
}
