import { useMemo, useRef } from 'react';
import { Route, Waypoint } from '../../types';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { getPointOnPath } from '../../utils/geometry';

interface RouteLineProps {
  route: Route | null;
  timelinePosition: number;
  isValid: boolean;
}

export const RouteLine = ({ route, timelinePosition, isValid }: RouteLineProps) => {
  const progressRef = useRef<THREE.Group>(null);
  const waypointMarkersRef = useRef<THREE.Group>(null);

  const { lineGeometry, tubeGeometry } = useMemo(() => {
    if (!route || route.waypoints.length < 2) {
      return { lineGeometry: null, tubeGeometry: null };
    }

    const points = route.waypoints.map(
      (wp) => new THREE.Vector3(wp.position.x, wp.position.y + 0.1, wp.position.z)
    );

    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
    const curvePoints = curve.getPoints(100);

    const lineGeom = new THREE.BufferGeometry().setFromPoints(curvePoints);
    const tubeGeom = new THREE.TubeGeometry(curve, 64, 0.15, 8, false);

    return { lineGeometry: lineGeom, tubeGeometry: tubeGeom };
  }, [route]);

  const pathPoints = useMemo(() => {
    if (!route) return [];
    return route.waypoints.map((wp) => wp.position);
  }, [route]);

  useFrame(() => {
    if (progressRef.current && pathPoints.length > 0) {
      const point = getPointOnPath(pathPoints, timelinePosition);
      progressRef.current.position.set(point.x, point.y + 0.5, point.z);
    }
  });

  if (!route) return null;

  const lineColor = isValid ? '#00B42A' : '#F53F3F';
  const emissiveIntensity = isValid ? 0.3 : 0.5;

  return (
    <group>
      {tubeGeometry && (
        <mesh geometry={tubeGeometry}>
          <meshStandardMaterial
            color={lineColor}
            emissive={lineColor}
            emissiveIntensity={emissiveIntensity}
            transparent
            opacity={0.7}
          />
        </mesh>
      )}

      {lineGeometry && (
        <lineSegments geometry={lineGeometry}>
          <lineBasicMaterial color={lineColor} linewidth={3} />
        </lineSegments>
      )}

      <group ref={waypointMarkersRef}>
        {route.waypoints.map((waypoint, index) => (
          <WaypointMarker
            key={waypoint.id}
            waypoint={waypoint}
            index={index}
            total={route.waypoints.length}
          />
        ))}
      </group>

      <group ref={progressRef}>
        <mesh>
          <sphereGeometry args={[0.4, 16, 16]} />
          <meshStandardMaterial
            color="#165DFF"
            emissive="#165DFF"
            emissiveIntensity={0.8}
            transparent
            opacity={0.9}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.7, 32]} />
          <meshBasicMaterial color="#165DFF" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
};

interface WaypointMarkerProps {
  waypoint: Waypoint;
  index: number;
  total: number;
}

const WaypointMarker = ({ waypoint, index, total }: WaypointMarkerProps) => {
  const getTypeColor = () => {
    switch (waypoint.type) {
      case 'ramp':
        return '#FF7D00';
      case 'elevator':
        return '#722ED1';
      case 'entrance':
        return '#00B42A';
      default:
        return '#86909C';
    }
  };

  const isStart = index === 0;
  const isEnd = index === total - 1;

  return (
    <group position={[waypoint.position.x, waypoint.position.y + 0.3, waypoint.position.z]}>
      <mesh>
        <cylinderGeometry
          args={[isStart || isEnd ? 0.5 : 0.3, isStart || isEnd ? 0.5 : 0.3, 0.2, 16]}
        />
        <meshStandardMaterial
          color={isStart ? '#00B42A' : isEnd ? '#165DFF' : getTypeColor()}
          emissive={isStart ? '#00B42A' : isEnd ? '#165DFF' : getTypeColor()}
          emissiveIntensity={0.3}
        />
      </mesh>

      <mesh position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color={isStart ? '#00B42A' : isEnd ? '#165DFF' : getTypeColor()} />
      </mesh>
    </group>
  );
};
