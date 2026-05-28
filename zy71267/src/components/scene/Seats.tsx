import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Seat, AcousticReading, DisplayParameter } from '../../data/models/acoustic';
import type { Anomaly } from '../../data/models/anomalies';
import { getParameterColor } from '../../utils/colorMap';
import { vec3ToArray } from '../../utils/geometryBuilder';

interface SeatsProps {
  seats: Seat[];
  readings: AcousticReading[];
  displayParam: DisplayParameter;
  selectedSeatId: string | null;
  hoveredSeatId: string | null;
  anomalies: Anomaly[];
  onSeatClick: (seatId: string | null) => void;
  onSeatHover: (seatId: string | null) => void;
}

const SEAT_SIZE = 0.5;
const SEAT_HEIGHT = 0.4;

export function Seats({
  seats,
  readings,
  displayParam,
  selectedSeatId,
  hoveredSeatId,
  anomalies,
  onSeatClick,
  onSeatHover,
}: SeatsProps) {
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const samplingErrorIds = useMemo(() => {
    const ids = new Set<string>();
    anomalies
      .filter((a) => a.type === 'seat_sampling_error')
      .forEach((a) => a.affectedIds.forEach((id) => ids.add(id)));
    return ids;
  }, [anomalies]);

  const noReadingIds = useMemo(() => {
    const ids = new Set<string>();
    anomalies
      .filter((a) => a.type === 'seat_no_reading')
      .forEach((a) => a.affectedIds.forEach((id) => ids.add(id)));
    return ids;
  }, [anomalies]);

  const { geometry, colors } = useMemo(() => {
    const seatGeometry = new THREE.BoxGeometry(SEAT_SIZE, SEAT_HEIGHT, SEAT_SIZE);
    const colorsArray = new Float32Array(seats.length * 3);
    const readingMap = new Map(readings.map((r) => [r.seatId, r]));

    seats.forEach((seat, index) => {
      const reading = readingMap.get(seat.id);
      let color: THREE.Color;

      if (samplingErrorIds.has(seat.id)) {
        color = new THREE.Color(0xff0000);
      } else if (noReadingIds.has(seat.id) || !reading) {
        color = new THREE.Color(0x666666);
      } else {
        const value = reading[displayParam];
        color = getParameterColor(value, displayParam, true);
      }

      colorsArray[index * 3] = color.r;
      colorsArray[index * 3 + 1] = color.g;
      colorsArray[index * 3 + 2] = color.b;
    });

    seatGeometry.setAttribute('color', new THREE.InstancedBufferAttribute(colorsArray, 3));

    return { geometry: seatGeometry, colors: colorsArray };
  }, [seats, readings, displayParam, samplingErrorIds, noReadingIds]);

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.1,
      roughness: 0.6,
      transparent: true,
      opacity: 0.9,
    });
  }, []);

  useFrame((state) => {
    if (!instancedMeshRef.current) return;

    const time = state.clock.getElapsedTime();

    seats.forEach((seat, index) => {
      const isSelected = seat.id === selectedSeatId;
      const isHovered = seat.id === hoveredSeatId;
      const hasError = samplingErrorIds.has(seat.id);

      dummy.position.set(
        seat.position.x,
        seat.position.y + SEAT_HEIGHT / 2 + (isSelected ? 0.2 : 0) + (isHovered ? 0.1 : 0),
        seat.position.z
      );

      if (isSelected) {
        dummy.scale.setScalar(1.15 + Math.sin(time * 4) * 0.05);
      } else if (isHovered) {
        dummy.scale.setScalar(1.08);
      } else if (hasError) {
        dummy.scale.setScalar(1 + Math.sin(time * 6) * 0.1);
      } else {
        dummy.scale.setScalar(1);
      }

      dummy.updateMatrix();
      instancedMeshRef.current!.setMatrixAt(index, dummy.matrix);
    });

    instancedMeshRef.current.instanceMatrix.needsUpdate = true;
  });

  const handlePointerDown = (event: any) => {
    event.stopPropagation();
    const instanceId = event.instanceId as number;
    if (instanceId !== undefined && seats[instanceId]) {
      onSeatClick(seats[instanceId].id);
    }
  };

  const handlePointerMove = (event: any) => {
    event.stopPropagation();
    const instanceId = event.instanceId as number;
    if (instanceId !== undefined && seats[instanceId]) {
      onSeatHover(seats[instanceId].id);
      document.body.style.cursor = 'pointer';
    }
  };

  const handlePointerOut = () => {
    onSeatHover(null);
    document.body.style.cursor = 'default';
  };

  return (
    <group>
      <instancedMesh
        ref={instancedMeshRef}
        args={[geometry, material, seats.length]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
      />

      {selectedSeatId && (() => {
        const seat = seats.find((s) => s.id === selectedSeatId);
        if (!seat) return null;
        return (
          <group position={vec3ToArray(seat.position)}>
            <mesh position={[0, SEAT_HEIGHT + 0.3, 0]}>
              <ringGeometry args={[0.6, 0.7, 32]} />
              <meshBasicMaterial color="#1e88e5" transparent opacity={0.8} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, SEAT_HEIGHT + 0.3, 0]} rotation={[0, Math.PI / 4, 0]}>
              <ringGeometry args={[0.6, 0.7, 32]} />
              <meshBasicMaterial color="#1e88e5" transparent opacity={0.6} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })()}

      {seats
        .filter((s) => s.isVip && !samplingErrorIds.has(s.id))
        .map((seat) => (
          <mesh
            key={`vip-${seat.id}`}
            position={[seat.position.x, seat.position.y + SEAT_HEIGHT + 0.05, seat.position.z]}
          >
            <cylinderGeometry args={[0.02, 0.02, 0.15, 8]} />
            <meshStandardMaterial color="#ffd700" emissive="#ffaa00" emissiveIntensity={0.5} />
          </mesh>
        ))}
    </group>
  );
}
