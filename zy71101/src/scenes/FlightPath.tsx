import { useRef, useState, useCallback } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { Waypoint, FlightPath as FlightPathType, Point3D, unitConversion } from '@/types';
import * as THREE from 'three';

interface FlightPathProps {
  flightPath: FlightPathType;
  selectedWaypoint: string | null;
  onSelectWaypoint: (id: string | null) => void;
  onUpdateWaypoint: (id: string, position: Point3D) => void;
  visible?: boolean;
}

export const FlightPath = ({
  flightPath,
  selectedWaypoint,
  onSelectWaypoint,
  onUpdateWaypoint,
  visible = true
}: FlightPathProps) => {
  const linePoints = flightPath.waypoints.map(wp => {
    const y = unitConversion.toMeters(wp.position.y, wp.position.unit);
    return [wp.position.x, y, wp.position.z] as [number, number, number];
  });

  if (!visible) return null;

  return (
    <group>
      <Line
        points={linePoints}
        color={flightPath.color}
        lineWidth={3}
        transparent
        opacity={0.9}
      />
      <Line
        points={linePoints}
        color={flightPath.color}
        lineWidth={6}
        transparent
        opacity={0.3}
      />

      {flightPath.waypoints.map((waypoint, index) => (
        <WaypointMarker
          key={waypoint.id}
          waypoint={waypoint}
          index={index}
          isSelected={selectedWaypoint === waypoint.id}
          onSelect={() => onSelectWaypoint(waypoint.id)}
          onUpdate={(pos) => onUpdateWaypoint(waypoint.id, pos)}
        />
      ))}
    </group>
  );
};

interface WaypointMarkerProps {
  waypoint: Waypoint;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (position: Point3D) => void;
}

const WaypointMarker = ({
  waypoint,
  index,
  isSelected,
  onSelect,
  onUpdate
}: WaypointMarkerProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isDragging, setIsDragging] = useState(false);
  const planeIntersect = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const yInMeters = unitConversion.toMeters(waypoint.position.y, waypoint.position.unit);

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setIsDragging(true);
    onSelect();
    (e.target as any).setPointerCapture(e.pointerId);
  }, [onSelect]);

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!isDragging || !meshRef.current) return;
    e.stopPropagation();

    const intersectPoint = new THREE.Vector3();
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(e.pointer, e.camera);
    raycaster.ray.intersectPlane(planeIntersect, intersectPoint);

    if (intersectPoint) {
      const newY = waypoint.position.unit === 'feet' 
        ? unitConversion.toFeet(intersectPoint.y || yInMeters, 'meter')
        : intersectPoint.y || yInMeters;
      
      onUpdate({
        x: intersectPoint.x,
        y: newY,
        z: intersectPoint.z,
        unit: waypoint.position.unit
      });
    }
  }, [isDragging, onUpdate, waypoint.position.unit, yInMeters]);

  const handlePointerUp = useCallback((e: ThreeEvent<PointerEvent>) => {
    setIsDragging(false);
    (e.target as any).releasePointerCapture(e.pointerId);
  }, []);

  return (
    <group position={[waypoint.position.x, yInMeters, waypoint.position.z]}>
      <mesh
        ref={meshRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        scale={isSelected ? [1.5, 1.5, 1.5] : [1, 1, 1]}
      >
        <sphereGeometry args={[1.5, 16, 16]} />
        <meshStandardMaterial
          color={isSelected ? '#F59E0B' : '#06B6D4'}
          emissive={isSelected ? '#F59E0B' : '#06B6D4'}
          emissiveIntensity={0.5}
          transparent
          opacity={0.9}
        />
      </mesh>
      
      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2, 2.5, 32]} />
        <meshBasicMaterial 
          color={isSelected ? '#F59E0B' : '#06B6D4'} 
          transparent 
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh position={[0, 3, 0]}>
        <sphereGeometry args={[0.8, 8, 8]} />
        <meshBasicMaterial color="#0F172A" />
      </mesh>
    </group>
  );
};
