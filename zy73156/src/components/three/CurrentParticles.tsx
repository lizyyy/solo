import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const COUNT = 900;
const BOUNDS = { x: 26, y: 10, z: 22 };

export default function CurrentParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const speedsRef = useRef<Float32Array>(new Float32Array(0));

  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const speeds = new Float32Array(COUNT);
    speedsRef.current = speeds;
    const cyan = new THREE.Color("#22D3EE");
    const blue = new THREE.Color("#38BDF8");
    const teal = new THREE.Color("#2DD4BF");
    const palette = [cyan, blue, teal];
    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * BOUNDS.x * 2;
      positions[i3 + 1] = (Math.random() - 0.5) * BOUNDS.y * 2;
      positions[i3 + 2] = (Math.random() - 0.5) * BOUNDS.z * 2;
      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i3] = c.r;
      colors[i3 + 1] = c.g;
      colors[i3 + 2] = c.b;
      speeds[i] = 0.6 + Math.random() * 1.8;
    }
    return { positions, colors };
  }, []);

  useFrame((_, delta) => {
    const points = pointsRef.current;
    if (!points) return;
    const attr = points.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const speeds = speedsRef.current;
    const t = performance.now() * 0.0004;
    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3;
      arr[i3] += speeds[i] * delta;
      arr[i3 + 1] += Math.sin(t + i) * 0.004;
      if (arr[i3] > BOUNDS.x) arr[i3] = -BOUNDS.x;
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={COUNT}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
          count={COUNT}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.09}
        vertexColors
        transparent
        opacity={0.7}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
