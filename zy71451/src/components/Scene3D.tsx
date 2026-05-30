import { useRef, useMemo, useEffect } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, Stars, Html } from "@react-three/drei"
import { EffectComposer, Bloom } from "@react-three/postprocessing"
import * as THREE from "three"
import { useClusterStore } from "@/store/clusterStore"
import { getClusterColor, CLUSTER_PALETTE } from "@/types"

interface ScatterPointsProps {
  samples: ReturnType<typeof useClusterStore.getState>["samples"]
  labelAssignments: ReturnType<typeof useClusterStore.getState>["labelAssignments"]
  primaryLabelId: string | undefined
  selectedSampleId: string | null
  hoveredSampleId: string | null
  onPointerOver: (id: string) => void
  onPointerOut: () => void
  onClick: (id: string) => void
}

function ScatterPoints({
  samples,
  labelAssignments,
  primaryLabelId,
  selectedSampleId,
  hoveredSampleId,
  onPointerOver,
  onPointerOut,
  onClick,
}: ScatterPointsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const outlierMeshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const clusterMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const la of labelAssignments) {
      if (la.columnId === primaryLabelId) m.set(la.sampleId, la.clusterId)
    }
    return m
  }, [labelAssignments, primaryLabelId])

  const count = samples.length
  const outlierSamples = samples.filter((s) => s.isOutlier)

  const { geometry, outlierGeometry } = useMemo(() => {
    const geo = new THREE.SphereGeometry(1, 8, 8)
    const colors = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const cid = clusterMap.get(samples[i].id) ?? -1
      const color = new THREE.Color(cid >= 0 ? getClusterColor(cid) : "#5a6a7a")
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }

    geo.setAttribute("color", new THREE.InstancedBufferAttribute(colors, 3))

    const outlierGeo = new THREE.RingGeometry(0.7, 1, 16)
    return { geometry: geo, outlierGeometry: outlierGeo }
  }, [samples, clusterMap, count])

  useFrame(() => {
    if (!meshRef.current) return

    for (let i = 0; i < count; i++) {
      const s = samples[i]
      s.projectedX += (s.targetX - s.projectedX) * 0.05
      s.projectedY += (s.targetY - s.projectedY) * 0.05
      s.projectedZ += (s.targetZ - s.projectedZ) * 0.05

      const isSelected = s.id === selectedSampleId
      const isHovered = s.id === hoveredSampleId
      const scale = isSelected ? 1.8 : isHovered ? 1.4 : 1.0

      dummy.position.set(s.projectedX, s.projectedY, s.projectedZ)
      dummy.scale.setScalar(0.04 * scale)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true

    if (outlierMeshRef.current) {
      for (let i = 0; i < outlierSamples.length; i++) {
        const s = outlierSamples[i]
        const t = Date.now() * 0.002
        const pulse = 1.0 + Math.sin(t + i * 0.3) * 0.3

        dummy.position.set(s.projectedX, s.projectedY, s.projectedZ)
        dummy.scale.setScalar(0.1 * pulse)
        dummy.updateMatrix()
        outlierMeshRef.current.setMatrixAt(i, dummy.matrix)
      }
      outlierMeshRef.current.instanceMatrix.needsUpdate = true
    }
  })

  const handlePointer = (e: any, index: number) => {
    e.stopPropagation()
    const id = samples[index].id
    onPointerOver(id)
  }

  const handleClick = (e: any, index: number) => {
    e.stopPropagation()
    const id = samples[index].id
    onClick(id)
  }

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[geometry, undefined, count]}
        onPointerOver={(e: any) => handlePointer(e, e.instanceId)}
        onPointerOut={onPointerOut}
        onClick={(e: any) => handleClick(e, e.instanceId)}
      >
        <meshStandardMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={outlierMeshRef} args={[outlierGeometry, undefined, outlierSamples.length]}>
        <meshBasicMaterial color="#f5a623" transparent opacity={0.6} toneMapped={false} side={THREE.DoubleSide} />
      </instancedMesh>
    </>
  )
}

