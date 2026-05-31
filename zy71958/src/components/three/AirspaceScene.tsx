import { useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useRecordsStore } from '../../store/useRecordsStore';
import { RouteLine } from './RouteLine';
import { NoFlyZoneMesh } from './NoFlyZoneMesh';
import { Coordinate, RouteVersion } from '../../types';
import { getCenterCoordinate } from '../../utils/geo';

interface AirspaceSceneProps {
  height?: string;
}

export function AirspaceScene({ height = '100%' }: AirspaceSceneProps) {
  const {
    records,
    noFlyZones,
    selectedRecordId,
    getCurrentRouteVersion,
    getCompareRoutes,
    selectRecord,
  } = useRecordsStore();

  const allRoutes = useMemo(() => {
    return records
      .map((r) => getCurrentRouteVersion(r.id))
      .filter((v): v is RouteVersion => v !== undefined);
  }, [records, getCurrentRouteVersion]);

  const compareRoutes = getCompareRoutes();

  const sceneCenter = useMemo(() => {
    const allCoords: Coordinate[] = [];
    allRoutes.forEach((route) => {
      allCoords.push(...route.routeData.coordinates);
    });
    noFlyZones.forEach((zone) => {
      allCoords.push(zone.center);
    });
    return allCoords.length > 0 ? getCenterCoordinate(allCoords) : { lat: 0, lng: 0, alt: 0 };
  }, [allRoutes, noFlyZones]);

  const selectedRoute = selectedRecordId ? getCurrentRouteVersion(selectedRecordId) : undefined;

  return (
    <div style={{ width: '100%', height, background: '#0F172A' }}>
      <Canvas
        camera={{ position: [5, 8, 5], fov: 60 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: 'linear-gradient(to bottom, #0F172A 0%, #1E293B 100%)' }}
      >
        <ambientLight intensity={0.3} />
        <directionalLight position={[10, 20, 10]} intensity={0.8} castShadow />
        <pointLight position={[-10, 10, -10]} intensity={0.4} color="#3B82F6" />

        <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={0.5} />

        <gridHelper args={[20, 20, '#334155', '#1E293B']} position={[0, 0, 0]} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#0F172A" transparent opacity={0.5} />
        </mesh>

        {noFlyZones.map((zone) => (
          <NoFlyZoneMesh
            key={zone.id}
            zone={zone}
            center={sceneCenter}
            highlighted={
              selectedRoute?.routeData.coordinates.some(
                (c) =>
                  Math.abs(c.lat - zone.center.lat) < 0.01 &&
                  Math.abs(c.lng - zone.center.lng) < 0.01
              ) || false
            }
          />
        ))}

        {compareRoutes.length === 2 ? (
          <>
            <RouteLine
              route={compareRoutes[0].routeData}
              center={sceneCenter}
              color="#3B82F6"
              opacity={0.9}
              showPoints={false}
            />
            <RouteLine
              route={compareRoutes[1].routeData}
              center={sceneCenter}
              color="#10B981"
              opacity={0.9}
              showPoints={false}
            />
          </>
        ) : (
          allRoutes.map((route) => {
            const isSelected = route.recordId === selectedRecordId;
            const hasIssue = useRecordsStore
              .getState()
              .issues.some((i) => i.recordId === route.recordId && i.status === 'open');
            return (
              <RouteLine
                key={route.id}
                route={route.routeData}
                center={sceneCenter}
                color={hasIssue ? '#EF4444' : isSelected ? '#F97316' : '#64748B'}
                opacity={isSelected ? 1 : hasIssue ? 0.8 : 0.5}
                selected={isSelected}
                onClick={() => selectRecord(route.recordId)}
                showPoints={isSelected}
              />
            );
          })
        )}

        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={2}
          maxDistance={30}
          maxPolarAngle={Math.PI / 2 - 0.1}
        />

        <EffectComposer>
          <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} height={300} intensity={0.5} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
