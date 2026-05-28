import { useMemo } from 'react';
import { Line } from '@react-three/drei';

function generateLatitudeLine(lat: number, segments: number): [number, number, number][] {
  const points: [number, number, number][] = [];
  const y = Math.sin(lat);
  const r = Math.cos(lat);
  for (let i = 0; i <= segments; i++) {
    const lon = (i / segments) * Math.PI * 2;
    points.push([r * Math.cos(lon), y, r * Math.sin(lon)]);
  }
  return points;
}

function generateLongitudeLine(lon: number, segments: number): [number, number, number][] {
  const points: [number, number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const lat = (i / segments) * Math.PI - Math.PI / 2;
    points.push([Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)]);
  }
  return points;
}

export default function SphereMesh() {
  const latitudeLines = useMemo(() => {
    const lines: [number, number, number][][] = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      lines.push(generateLatitudeLine((lat * Math.PI) / 180, 64));
    }
    return lines;
  }, []);

  const longitudeLines = useMemo(() => {
    const lines: [number, number, number][][] = [];
    for (let lon = 0; lon < 360; lon += 30) {
      lines.push(generateLongitudeLine((lon * Math.PI) / 180, 64));
    }
    return lines;
  }, []);

  const axisLength = 1.4;

  return (
    <group>
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial color="cyan" transparent opacity={0.05} side={2} depthWrite={false} />
      </mesh>

      {latitudeLines.map((pts, i) => (
        <Line key={`lat-${i}`} points={pts} color="cyan" lineWidth={0.5} transparent opacity={0.15} />
      ))}
      {longitudeLines.map((pts, i) => (
        <Line key={`lon-${i}`} points={pts} color="cyan" lineWidth={0.5} transparent opacity={0.15} />
      ))}

      <Line points={[[0, 0, 0], [axisLength, 0, 0]]} color="red" lineWidth={1.5} />
      <Line points={[[0, 0, 0], [0, axisLength, 0]]} color="green" lineWidth={1.5} />
      <Line points={[[0, 0, 0], [0, 0, axisLength]]} color="blue" lineWidth={1.5} />
    </group>
  );
}