function AxesHelperLabels() {
  return (
    <group>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={6}
            array={new Float32Array([
              -2.5, 0, 0, 2.5, 0, 0, 0, -2.5, 0, 0, 2.5, 0, 0, 0, -2.5, 0, 0, 2.5,
            ])}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={6}
            array={new Float32Array([
              0, 0.96, 0.83, 0, 0.96, 0.83, 0, 0.72, 0.58, 0, 0.72, 0.58, 0.66, 0.52, 0.96, 0.66, 0.52, 0.96,
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.3} />
      </lineSegments>

      <Html position={[2.7, 0, 0]} center>
        <div className="text-[10px] font-['DM_Sans'] text-cyan-400 bg-[#1a2332]/80 px-1.5 py-0.5 rounded">X</div>
      </Html>
      <Html position={[0, 2.7, 0]} center>
        <div className="text-[10px] font-['DM_Sans'] text-green-400 bg-[#1a2332]/80 px-1.5 py-0.5 rounded">Y</div>
      </Html>
      <Html position={[0, 0, 2.7]} center>
        <div className="text-[10px] font-['DM_Sans'] text-purple-400 bg-[#1a2332]/80 px-1.5 py-0.5 rounded">Z</div>
      </Html>
    </group>
  )
}

function ClusterLegend() {
  const labelColumns = useClusterStore((s) => s.labelColumns)
  const labelAssignments = useClusterStore((s) => s.labelAssignments)
  const primaryId = labelColumns.find((l) => l.isPrimary)?.id ?? labelColumns[0]?.id

  const uniqueClusters = useMemo(() => {
    const set = new Set<number>()
    for (const la of labelAssignments) {
      if (la.columnId === primaryId) set.add(la.clusterId)
    }
    return Array.from(set).sort((a, b) => a - b)
  }, [labelAssignments, primaryId])

  return (
    <Html position={[-2.3, 2.1, 0]} style={{ pointerEvents: "none" }}>
      <div className="bg-[#1a2332]/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-[#2a3444]">
        <div className="text-[10px] font-['DM_Sans'] text-[#8a9aaa] mb-1.5">簇标签</div>
        <div className="flex flex-wrap gap-2 max-w-[180px]">
          {uniqueClusters.map((cid) => (
            <div key={cid} className="flex items-center gap-1">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  backgroundColor: getClusterColor(cid),
                  boxShadow: `0 0 4px ${getClusterColor(cid)}`,
                }}
              />
              <span className="text-[9px] font-['DM_Sans'] text-[#e8edf5]">C{cid}</span>
            </div>
          ))}
        </div>
      </div>
    </Html>
  )
}

function SampleTooltip() {
  const hoveredSampleId = useClusterStore((s) => s.hoveredSampleId)
  const samples = useClusterStore((s) => s.samples)
  const labelAssignments = useClusterStore((s) => s.labelAssignments)
  const labelColumns = useClusterStore((s) => s.labelColumns)
  const featureColumns = useClusterStore((s) => s.featureColumns)

  const sample = samples.find((s) => s.id === hoveredSampleId)
  const primaryId = labelColumns.find((l) => l.isPrimary)?.id ?? labelColumns[0]?.id
  const assignment = labelAssignments.find(
    (la) => la.sampleId === hoveredSampleId && la.columnId === primaryId
  )

  if (!sample || !hoveredSampleId) return null

  return (
    <Html
      position={[sample.projectedX + 0.15, sample.projectedY + 0.15, sample.projectedZ]}
      center
      style={{ pointerEvents: "none" }}
    >
      <div className="bg-[#1a2332]/95 backdrop-blur-sm rounded-lg px-3 py-2 border border-[#00f5d4]/40 shadow-[0_0_12px_rgba(0,245,212,0.15)] min-w-[160px]">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: assignment ? getClusterColor(assignment.clusterId) : "#5a6a7a",
              boxShadow: assignment
                ? `0 0 6px ${getClusterColor(assignment.clusterId)}`
                : "none",
            }}
          />
          <span className="text-xs font-mono text-[#e8edf5] font-semibold">{sample.id}</span>
          {sample.isOutlier && (
            <span className="text-[9px] text-[#f5a623] font-bold ml-auto">离群</span>
          )}
        </div>
        {assignment && (
          <div className="text-[10px] font-['DM_Sans'] text-[#8a9aaa] mb-1.5">
            簇: <span className="text-[#00f5d4] font-semibold">C{assignment.clusterId}</span>
            {assignment.manuallyModified && (
              <span className="text-[#f5a623] ml-1">（人工修改）</span>
            )}
          </div>
        )}
        {sample.isOutlier && (
          <div className="text-[10px] font-['DM_Sans'] text-[#8a9aaa]">
            Z-score: <span className="text-[#f5a623] font-semibold">{sample.outlierScore.toFixed(2)}</span>
          </div>
        )}
        <div className="border-t border-[#2a3444] mt-2 pt-2 space-y-0.5">
          {featureColumns.filter((f) => f.selected).slice(0, 4).map((f) => (
            <div key={f.id} className="flex justify-between text-[9px] font-['DM_Sans']">
              <span className="text-[#5a6a7a]">{f.name}</span>
              <span className="text-[#8a9aaa]">—</span>
            </div>
          ))}
        </div>
        <div className="text-[8px] text-[#3a4a5a] mt-2 text-center">点击修改标签</div>
      </div>
    </Html>
  )
}

function CameraController() {
  const { camera } = useThree()
  const selectedSampleId = useClusterStore((s) => s.selectedSampleId)
  const samples = useClusterStore((s) => s.samples)
  const controlsRef = useRef<any>(null)

  useEffect(() => {
    if (!selectedSampleId || !controlsRef.current) return
    const sample = samples.find((s) => s.id === selectedSampleId)
    if (!sample) return

    const targetPos = new THREE.Vector3(sample.targetX, sample.targetY, sample.targetZ)
    const camTarget = new THREE.Vector3(
      sample.targetX + 1.5,
      sample.targetY + 1.5,
      sample.targetZ + 1.5
    )

    let t = 0
    const startPos = camera.position.clone()
    const startTarget = controlsRef.current.target.clone()

    const animate = () => {
      t += 0.03
      if (t >= 1) return
      const ease = 1 - Math.pow(1 - t, 3)
      camera.position.lerpVectors(startPos, camTarget, ease)
      controlsRef.current.target.lerpVectors(startTarget, targetPos, ease)
      requestAnimationFrame(animate)
    }
    animate()
  }, [selectedSampleId, samples, camera])

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      minDistance={2}
      maxDistance={15}
      autoRotate={false}
    />
  )
}

