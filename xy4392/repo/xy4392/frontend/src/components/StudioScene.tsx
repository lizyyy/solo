import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { 
  OrbitControls, 
  TransformControls,
  Grid,
  GizmoHelper,
  GizmoViewport,
  PerspectiveCamera
} from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '@/store'
import { PlacedLight, Actor, Camera, StudioDimensions, Vec3 } from '@/types'
import { lightApi, actorApi, cameraApi } from '@/services/api'

interface LightMeshProps {
  light: PlacedLight
  isSelected: boolean
  onSelect: (id: string) => void
  onDragEnd: (id: string, position: Vec3, rotation: Vec3) => void
}

function LightMesh({ light, isSelected, onSelect, onDragEnd }: LightMeshProps) {
  const meshRef = useRef<THREE.Group>(null)
  const transformRef = useRef<any>(null)
  const { currentPlanId, editor } = useStore()
  const { setDragging } = useStore(state => ({
    setDragging: state.setDragging
  }))

  const color = useMemo(() => {
    if (light.color.startsWith('#')) {
      return new THREE.Color(light.color)
    }
    const temp = light.colorTemp
    if (temp <= 4000) {
      return new THREE.Color(1, (temp - 2000) / 2000, (temp - 2000) / 4000)
    }
    return new THREE.Color((8000 - temp) / 4000, 1, 1)
  }, [light.color, light.colorTemp])

  useEffect(() => {
    if (transformRef.current) {
      const controls = transformRef.current
      const onDragStart = () => setDragging(true)
      const onDragEnd = () => {
        setDragging(false)
        if (meshRef.current) {
          const pos = meshRef.current.position
          const rot = meshRef.current.rotation
          onDragEnd(light.id, 
            { x: pos.x, y: pos.y, z: pos.z },
            { x: rot.x, y: rot.y, z: rot.z }
          )
        }
      }
      controls.addEventListener('dragging-changed', (event: any) => {
        if (event.value) onDragStart()
      })
      controls.addEventListener('objectChange', onDragEnd)
      return () => {
        controls.removeEventListener('dragging-changed', onDragStart)
        controls.removeEventListener('objectChange', onDragEnd)
      }
    }
  }, [transformRef, light.id, onDragEnd, setDragging])

  if (!meshRef.current) {
    return (
      <group ref={meshRef} position={[light.position.x, light.position.y, light.position.z]}>
        <mesh
          onClick={(e) => {
            e.stopPropagation()
            onSelect(light.id)
          }}
        >
          <boxGeometry args={[0.3, 0.2, 0.3]} />
          <meshStandardMaterial 
            color={color} 
            emissive={color}
            emissiveIntensity={light.intensity * 0.5}
          />
        </mesh>
        
        <mesh position={[0, -light.standHeight / 2, 0]}>
          <cylinderGeometry args={[0.03, 0.03, light.standHeight, 8]} />
          <meshStandardMaterial color="#555" metalness={0.8} />
        </mesh>
        
        <mesh position={[0, -light.standHeight, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.02, 16]} />
          <meshStandardMaterial color="#333" metalness={0.5} />
        </mesh>

        {light.isHighTemp && (
          <mesh position={[0, 0.2, 0]}>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={1} transparent opacity={0.8} />
          </mesh>
        )}

        <pointLight 
          color={color} 
          intensity={light.intensity * 10} 
          distance={15}
          position={[0, 0, 0]}
        />
      </group>
    )
  }

  return (
    <>
      <group ref={meshRef} position={[light.position.x, light.position.y, light.position.z]}>
        <mesh
          onClick={(e) => {
            e.stopPropagation()
            onSelect(light.id)
          }}
        >
          <boxGeometry args={[0.3, 0.2, 0.3]} />
          <meshStandardMaterial 
            color={color} 
            emissive={color}
            emissiveIntensity={light.intensity * 0.5}
          />
        </mesh>
        
        <mesh position={[0, -light.standHeight / 2, 0]}>
          <cylinderGeometry args={[0.03, 0.03, light.standHeight, 8]} />
          <meshStandardMaterial color="#555" metalness={0.8} />
        </mesh>
        
        <mesh position={[0, -light.standHeight, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.02, 16]} />
          <meshStandardMaterial color="#333" metalness={0.5} />
        </mesh>

        {light.isHighTemp && (
          <mesh position={[0, 0.2, 0]}>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={1} transparent opacity={0.8} />
          </mesh>
        )}

        <pointLight 
          color={color} 
          intensity={light.intensity * 10} 
          distance={15}
          position={[0, 0, 0]}
        />
      </group>

      {isSelected && meshRef.current && (
        <TransformControls
          ref={transformRef}
          object={meshRef.current}
          mode="translate"
          size={0.8}
        />
      )}
    </>
  )
}

