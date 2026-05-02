import React, { useRef, useMemo, useState } from 'react'
import { OrbitControls, Grid, Text, Line } from '@react-three/drei'
import * as THREE from 'three'
import { Segment, Crane, Obstacle, Keyframe, CollisionResult, Vector3D } from '@/types'
import { vec3 } from '@/utils/math'

interface ShipyardSceneProps {
  segments: Segment[]
  crane: Crane
  obstacles: Obstacle[]
  keyframes: Keyframe[]
  currentKeyframeIndex: number
  collisionResults: CollisionResult[]
  onSegmentDrag?: (segmentId: string, position: Vector3D) => void
  onKeyframeDrag?: (keyframeId: string, position: Vector3D) => void
}

const ShipyardGround: React.FC = () => {
  return (
    <group>
      <Grid
        position={[0, -0.01, 0]}
        args={[200, 200]}
        cellSize={5}
        cellThickness={0.5}
        cellColor="#4a5568"
        sectionSize={20}
        sectionThickness={1}
        sectionColor="#2d3748"
        fadeDistance={300}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={false}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#1a202c" />
      </mesh>
    </group>
  )
}

const ShipDock: React.FC = () => {
  const dockLength = 100
  const dockWidth = 40
  const dockHeight = 5

  return (
    <group position={[0, dockHeight / 2, 0]}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[dockLength, dockHeight, dockWidth]} />
        <meshStandardMaterial color="#4a5568" metalness={0.3} roughness={0.7} />
      </mesh>
      <mesh position={[-dockLength / 2 - 5, dockHeight, 0]}>
        <boxGeometry args={[10, 15, 80]} />
        <meshStandardMaterial color="#718096" />
      </mesh>
      <mesh position={[dockLength / 2 + 5, dockHeight, 0]}>
        <boxGeometry args={[10, 15, 80]} />
        <meshStandardMaterial color="#718096" />
      </mesh>
    </group>
  )
}

const CraneModel: React.FC<{ crane: Crane; targetPosition?: Vector3D }> = ({ crane, targetPosition }) => {
  const boomAngle = useMemo(() => {
    if (!targetPosition) return 45
    const radius = vec3.distance2D(crane.position, targetPosition)
    const height = targetPosition.y - crane.position.y
    return Math.atan2(height, radius) * (180 / Math.PI)
  }, [crane, targetPosition])

  const radius = useMemo(() => {
    if (!targetPosition) return 25
    return vec3.distance2D(crane.position, targetPosition)
  }, [crane, targetPosition])

  const slewAngle = useMemo(() => {
    if (!targetPosition) return 0
    const dx = targetPosition.x - crane.position.x
    const dz = targetPosition.z - crane.position.z
    return Math.atan2(dx, dz)
  }, [crane, targetPosition])

  return (
    <group position={[crane.position.x, crane.position.y, crane.position.z]}>
      <mesh position={[0, 5, 0]}>
        <cylinderGeometry args={[6, 8, 10, 8]} />
        <meshStandardMaterial color={crane.color} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 10, 0]}>
        <boxGeometry args={[15, 4, 8]} />
        <meshStandardMaterial color={crane.color} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 12, 0]}>
        <boxGeometry args={[12, 3, 6]} />
        <meshStandardMaterial color="#f0f0f0" metalness={0.8} roughness={0.2} />
      </mesh>
      <group rotation={[0, slewAngle, 0]}>
        <group position={[0, 12, 0]} rotation={[-boomAngle * Math.PI / 180, 0, 0]}>
          <mesh position={[0, crane.boomLength / 2, 0]}>
            <boxGeometry args={[1.5, crane.boomLength, 1.5]} />
            <meshStandardMaterial color="#f5a623" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[0, crane.boomLength, 0]}>
            <sphereGeometry args={[0.8, 16, 16]} />
            <meshStandardMaterial color="#ffd700" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
        <group position={[0, 12, 0]}>
          <Line
            points={[
              [0, 0, 0],
              [
                Math.sin(boomAngle * Math.PI / 180) * radius,
                Math.cos(boomAngle * Math.PI / 180) * radius,
                0
              ]
            ]}
            color="#ffd700"
            lineWidth={2}
            dashed={false}
          />
        </group>
      </group>
      <Text
        position={[0, 25, 0]}
        color="#ffffff"
        fontSize={2}
        anchorX="center"
        anchorY="middle"
      >
        {crane.name}
      </Text>
      <mesh position={[0, 20, 0]}>
        <ringGeometry args={[crane.minRadius, crane.maxRadius, 64]} rotation={[-Math.PI / 2, 0, 0]} />
        <meshBasicMaterial color="#ff6b6b" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

