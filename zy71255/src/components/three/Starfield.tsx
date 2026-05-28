import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const Starfield = () => {
  const starsRef = useRef<THREE.Points>(null);
  const count = 1000;

  const { positions, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const radius = 100 + Math.random() * 50;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

      sizes[i] = Math.random() * 2 + 0.5;
    }

    return { positions, sizes };
  }, []);

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 }
      },
      vertexShader: `
        attribute float size;
        varying float vOpacity;
        uniform float time;
        void main() {
          vOpacity = 0.5 + 0.5 * sin(time * 2.0 + position.x * 0.1 + position.y * 0.1);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vOpacity;
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          gl_FragColor = vec4(1.0, 1.0, 1.0, alpha * vOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }, []);

  useFrame((state) => {
    if (starsRef.current && shaderMaterial.uniforms) {
      shaderMaterial.uniforms.time.value = state.clock.elapsedTime;
      starsRef.current.rotation.y = state.clock.elapsedTime * 0.02;
    }
  });

  return (
    <points ref={starsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <primitive object={shaderMaterial} attach="material" />
    </points>
  );
};

export default Starfield;
