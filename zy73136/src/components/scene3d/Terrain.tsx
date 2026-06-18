import { useRef, useMemo } from 'react';
import * as THREE from 'three';

export function Terrain() {
  const meshRef = useRef<THREE.Mesh>(null);

  const terrainGeometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(100, 100, 64, 64);
    const positions = geometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);

      let z = 0;

      z += Math.sin(x * 0.05) * Math.cos(y * 0.05) * 2;
      z += Math.sin(x * 0.08 + 1) * Math.cos(y * 0.06 - 0.5) * 1.5;

      const distFromCenter = Math.sqrt(x * x + y * y);
      const edgeFalloff = Math.max(0, (distFromCenter - 35) / 15);
      z -= edgeFalloff * 5;

      positions.setZ(i, z);
    }

    geometry.computeVertexNormals();

    return geometry;
  }, []);

  const terrainMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uDeepColor: { value: new THREE.Color('#0A1628') },
        uShallowColor: { value: new THREE.Color('#1E3A5F') },
        uEdgeColor: { value: new THREE.Color('#00D4FF') },
      },
      vertexShader: `
        varying vec3 vPosition;
        varying float vDepth;
        
        void main() {
          vPosition = position;
          vDepth = position.z;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uDeepColor;
        uniform vec3 uShallowColor;
        uniform vec3 uEdgeColor;
        varying vec3 vPosition;
        varying float vDepth;
        
        void main() {
          float depthFactor = smoothstep(-5.0, 1.0, vDepth);
          vec3 color = mix(uDeepColor, uShallowColor, depthFactor);
          
          float distFromCenter = length(vPosition.xy);
          float edgeFactor = smoothstep(35.0, 45.0, distFromCenter);
          color = mix(color, uEdgeColor * 0.5, edgeFactor * 0.5);
          
          gl_FragColor = vec4(color, 0.85);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });
  }, []);

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
      <primitive object={terrainGeometry} attach="geometry" />
      <primitive object={terrainMaterial} attach="material" />
    </mesh>
  );
}
