import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { SPHERE_RADIUS } from '../../utils/hslCalculator';

interface HSLSphereProps {
  visible: boolean;
}

export function HSLSphere({ visible }: HSLSphereProps) {
  const sphereRef = useRef<THREE.Mesh>(null);
  const innerGridRef = useRef<THREE.LineSegments>(null);

  const sphereGeometry = useMemo(() => {
    return new THREE.SphereGeometry(SPHERE_RADIUS, 64, 64);
  }, []);

  const sphereMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.03,
      side: THREE.DoubleSide,
      depthWrite: false
    });
  }, []);

  const gridGeometry = useMemo(() => {
    const segments: THREE.Vector3[] = [];
    
    for (let i = 0; i <= 12; i++) {
      const phi = (i / 12) * Math.PI;
      for (let j = 0; j <= 64; j++) {
        const theta = (j / 64) * Math.PI * 2;
        const nextTheta = ((j + 1) / 64) * Math.PI * 2;
        
        const r = SPHERE_RADIUS;
        segments.push(new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(theta)
        ));
        segments.push(new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(nextTheta),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(nextTheta)
        ));
      }
    }
    
    for (let i = 0; i <= 24; i++) {
      const theta = (i / 24) * Math.PI * 2;
      for (let j = 0; j <= 32; j++) {
        const phi = (j / 32) * Math.PI;
        const nextPhi = ((j + 1) / 32) * Math.PI;
        
        const r = SPHERE_RADIUS;
        segments.push(new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(theta)
        ));
        segments.push(new THREE.Vector3(
          r * Math.sin(nextPhi) * Math.cos(theta),
          r * Math.cos(nextPhi),
          r * Math.sin(nextPhi) * Math.sin(theta)
        ));
      }
    }
    
    const positions = new Float32Array(segments.length * 3);
    segments.forEach((v, i) => {
      positions[i * 3] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;
    });
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, []);

  const gridMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08,
      depthWrite: false
    });
  }, []);

  const hueRingGeometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const theta = (i / 128) * Math.PI * 2;
      const hue = (i / 128) * 360;
      
      const color = new THREE.Color();
      color.setHSL(hue / 360, 1, 0.5);
      
      const r = SPHERE_RADIUS * 1.02;
      points.push(new THREE.Vector3(
        r * Math.cos(theta),
        0,
        r * Math.sin(theta)
      ));
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, []);

  const hueRingMaterial = useMemo(() => {
    const colors = new Float32Array(129 * 3);
    for (let i = 0; i <= 128; i++) {
      const hue = (i / 128) * 360;
      const color = new THREE.Color();
      color.setHSL(hue / 360, 1, 0.5);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      linewidth: 2
    });
    
    hueRingGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    return material;
  }, [hueRingGeometry]);

  useFrame(() => {
    if (innerGridRef.current) {
      innerGridRef.current.rotation.y += 0.0005;
    }
  });

  if (!visible) return null;

  return (
    <group>
      <mesh ref={sphereRef} geometry={sphereGeometry} material={sphereMaterial} />
      
      <lineSegments ref={innerGridRef} geometry={gridGeometry} material={gridMaterial} />
      
      <lineSegments geometry={hueRingGeometry} material={hueRingMaterial} />
      
      <mesh position={[0, SPHERE_RADIUS * 1.05, 0]}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshBasicMaterial color={0xffffff} />
      </mesh>
      <mesh position={[0, -SPHERE_RADIUS * 1.05, 0]}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshBasicMaterial color={0x000000} />
      </mesh>
    </group>
  );
}
