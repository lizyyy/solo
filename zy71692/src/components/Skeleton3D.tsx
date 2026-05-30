import { useRef, useMemo, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, Billboard, Text } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { Vec3, AngleJointDef, AngleResult } from '@/types'
import { calculateAngle } from '@/utils/angle'

interface Skeleton3DProps {
  joints: Record<string, { x: number; y: number; z: number }>
  bones: [string, string][]
  angleJoints: AngleJointDef[]
  angleResults: AngleResult[]
  currentFrame: number
  selectedJoints: string[]
  cameraPreset: 'front' | 'side' | 'top' | 'free'
  onJointClick: (jointName: string) => void
}

const TEAL = '#0D9488'
const ORANGE = '#F97316'
const RED = '#EF4444'

const CAMERA_PRESETS: Record<string, [number, number, number]> = {
  front: [0, 1, 3],
  side: [3, 1, 0],
  top: [0, 3, 0.001],
}

function toVec3(v: Vec3): THREE.Vector3 {
  return new THREE.Vector3(v.x, v.y, v.z)
}

function CameraController({ preset }: { preset: string }) {
  const { camera } = useThree()
  const target = useRef(new THREE.Vector3())
  const targetLookAt = useRef(new THREE.Vector3(0, 1, 0))

  useFrame(() => {
    if (preset === 'free') return
    const pos = CAMERA_PRESETS[preset]
    if (!pos) return
    target.current.set(...pos)
    camera.position.lerp(target.current, 0.05)
    const currentLookAt = new THREE.Vector3()
    camera.getWorldDirection(currentLookAt)
    const desired = targetLookAt.current.clone().sub(camera.position).normalize()
    currentLookAt.lerp(desired, 0.05)
    camera.lookAt(targetLookAt.current)
  })

  return null
}

function JointSphere({
  name,
  position,
  isSelected,
  onClick,
}: {
  name: string
  position: THREE.Vector3
  isSelected: boolean
  onClick: (name: string) => void
}) {
  const ref = useRef<THREE.Mesh>(null)

  return (
    <mesh
      ref={ref}
      position={position}
      onClick={(e) => {
        e.stopPropagation()
        onClick(name)
      }}
    >
      <sphereGeometry args={[isSelected ? 0.06 : 0.04, 16, 16]} />
      <meshStandardMaterial
        color={TEAL}
        emissive={TEAL}
        emissiveIntensity={isSelected ? 2.5 : 1.2}
      />
    </mesh>
  )
}

function BoneCylinder({ from, to }: { from: THREE.Vector3; to: THREE.Vector3 }) {
  const { position, rotation, length } = useMemo(() => {
    const mid = from.clone().add(to).multiplyScalar(0.5)
    const dir = to.clone().sub(from)
    const len = dir.length()
    dir.normalize()
    const quat = new THREE.Quaternion()
    quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    const euler = new THREE.Euler().setFromQuaternion(quat)
    return { position: mid, rotation: euler, length: len }
  }, [from, to])

  return (
    <mesh position={position} rotation={rotation}>
      <cylinderGeometry args={[0.012, 0.012, length, 8]} />
      <meshStandardMaterial color="white" />
    </mesh>
  )
}

