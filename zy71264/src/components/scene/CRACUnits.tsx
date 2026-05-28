import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { CRACUnit } from '@/types'
import { useStore } from '@/store/useStore'

const CRAC_SIZE: [number, number, number] = [1.5, 3, 1.5]

interface SingleCRACProps {
  crac: CRACUnit
  clippingPlane: THREE.Plane
}

const SingleCRAC = ({ crac, clippingPlane }: SingleCRACProps) => {
  const fanRef = useRef<THREE.Mesh>(null)
  const coneRef = useRef<THREE.Mesh>(null)
  const timeRef = useRef(0)

  const direction = useMemo(() => {
    return new THREE.Vector3(...crac.direction).normalize()
  }, [crac.direction])

  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion()
    q.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction)
    return q
  }, [direction])

  useFrame((_, delta) => {
    timeRef.current += delta
    if (fanRef.current) {
      fanRef.current.rotation.y += delta * 8
    }
    if (coneRef.current) {
      const pulse = (Math.sin(timeRef.current * 2) + 1) / 2
      coneRef.current.scale.z = 1 + pulse * 0.3
      const mat = coneRef.current.material as THREE.MeshStandardMaterial
      mat.opacity = 0.2 + pulse * 0.2
    }
  })

  const cracMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#00e5a0',
      metalness: 0.6,
      roughness: 0.3,
      clippingPlanes: [clippingPlane],
      emissive: '#00e5a0',
      emissiveIntensity: 0.1,
    })
  }, [clippingPlane])

  const fanMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#1a1a2e',
      metalness: 0.8,
      roughness: 0.2,
      clippingPlanes: [clippingPlane],
    })
  }, [clippingPlane])

  const coneMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#00d4ff',
      transparent: true,
      opacity: 0.3,
      clippingPlanes: [clippingPlane],
      emissive: '#00d4ff',
      emissiveIntensity: 0.3,
      side: THREE.DoubleSide,
    })
  }, [clippingPlane])

  const outflowPosition = useMemo(() => {
    const pos = new THREE.Vector3(...crac.position)
    const offset = direction.clone().multiplyScalar(1.5)
    pos.y = 1.5
    return pos.add(offset).toArray() as [number, number, number]
  }, [crac.position, direction])

  return (
    <group position={[crac.position[0], 0, crac.position[2]]}>
      <mesh position={[0, 1.5, 0]} material={cracMaterial} castShadow receiveShadow>
        <boxGeometry args={CRAC_SIZE} />
      </mesh>

      <mesh
        ref={fanRef}
        position={[0, 1.5, CRAC_SIZE[2] / 2 + 0.01]}
        material={fanMaterial}
      >
        <cylinderGeometry args={[0.5, 0.5, 0.1, 6]} />
      </mesh>

      <group position={outflowPosition} quaternion={quaternion}>
        <mesh ref={coneRef} material={coneMaterial}>
          <coneGeometry args={[0.6, 2, 16, 1, true]} />
        </mesh>
      </group>

      <Html
        position={[0, 3.2, 0]}
        center
        distanceFactor={12}
        zIndexRange={[50, 0]}
      >
        <div className="bg-emerald-900/90 border border-emerald-600 rounded px-2 py-1 text-xs whitespace-nowrap">
          <div className="font-semibold text-emerald-300">{crac.label}</div>
          <div className="text-emerald-400">{crac.airflowCfm} CFM</div>
        </div>
      </Html>
    </group>
  )
}

export const CRACUnits = () => {
  const { paramSet, sectionPlaneY } = useStore()

  const clippingPlane = useMemo(() => {
    return new THREE.Plane(new THREE.Vector3(0, 1, 0), -sectionPlaneY)
  }, [sectionPlaneY])

  return (
    <group>
      {paramSet.cracUnits.map((crac: CRACUnit) => (
        <SingleCRAC key={crac.id} crac={crac} clippingPlane={clippingPlane} />
      ))}
    </group>
  )
}
