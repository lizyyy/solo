import type { LevelDef, WaveCard } from "@/types"

const WAVE_COLORS = ["#00D4AA", "#FF6B35", "#6C5CE7", "#FDCB6E", "#E84393", "#00B894"]

function makeCard(partial: Partial<WaveCard> & Pick<WaveCard, "id">): WaveCard {
  return {
    amplitude: 1,
    frequency: 1,
    phase: 0,
    phaseUnit: "radian",
    color: WAVE_COLORS[Math.floor(Math.random() * WAVE_COLORS.length)],
    locked: false,
    ...partial,
  }
}

export const LEVELS: LevelDef[] = [
  {
    id: "level-1",
    name: "初识海浪",
    description: "调整单一正弦波的振幅和频率，让冲浪板平稳滑行",
    targetWave: [makeCard({ id: "t1", amplitude: 2, frequency: 0.5, phase: 0, color: "#00D4AA" })],
    maxScore: 100,
    matchThreshold: 80,
  },
  {
    id: "level-2",
    name: "叠加涌浪",
    description: "用两路正弦波叠加，拟合双峰海浪",
    targetWave: [
      makeCard({ id: "t1", amplitude: 2, frequency: 0.5, phase: 0, color: "#00D4AA" }),
      makeCard({ id: "t2", amplitude: 1, frequency: 1, phase: Math.PI / 4, color: "#FF6B35" }),
    ],
    maxScore: 150,
    matchThreshold: 75,
  },
  {
    id: "level-3",
    name: "相位之舞",
    description: "精确调整相位，让波峰精确对齐目标位置",
    targetWave: [
      makeCard({ id: "t1", amplitude: 1.5, frequency: 0.8, phase: Math.PI / 3, color: "#00D4AA" }),
      makeCard({ id: "t2", amplitude: 1, frequency: 1.2, phase: Math.PI / 6, color: "#6C5CE7" }),
      makeCard({ id: "t3", amplitude: 0.5, frequency: 2, phase: Math.PI / 2, color: "#FDCB6E" }),
    ],
    maxScore: 200,
    matchThreshold: 70,
  },
  {
    id: "level-4",
    name: "风暴海啸",
    description: "在四路波叠加中找到平衡，避免振幅溢出和边界穿越",
    targetWave: [
      makeCard({ id: "t1", amplitude: 2, frequency: 0.3, phase: 0, color: "#00D4AA" }),
      makeCard({ id: "t2", amplitude: 1.5, frequency: 0.7, phase: Math.PI / 4, color: "#FF6B35" }),
      makeCard({ id: "t3", amplitude: 1, frequency: 1.4, phase: Math.PI / 2, color: "#6C5CE7" }),
      makeCard({ id: "t4", amplitude: 0.8, frequency: 2.5, phase: Math.PI, color: "#E84393" }),
    ],
    maxScore: 250,
    matchThreshold: 65,
  },
]

export function getLevel(id: string): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id)
}

export { WAVE_COLORS }
