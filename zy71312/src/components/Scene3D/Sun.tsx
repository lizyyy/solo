import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SunProps {
  latitude: number;
  timeOfDay?: number;
  dayOfYear?: number;
  showTrajectory?: boolean;
}

export const Sun: React.FC<SunProps> = ({
  latitude,
  timeOfDay = 12,
  dayOfYear = 172,
  showTrajectory = true,
}) => {
  const sunRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.DirectionalLight>(null);

  const sunPosition = useMemo(() => {
    const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
    const hourAngle = 15 * (timeOfDay - 12);

    const latRad = (latitude * Math.PI) / 180;
    const decRad = (declination * Math.PI) / 180;
    const haRad = (hourAngle * Math.PI) / 180;

    const sinAlt =
      Math.sin(latRad) * Math.sin(decRad) +
      Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
    const altitude = Math.asin(sinAlt);
    const cosAlt = Math.sqrt(1 - sinAlt * sinAlt);

    let cosAz =
      (Math.sin(decRad) * Math.cos(latRad) -
        Math.cos(decRad) * Math.sin(latRad) * Math.cos(haRad)) /
      cosAlt;
    cosAz = Math.max(-1, Math.min(1, cosAz));
    let azimuth = Math.acos(cosAz);
    if (hourAngle > 0) azimuth = 2 * Math.PI - azimuth;

    const radius = 30;
    const x = radius * Math.cos(altitude) * Math.sin(azimuth);
    const y = radius * Math.sin(altitude) + 5;
    const z = radius * Math.cos(altitude) * Math.cos(azimuth);

    return { x, y, z, altitude: (altitude * 180) / Math.PI };
  }, [latitude, timeOfDay, dayOfYear]);

  const trajectoryPoints = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
    const decRad = (declination * Math.PI) / 180;
    const latRad = (latitude * Math.PI) / 180;

    for (let hour = 6; hour <= 18; hour += 0.5) {
      const hourAngle = 15 * (hour - 12);
      const haRad = (hourAngle * Math.PI) / 180;

      const sinAlt =
        Math.sin(latRad) * Math.sin(decRad) +
        Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);

      if (sinAlt > 0) {
        const altitude = Math.asin(sinAlt);
        const cosAlt = Math.sqrt(1 - sinAlt * sinAlt);

        let cosAz =
          (Math.sin(decRad) * Math.cos(latRad) -
            Math.cos(decRad) * Math.sin(latRad) * Math.cos(haRad)) /
          cosAlt;
        cosAz = Math.max(-1, Math.min(1, cosAz));
        let azimuth = Math.acos(cosAz);
        if (hourAngle > 0) azimuth = 2 * Math.PI - azimuth;

        const radius = 30;
        const x = radius * Math.cos(altitude) * Math.sin(azimuth);
        const y = radius * Math.sin(altitude) + 5;
        const z = radius * Math.cos(altitude) * Math.cos(azimuth);

        points.push(new THREE.Vector3(x, y, z));
      }
    }

    return points;
  }, [latitude, dayOfYear]);

  useFrame(() => {
    if (sunRef.current) {
      sunRef.current.position.set(sunPosition.x, sunPosition.y, sunPosition.z);
    }
    if (lightRef.current) {
      lightRef.current.position.set(sunPosition.x, sunPosition.y, sunPosition.z);
      lightRef.current.target.position.set(0, 0, 0);
      lightRef.current.target.updateMatrixWorld();
    }
  });

  return (
    <group>
      <mesh ref={sunRef}>
        <sphereGeometry args={[2, 32, 32]} />
        <meshBasicMaterial color="#ffd700" />
      </mesh>

      <pointLight position={[sunPosition.x, sunPosition.y, sunPosition.z]} intensity={2} color="#fff5e0" distance={100} />

      <directionalLight
        ref={lightRef}
        position={[sunPosition.x, sunPosition.y, sunPosition.z]}
        intensity={Math.max(0, sunPosition.altitude / 60)}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={100}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />

      {showTrajectory && trajectoryPoints.length > 1 && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={trajectoryPoints.length}
              array={new Float32Array(
                trajectoryPoints.flatMap((p) => [p.x, p.y, p.z])
              )}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#ffb300" linewidth={2} opacity={0.6} transparent />
        </line>
      )}

      {trajectoryPoints.filter((_, i) => i % 4 === 0).map((point, index) => (
        <mesh key={index} position={[point.x, point.y, point.z]}>
          <sphereGeometry args={[0.3, 8, 8]} />
          <meshBasicMaterial color="#ffd700" opacity={0.5} transparent />
        </mesh>
      ))}
    </group>
  );
};
