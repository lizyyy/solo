import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSimulationStore } from '../../store/useSimulationStore';
import * as THREE from 'three';

export default function TrajectoryLine() {
  const lineRef = useRef<THREE.Line>(null);
  const { trajectory, conclusion } = useSimulationStore();

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(3000 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useFrame(() => {
    if (lineRef.current && trajectory.length > 1) {
      const positions = geometry.attributes.position.array as Float32Array;
      
      trajectory.forEach((point, i) => {
        if (i < 1000) {
          positions[i * 3] = point.position.x;
          positions[i * 3 + 1] = point.position.y;
          positions[i * 3 + 2] = point.position.z;
        }
      });
      
      geometry.attributes.position.needsUpdate = true;
      geometry.setDrawRange(0, Math.min(trajectory.length, 1000));
      
      const material = lineRef.current.material as THREE.LineBasicMaterial;
      if (conclusion === 'inconsistent') {
        material.color.setHex(0xff3b30);
      } else if (conclusion === 'needs-evidence') {
        material.color.setHex(0xff9500);
      } else {
        material.color.setHex(0x00ff88);
      }
    }
  });

  return (
    <primitive object={new THREE.Line(geometry)} ref={lineRef}>
      <lineBasicMaterial color="#00ff88" linewidth={2} transparent opacity={0.8} />
    </primitive>
  );
}