const SegmentModel: React.FC<{
  segment: Segment
  position: Vector3D
  rotation: Vector3D
  isSelected?: boolean
  hasCollision?: boolean
  onDrag?: (position: Vector3D) => void
}> = ({ segment, position, rotation, isSelected, hasCollision, onDrag }) => {
  const [hovered, setHovered] = useState(false)

  const color = useMemo(() => {
    if (hasCollision) return '#ff4444'
    if (isSelected) return '#4fc3f7'
    return hovered ? '#81c784' : segment.color
  }, [segment.color, isSelected, hovered, hasCollision])

  return (
    <group
      position={[position.x, position.y, position.z]}
      rotation={[
        rotation.x * Math.PI / 180,
        rotation.y * Math.PI / 180,
        rotation.z * Math.PI / 180
      ]}
    >
      <mesh
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[
          segment.dimensions.length,
          segment.dimensions.height,
          segment.dimensions.width
        ]} />
        <meshStandardMaterial
          color={color}
          metalness={0.3}
          roughness={0.6}
          transparent
          opacity={hovered ? 0.9 : 0.7}
        />
      </mesh>
      <mesh position={[0, segment.dimensions.height / 2, 0]}>
        <boxGeometry args={[
          segment.dimensions.length + 0.2,
          0.2,
          segment.dimensions.width + 0.2
        ]} />
        <meshStandardMaterial color="#37474f" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, -segment.dimensions.height / 2, 0]}>
        <boxGeometry args={[
          segment.dimensions.length + 0.2,
          0.2,
          segment.dimensions.width + 0.2
        ]} />
        <meshStandardMaterial color="#37474f" metalness={0.8} roughness={0.2} />
      </mesh>
      {segment.liftingPoints.map((lp, index) => (
        <group key={index} position={[lp.x, lp.y, lp.z]}>
          <mesh>
            <sphereGeometry args={[0.5, 16, 16]} />
            <meshStandardMaterial color="#ffd700" metalness={0.9} roughness={0.1} />
          </mesh>
          <Text
            position={[0, 1.5, 0]}
            color="#ffffff"
            fontSize={1}
            anchorX="center"
            anchorY="middle"
          >
            {index + 1}
          </Text>
        </group>
      ))}
      <group position={[segment.centerOfGravity.x, segment.centerOfGravity.y, segment.centerOfGravity.z]}>
        <mesh>
          <coneGeometry args={[0.6, 1.5, 8]} />
          <meshStandardMaterial color="#e91e63" />
        </mesh>
      </group>
      <Text
        position={[0, segment.dimensions.height + 2, 0]}
        color="#ffffff"
        fontSize={1.5}
        anchorX="center"
        anchorY="middle"
      >
        {segment.name}
      </Text>
    </group>
  )
}

