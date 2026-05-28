import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RayPath as RayPathType } from '../../data/models/acoustic';

interface RayPathsProps {
  rays: RayPathType[];
  maxVisible?: number;
}

export function RayPaths({ rays, maxVisible = 2000 }: RayPathsProps) {
  const groupRef = useRef<THREE.Group>(null);
  const lineRef = useRef<THREE.LineSegments>(null);
  const shaderMaterialRef = useRef<THREE.ShaderMaterial>(null);

  const displayRays = useMemo(() => {
    if (rays.length <= maxVisible) return rays;
    const step = Math.ceil(rays.length / maxVisible);
    return rays.filter((_, i) => i % step === 0);
  }, [rays, maxVisible]);

  const isTooDense = rays.length > 5000;

  const { positions, colors, rayStarts, rayLengths } = useMemo(() => {
    const allPositions: number[] = [];
    const allColors: number[] = [];
    const starts: number[] = [];
    const lengths: number[] = [];

    let vertexIndex = 0;

    displayRays.forEach((ray) => {
      const rayLength = ray.points.length - 1;
      const opacity = isTooDense ? 0.2 : 0.6;

      for (let i = 0; i < rayLength; i++) {
        const start = ray.points[i];
        const end = ray.points[i + 1];

        allPositions.push(start.x, start.y, start.z, end.x, end.y, end.z);

        const intensity = ray.energy * opacity;
        const color = new THREE.Color(ray.color[0], ray.color[1], ray.color[2]);
        allColors.push(
          color.r * intensity,
          color.g * intensity,
          color.b * intensity,
          color.r * intensity,
          color.g * intensity,
          color.b * intensity
        );

        starts.push(vertexIndex, vertexIndex + 1);
        lengths.push(rayLength, rayLength);

        vertexIndex += 2;
      }
    });

    return {
      positions: new Float32Array(allPositions),
      colors: new Float32Array(allColors),
      rayStarts: new Float32Array(starts),
      rayLengths: new Float32Array(lengths),
    };
  }, [displayRays, isTooDense]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [positions, colors]);

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        pulseSpeed: { value: 1.5 },
        dashSize: { value: 0.3 },
        gapSize: { value: 0.2 },
      },
      vertexShader: `
        attribute vec3 color;
        varying vec3 vColor;
        varying float vLineProgress;
        
        uniform float time;
        
        void main() {
          vColor = color;
          vLineProgress = float(gl_VertexID) / 2000.0;
          
          vec3 pos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vLineProgress;
        
        uniform float time;
        uniform float pulseSpeed;
        uniform float dashSize;
        uniform float gapSize;
        
        void main() {
          float totalSize = dashSize + gapSize;
          float progress = vLineProgress + time * pulseSpeed;
          float dash = mod(progress, totalSize);
          
          if (dash > dashSize) {
            discard;
          }
          
          float alpha = 1.0 - dash / dashSize;
          alpha *= 0.8 + 0.2 * sin(time * 2.0 + vLineProgress * 10.0);
          
          gl_FragColor = vec4(vColor, alpha * 0.8);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, []);

  useFrame((state) => {
    if (shaderMaterialRef.current) {
      shaderMaterialRef.current.uniforms.time.value = state.clock.getElapsedTime();
    }
  });

  const orderStats = useMemo(() => {
    const stats = new Map<number, number>();
    displayRays.forEach((ray) => {
      stats.set(ray.order, (stats.get(ray.order) || 0) + 1);
    });
    return Array.from(stats.entries()).sort((a, b) => a[0] - b[0]);
  }, [displayRays]);

  return (
    <group ref={groupRef}>
      <lineSegments ref={lineRef} geometry={geometry} material={shaderMaterial} />

      {displayRays.slice(0, Math.min(50, displayRays.length)).map((ray) => {
        const firstPoint = ray.points[0];
        const lastPoint = ray.points[ray.points.length - 1];
        return (
          <group key={`source-${ray.id}`}>
            <mesh position={[firstPoint.x, firstPoint.y, firstPoint.z]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshBasicMaterial color={new THREE.Color(ray.color[0], ray.color[1], ray.color[2])} />
            </mesh>
            <mesh position={[lastPoint.x, lastPoint.y, lastPoint.z]}>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
            </mesh>
          </group>
        );
      })}

      {isTooDense && (
        <group position={[0, 8, 0]}>
          <mesh>
            <planeGeometry args={[8, 1.5]} />
            <meshBasicMaterial color="#ff9800" transparent opacity={0.1} />
          </mesh>
        </group>
      )}
    </group>
  );
}
