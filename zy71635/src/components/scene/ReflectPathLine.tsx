import { Line } from '@react-three/drei';
import type { ReflectPath } from '@/utils/types';

interface ReflectPathLineProps {
  path: ReflectPath;
}

export function ReflectPathLine({ path }: ReflectPathLineProps) {
  return (
    <Line
      points={path.pathPoints}
      color="#f59e0b"
      lineWidth={2}
      transparent
      opacity={0.6}
      dashed
      dashSize={0.3}
      gapSize={0.2}
    />
  );
}