interface ActorMeshProps {
  actor: Actor
  isSelected: boolean
  onSelect: (id: string) => void
  onDragEnd: (id: string, position: Vec3, rotation: Vec3) => void
}

function ActorMesh({ actor, isSelected, onSelect, onDragEnd }: ActorMeshProps) {
  const meshRef = useRef<THREE.Group>(null)
  const transformRef = useRef<any>(null)
  const { setDragging } = useStore(state => ({
    setDragging: state.setDragging
  }))

  useEffect(() => {
    if (transformRef.current) {
      const controls = transformRef.current
      const onDragStart = () => setDragging(true)
      const onDragEndEvent = () => {
        setDragging(false)
        if (meshRef.current) {
          const pos = meshRef.current.position
          const rot = meshRef.current.rotation
          onDragEnd(actor.id, 
            { x: pos.x, y: pos.y, z: pos.z },
            { x: rot.x, y: rot.y, z: rot.z }
          )
        }
      }
      controls.addEventListener('dragging-changed', (event: any) => {
        if (event.value) onDragStart()
      })
      controls.addEventListener('objectChange', onDragEndEvent)
      return () => {
        controls.removeEventListener('dragging-changed', onDragStart)
        controls.removeEventListener('objectChange', onDragEndEvent)
      }
    }
  }, [transformRef, actor.id, onDragEnd, setDragging])

  return (
    <>
      <group 
        ref={meshRef} 
        position={[actor.position.x, actor.position.y, actor.position.z]}
        rotation={[actor.rotation.x, actor.rotation.y, actor.rotation.z]}
      >
        <group onClick={(e) => { e.stopPropagation(); onSelect(actor.id) }}>
          <mesh position={[0, 1.3, 0]}>
            <capsuleGeometry args={[0.25, 0.8, 8, 16]} />
            <meshStandardMaterial color={isSelected ? '#1890ff' : '#13c2c2'} />
          </mesh>
          
          <mesh position={[0, 2, 0]}>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshStandardMaterial color="#ffd699" />
          </mesh>

          <mesh position={[0, 2.1, 0.15]}>
            <coneGeometry args={[0.12, 0.1, 4]} rotation={[Math.PI, 0, 0]} />
            <meshStandardMaterial color="#333" />
          </mesh>
        </group>

        {actor.walkPath && actor.walkPath.length > 0 && (
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={actor.walkPath.length + 1}
                array={new Float32Array([
                  actor.position.x, actor.position.y, actor.position.z,
                  ...actor.walkPath.flatMap(p => [p.x, p.y, p.z])
                ])}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#13c2c2" linewidth={2} dashed />
          </line>
        )}
      </group>

      {isSelected && meshRef.current && (
        <TransformControls
          ref={transformRef}
          object={meshRef.current}
          mode="translate"
          size={0.8}
        />
      )}
    </>
  )
}

interface CameraMeshProps {
  camera: Camera
  isSelected: boolean
  onSelect: (id: string) => void
  onDragEnd: (id: string, position: Vec3, rotation: Vec3) => void
}

