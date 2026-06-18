import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Ocean() {
  const meshRef = useRef<THREE.Mesh>(null);
  const geometryRef = useRef<THREE.PlaneGeometry>(null);

  const oceanMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#0A1628') },
        uHighlightColor: { value: new THREE.Color('#00D4FF') },
      },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying float vWave;
        
        void main() {
          vUv = uv;
          vec3 pos = position;
          
          float wave1 = sin(pos.x * 0.1 + uTime * 0.5) * 0.3;
          float wave2 = sin(pos.y * 0.15 + uTime * 0.3) * 0.2;
          float wave3 = sin((pos.x + pos.y) * 0.08 + uTime * 0.4) * 0.15;
          
          pos.z += wave1 + wave2 + wave3;
          vWave = wave1 + wave2 + wave3;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform vec3 uHighlightColor;
        varying vec2 vUv;
        varying float vWave;
        
        void main() {
          float waveIntensity = (vWave + 0.65) * 0.7;
          vec3 color = mix(uColor, uHighlightColor * 0.3, waveIntensity);
          
          float fresnel = pow(1.0 - abs(dot(vec3(0.0, 0.0, 1.0), normalize(vec3(vUv - 0.5, 1.0)))), 2.0);
          color += uHighlightColor * fresnel * 0.3;
          
          float grid = abs(sin(vUv.x * 50.0)) * 0.1 + abs(sin(vUv.y * 50.0)) * 0.1;
          color += uHighlightColor * grid * 0.2;
          
          gl_FragColor = vec4(color, 0.9);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });
  }, []);

  useFrame((state) => {
    if (oceanMaterial) {
      oceanMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry ref={geometryRef} args={[100, 100, 128, 128]} />
      <primitive object={oceanMaterial} attach="material" />
    </mesh>
  );
}
