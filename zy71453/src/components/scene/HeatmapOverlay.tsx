import * as THREE from 'three'
import { useMemo } from 'react'
import { useStore } from '../../store/useStore'
import { computeHeatmap, heatmapColor } from '../../utils/heatmap'

export default function HeatmapOverlay() {
  const showHeatmap = useStore((s) => s.showHeatmap)
  const trajectories = useStore((s) => s.trajectories)
  const filterState = useStore((s) => s.filterState)
  const shelves = useStore((s) => s.shelves)
  const heatmapConfig = useStore((s) => s.heatmapConfig)

  const filteredTrajectories = useMemo(
    () =>
      trajectories.filter((t) => {
        if (!filterState.statusFilter.includes(t.status)) return false
        if (filterState.robotIds.length > 0 && !filterState.robotIds.includes(t.robotId))
          return false
        return true
      }),
    [trajectories, filterState],
  )

  const cells = useMemo(
    () => computeHeatmap(filteredTrajectories, shelves, heatmapConfig.gridSize, heatmapConfig.threshold),
    [filteredTrajectories, shelves, heatmapConfig.gridSize, heatmapConfig.threshold],
  )

  if (!showHeatmap) return null

  return (
    <group>
      {cells.map((cell, i) => {
        const [r, g, b] = heatmapColor(cell.intensity)
        return (
          <mesh
            key={`${cell.x}-${cell.z}-${i}`}
            position={[cell.x + heatmapConfig.gridSize / 2, 0.05, cell.z + heatmapConfig.gridSize / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[heatmapConfig.gridSize, heatmapConfig.gridSize]} />
            <meshBasicMaterial
              color={new THREE.Color(r, g, b)}
              transparent
              opacity={heatmapConfig.opacity}
              depthWrite={false}
            />
          </mesh>
        )
      })}
    </group>
  )
}
