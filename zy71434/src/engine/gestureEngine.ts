import type { GestureResult, GestureType } from '@/types/game'

type FingerState = 'extended' | 'curled' | 'ambiguous'

interface FingerAnalysis {
  thumb: FingerState
  index: FingerState
  middle: FingerState
  ring: FingerState
  pinky: FingerState
}

const AMBIGUITY_THRESHOLD = 0.05

function analyzeFingers(landmarks: number[][]): FingerAnalysis {
  const isAmbiguous = (diff: number) => Math.abs(diff) < AMBIGUITY_THRESHOLD

  const thumbTipX = landmarks[4][0]
  const thumbIpX = landmarks[3][0]
  const thumbMcpX = landmarks[2][0]
  const thumbDiff = Math.abs(thumbTipX - thumbMcpX) - Math.abs(thumbIpX - thumbMcpX)
  const thumbState: FingerState = isAmbiguous(thumbDiff)
    ? 'ambiguous'
    : thumbDiff > 0
      ? 'extended'
      : 'curled'

  const analyzeFinger = (tipIdx: number, pipIdx: number): FingerState => {
    const tipY = landmarks[tipIdx][1]
    const pipY = landmarks[pipIdx][1]
    const diff = pipY - tipY
    return isAmbiguous(diff) ? 'ambiguous' : diff > 0 ? 'extended' : 'curled'
  }

  return {
    thumb: thumbState,
    index: analyzeFinger(8, 6),
    middle: analyzeFinger(12, 10),
    ring: analyzeFinger(16, 14),
    pinky: analyzeFinger(20, 18),
  }
}

function matchGesture(fingers: FingerAnalysis): GestureType {
  const extendedCount = (
    ['thumb', 'index', 'middle', 'ring', 'pinky'] as const
  ).filter((f) => fingers[f] === 'extended').length

  const isExtended = (f: keyof FingerAnalysis) => fingers[f] === 'extended'

  if (extendedCount === 0) return 'fist'
  if (isExtended('thumb') && extendedCount === 1) return 'thumb'
  if (isExtended('index') && extendedCount === 1) return 'index'
  if (isExtended('index') && isExtended('middle') && extendedCount === 2)
    return 'peace'
  if (
    isExtended('index') &&
    isExtended('middle') &&
    isExtended('ring') &&
    extendedCount === 3
  )
    return 'three'
  if (
    isExtended('index') &&
    isExtended('middle') &&
    isExtended('ring') &&
    isExtended('pinky') &&
    extendedCount === 4
  )
    return 'four'
  if (extendedCount === 5) return 'open'

  if (isExtended('index')) return 'index'
  if (isExtended('thumb')) return 'thumb'
  return 'fist'
}

export function recognizeGesture(landmarks: number[][]): GestureResult {
  const fingers = analyzeFingers(landmarks)
  const gesture = matchGesture(fingers)
  const ambiguousCount = (
    ['thumb', 'index', 'middle', 'ring', 'pinky'] as const
  ).filter((f) => fingers[f] === 'ambiguous').length
  const confidence = Math.max(0.3, 1.0 - ambiguousCount * 0.15)

  return {
    gesture,
    confidence,
    landmarks,
  }
}
