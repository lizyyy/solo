import { Line } from '@react-three/drei'
import type { PipeSegment } from '@/types'

interface PipelineLineProps {
  pipe: PipeSegment
}

export default function PipelineLine({ pipe }: PipelineLineProps) {
  const points: [number, number, number][] = [
    [pipe.startX, pipe.startY, pipe.startZ],
    [pipe.endX, pipe.endY, pipe.endZ],
  ]

  return (
    <Line
      points={points}
      color="#4a9ead"
      lineWidth={3}
      dashed={false}
    />
  )
}