function LabelEditPopup() {
  const selectedSampleId = useClusterStore((s) => s.selectedSampleId)
  const setSelectedSample = useClusterStore((s) => s.setSelectedSample)
  const setLabelForSample = useClusterStore((s) => s.setLabelForSample)
  const labelColumns = useClusterStore((s) => s.labelColumns)
  const labelAssignments = useClusterStore((s) => s.labelAssignments)
  const samples = useClusterStore((s) => s.samples)

  const sample = samples.find((s) => s.id === selectedSampleId)
  if (!sample || !selectedSampleId) return null

  const primaryId = labelColumns.find((l) => l.isPrimary)?.id ?? labelColumns[0]?.id
  const currentCluster = labelAssignments.find(
    (la) => la.sampleId === selectedSampleId && la.columnId === primaryId
  )?.clusterId ?? 0

  const clusterOptions = Array.from(new Set(labelAssignments.filter((la) => la.columnId === primaryId).map((la) => la.clusterId))).sort((a, b) => a - b)

  const handleChange = (newCluster: number) => {
    setLabelForSample(selectedSampleId, newCluster)
  }

  return (
    <Html
      position={[sample.projectedX + 0.2, sample.projectedY + 0.2, sample.projectedZ]}
      center
    >
      <div className="bg-[#1a2332]/95 backdrop-blur-sm rounded-lg px-3 py-2.5 border border-[#00f5d4]/50 shadow-[0_0_16px_rgba(0,245,212,0.25)] min-w-[180px]">
        <div className="text-[10px] font-['DM_Sans'] text-[#8a9aaa] mb-1">修改簇标签</div>
        <div className="text-xs font-mono text-[#e8edf5] font-semibold mb-2">{sample.id}</div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {clusterOptions.map((cid) => (
            <button
              key={cid}
              onClick={() => handleChange(cid)}
              className={`text-[10px] font-['DM_Sans'] font-semibold px-2 py-1 rounded transition-all hover:scale-105 ${
                currentCluster === cid
                  ? "text-[#0f1822] scale-105"
                  : "text-[#e8edf5] border border-[#2a3444] hover:border-[#00f5d4]/50"
              }`}
              style={
                currentCluster === cid
                  ? { backgroundColor: getClusterColor(cid), boxShadow: `0 0 8px ${getClusterColor(cid)}` }
                  : {}
              }
            >
              C{cid}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSelectedSample(null)}
          className="w-full text-[10px] font-['DM_Sans'] text-[#5a6a7a] hover:text-[#8a9aaa] py-1 border-t border-[#2a3444] transition-colors"
        >
          取消
        </button>
      </div>
    </Html>
  )
}

export default function Scene3D() {
  const samples = useClusterStore((s) => s.samples)
  const labelAssignments = useClusterStore((s) => s.labelAssignments)
  const labelColumns = useClusterStore((s) => s.labelColumns)
  const selectedSampleId = useClusterStore((s) => s.selectedSampleId)
  const hoveredSampleId = useClusterStore((s) => s.hoveredSampleId)
  const setSelectedSample = useClusterStore((s) => s.setSelectedSample)
  const setHoveredSample = useClusterStore((s) => s.setHoveredSample)

  const primaryLabelId = labelColumns.find((l) => l.isPrimary)?.id ?? labelColumns[0]?.id

  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 3, 6], fov: 60, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
        style={{ background: "linear-gradient(135deg, #0a0e1a 0%, #0f1822 100%)" }}
      >
        <ambientLight intensity={0.15} color="#a8c5ff" />
        <directionalLight position={[5, 10, 7]} intensity={0.25} color="#fff4e0" />
        <directionalLight position={[-5, 5, -5]} intensity={0.15} color="#c8d8ff" />

        <Stars radius={50} depth={30} count={2000} factor={2} fade speed={0.3} />

        <group position={[0, -0.3, 0]}>
          <ScatterPoints
            samples={samples}
            labelAssignments={labelAssignments}
            primaryLabelId={primaryLabelId}
            selectedSampleId={selectedSampleId}
            hoveredSampleId={hoveredSampleId}
            onPointerOver={setHoveredSample}
            onPointerOut={() => setHoveredSample(null)}
            onClick={setSelectedSample}
          />
        </group>

        <AxesHelperLabels />
        <ClusterLegend />
        <SampleTooltip />
        {selectedSampleId && <LabelEditPopup />}

        <CameraController />

        <EffectComposer>
          <Bloom
            intensity={0.3}
            luminanceThreshold={0.15}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
