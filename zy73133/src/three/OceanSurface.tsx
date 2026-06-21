import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function OceanSurface() {
  const meshRef = useRef<THREE.Mesh>(null);
  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(120, 120, 80, 80);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#0f3a4e'),
        metalness: 0.5,
        roughness: 0.4,
        transparent: true,
        opacity: 0.92,
        wireframe: false,
        emissive: new THREE.Color('#0a4552'),
        emissiveIntensity: 0.7,
      }),
    [],
  );

  const basePositions = useMemo(() => geom.attributes.position.array.slice() as Float32Array, [geom]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    const pos = meshRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = basePositions[i];
      const z = basePositions[i + 2];
      arr[i + 1] =
        Math.sin(x * 0.35 + t * 1.1) * 0.35 +
        Math.cos(z * 0.3 + t * 0.8) * 0.3 +
        Math.sin((x + z) * 0.5 + t * 0.6) * 0.15;
    }
    pos.needsUpdate = true;
    meshRef.current.geometry.computeVertexNormals();
  });

  return <mesh ref={meshRef} geometry={geom} material={material} position={[0, -0.2, 0]} receiveShadow />;
}

export function BathymetryGrid() {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const size = 60;
    const step = 4;
    for (let i = -size; i <= size; i += step) {
      points.push(new THREE.Vector3(-size, -0.05, i), new THREE.Vector3(size, -0.05, i));
      points.push(new THREE.Vector3(i, -0.05, -size), new THREE.Vector3(i, -0.05, size));
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, []);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#38e1d6" transparent opacity={0.35} />
    </lineSegments>
  );
}
