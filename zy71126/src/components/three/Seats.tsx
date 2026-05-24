import { useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { ThreeEvent, useThree } from '@react-three/fiber';
import { useAppStore, useFilteredSeats } from '@/store/appStore';
import { Seat } from '@/types';

interface SeatMeshProps {
  seat: Seat;
  onDragStart: (seatId: string) => void;
  onDrag: (seatId: string, position: THREE.Vector3) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}

function SeatMesh({ seat, onDragStart, onDrag, onDragEnd, isDragging }: SeatMeshProps) {
  const meshRef = useRef<THREE.Group>(null);
  const isDraggingEnabled = useAppStore((state) => state.isDraggingEnabled);
  const eyeHeight = useAppStore((state) => state.eyeHeight);
  const { camera, gl } = useThree();
  const dragPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const isDraggingRef = useRef(false);
  const offsetRef = useRef(new THREE.Vector3());
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  const getSeatColor = () => {
    if (seat.isSelected) return '#fbbf24';
    if (seat.isBlocked) return '#ef4444';
    return '#3b82f6';
  };

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!isDraggingEnabled) return;
    e.stopPropagation();
    isDraggingRef.current = true;
    onDragStart(seat.id);

    const intersectPoint = e.point.clone();
    const meshPosition = new THREE.Vector3(
      seat.position.x,
      seat.position.y,
      seat.position.z
    );
    offsetRef.current.copy(meshPosition).sub(intersectPoint);
  }, [isDraggingEnabled, seat, onDragStart]);

  const handlePointerMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return;

    const rect = gl.domElement.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, camera);
    const intersectPoint = new THREE.Vector3();
    raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, intersectPoint);

    if (intersectPoint) {
      const newPosition = intersectPoint.add(offsetRef.current);
      onDrag(seat.id, newPosition);
    }
  }, [camera, gl, seat.id, onDrag]);

  const handlePointerUp = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      onDragEnd();
    }
  }, [onDragEnd]);

  useEffect(() => {
    if (isDraggingEnabled) {
      window.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('mouseup', handlePointerUp);
      return () => {
        window.removeEventListener('mousemove', handlePointerMove);
        window.removeEventListener('mouseup', handlePointerUp);
      };
    }
  }, [isDraggingEnabled, handlePointerMove, handlePointerUp]);

  if (!seat.isVisible) return null;

  return (
    <group
      ref={meshRef}
      position={[seat.position.x, seat.position.y, seat.position.z]}
      onPointerDown={handlePointerDown}
    >
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.5, 0.8, 0.05]} />
        <meshStandardMaterial
          color={getSeatColor()}
          transparent
          opacity={isDragging ? 0.6 : 0.9}
        />
      </mesh>

      <mesh position={[0, 0.05, 0.15]} castShadow>
        <boxGeometry args={[0.5, 0.1, 0.4]} />
        <meshStandardMaterial
          color={getSeatColor()}
          transparent
          opacity={isDragging ? 0.6 : 0.9}
        />
      </mesh>

      <mesh position={[0, eyeHeight, 0]}>
        <sphereGeometry args={[0.05]} />
        <meshBasicMaterial color={seat.isBlocked ? '#ef4444' : '#10b981'} />
      </mesh>

      {isDraggingEnabled && (
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.6, 1, 0.5]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}
    </group>
  );
}

export function Seats() {
  const seats = useFilteredSeats();
  const updateSeatPosition = useAppStore((state) => state.updateSeatPosition);
  const setSelectedSeat = useAppStore((state) => state.setSelectedSeat);
  const draggingSeatId = useAppStore((state) => state.selectedSeatId);

  const handleDragStart = useCallback((seatId: string) => {
    setSelectedSeat(seatId);
  }, [setSelectedSeat]);

  const handleDrag = useCallback((seatId: string, position: THREE.Vector3) => {
    updateSeatPosition(seatId, {
      x: Math.round(position.x * 2) / 2,
      y: 0,
      z: Math.round(position.z * 2) / 2,
    });
  }, [updateSeatPosition]);

  const handleDragEnd = useCallback(() => {
  }, []);

  return (
    <group>
      {seats.map((seat) => (
        <SeatMesh
          key={seat.id}
          seat={seat}
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          isDragging={draggingSeatId === seat.id}
        />
      ))}
    </group>
  );
}
