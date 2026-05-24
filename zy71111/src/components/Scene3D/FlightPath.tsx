
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useInspectionStore } from '../../store/useInspectionStore';

export function FlightPath() {
  const inspectionData = useInspectionStore((state) => state.inspectionData);
  const currentTime = useInspectionStore((state) => state.currentTime);
  const droneRef = useRef<THREE.Mesh>(null);

  const { curve, points, tubeGeometry } = useMemo(() => {
    if (!inspectionData) return { curve: null, points: [], tubeGeometry: null };

    const pts = inspectionData.flightPath.map(
      (p) => new THREE.Vector3(...p.position)
    );
    const crv = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const tubeGeo = new THREE.TubeGeometry(crv, 200, 0.03, 8, false);
    return { curve: crv, points: pts, tubeGeometry: tubeGeo };
  }, [inspectionData]);

  useFrame(() => {
    if (!inspectionData || !curve || !droneRef.current) return;

    const { startTime, endTime } = inspectionData;
    const progress = Math.min(
      Math.max((currentTime - startTime) / (endTime - startTime), 0),
      1
    );

    const position = curve.getPoint(progress);
    droneRef.current.position.copy(position);

    const lookAtPoint = curve.getPoint(Math.min(progress + 0.02, 1));
    droneRef.current.lookAt(lookAtPoint);
  });

  if (!inspectionData) return null;

  return (
    <group>
      {tubeGeometry && (
        <mesh geometry={tubeGeometry}>
          <meshBasicMaterial color="#06b6d4" transparent opacity={0.6} />
        </mesh>
      )}

      <mesh ref={droneRef}>
        <boxGeometry args={[0.2, 0.1, 0.2]} />
        <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={0.5} />
      </mesh>

      {points.slice(0, -1).map((point, i) => (
        <mesh key={i} position={point}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color="#0891b2" transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  );
}