function AngleArc({
  center,
  from,
  to,
  angle,
  isAnomaly,
  label,
}: {
  center: THREE.Vector3
  from: THREE.Vector3
  to: THREE.Vector3
  angle: number
  isAnomaly: boolean
  label: string
}) {
  const arcGroup = useMemo(() => {
    const v1 = from.clone().sub(center).normalize()
    const v2 = to.clone().sub(center).normalize()
    const arcRadius = 0.15
    const angleRad = (angle * Math.PI) / 180
    const curve = new THREE.EllipseCurve(0, 0, arcRadius, arcRadius, 0, angleRad, false, 0)
    const points = curve.getPoints(32)
    const shape = new THREE.Shape()
    shape.moveTo(0, 0)
    points.forEach((p) => shape.lineTo(p.x, p.y))
    shape.lineTo(0, 0)

    const geometry = new THREE.ShapeGeometry(shape)

    const quaternion = new THREE.Quaternion()
    const normal = v1.clone().cross(v2).normalize()
    if (normal.length() < 0.001) {
      quaternion.identity()
    } else {
      const rotMatrix = new THREE.Matrix4()
      const xAxis = v1
      const yAxis = normal.clone().cross(xAxis).normalize()
      if (yAxis.length() < 0.001) {
        quaternion.identity()
      } else {
        rotMatrix.makeBasis(xAxis, yAxis, normal)
        quaternion.setFromRotationMatrix(rotMatrix)
      }
    }

    geometry.applyQuaternion(quaternion)
    geometry.translate(center.x, center.y, center.z)

    return geometry
  }, [center, from, to, angle])

  const color = isAnomaly ? RED : ORANGE
  const labelPos = center.clone().add(
    from.clone().sub(center).normalize().add(to.clone().sub(center).normalize()).multiplyScalar(0.25)
  )

  return (
    <group>
      <mesh geometry={arcGroup}>
        <meshBasicMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
      <Billboard position={labelPos}>
        <Text fontSize={0.08} color={color} anchorX="center" anchorY="middle">
          {`${angle.toFixed(1)}°`}
        </Text>
      </Billboard>
    </group>
  )
}

function Scene({
  joints,
  bones,
  angleJoints,
  angleResults,
  currentFrame,
  selectedJoints,
  cameraPreset,
  onJointClick,
}: Skeleton3DProps) {
  const jointVecs = useMemo(() => {
    const map: Record<string, THREE.Vector3> = {}
    for (const [name, pos] of Object.entries(joints)) {
      map[name] = toVec3(pos)
    }
    return map
  }, [joints])

  const angleMap = useMemo(() => {
    const map: Record<string, AngleResult | undefined> = {}
    for (const r of angleResults) {
      if (r.frameIndex === currentFrame) {
        map[r.jointName] = r
      }
    }
    return map
  }, [angleResults, currentFrame])

  const handleJointClick = useCallback(
    (name: string) => onJointClick(name),
    [onJointClick]
  )

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <CameraController preset={cameraPreset} />
      <OrbitControls enableDamping dampingFactor={0.1} />

      <Grid
        position={[0, 0, 0]}
        args={[10, 10]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#333"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#555"
        fadeDistance={8}
        infiniteGrid
      />

      {Object.entries(jointVecs).map(([name, pos]) => (
        <JointSphere
          key={name}
          name={name}
          position={pos}
          isSelected={selectedJoints.includes(name)}
          onClick={handleJointClick}
        />
      ))}

      {bones.map(([a, b]) => {
        const from = jointVecs[a]
        const to = jointVecs[b]
        if (!from || !to) return null
        return <BoneCylinder key={`${a}-${b}`} from={from} to={to} />
      })}

      {angleJoints.map((def) => {
        const centerV = jointVecs[def.center]
        const fromV = jointVecs[def.from]
        const toV = jointVecs[def.to]
        if (!centerV || !fromV || !toV) return null
        const result = angleMap[def.name]
        const angle = result
          ? result.angle
          : calculateAngle(joints[def.from], joints[def.center], joints[def.to])
        const isAnomaly = result?.isAnomaly ?? false
        return (
          <AngleArc
            key={def.name}
            center={centerV}
            from={fromV}
            to={toV}
            angle={angle}
            isAnomaly={isAnomaly}
            label={def.label}
          />
        )
      })}

      <EffectComposer>
        <Bloom luminanceThreshold={0.6} luminanceSmoothing={0.4} intensity={1.2} />
      </EffectComposer>
    </>
  )
}

export default function Skeleton3D(props: Skeleton3DProps) {
  return (
    <Canvas camera={{ position: [0, 1, 3], fov: 50 }} style={{ background: '#111827' }}>
      <Scene {...props} />
    </Canvas>
  )
}
