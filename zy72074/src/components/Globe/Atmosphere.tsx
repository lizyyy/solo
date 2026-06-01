import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EARTH_RADIUS } from '../../utils/coordinate';

interface AtmosphereProps {
  radius?: number;
}

export function Atmosphere({ radius = EARTH_RADIUS }: AtmosphereProps) {
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (atmosphereRef.current) {
      const material = atmosphereRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  const atmosphereMaterial = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      uniform float uTime;
      
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      uniform float uTime;
      
      void main() {
        float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
        vec3 atmosphereColor = vec3(0.3, 0.6, 1.0);
        float pulse = 0.8 + sin(uTime * 0.5) * 0.2;
        gl_FragColor = vec4(atmosphereColor, intensity * pulse * 0.6);
      }
    `,
    uniforms: {
      uTime: { value: 0 },
    },
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
  });

  return (
    <group>
      <mesh ref={atmosphereRef}>
        <sphereGeometry args={[radius * 1.15, 64, 64]} />
        <primitive object={atmosphereMaterial} attach="material" />
      </mesh>
      
      <mesh ref={glowRef}>
        <sphereGeometry args={[radius * 1.02, 64, 64]} />
        <meshBasicMaterial
          color="#4da6ff"
          transparent
          opacity={0.08}
          side={THREE.FrontSide}
        />
      </mesh>
    </group>
  );
}
