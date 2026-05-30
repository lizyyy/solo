
import { useRef, useMemo } from 'react';
import { Points, BufferGeometry, BufferAttribute, PointsMaterial } from 'three';
import { useFrame, ThreeEvent } from '@react-three/fiber';

const generateRandomInSphere = (count: number, radius: number): Float32Array => {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = radius * Math.cbrt(Math.random());
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }
  return positions;
};

export const StarsBackground = () => {
  const ref = useRef<Points>(null);
  
  const positions = useMemo(() => generateRandomInSphere(6000, 1500), []);
  const positions2 = useMemo(() => generateRandomInSphere(2000, 1000), []);

  const geometry1 = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  const geometry2 = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions2, 3));
    return geo;
  }, [positions2]);

  const material1 = useMemo(() => {
    return new PointsMaterial({
      size: 0.8,
      color: '#8b5cf6',
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
    });
  }, []);

  const material2 = useMemo(() => {
    return new PointsMaterial({
      size: 0.5,
      color: '#60a5fa',
      transparent: true,
      opacity: 0.4,
    });
  }, []);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.x -= delta / 50;
      ref.current.rotation.y -= delta / 70;
    }
  });

  return (
    <group rotation={[0, 0, Math.PI / 4]}>
      <points ref={ref} geometry={geometry1} material={material1} />
      <points geometry={geometry2} material={material2} />
    </group>
  );
};