const ObstacleModel: React.FC<{ obstacle: Obstacle }> = ({ obstacle }) => {
  return (
    <group
      position={[obstacle.position.x, obstacle.position.y, obstacle.position.z]}
      rotation={[0, obstacle.rotation * Math.PI / 180, 0]}
    >
      <mesh>
        <boxGeometry args={[
          obstacle.dimensions.length,
          obstacle.dimensions.height,
          obstacle.dimensions.width
        ]} />
        <meshStandardMaterial
          color={obstacle.color}
          transparent
          opacity={obstacle.isPermanent ? 0.8 : 0.5}
          wireframe={obstacle.type === 'transport_route'}
        />
      </mesh>
      {obstacle.type === 'temporary_support' && (
        <>
          <mesh position={[0, obstacle.dimensions.height / 2 + 0.5, 0]}>
            <boxGeometry args={[obstacle.dimensions.length + 2, 0.5, obstacle.dimensions.width + 2]} />
            <meshStandardMaterial color="#c62828" />
          </mesh>
          <group position={[0, obstacle.dimensions.height / 2 + 0.75, 0]}>
            {[...Array(5)].map((_, i) => (
              <mesh key={i} position={[
                -obstacle.dimensions.length / 2 + (obstacle.dimensions.length / 4) * i,
                0,
                0
              ]}>
                <cylinderGeometry args={[0.15, 0.15, 0.8, 8]} />
                <meshStandardMaterial color="#ffffff" />
              </mesh>
            ))}
          </group>
        </>
      )}
      {obstacle.type === 'transport_route' && (
        <mesh
          position={[0, 0.1, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[obstacle.dimensions.length, obstacle.dimensions.width]} />
          <meshBasicMaterial
            color="#2196F3"
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      <Text
        position={[0, obstacle.dimensions.height / 2 + 1, 0]}
        color="#ffffff"
        fontSize={1}
        anchorX="center"
        anchorY="middle"
      >
        {obstacle.name}
      </Text>
    </group>
  )
}

const KeyframeMarker: React.FC<{
  keyframe: Keyframe
  index: number
  isCurrent: boolean
  onDrag?: (position: Vector3D) => void
}> = ({ keyframe, index, isCurrent, onDrag }) => {
  const [hovered, setHovered] = useState(false)

  const color = isCurrent ? '#4fc3f7' : (hovered ? '#81c784' : '#66bb6a')

  return (
    <group
      position={[keyframe.position.x, keyframe.position.y, keyframe.position.z]}
    >
      <mesh
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[isCurrent ? 1.5 : 1, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isCurrent ? 0.3 : 0.1}
        />
      </mesh>
      {isCurrent && (
        <mesh>
          <ringGeometry args={[1.8, 2.2, 32]} rotation={[-Math.PI / 2, 0, 0]} />
          <meshBasicMaterial color="#4fc3f7" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}
      <Text
        position={[0, 2.5, 0]}
        color="#ffffff"
        fontSize={1.2}
        anchorX="center"
        anchorY="middle"
      >
        {keyframe.label || `K${index + 1}`}
      </Text>
      <Text
        position={[0, 4, 0]}
        color="#90a4ae"
        fontSize={0.8}
        anchorX="center"
        anchorY="middle"
      >
        R: {keyframe.radius.toFixed(1)}m | H: {keyframe.hookHeight.toFixed(1)}m
      </Text>
    </group>
  )
}

const KeyframePath: React.FC<{ keyframes: Keyframe[] }> = ({ keyframes }) => {
  if (keyframes.length < 2) return null

  const points = useMemo(() => {
    return keyframes.map(kf => [kf.position.x, kf.position.y, kf.position.z])
  }, [keyframes])

  return (
    <group>
      <Line
        points={points}
        color="#81c784"
        lineWidth={3}
        dashed={true}
        dashSize={2}
        gapSize={1}
      />
      {keyframes.slice(0, -1).map((kf, index) => {
        const nextKf = keyframes[index + 1]
        const midPos = vec3.lerp(kf.position, nextKf.position, 0.5)
        return (
          <group key={index} position={[midPos.x, midPos.y + 1, midPos.z]}>
            <mesh rotation={[0, Math.atan2(nextKf.position.x - kf.position.x, nextKf.position.z - kf.position.z), 0]}>
              <coneGeometry args={[0.8, 1.5, 4]} />
              <meshStandardMaterial color="#81c784" />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

const CollisionIndicator: React.FC<{ collisions: CollisionResult[] }> = ({ collisions }) => {
  if (collisions.length === 0) return null

  const criticalCollisions = collisions.filter(c => c.severity === 'critical')
  const warningCollisions = collisions.filter(c => c.severity === 'warning')

  return (
    <group position={[0, 50, 0]}>
      {criticalCollisions.map((collision, index) => (
        collision.position && (
          <group
            key={collision.id}
            position={[collision.position.x, collision.position.y + 5, collision.position.z]}
          >
            <mesh>
              <octahedronGeometry args={[3, 0]} />
              <meshBasicMaterial color="#f44336" wireframe />
            </mesh>
          </group>
        )
      ))}
      {warningCollisions.map((collision, index) => (
        collision.position && (
          <group
            key={collision.id}
            position={[collision.position.x, collision.position.y + 3, collision.position.z]}
          >
            <mesh>
              <tetrahedronGeometry args={[2, 0]} />
              <meshBasicMaterial color="#ff9800" wireframe />
            </mesh>
          </group>
        )
      ))}
    </group>
  )
}

const Lights: React.FC = () => {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[50, 100, 50]}
        intensity={1}
        castShadow
      />
      <directionalLight position={[-50, 50, -50]} intensity={0.3} />
      <hemisphereLight intensity={0.5} groundColor="#1a202c" />
    </>
  )
}

export const ShipyardScene: React.FC<ShipyardSceneProps> = ({
  segments,
  crane,
  obstacles,
  keyframes,
  currentKeyframeIndex,
  collisionResults,
  onSegmentDrag,
  onKeyframeDrag
}) => {
  const currentKeyframe = keyframes[currentKeyframeIndex]
  const targetPosition = currentKeyframe?.position || segments[0]?.initialPosition

  const hasCollision = (segmentId: string) => {
    return collisionResults.some(c => c.involvedObjects.includes(segmentId))
  }

  return (
    <>
      <Lights />
      <ShipyardGround />
      <ShipDock />
      <CraneModel crane={crane} targetPosition={targetPosition} />
      {obstacles.map(obstacle => (
        <ObstacleModel key={obstacle.id} obstacle={obstacle} />
      ))}
      {segments.map((segment, index) => {
        const position = keyframes.length > 0 && currentKeyframe
          ? currentKeyframe.position
          : segment.initialPosition
        const rotation = keyframes.length > 0 && currentKeyframe
          ? currentKeyframe.rotation
          : { x: 0, y: 0, z: 0 }

        return (
          <SegmentModel
            key={segment.id}
            segment={segment}
            position={position}
            rotation={rotation}
            isSelected={index === 0}
            hasCollision={hasCollision(segment.id)}
            onDrag={(pos) => onSegmentDrag?.(segment.id, pos)}
          />
        )
      })}
      {keyframes.length > 0 && (
        <>
          <KeyframePath keyframes={keyframes} />
          {keyframes.map((keyframe, index) => (
            <KeyframeMarker
              key={keyframe.id}
              keyframe={keyframe}
              index={index}
              isCurrent={index === currentKeyframeIndex}
              onDrag={(pos) => onKeyframeDrag?.(keyframe.id, pos)}
            />
          ))}
        </>
      )}
      <CollisionIndicator collisions={collisionResults} />
      <OrbitControls
        makeDefault
        minDistance={10}
        maxDistance={500}
        maxPolarAngle={Math.PI / 2 - 0.1}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  )
}