function CameraMesh({ camera, isSelected, onSelect, onDragEnd }: CameraMeshProps) {
  const meshRef = useRef<THREE.Group>(null)
  const transformRef = useRef<any>(null)
  const { setDragging } = useStore(state => ({
    setDragging: state.setDragging
  }))

  useEffect(() => {
    if (transformRef.current) {
      const controls = transformRef.current
      const onDragStart = () => setDragging(true)
      const onDragEndEvent = () => {
        setDragging(false)
        if (meshRef.current) {
          const pos = meshRef.current.position
          const rot = meshRef.current.rotation
          onDragEnd(camera.id, 
            { x: pos.x, y: pos.y, z: pos.z },
            { x: rot.x, y: rot.y, z: rot.z }
          )
        }
      }
      controls.addEventListener('dragging-changed', (event: any) => {
        if (event.value) onDragStart()
      })
      controls.addEventListener('objectChange', onDragEndEvent)
      return () => {
        controls.removeEventListener('dragging-changed', onDragStart)
        controls.removeEventListener('objectChange', onDragEndEvent)
      }
    }
  }, [transformRef, camera.id, onDragEnd, setDragging])

  const viewDirection = useMemo(() => {
    const yaw = camera.rotation.y
    return new THREE.Vector3(
      Math.sin(yaw),
      Math.sin(camera.rotation.x),
      Math.cos(yaw)
    ).normalize()
  }, [camera.rotation])

  return (
    <>
      <group 
        ref={meshRef} 
        position={[camera.position.x, camera.position.y, camera.position.z]}
        rotation={[camera.rotation.x, camera.rotation.y, camera.rotation.z]}
      >
        <group onClick={(e) => { e.stopPropagation(); onSelect(camera.id) }}>
          <mesh>
            <boxGeometry args={[0.25, 0.2, 0.35]} />
            <meshStandardMaterial color={isSelected ? '#1890ff' : '#333'} metalness={0.7} />
          </mesh>
          
          <mesh position={[0, 0, 0.2]}>
            <cylinderGeometry args={[0.08, 0.08, 0.15, 16]} rotation={[Math.PI / 2, 0, 0]} />
            <meshStandardMaterial color="#111" metalness={0.9} />
          </mesh>

          <mesh position={[0.1, 0.08, 0]}>
            <boxGeometry args={[0.04, 0.04, 0.02]} />
            <meshStandardMaterial color="#ff4444" emissive="#ff0000" emissiveIntensity={0.5} />
          </mesh>

          <mesh position={[0, -0.4, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.6, 8]} />
            <meshStandardMaterial color="#555" metalness={0.8} />
          </mesh>

          <mesh position={[0, -0.75, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 0.02, 16]} />
            <meshStandardMaterial color="#333" metalness={0.5} />
          </mesh>
        </group>

        <mesh position={[0, 0, 1.5]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.32, 32]} />
          <meshBasicMaterial color={isSelected ? '#1890ff' : '#888'} side={THREE.DoubleSide} />
        </mesh>

        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([
                0, 0, 0.2,
                viewDirection.x * 10,
                viewDirection.y * 10 + camera.position.y,
                viewDirection.z * 10
              ])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={isSelected ? '#1890ff' : '#666'} transparent opacity={0.5} />
        </line>
      </group>

      {isSelected && meshRef.current && (
        <TransformControls
          ref={transformRef}
          object={meshRef.current}
          mode="translate"
          size={0.8}
        />
      )}
    </>
  )
}

interface StudioFloorProps {
  dimensions: StudioDimensions
}

function StudioFloor({ dimensions }: StudioFloorProps) {
  const halfW = dimensions.width / 2
  const halfD = dimensions.depth / 2
  const height = dimensions.height

  return (
    <group>
      <Grid
        args={[dimensions.width, dimensions.depth]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#444"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#666"
        fadeDistance={50}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={false}
        position={[0, 0.01, 0]}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[dimensions.width, dimensions.depth]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
      </mesh>

      <mesh position={[0, height / 2, -halfD]}>
        <planeGeometry args={[dimensions.width, height]} />
        <meshStandardMaterial color="#2a2a2a" side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[0, height / 2, halfD]}>
        <planeGeometry args={[dimensions.width, height]} />
        <meshStandardMaterial color="#2a2a2a" side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[-halfW, height / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[dimensions.depth, height]} />
        <meshStandardMaterial color="#2a2a2a" side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[halfW, height / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[dimensions.depth, height]} />
        <meshStandardMaterial color="#2a2a2a" side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[dimensions.width, dimensions.depth]} />
        <meshStandardMaterial color="#1e1e1e" side={THREE.DoubleSide} />
      </mesh>

      <lineSegments>
        <edgesGeometry>
          <boxGeometry args={[dimensions.width, height, dimensions.depth]} />
        </edgesGeometry>
        <lineBasicMaterial color="#555" transparent opacity={0.3} />
      </lineSegments>
    </group>
  )
}

