import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function createDamGeometry(width: number, height: number, depth: number) {
  const geometry = new THREE.BufferGeometry();
  const vertices: number[] = [];
  const indices: number[] = [];

  const topWidth = width * 0.4;
  const frontDepth = depth * 0.4;
  const backDepth = depth * 0.6;

  const points = [
    [-width / 2, 0, -depth / 2],
    [width / 2, 0, -depth / 2],
    [width / 2, 0, depth / 2],
    [-width / 2, 0, depth / 2],
    [-topWidth / 2, height, -frontDepth / 2],
    [topWidth / 2, height, -frontDepth / 2],
    [topWidth / 2, height, backDepth / 2],
    [-topWidth / 2, height, backDepth / 2],
  ];

  points.forEach((p) => vertices.push(...p));

  const faces = [
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
    [0, 3, 2, 1],
    [4, 5, 6, 7],
  ];

  faces.forEach((face) => {
    indices.push(face[0], face[1], face[2]);
    indices.push(face[0], face[2], face[3]);
  });

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3)
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  return geometry;
}

export function DamModel() {
  const damRef = useRef<THREE.Group>(null);
  const damGeometry = useMemo(() => createDamGeometry(30, 30, 50), []);

  useFrame((state) => {
    if (damRef.current) {
      damRef.current.position.y = 0;
    }
  });

  return (
    <group ref={damRef}>
      <mesh position={[0, 15, 0]} castShadow receiveShadow>
        <primitive object={damGeometry} attach="geometry" />
        <meshStandardMaterial
          color="#6b7280"
          metalness={0.3}
          roughness={0.8}
          flatShading
        />
      </mesh>

      <mesh position={[0, 1, 26]} receiveShadow>
        <boxGeometry args={[32, 2, 2]} />
        <meshStandardMaterial color="#4b5563" roughness={0.9} />
      </mesh>

      <mesh position={[0, 1, -26]} receiveShadow>
        <boxGeometry args={[32, 2, 2]} />
        <meshStandardMaterial color="#4b5563" roughness={0.9} />
      </mesh>

      {[...Array(5)].map((_, i) => (
        <mesh
          key={i}
          position={[-12 + i * 6, 25, 0]}
          receiveShadow
        >
          <boxGeometry args={[1, 1.5, 52]} />
          <meshStandardMaterial color="#374151" roughness={0.9} />
        </mesh>
      ))}

      <mesh position={[0, 0.5, 0]} receiveShadow>
        <boxGeometry args={[34, 1, 54]} />
        <meshStandardMaterial color="#374151" roughness={0.95} />
      </mesh>
    </group>
  );
}
