import { Line } from '@react-three/drei';
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
        const points = route.points.map(p => [p.x, p.y + 0.5, p.z] as [number, number, number]);
        const isSelected = selectedRoute === route.id;
        
        const handleClick = (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          selectRoute(isSelected ? null : route.id);
        };

        return (
          <group key={route.id}>
            <Line
              points={points}
              color={isSelected ? '#FFD700' : route.color}
              lineWidth={isSelected ? 4 : 2}
            />
            
            {route.points.map((point, i) => (
              <mesh
                key={i}
                position={[point.x, point.y + 0.5, point.z]}
                onClick={handleClick}
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