interface SceneContentProps {
  dimensions: StudioDimensions
  lights: PlacedLight[]
  actors: Actor[]
  cameras: Camera[]
}

function SceneContent({ dimensions, lights, actors, cameras }: SceneContentProps) {
  const { editor, currentPlanId, updateLight, updateActor, updateCamera, setSelectedObject } = useStore(state => ({
    editor: state.editor,
    currentPlanId: state.currentPlanId,
    updateLight: state.updateLight,
    updateActor: state.updateActor,
    updateCamera: state.updateCamera,
    setSelectedObject: state.setSelectedObject
  }))

  const handleLightSelect = (id: string) => {
    setSelectedObject(id, 'light')
  }

  const handleActorSelect = (id: string) => {
    setSelectedObject(id, 'actor')
  }

  const handleCameraSelect = (id: string) => {
    setSelectedObject(id, 'camera')
  }

  const handleLightDragEnd = async (id: string, position: Vec3, rotation: Vec3) => {
    updateLight(id, { position, rotation })
    if (currentPlanId) {
      try {
        await lightApi.update(currentPlanId, id, { position, rotation })
      } catch (e) {
        console.error('Failed to save light position', e)
      }
    }
  }

  const handleActorDragEnd = async (id: string, position: Vec3, rotation: Vec3) => {
    updateActor(id, { position, rotation })
    if (currentPlanId) {
      try {
        await actorApi.update(currentPlanId, id, { position, rotation })
      } catch (e) {
        console.error('Failed to save actor position', e)
      }
    }
  }

  const handleCameraDragEnd = async (id: string, position: Vec3, rotation: Vec3) => {
    updateCamera(id, { position, rotation })
    if (currentPlanId) {
      try {
        await cameraApi.update(currentPlanId, id, { position, rotation })
      } catch (e) {
        console.error('Failed to save camera position', e)
      }
    }
  }

  return (
    <>
      <StudioFloor dimensions={dimensions} />

      {lights.map(light => (
        <LightMesh
          key={light.id}
          light={light}
          isSelected={editor.selectedObjectId === light.id && editor.selectedType === 'light'}
          onSelect={handleLightSelect}
          onDragEnd={handleLightDragEnd}
        />
      ))}

      {actors.map(actor => (
        <ActorMesh
          key={actor.id}
          actor={actor}
          isSelected={editor.selectedObjectId === actor.id && editor.selectedType === 'actor'}
          onSelect={handleActorSelect}
          onDragEnd={handleActorDragEnd}
        />
      ))}

      {cameras.map(camera => (
        <CameraMesh
          key={camera.id}
          camera={camera}
          isSelected={editor.selectedObjectId === camera.id && editor.selectedType === 'camera'}
          onSelect={handleCameraSelect}
          onDragEnd={handleCameraDragEnd}
        />
      ))}

      <ambientLight intensity={0.2} />
    </>
  )
}

interface StudioSceneProps {
  dimensions: StudioDimensions
  lights: PlacedLight[]
  actors: Actor[]
  cameras: Camera[]
}

export default function StudioScene({ dimensions, lights, actors, cameras }: StudioSceneProps) {
  const { setSelectedObject } = useStore(state => ({
    setSelectedObject: state.setSelectedObject
  }))

  const handleCanvasClick = () => {
    setSelectedObject(null, null)
  }

  return (
    <div className="three-canvas" onClick={handleCanvasClick}>
      <Canvas
        shadows
        camera={{ position: [15, 12, 15], fov: 50 }}
      >
        <PerspectiveCamera makeDefault position={[15, 12, 15]} fov={50} />
        <OrbitControls
          makeDefault
          minDistance={2}
          maxDistance={100}
          maxPolarAngle={Math.PI / 2}
        />

        <SceneContent
          dimensions={dimensions}
          lights={lights}
          actors={actors}
          cameras={cameras}
        />

        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport axisColors={['#ff4d4f', '#52c41a', '#1890ff']} labelColor="#fff" />
        </GizmoHelper>
      </Canvas>
    </div>
  )
}
