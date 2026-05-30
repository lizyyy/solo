import { OrthographicCamera, OrbitControls } from '@react-three/drei'
import { useGameStore } from '@/store/gameStore'
import Table3D from './Table3D'
import Waiter3D from './Waiter3D'
import KitchenExit3D from './KitchenExit3D'
import DishArea3D from './DishArea3D'
import PathRenderer from './PathRenderer'

function RestaurantScene() {
  const tables = useGameStore(s => s.tables)
  const waiters = useGameStore(s => s.waiters)

  return (
    <>
      <OrthographicCamera
        makeDefault
        position={[0, 12, 8]}
        zoom={45}
        near={0.1}
        far={100}
      />
      <OrbitControls
        target={[0, 0, 0]}
        maxPolarAngle={Math.PI / 2.5}
        minZoom={20}
        maxZoom={80}
      />

      <ambientLight color="#FFF5E1" intensity={0.4} />
      <pointLight position={[-4, 6, -2]} intensity={0.8} color="#FFF5E1" />
      <pointLight position={[4, 6, 2]} intensity={0.8} color="#FFF5E1" />
      <pointLight position={[0, 6, 0]} intensity={0.6} color="#FFFFFF" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[20, 14]} />
        <meshStandardMaterial color="#8B6914" metalness={0.05} roughness={0.8} />
      </mesh>

      <gridHelper args={[20, 20, '#666666', '#444444']} position={[0, 0.01, 0]} />

      {tables.map(table => (
        <Table3D key={table.id} table={table} />
      ))}

      {waiters.map(waiter => (
        <Waiter3D key={waiter.id} waiter={waiter} />
      ))}

      <KitchenExit3D />
      <DishArea3D />

      {waiters.map(waiter => {
        if (waiter.path.length < 2 || !waiter.currentTask) return null
        return (
          <PathRenderer
            key={`path-${waiter.id}`}
            path={waiter.path}
            routeType={waiter.currentTask.type}
          />
        )
      })}
    </>
  )
}

export default RestaurantScene
