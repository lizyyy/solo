import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Transaction } from '../../types';
import { createCurvePath } from '../../utils/threeUtils';

interface FlowLineProps {
  transaction: Transaction;
  fromPos: [number, number, number];
  toPos: [number, number, number];
  isHighlighted: boolean;
  progress?: number;
  maxAmount?: number;
  onSelect: (id: string) => void;
}

const FLOW_COLOR = '#9D4EDD';

const FlowLine = ({
  transaction,
  fromPos,
  toPos,
  isHighlighted,
  progress = 1,
  maxAmount = 1000,
  onSelect
}: FlowLineProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const curve = useMemo(() => {
    const start = new THREE.Vector3(...fromPos);
    const end = new THREE.Vector3(...toPos);
    const distance = start.distanceTo(end);
    const height = Math.min(distance * 0.3, 5);
    return createCurvePath(start, end, height);
  }, [fromPos, toPos]);

  const tubeRadius = useMemo(() => {
    const normalizedAmount = Math.min(transaction.amount / maxAmount, 1);
    return 0.05 + normalizedAmount * 0.15;
  }, [transaction.amount, maxAmount]);

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(FLOW_COLOR) },
        glowIntensity: { value: isHighlighted ? 1.5 : 0.5 },
        progress: { value: progress }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        void main() {
          vUv = uv;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        uniform float glowIntensity;
        uniform float progress;
        varying vec2 vUv;
        varying vec3 vPosition;

        void main() {
          float visible = step(vUv.x, progress);
          if (visible < 0.5) discard;

          float flow = fract(vUv.x * 10.0 - time * 2.0);
          float particle = smoothstep(0.0, 0.15, flow) * smoothstep(0.3, 0.15, flow);
          particle += smoothstep(0.5, 0.65, flow) * smoothstep(0.8, 0.65, flow);

          float glow = sin(vUv.x * 3.14159) * glowIntensity;
          float alpha = 0.3 + particle * 0.7 + glow * 0.3;

          vec3 finalColor = color * (1.0 + glow * 0.5);
          gl_FragColor = vec4(finalColor, alpha * visible);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
  }, [isHighlighted, progress]);

  const glowMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(FLOW_COLOR) },
        intensity: { value: isHighlighted ? 2.0 : 1.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        uniform float intensity;
        varying vec2 vUv;

        void main() {
          float flow = fract(vUv.x * 5.0 - time * 1.5);
          float pulse = smoothstep(0.0, 0.1, flow) * smoothstep(0.2, 0.1, flow);
          float glow = sin(vUv.x * 3.14159) * 0.5;
          float alpha = (pulse * 0.6 + glow * 0.3) * intensity;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide
    });
  }, [isHighlighted]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    if (shaderMaterial.uniforms) {
      shaderMaterial.uniforms.time.value = time;
      shaderMaterial.uniforms.progress.value = progress;
    }
    if (glowMaterial.uniforms) {
      glowMaterial.uniforms.time.value = time;
    }
  });

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onSelect(transaction.id);
  };

  const handlePointerOver = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    document.body.style.cursor = 'auto';
  };

  return (
    <group>
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <tubeGeometry args={[curve, 128, tubeRadius, 8, false]} />
        <primitive object={shaderMaterial} attach="material" />
      </mesh>

      <mesh ref={glowRef}>
        <tubeGeometry args={[curve, 128, tubeRadius * 2, 8, false]} />
        <primitive object={glowMaterial} attach="material" />
      </mesh>
    </group>
  );
};

export default FlowLine;
