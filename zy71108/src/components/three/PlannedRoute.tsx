import { useMemo } from 'react';
import * as THREE from 'three';
import { Point3D } from '../../types';

interface PlannedRouteProps {
  points: Point3D[];
}

export function PlannedRoute({ points }: PlannedRouteProps) {
  const { lineGeometry, markerPositions } = useMemo(() => {
    const threePoints = points.map(p => new THREE.Vector3(p.x, 2, p.z));
    const curve = new THREE.CatmullRomCurve3(threePoints, false, 'catmullrom', 0.3);
    const curvePoints = curve.getPoints(50);
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
    
    return {
      lineGeometry,
      markerPositions: threePoints
    };
  }, [points]);

  if (points.length === 0) return null;

  return (
    <group>
      <primitive
        object={new THREE.Line(
          lineGeometry,
          new THREE.LineDashedMaterial({
            color: '#00B42A',
            dashSize: 1,
            gapSize: 0.5,
            linewidth: 3
          })
        )}
      />
      
      {markerPositions.map((pos, i) => (
        <mesh key={i} position={[pos.x, pos.y, pos.z]}>
          <sphereGeometry args={[0.8, 16, 16]} />
          <meshStandardMaterial color="#00B42A" emissive="#00B42A" emissiveIntensity={0.5} />
        </mesh>
      ))}

      {points.length >= 2 && (
        <group>
          <mesh position={[markerPositions[0].x, markerPositions[0].y, markerPositions[0].z]}>
            <cylinderGeometry args={[1.2, 1.2, 0.3, 16]} />
            <meshBasicMaterial color="#165DFF" transparent opacity={0.8} />
          </mesh>
          <mesh position={[
            markerPositions[markerPositions.length - 1].x,
            markerPositions[markerPositions.length - 1].y,
            markerPositions[markerPositions.length - 1].z
          ]}>
            <cylinderGeometry args={[1.2, 1.2, 0.3, 16]} />
            <meshBasicMaterial color="#F53F3F" transparent opacity={0.8} />
          </mesh>
        </group>
      )}
    </group>
  );
}

export default PlannedRoute;
