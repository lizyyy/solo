import { useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom, FXAA } from '@react-three/postprocessing'
import { useProjectStore } from '@/store'
import { interpolateActorPosition } from '@/utils/collisionDetection'
import { StageFloor } from './StageFloor'
import { LightCone } from './LightCone'
import { ActorModel } from './ActorModel'
import { PropModel } from './PropModel'
import { TrajectoryLine } from './TrajectoryLine'

function SceneContent() {
  const {
    scene,
    lights,
    actors,
    props,
    trajectories,
    filters,
    playback,
    selectedElement,
    setSelectedElement,
    setCurrentTime,
    actorLightStatus,
    occlusionResults,
  } = useProjectStore()

  const controlsRef = useRef<any>(null)

  useFrame((_, delta) => {
    if (playback.isPlaying) {
      const newTime = playback.currentTime + delta * playback.speed
      if (newTime >= playback.duration) {
        setCurrentTime(0)
      } else {
        setCurrentTime(newTime)
      }
    }
  })

  const getActorPosition = (actorId: string) => {
    const trajectory = trajectories.find((t) => t.actorId === actorId)
    const actor = actors.find((a) => a.id === actorId)
    if (trajectory) {
      return interpolateActorPosition(trajectory, playback.currentTime, actor?.height || 1.7)
    }
    return { x: 0, y: (actor?.height || 1.7) / 2, z: 0 }
  }

  const isActorInLight = (actorId: string) => {
    const status = actorLightStatus.find((s) => s.actorId === actorId)
    return status?.inLightCone ?? true
  }

  const isPropOccluded = (propId: string) => {
    return occlusionResults.some((o) => o.propId === propId)
  }

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 20, 10]} intensity={0.5} castShadow />

      <StageFloor width={scene.stageWidth} depth={scene.stageDepth} />

      {filters.lights &&
        lights.map((light) => (
          <LightCone
            key={light.id}
            light={light}
            selected={selectedElement?.type === 'light' && selectedElement.id === light.id}
            onClick={() =>
              setSelectedElement({
                type: 'light',
                id: light.id,
              })
            }
          />
        ))}

      {filters.trajectories &&
        trajectories.map((trajectory, index) => {
          const actor = actors.find((a) => a.id === trajectory.actorId)
          return (
            <TrajectoryLine
              key={trajectory.id}
              trajectory={trajectory}
              selected={selectedElement?.type === 'trajectory' && selectedElement.id === trajectory.id}
              currentTime={playback.currentTime}
              color={actor?.color || `hsl(${(index * 60) % 360}, 70%, 60%)`}
            />
          )
        })}

      {filters.actors &&
        actors.map((actor) => (
          <ActorModel
            key={actor.id}
            actor={actor}
            position={getActorPosition(actor.id)}
            selected={selectedElement?.type === 'actor' && selectedElement.id === actor.id}
            inLight={isActorInLight(actor.id)}
            onClick={() =>
              setSelectedElement({
                type: 'actor',
                id: actor.id,
              })
            }
          />
        ))}

      {filters.props &&
        props.map((prop) => (
          <PropModel
            key={prop.id}
            prop={prop}
            selected={selectedElement?.type === 'prop' && selectedElement.id === prop.id}
            occluded={isPropOccluded(prop.id)}
            onClick={() =>
              setSelectedElement({
                type: 'prop',
                id: prop.id,
              })
            }
          />
        ))}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        minDistance={3}
        maxDistance={50}
        maxPolarAngle={Math.PI / 2 + 0.1}
      />

      <EffectComposer>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={0.5} />
        <FXAA />
      </EffectComposer>
    </>
  )
}

export function StageScene() {
  const { setSelectedElement } = useProjectStore()

  return (
    <Canvas
      camera={{ position: [15, 12, 15], fov: 45 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onClick={() => setSelectedElement(null)}
    >
      <color attach="background" args={['#0d0d1a']} />
      <fog attach="fog" args={['#0d0d1a', 20, 60]} />
      <SceneContent />
    </Canvas>
  )
}
