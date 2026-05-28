import { useMemo } from "react"
import { Text } from "@react-three/drei"
import { useTermWallStore } from "@/store/useTermWallStore"

export default function AxisLabels() {
  const aggregatedBlocks = useTermWallStore((s) => s.aggregatedBlocks)

  const { varietyLabels, monthLabels } = useMemo(() => {
    const varietyMap = new Map<string, string>()
    const monthSet = new Set<string>()
    for (const b of aggregatedBlocks) {
      if (!varietyMap.has(b.varietyCode)) {
        varietyMap.set(b.varietyCode, b.varietyName || b.varietyCode)
      }
      monthSet.add(b.contractMonth)
    }
    const varieties = Array.from(varietyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    const months = Array.from(monthSet).sort()

    const VARIETY_GAP = 3
    const MONTH_GAP = 2.5
    const offsetX = -(varieties.length - 1) * VARIETY_GAP / 2
    const offsetZ = -(months.length - 1) * MONTH_GAP / 2

    return {
      varietyLabels: varieties.map(([code, name], i) => ({
        text: `${code} ${name}`,
        position: [offsetX + i * VARIETY_GAP, -0.5, offsetZ - 2.5] as [number, number, number],
      })),
      monthLabels: months.map((m, i) => ({
        text: m === "__MISSING__" ? "未标注" : m,
        color: m === "__MISSING__" ? "#fbbf24" : "#94a3b8",
        position: [offsetX - 3, -0.3, offsetZ + i * MONTH_GAP] as [number, number, number],
      })),
    }
  }, [aggregatedBlocks])

  return (
    <group>
      {varietyLabels.map((v, i) => (
        <Text
          key={`var-${i}`}
          position={v.position}
          fontSize={0.45}
          color="#94a3b8"
          anchorX="center"
          anchorY="top"
          rotation={[-Math.PI / 6, 0, 0]}
        >
          {v.text}
        </Text>
      ))}
      {monthLabels.map((m, i) => (
        <Text
          key={`month-${i}`}
          position={m.position}
          fontSize={0.4}
          color={m.color}
          anchorX="right"
          anchorY="middle"
        >
          {m.text}
        </Text>
      ))}
    </group>
  )
}
