import { useSunStore } from '@/store/useSunStore';
import { useMemo } from 'react';

export function SunLight() {
  const { sunTime, getSunPosition } = useSunStore();
  const sunPos = useMemo(() => getSunPosition(), [sunTime, getSunPosition]);

  const intensity = sunTime >= 6 && sunTime <= 18 
    ? Math.sin(((sunTime - 6) / 12) * Math.PI) * 2 
    : 0.2;

  const lightColor = useMemo(() => {
    if (sunTime < 6 || sunTime > 18) return '#4a5568';
    if (sunTime < 8 || sunTime > 16) return '#fcd34d';
    return '#fffbeb';
  }, [sunTime]);

  return (
    <>
      <directionalLight
        position={[sunPos.x, sunPos.y, sunPos.z]}
        intensity={intensity}
        color={lightColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={200}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
      />
      <ambientLight intensity={0.4} />
      <hemisphereLight args={['#87ceeb', '#3d5c3d', 0.3]} />
    </>
  );
}
