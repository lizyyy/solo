import { useRef, useMemo, forwardRef, useImperativeHandle, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { ParamSet, AnomalyItem, AirflowSample, CompareScore, RackConfig, CRACUnit } from '@/types'

interface ReadOnlySceneProps {
  paramSet: ParamSet
  anomalies: AnomalyItem[]
  airflowSamples: AirflowSample[]
  score: CompareScore
  accentColor?: string
}

export interface ReadOnlySceneRef {
  controls: any
}

const RACK_WIDTH = 0.8
const RACK_DEPTH = 1.2
const RACK_HEIGHT = 2.5

const lerpColor = (a: THREE.Color, b: THREE.Color, t: number): THREE.Color => {
  return a.clone().lerp(b, t)
}

const getTempColor = (temp: number): THREE.Color => {
  const clamped = Math.max(18, Math.min(45, temp))
  const t = (clamped - 18) / (45 - 18)
  const coolBlue = new THREE.Color('#00d4ff')
  const hotRed = new THREE.Color('#ff6b35')
  return lerpColor(coolBlue, hotRed, t)
}

const ReadOnlyRackArray = ({ paramSet, anomalies, sectionPlaneY }: {
  paramSet: ParamSet
  anomalies: AnomalyItem[]
  sectionPlaneY: number
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const timeRef = useRef(0)

  const missingPowerRackIds = useMemo(() => {
    return anomalies
      .filter((a) => a.type === 'missing_power' && a.rackId)
      .map((a) => a.rackId)
  }, [anomalies])

  const hotspotRackIds = useMemo(() => {
    return anomalies
      .filter((a) => a.type === 'hotspot_occluded' && a.rackId)
      .map((a) => a.rackId)
  }, [anomalies])

  const clippingPlane = useMemo(() => {
    return new THREE.Plane(new THREE.Vector3(0, 1, 0), -sectionPlaneY)
  }, [sectionPlaneY])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const colorArray = useMemo(() => new Float32Array(paramSet.racks.length * 3), [paramSet.racks.length])

  useFrame((_, delta) => {
    timeRef.current += delta
    if (!meshRef.current) return

    paramSet.racks.forEach((rack: RackConfig, index: number) => {
      const x = rack.col * 1.0
      const z = rack.row * 3.2
      const y = 1.25

      dummy.position.set(x, y, z)
      dummy.scale.set(1, 1, 1)

      let color: THREE.Color
      if (missingPowerRackIds.includes(rack.id)) {
        const flashIntensity = (Math.sin(timeRef.current * 5) + 1) / 2
        color = new THREE.Color().setRGB(0.3 + flashIntensity * 0.3, 0.3 + flashIntensity * 0.3, 0.3 + flashIntensity * 0.3)
      } else if (hotspotRackIds.includes(rack.id)) {
        const pulseIntensity = (Math.sin(timeRef.current * 3) + 1) / 2
        const baseColor = getTempColor(rack.temperature)
        color = baseColor.clone().multiplyScalar(1 + pulseIntensity * 0.5)
      } else {
        color = getTempColor(rack.temperature)
      }

      if (rack.isColdAisle) {
        const coldColor = new THREE.Color('#00d4ff')
        color = color.clone().lerp(coldColor, 0.3)
      } else {
        const hotColor = new THREE.Color('#ff6b35')
        color = color.clone().lerp(hotColor, 0.2)
      }

      dummy.updateMatrix()
      meshRef.current!.setMatrixAt(index, dummy.matrix)

      colorArray[index * 3] = color.r
      colorArray[index * 3 + 1] = color.g
      colorArray[index * 3 + 2] = color.b
    })

    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }
  })

  const frontMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#ffffff',
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      clippingPlanes: [clippingPlane],
      emissive: '#000000',
      emissiveIntensity: 0,
      metalness: 0.3,
      roughness: 0.7,
    })
  }, [clippingPlane])

  useEffect(() => {
    return () => {
      frontMaterial.dispose()
    }
  }, [frontMaterial])

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, paramSet.racks.length]}
        material={frontMaterial}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[RACK_WIDTH, RACK_HEIGHT, RACK_DEPTH]}>
          <instancedBufferAttribute attach="attributes-color" args={[colorArray, 3]} />
        </boxGeometry>
      </instancedMesh>
    </group>
  )
}

