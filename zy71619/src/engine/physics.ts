import type { SurfboardState, WaveCard } from "@/types"
import { getWaveYAtX, getWaveDerivativeAtX, X_RANGE_TOTAL } from "./wave"

const BASE_SPEED = 0.03
const CANVAS_Y_MIN = -6
const CANVAS_Y_MAX = 6

export function initSurfboard(): SurfboardState {
  return {
    x: 0,
    y: 0,
    velocityX: BASE_SPEED,
    velocityY: 0,
    angle: 0,
  }
}

export function updateSurfboard(
  board: SurfboardState,
  cards: WaveCard[],
  time: number,
  deltaTime: number
): SurfboardState {
  let newX = board.x + board.velocityX * deltaTime * 60
  if (newX > X_RANGE_TOTAL) {
    newX = 0
  }

  const newY = getWaveYAtX(cards, newX, time)
  const derivative = getWaveDerivativeAtX(cards, newX, time)
  const newAngle = Math.atan(derivative)
  const newVY = derivative * board.velocityX

  return {
    x: newX,
    y: newY,
    velocityX: BASE_SPEED,
    velocityY: newVY,
    angle: newAngle,
  }
}

export function checkBoundaryCrossing(board: SurfboardState): boolean {
  return board.y < CANVAS_Y_MIN || board.y > CANVAS_Y_MAX
}

export function clampToBoundary(board: SurfboardState): SurfboardState {
  const clampedY = Math.max(CANVAS_Y_MIN, Math.min(CANVAS_Y_MAX, board.y))
  return { ...board, y: clampedY }
}

export { CANVAS_Y_MIN, CANVAS_Y_MAX }
