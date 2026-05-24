import { useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '../store/useStore';

export function PatrolRoutes() {
  const routes = useStore(state => state.routes);
  const showRoutes = useStore(state => state.showRoutes);
  const selectedRoute = useStore(state => state.selectedRoute);
  const selectRoute = useStore(state => state.selectRoute);

  const enabledRoutes = routes.filter(r => r.enabled);

  if (!showRoutes) return null;

  return (
    <>
      {enabledRoutes.map(route => {
        const points = route.points.map(p => new THREE.Vector3(p.x, p.y + 0.5, p.z));
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const isSelected = selectedRoute === route.id;
        
        return (
          <group key={route.id}>
            <line
              geometry={lineGeometry}
              onClick={(e) => {
                e.stopPropagation();
                selectRoute(isSelected ? null : route.id);
              }}
            >
              <lineBasicMaterial
                color={isSelected ? '#FFD700' : route.color}
                linewidth={isSelected ? 4 : 2}
              />
            </line>
            
            {route.points.map((point, i) => (
              <mesh
                key={i}
                position={[point.x, point.y + 0.5, point.z]}
                onClick={(e) => {
                  e.stopPropagation();
                  selectRoute(isSelected ? null : route.id);
                }}
              >
                <sphereGeometry args={[isSelected ? 0.8 : 0.5, 16, 16]} />
                <meshBasicMaterial color={isSelected ? '#FFD700' : route.color} />
              </mesh>
            ))}
          </group>
        );
      })}
    </>
  );
}