const ReadOnlyCRACUnits = ({ paramSet, sectionPlaneY }: {
  paramSet: ParamSet
  sectionPlaneY: number
}) => {
  const clippingPlane = useMemo(() => {
    return new THREE.Plane(new THREE.Vector3(0, 1, 0), -sectionPlaneY)
  }, [sectionPlaneY])

  return (
    <group>
      {paramSet.cracUnits.map((crac: CRACUnit) => (
        <ReadOnlySingleCRAC key={crac.id} crac={crac} clippingPlane={clippingPlane} />
      ))}
    </group>
  )
}

const ReadOnlySingleCRAC = ({ crac, clippingPlane }: {
  crac: CRACUnit
  clippingPlane: THREE.Plane
}) => {
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
        <boxGeometry args={[1.5, 3, 1.5]} />
      </mesh>

      <mesh
        ref={fanRef}
        position={[0, 1.5, 1.5 / 2 + 0.01]}
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

const ReadOnlyAirflowArrows = ({ airflowSamples, sectionPlaneY }: {
  airflowSamples: AirflowSample[]
  sectionPlaneY: number
}) => {
  const shaftMeshRef = useRef<THREE.InstancedMesh>(null)
  const headMeshRef = useRef<THREE.InstancedMesh>(null)
  const timeRef = useRef(0)

  const clippingPlane = useMemo(() => {
    return new THREE.Plane(new THREE.Vector3(0, 1, 0), -sectionPlaneY)
  }, [sectionPlaneY])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const shaftColorArray = useMemo(
    () => new Float32Array(airflowSamples.length * 3),
    [airflowSamples.length]
  )
  const headColorArray = useMemo(
    () => new Float32Array(airflowSamples.length * 3),
    [airflowSamples.length]
  )

  const upVector = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const targetVector = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, delta) => {
    timeRef.current += delta
    if (!shaftMeshRef.current || !headMeshRef.current) return

    airflowSamples.forEach((sample: AirflowSample, index: number) => {
      const [px, py, pz] = sample.position
      const direction = new THREE.Vector3(...sample.direction).normalize()
      const scale = 0.3 + Math.max(0.1, Math.min(5, sample.velocity)) / 5 * 1.2
      const color = getTempColor(sample.temperature)
      const pulse = 1 + Math.sin(timeRef.current * 2 + index * 0.1) * 0.1

      const quaternion = new THREE.Quaternion()
      targetVector.copy(direction)
      quaternion.setFromUnitVectors(upVector, targetVector)

      const shaftLength = 0.8 * scale * pulse
      dummy.position.set(px, py + shaftLength / 2, pz)
      dummy.quaternion.copy(quaternion)
      dummy.scale.set(scale * 0.15, shaftLength, scale * 0.15)
      dummy.updateMatrix()
      shaftMeshRef.current!.setMatrixAt(index, dummy.matrix)

      const headLength = 0.3 * scale * pulse
      dummy.position.set(
        px + direction.x * (shaftLength + headLength / 2),
        py + direction.y * (shaftLength + headLength / 2) + shaftLength / 2,
        pz + direction.z * (shaftLength + headLength / 2)
      )
      dummy.scale.set(scale * 0.3, headLength, scale * 0.3)
      dummy.updateMatrix()
      headMeshRef.current!.setMatrixAt(index, dummy.matrix)

      shaftColorArray[index * 3] = color.r
      shaftColorArray[index * 3 + 1] = color.g
      shaftColorArray[index * 3 + 2] = color.b

      headColorArray[index * 3] = color.r
      headColorArray[index * 3 + 1] = color.g
      headColorArray[index * 3 + 2] = color.b
    })

    shaftMeshRef.current.instanceMatrix.needsUpdate = true
    shaftMeshRef.current.instanceColor!.needsUpdate = true
    headMeshRef.current.instanceMatrix.needsUpdate = true
    headMeshRef.current.instanceColor!.needsUpdate = true
  })

  const shaftMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      clippingPlanes: [clippingPlane],
      emissive: '#000000',
      emissiveIntensity: 0.3,
      metalness: 0.2,
      roughness: 0.5,
    })
  }, [clippingPlane])

  const headMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      clippingPlanes: [clippingPlane],
      emissive: '#000000',
      emissiveIntensity: 0.5,
      metalness: 0.3,
      roughness: 0.4,
    })
  }, [clippingPlane])

  useEffect(() => {
    return () => {
      shaftMaterial.dispose()
      headMaterial.dispose()
    }
  }, [shaftMaterial, headMaterial])

  const count = airflowSamples.length

  return (
    <group>
      <instancedMesh
        ref={shaftMeshRef}
        args={[undefined, undefined, count]}
        material={shaftMaterial}
      >
        <cylinderGeometry args={[1, 1, 1, 8]}>
          <instancedBufferAttribute attach="attributes-color" args={[shaftColorArray, 3]} />
        </cylinderGeometry>
      </instancedMesh>

      <instancedMesh
        ref={headMeshRef}
        args={[undefined, undefined, count]}
        material={headMaterial}
      >
        <coneGeometry args={[1, 1, 8]}>
          <instancedBufferAttribute attach="attributes-color" args={[headColorArray, 3]} />
        </coneGeometry>
      </instancedMesh>
    </group>
  )
}

