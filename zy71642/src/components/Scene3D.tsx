import React, { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useOrbitalStore } from '@/store/useOrbitalStore'
import { getMolecule, getOrbital } from '@/data/molecules'
import { generateOrbitalGeometry } from '@/utils/orbitalGeometry'

function Atom({ position, color, label }: { position: [number, number, number]; color: string; label: string }) {
  const threeColor = useMemo(() => new THREE.Color(color), [color])
  const emissiveColor = useMemo(() => new THREE.Color(color).multiplyScalar(0.4), [color])

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.15, 32, 32]} />
        <meshStandardMaterial color={threeColor} emissive={emissiveColor} emissiveIntensity={0.6} roughness={0.3} metalness={0.2} />
      </mesh>
      <Text position={[0, 0.28, 0]} fontSize={0.18} color="white" anchorX="center" anchorY="bottom" outlineWidth={0.02} outlineColor="#000000">
        {label}
      </Text>
    </group>
  )
}

const AtomMemo = React.memo(Atom)

function Bond({ start, end }: { start: [number, number, number]; end: [number, number, number] }) {
  const mid = useMemo<[number, number, number]>(() => [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  ], [start, end])

  const direction = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(
      new THREE.Vector3(...end),
      new THREE.Vector3(...start)
    )
    return dir
  }, [start, end])

  const length = useMemo(() => direction.length(), [direction])
  const quaternion = useMemo(() => {
    const quat = new THREE.Quaternion()
    quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize())
    return quat
  }, [direction])

  return (
    <mesh position={mid} quaternion={quaternion}>
      <cylinderGeometry args={[0.03, 0.03, length, 8]} />
      <meshStandardMaterial color="#94a3b8" roughness={0.5} metalness={0.1} />
    </mesh>
  )
}

const BondMemo = React.memo(Bond)

function MoleculeSkeleton() {
  const currentMoleculeId = useOrbitalStore((s) => s.currentMoleculeId)
  const molecule = useMemo(() => getMolecule(currentMoleculeId), [currentMoleculeId])

  if (!molecule) return null

  return (
    <group>
      {molecule.atomPositions.map((pos, i) => (
        <AtomMemo key={`atom-${i}`} position={pos} color={molecule.atomColors[i]} label={molecule.atomLabels[i]} />
      ))}
      {molecule.bonds.map(([a, b], i) => (
        <BondMemo key={`bond-${i}`} start={molecule.atomPositions[a]} end={molecule.atomPositions[b]} />
      ))}
    </group>
  )
}

const MoleculeSkeletonMemo = React.memo(MoleculeSkeleton)

function OrbitalCloud() {
  const currentMoleculeId = useOrbitalStore((s) => s.currentMoleculeId)
  const currentOrbitalId = useOrbitalStore((s) => s.currentOrbitalId)
  const isosurfaceThreshold = useOrbitalStore((s) => s.isosurfaceThreshold)

  const orbital = useMemo(() => getOrbital(currentMoleculeId, currentOrbitalId), [currentMoleculeId, currentOrbitalId])

  const geometry = useMemo(() => {
    if (!orbital) return null
    return generateOrbitalGeometry(orbital.shape, isosurfaceThreshold)
  }, [orbital, isosurfaceThreshold])

  const meshRef = useRef<THREE.Mesh>(null)
  const [opacity, setOpacity] = useState(0.6)
  const targetOpacity = 0.6

  useFrame(() => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial
      mat.opacity += (targetOpacity - mat.opacity) * 0.1
    }
  })

  useEffect(() => {
    setOpacity(0)
    const timer = setTimeout(() => setOpacity(targetOpacity), 50)
    return () => clearTimeout(timer)
  }, [currentOrbitalId])

  if (!geometry) return null

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} transparent opacity={opacity} depthWrite={false} roughness={0.4} metalness={0.1} />
    </mesh>
  )
}

const OrbitalCloudMemo = React.memo(OrbitalCloud)

function NodePlanes() {
  const currentMoleculeId = useOrbitalStore((s) => s.currentMoleculeId)
  const currentOrbitalId = useOrbitalStore((s) => s.currentOrbitalId)
  const showNodePlanes = useOrbitalStore((s) => s.showNodePlanes)
  const nodePlaneOpacity = useOrbitalStore((s) => s.nodePlaneOpacity)

  const orbital = useMemo(() => getOrbital(currentMoleculeId, currentOrbitalId), [currentMoleculeId, currentOrbitalId])

  if (!showNodePlanes || !orbital || orbital.nodePlanes.length === 0) return null

  return (
    <group>
      {orbital.nodePlanes.map((plane, i) => {
        const [nx, ny, nz] = plane.normal
        const normalVec = new THREE.Vector3(nx, ny, nz).normalize()
        const quat = new THREE.Quaternion()
        quat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normalVec)
        const offset: [number, number, number] = [nx * plane.distance, ny * plane.distance, nz * plane.distance]

        return (
          <group key={`nodeplane-${i}`} position={offset} quaternion={quat}>
            <mesh>
              <planeGeometry args={[5, 5]} />
              <meshBasicMaterial color="#22c55e" transparent opacity={nodePlaneOpacity} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
            <Text position={[0, 2.6, 0.01]} fontSize={0.2} color="#22c55e" anchorX="center" anchorY="bottom">
              {plane.label}
            </Text>
          </group>
        )
      })}
    </group>
  )
}

const NodePlanesMemo = React.memo(NodePlanes)

function SectionPlane() {
  const showSection = useOrbitalStore((s) => s.showSection)
  const sectionPosition = useOrbitalStore((s) => s.sectionPosition)
  const sectionAxis = useOrbitalStore((s) => s.sectionAxis)

  if (!showSection) return null

  const position: [number, number, number] = [0, 0, 0]
  const rotation: [number, number, number] = [0, 0, 0]

  if (sectionAxis === 'x') {
    position[0] = sectionPosition
    rotation[1] = Math.PI / 2
  } else if (sectionAxis === 'y') {
    position[1] = sectionPosition
    rotation[0] = Math.PI / 2
  } else {
    position[2] = sectionPosition
  }

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[5, 5]} />
      <meshBasicMaterial color="#f97316" transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  )
}

const SectionPlaneMemo = React.memo(SectionPlane)

function SceneContent() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} color="#ffffff" />
      <directionalLight position={[-3, -2, 4]} intensity={0.4} color="#a0c4ff" />
      <pointLight position={[0, 3, 0]} intensity={0.3} color="#6366f1" />

      <MoleculeSkeletonMemo />
      <OrbitalCloudMemo />
      <NodePlanesMemo />
      <SectionPlaneMemo />

      <gridHelper args={[10, 20, '#1e293b', '#0f172a']} />

      <OrbitControls enableDamping dampingFactor={0.08} minDistance={1} maxDistance={20} />

      <EffectComposer>
        <Bloom luminanceThreshold={0.4} luminanceSmoothing={0.9} intensity={0.8} mipmapBlur />
      </EffectComposer>
    </>
  )
}

const SceneContentMemo = React.memo(SceneContent)

function Scene3DInner() {
  return (
    <Canvas
      camera={{ position: [0, 2, 5], fov: 50, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#0a0e1a' }}
      onCreated={({ gl }) => {
        gl.setClearColor('#0a0e1a')
      }}
    >
      <SceneContentMemo />
    </Canvas>
  )
}

export default function Scene3D() {
  return <Scene3DInner />
}
