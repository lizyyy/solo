import { useFrame } from '@react-three/fiber'
import useSceneStore from '../../store/useSceneStore'
import { getLightStateAtTime, getPositionAtTime } from '../../utils/conflictDetector'
import Intersection from './Intersection'
import Vehicle from './Vehicle'
import Pedestrian from './Pedestrian'
import TrafficLight from './TrafficLight'
import AccidentMarker from './AccidentMarker'
import ConflictMarker from './ConflictMarker'
import TrajectoryLine from './TrajectoryLine'

function Scene3D() {
  const {
    intersection,
    signalPhases,
    vehicles,
    pedestrians,
    accidentPoints,
    conflicts,
    currentTime,
    filters,
  } = useSceneStore()

  useFrame((_, delta) => {
    const { isPlaying, playSpeed, totalDuration, setCurrentTime } = useSceneStore.getState()
    if (isPlaying) {
      const newTime = useSceneStore.getState().currentTime + delta * playSpeed
      if (newTime >= totalDuration) {
        setCurrentTime(0)
      } else {
        setCurrentTime(newTime)
      }
    }
  })

  if (!intersection) return null

  return (
    <group>
      <Intersection intersection={intersection} />

      {filters.showTrafficLights &&
        signalPhases.map((phase) => {
          const light = intersection.trafficLights.find((l) => l.direction === phase.direction)
          if (!light) return null
          const state = getLightStateAtTime(phase, currentTime)
          return <TrafficLight key={phase.id} position={light.position} state={state} direction={phase.direction} />
        })}

      {filters.showTrajectories && (
        <>
          {vehicles.map((veh) => (
            <TrajectoryLine key={`traj-${veh.id}`} points={veh.points} color={veh.color} />
          ))}
          {pedestrians.map((ped) => (
            <TrajectoryLine key={`traj-${ped.id}`} points={ped.points} color="#f472b6" />
          ))}
        </>
      )}

      {filters.showVehicles &&
        vehicles.map((veh) => {
          const pos = getPositionAtTime(veh.points, currentTime)
          if (!pos) return null
          return <Vehicle key={veh.id} position={[pos.x, 0.5, pos.y]} color={veh.color} type={veh.type} rotation={pos.angle} />
        })}

      {filters.showPedestrians &&
        pedestrians.map((ped) => {
          const pos = getPositionAtTime(ped.points, currentTime)
          if (!pos) return null
          return <Pedestrian key={ped.id} position={[pos.x, 0.8, pos.y]} />
        })}

      {filters.showAccidentPoints &&
        accidentPoints.map((acc) => (
          <AccidentMarker
            key={acc.id}
            position={[acc.x, 0.1, acc.y]}
            visible={Math.abs(currentTime - acc.time) < 2}
          />
        ))}

      {filters.showConflicts &&
        conflicts.map((conflict) => (
          <ConflictMarker
            key={conflict.id}
            position={[conflict.x, 0.5, conflict.y]}
            severity={conflict.severity}
            visible={Math.abs(currentTime - conflict.time) < 3}
          />
        ))}
    </group>
  )
}

export default Scene3D