const ReadOnlySceneContent = ({
  paramSet,
  anomalies,
  airflowSamples,
  accentColor = '#00d4ff',
}: {
  paramSet: ParamSet
  anomalies: AnomalyItem[]
  airflowSamples: AirflowSample[]
  accentColor?: string
}) => {
  const sectionPlaneY = 5

  return (
    <>
      <ambientLight intensity={0.3} color="#8aa5c0" />
      <directionalLight
        intensity={0.6}
        position={[10, 20, 10]}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      {paramSet.cracUnits.map((crac) => (
        <pointLight
          key={crac.id}
          position={crac.position}
          color={accentColor}
          intensity={0.5}
          distance={10}
        />
      ))}

      <gridHelper
        args={[20, 20, '#1e3a52', '#152232']}
        position={[0, 0.01, 0]}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#0a141f" />
      </mesh>

      <ReadOnlyRackArray paramSet={paramSet} anomalies={anomalies} sectionPlaneY={sectionPlaneY} />
      <ReadOnlyCRACUnits paramSet={paramSet} sectionPlaneY={sectionPlaneY} />
      <ReadOnlyAirflowArrows airflowSamples={airflowSamples} sectionPlaneY={sectionPlaneY} />

      <EffectComposer>
        <Bloom luminanceThreshold={0.4} intensity={0.8} mipmapBlur />
      </EffectComposer>
    </>
  )
}

const ReadOnlyScene = forwardRef<ReadOnlySceneRef, ReadOnlySceneProps>((props, ref) => {
  const { paramSet, anomalies, airflowSamples, accentColor = '#00d4ff' } = props
  const controlsRef = useRef<any>(null)

  useImperativeHandle(ref, () => ({
    get controls() {
      return controlsRef.current
    }
  }))

  return (
    <Canvas
      shadows
      camera={{ position: [15, 12, 15], fov: 50 }}
      gl={{ localClippingEnabled: true, antialias: true }}
    >
      <color attach="background" args={['#0f1923']} />
      <fog attach="fog" args={['#0f1923', 20, 50]} />
      <ReadOnlySceneContent
        paramSet={paramSet}
        anomalies={anomalies}
        airflowSamples={airflowSamples}
        accentColor={accentColor}
      />
      <OrbitControls
        ref={controlsRef}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={5}
        maxDistance={40}
        enableDamping
        dampingFactor={0.05}
        makeDefault
      />
    </Canvas>
  )
})

ReadOnlyScene.displayName = 'ReadOnlyScene'

export default ReadOnlyScene
