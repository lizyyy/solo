import { useMemo, useCallback } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, Html } from "@react-three/drei"
import { useDataStore } from "@/stores/useDataStore"
import { useFilterStore } from "@/stores/useFilterStore"
import { useSelectionStore } from "@/stores/useSelectionStore"
import { useAuditStore } from "@/stores/useAuditStore"
import type { AggregatedExposure } from "@/data/types"
import { TowerColumn } from "./TowerColumn"
import { TowerGround } from "./TowerGround"

const SPACING = 2.5
const MAX_HEIGHT = 8

function exposureId(e: AggregatedExposure) {
  return `${e.clientId}-${e.bucketId}`
}

function SceneContent() {
  const aggregated = useDataStore((s) => s.aggregated)
  const { activeGreeks, activeBuckets, thresholdValue } = useFilterStore()
  const { selectedExposure, hoveredExposureId, selectExposure, setHovered } = useSelectionStore()
  const logAction = useAuditStore((s) => s.logAction)

  const { visibleExposures, dimmedExposures } = useMemo(() => {
    const bucketFiltered = aggregated.filter((e) => activeBuckets.includes(e.bucketId))
    const visible: AggregatedExposure[] = []
    const dimmed: AggregatedExposure[] = []
    for (const e of bucketFiltered) {
      if (thresholdValue > 0) {
        const maxGreek = Math.max(...activeGreeks.map((g) => Math.abs(e[g])))
        if (maxGreek < thresholdValue) {
          dimmed.push(e)
          continue
        }
      }
      visible.push(e)
    }
    return { visibleExposures: visible, dimmedExposures: dimmed }
  }, [aggregated, activeBuckets, activeGreeks, thresholdValue])

  const { clientList, bucketList, clientIndex, bucketIndex, heightScale } = useMemo(() => {
    const all = [...visibleExposures, ...dimmedExposures]
    const clients = [...new Set(all.map((e) => e.clientCode))]
    const buckets = [...new Set(all.map((e) => e.bucketLabel))]
    const cIdx: Record<string, number> = {}
    const bIdx: Record<string, number> = {}
    clients.forEach((c, i) => { cIdx[c] = i })
    buckets.forEach((b, i) => { bIdx[b] = i })

    let maxAbs = 0
    visibleExposures.forEach((e) => {
      activeGreeks.forEach((g) => {
        maxAbs = Math.max(maxAbs, Math.abs(e[g]))
      })
    })
    const scale = maxAbs > 0 ? MAX_HEIGHT / maxAbs : 1

    return {
      clientList: clients,
      bucketList: buckets,
      clientIndex: cIdx,
      bucketIndex: bIdx,
      heightScale: scale,
    }
  }, [visibleExposures, dimmedExposures, activeGreeks])

  const handleSelect = useCallback(
    (exposure: AggregatedExposure) => {
      const isSame = selectedExposure && exposureId(selectedExposure) === exposureId(exposure)
      if (isSame) {
        selectExposure(null)
        logAction("DESELECT_EXPOSURE", `取消选中 ${exposure.clientName} / ${exposure.bucketLabel}`)
      } else {
        selectExposure(exposure)
        logAction("SELECT_EXPOSURE", `选中 ${exposure.clientName} / ${exposure.bucketLabel}`)
      }
    },
    [selectedExposure, selectExposure, logAction]
  )

  const hoveredExposure = useMemo(() => {
    if (!hoveredExposureId) return null
    return [...visibleExposures, ...dimmedExposures].find((e) => exposureId(e) === hoveredExposureId) ?? null
  }, [hoveredExposureId, visibleExposures, dimmedExposures])

  const renderColumn = (e: AggregatedExposure, isDimmed: boolean) => {
    const id = exposureId(e)
    const x = (clientIndex[e.clientCode] ?? 0) * SPACING
    const z = (bucketIndex[e.bucketLabel] ?? 0) * SPACING
    const isSel = selectedExposure ? exposureId(selectedExposure) === id : false
    const isHov = hoveredExposureId === id

    return (
      <TowerColumn
        key={id}
        exposure={e}
        position={[x, 0, z]}
        heightScale={heightScale}
        isSelected={isSel}
        isHovered={isHov}
        isDimmed={isDimmed}
        activeGreeks={activeGreeks}
        onClick={() => handleSelect(e)}
        onPointerOver={() => setHovered(id)}
        onPointerOut={() => setHovered(null)}
      />
    )
  }

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} />
      <hemisphereLight args={["#1a1a2e", "#0a0f1a", 0.4]} />
      <fog attach="fog" args={["#0a0f1a", 15, 50]} />

      <TowerGround
        clientLabels={clientList}
        bucketLabels={bucketList}
        spacing={SPACING}
      />

      {visibleExposures.map((e) => renderColumn(e, false))}
      {dimmedExposures.map((e) => renderColumn(e, true))}

      {hoveredExposure && (
        <Html
          position={[
            (clientIndex[hoveredExposure.clientCode] ?? 0) * SPACING,
            4,
            (bucketIndex[hoveredExposure.bucketLabel] ?? 0) * SPACING,
          ]}
          center
          distanceFactor={12}
          style={{
            pointerEvents: "none",
            background: "rgba(10, 15, 26, 0.92)",
            border: "1px solid rgba(100, 116, 139, 0.3)",
            borderRadius: 8,
            padding: "8px 12px",
            color: "#e2e8f0",
            fontSize: 12,
            fontFamily: "monospace",
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4, color: "#f8fafc" }}>
            {hoveredExposure.clientName} / {hoveredExposure.bucketLabel}
          </div>
          {activeGreeks.map((g) => (
            <div key={g}>
              <span style={{ color: g === "delta" ? "#4a90d9" : g === "gamma" ? "#9b59b6" : "#1abc9c" }}>
                {g.toUpperCase()}
              </span>
              : {hoveredExposure[g].toFixed(2)}
            </div>
          ))}
          {hoveredExposure.hasAnomaly && (
            <div style={{ color: "#ff6b35", marginTop: 4 }}>
              ⚠ {hoveredExposure.anomalyType.map(t => t === "BUCKET_MISMATCH" ? "到期桶错位" : "Delta符号反转").join(", ")}
            </div>
          )}
        </Html>
      )}

      <OrbitControls
        makeDefault
        minPolarAngle={0.2}
        maxPolarAngle={1.4}
        enableDamping
        dampingFactor={0.12}
        target={[clientList.length * SPACING / 2 - SPACING / 2, 2, bucketList.length * SPACING / 2 - SPACING / 2]}
      />
    </>
  )
}

export function RiskTower3D() {
  return (
    <Canvas
      camera={{ position: [12, 10, 12], fov: 50, near: 0.1, far: 100 }}
      style={{ background: "#0a0f1a" }}
    >
      <SceneContent />
    </Canvas>
  )
}
