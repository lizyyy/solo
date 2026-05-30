import type { WaveCard, BusinessException, ExceptionType, ExceptionResolution } from "@/types"
import { getTotalAmplitude, MAX_AMPLITUDE } from "./wave"

let exceptionIdCounter = 0
function nextExceptionId(): string {
  return `exc_${Date.now()}_${++exceptionIdCounter}`
}

export function detectPhaseUnitError(cards: WaveCard[]): BusinessException | null {
  for (const card of cards) {
    if (card.phaseUnit === "radian" && Math.abs(card.phase) > 2 * Math.PI) {
      return {
        id: nextExceptionId(),
        type: "PHASE_UNIT_ERROR",
        triggeredAt: Date.now(),
        context: {
          parameterName: `波形卡相位 (id: ${card.id})`,
          currentValue: card.phase,
          expectedRange: [0, 2 * Math.PI],
          allWaveCards: structuredClone(cards),
        },
        resolution: null,
        beforeSnapshot: structuredClone(cards),
        afterSnapshot: [],
        confirmedBy: null,
        confirmedAt: null,
      }
    }
  }
  return null
}

export function detectAmplitudeOverflow(cards: WaveCard[]): BusinessException | null {
  const total = getTotalAmplitude(cards)
  if (total > MAX_AMPLITUDE) {
    return {
      id: nextExceptionId(),
      type: "AMPLITUDE_OVERFLOW",
      triggeredAt: Date.now(),
      context: {
        parameterName: "振幅叠加总和",
        currentValue: total,
        expectedRange: [0, MAX_AMPLITUDE],
        allWaveCards: structuredClone(cards),
      },
      resolution: null,
      beforeSnapshot: structuredClone(cards),
      afterSnapshot: [],
      confirmedBy: null,
      confirmedAt: null,
    }
  }
  return null
}

export function detectBoundaryCrossing(
  boardY: number,
  yMin: number,
  yMax: number,
  cards: WaveCard[]
): BusinessException | null {
  if (boardY < yMin || boardY > yMax) {
    return {
      id: nextExceptionId(),
      type: "BOUNDARY_CROSSING",
      triggeredAt: Date.now(),
      context: {
        parameterName: "冲浪板Y坐标",
        currentValue: boardY,
        expectedRange: [yMin, yMax],
        allWaveCards: structuredClone(cards),
      },
      resolution: null,
      beforeSnapshot: structuredClone(cards),
      afterSnapshot: [],
      confirmedBy: null,
      confirmedAt: null,
    }
  }
  return null
}

export function resolveException(
  exception: BusinessException,
  resolution: ExceptionResolution,
  afterSnapshot: WaveCard[],
  confirmedBy: "student" | "teacher" = "student"
): BusinessException {
  return {
    ...exception,
    resolution,
    afterSnapshot: structuredClone(afterSnapshot),
    confirmedBy: resolution === "CANCELLED" ? null : confirmedBy,
    confirmedAt: resolution === "CANCELLED" ? null : Date.now(),
  }
}

export function fixPhaseUnit(cards: WaveCard[], cardId: string): WaveCard[] {
  return cards.map((c) => {
    if (c.id === cardId && c.phaseUnit === "radian" && Math.abs(c.phase) > 2 * Math.PI) {
      return { ...c, phaseUnit: "degree" as const }
    }
    return c
  })
}

export function autoWrapPhase(cards: WaveCard[], cardId: string): WaveCard[] {
  return cards.map((c) => {
    if (c.id === cardId && c.phaseUnit === "radian" && Math.abs(c.phase) > 2 * Math.PI) {
      const wrapped = ((c.phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
      return { ...c, phase: wrapped }
    }
    return c
  })
}

export function scaleAmplitudes(cards: WaveCard[], targetTotal: number): WaveCard[] {
  const currentTotal = getTotalAmplitude(cards)
  if (currentTotal === 0) return cards
  const factor = targetTotal / currentTotal
  return cards.map((c) => ({ ...c, amplitude: c.amplitude * factor }))
}

export function detectAllExceptions(
  cards: WaveCard[],
  boardY: number,
  yMin: number,
  yMax: number
): BusinessException[] {
  const exceptions: BusinessException[] = []
  const phaseError = detectPhaseUnitError(cards)
  if (phaseError) exceptions.push(phaseError)
  const amplitudeOverflow = detectAmplitudeOverflow(cards)
  if (amplitudeOverflow) exceptions.push(amplitudeOverflow)
  const boundaryCrossing = detectBoundaryCrossing(boardY, yMin, yMax, cards)
  if (boundaryCrossing) exceptions.push(boundaryCrossing)
  return exceptions
}

export function getExceptionLabel(type: ExceptionType): string {
  switch (type) {
    case "PHASE_UNIT_ERROR":
      return "相位单位异常"
    case "AMPLITUDE_OVERFLOW":
      return "振幅叠加溢出"
    case "BOUNDARY_CROSSING":
      return "边界穿越"
  }
}

export function getExceptionDescription(exc: BusinessException): string {
  switch (exc.type) {
    case "PHASE_UNIT_ERROR":
      return `相位值 ${exc.context.currentValue.toFixed(2)} 超出弧度范围 [0, 2π]，可能误用了角度值`
    case "AMPLITUDE_OVERFLOW":
      return `振幅叠加总和 ${exc.context.currentValue.toFixed(2)} 超出安全阈值 ${exc.context.expectedRange[1]}`
    case "BOUNDARY_CROSSING": {
      const dir = exc.context.currentValue < exc.context.expectedRange[0] ? "下方" : "上方"
      return `冲浪板穿越${dir}边界 (y=${exc.context.currentValue.toFixed(2)})`
    }
  }
}
