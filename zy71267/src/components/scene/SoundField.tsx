import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Seat, AcousticReading, DisplayParameter } from '../../data/models/acoustic';
import { getParameterColor, PARAMETER_RANGES } from '../../utils/colorMap';

interface SoundFieldProps {
  seats: Seat[];
  readings: AcousticReading[];
  displayParam: DisplayParameter;
  enabled: boolean;
}

export function SoundField({ seats, readings, displayParam, enabled }: SoundFieldProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const { geometry, paramValues } = useMemo(() => {
    const readingMap = new Map(readings.map((r) => [r.seatId, r]));
    
    const validSeats = seats.filter((s) => {
      const reading = readingMap.get(s.id);
      return reading !== undefined;
    });

    if (validSeats.length < 3) {
      return {
        geometry: new THREE.PlaneGeometry(1, 1),
        paramValues: new Float32Array([0, 0, 0]),
      };
    }

    const positions: number[] = [];
    const uvs: number[] = [];
    const values: number[] = [];
    const indices: number[] = [];

    const range = PARAMETER_RANGES[displayParam];

    validSeats.forEach((seat, index) => {
      const reading = readingMap.get(seat.id)!;
      const value = reading[displayParam];
      const normalizedValue = (value - range.min) / (range.max - range.min);

      positions.push(seat.position.x, 0.02, seat.position.z);
      uvs.push(index / validSeats.length, 0);
      values.push(normalizedValue);

      if (index >= 2) {
        indices.push(0, index - 1, index);
      }
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    geo.setAttribute('aValue', new THREE.BufferAttribute(new Float32Array(values), 1));
    
    if (indices.length > 0) {
      geo.setIndex(indices);
    }
    
    geo.computeVertexNormals();

    return { geometry: geo, paramValues: new Float32Array(values) };
  }, [seats, readings, displayParam]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        opacity: { value: enabled ? 0.6 : 0 },
      },
      vertexShader: `
        attribute float aValue;
        varying float vValue;
        varying vec3 vPosition;
        
        void main() {
          vValue = aValue;
          vPosition = position;
          
          vec3 pos = position;
          pos.y += aValue * 0.5;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying float vValue;
        varying vec3 vPosition;
        
        uniform float time;
        uniform float opacity;
        
        vec3 viridisColor(float t) {
          t = clamp(t, 0.0, 1.0);
          float r = 0.2777 + t * (0.1050 + t * (-0.3309 + t * (-4.6343 + t * (6.1824 - t * 2.5115))));
          float g = 0.0054 + t * (1.4076 + t * (0.3408 + t * (-1.0632 + t * (-0.3678 + t * 0.3809))));
          float b = 0.3340 + t * (1.3814 + t * (0.0884 + t * (-0.4625 + t * (1.0967 - t * 0.7836))));
          return vec3(r, g, b);
        }
        
        vec3 heatmapColor(float t) {
          t = clamp(t, 0.0, 1.0);
          vec3 color;
          
          if (t < 0.25) {
            float nt = t / 0.25;
            color = vec3(0.0, nt * 0.5, 0.5 + nt * 0.5);
          } else if (t < 0.5) {
            float nt = (t - 0.25) / 0.25;
            color = vec3(0.0, 0.5 + nt * 0.5, 1.0 - nt * 0.5);
          } else if (t < 0.75) {
            float nt = (t - 0.5) / 0.25;
            color = vec3(nt, 1.0, 0.5 - nt * 0.5);
          } else {
            float nt = (t - 0.75) / 0.25;
            color = vec3(1.0, 1.0 - nt * 0.5, 0.0);
          }
          
          return color;
        }
        
        void main() {
          vec3 color = heatmapColor(vValue);
          
          float wave = sin(vPosition.x * 0.5 + time) * sin(vPosition.z * 0.5 + time) * 0.1;
          float finalOpacity = opacity * (0.7 + wave);
          
          gl_FragColor = vec4(color, finalOpacity);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, []);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.getElapsedTime();
    }
  });

  const contourLines = useMemo(() => {
    const range = PARAMETER_RANGES[displayParam];
    const lines: { value: number; color: string }[] = [];
    
    for (let i = 0; i <= 5; i++) {
      const value = range.min + (range.max - range.min) * (i / 5);
      lines.push({
        value,
        color: '#ffffff',
      });
    }
    
    return lines;
  }, [displayParam]);

  if (!enabled) return null;

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry} material={material} />
      
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}
