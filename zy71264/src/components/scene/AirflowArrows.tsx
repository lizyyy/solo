import { useRef, useState, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { AirflowSample } from '@/types'
import { useStore } from '@/store/useStore'

const MIN_TEMP = 18
const MAX_TEMP = 45
const MIN_VELOCITY = 0.1
const MAX_VELOCITY = 5

const lerpColor = (a: THREE.Color, b: THREE.Color, t: number): THREE.Color => {
  return a.clone().lerp(b, t)
}

const getTempColor = (temp: number): THREE.Color => {
  const clamped = Math.max(MIN_TEMP, Math.min(MAX_TEMP, temp))
  const t = (clamped - MIN_TEMP) / (MAX_TEMP - MIN_TEMP)
  const coolBlue = new THREE.Color('#00d4ff')
  const hotRed = new THREE.Color('#ff6b35')
  return lerpColor(coolBlue, hotRed, t)
}

const getVelocityScale = (velocity: number): number => {
  const clamped = Math.max(MIN_VELOCITY, Math.min(MAX_VELOCITY, velocity))
  const t = (clamped - MIN_VELOCITY) / (MAX_VELOCITY - MIN_VELOCITY)
  return 0.3 + t * 1.2
}

export const AirflowArrows = () => {
  const shaftMeshRef = useRef<THREE.InstancedMesh>(null)
  const headMeshRef = useRef<THREE.InstancedMesh>(null)
  const { airflowSamples, sectionPlaneY } = useStore()
  const [selectedSample, setSelectedSample] = useState<{ sample: AirflowSample; index: number } | null>(null)
  const [tooltipPos, setTooltipPos] = useState<[number, number, number]>([0, 0, 0])
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
      const scale = getVelocityScale(sample.velocity)
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
    if (shaftMeshRef.current.instanceColor) {
      shaftMeshRef.current.instanceColor.needsUpdate = true
    }
    headMeshRef.current.instanceMatrix.needsUpdate = true
    if (headMeshRef.current.instanceColor) {
      headMeshRef.current.instanceColor.needsUpdate = true
    }
  })

  const handleClick = (event: any) => {
    const instanceId = event.instanceId
    if (instanceId !== undefined && instanceId >= 0) {
      const sample = airflowSamples[instanceId]
      if (sample) {
        setSelectedSample({ sample, index: instanceId })
        setTooltipPos(sample.position as [number, number, number])
      }
    }
  }

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
        onClick={handleClick}
      >
        <cylinderGeometry args={[1, 1, 1, 8]}>
          <instancedBufferAttribute attach="attributes-color" args={[shaftColorArray, 3]} />
        </cylinderGeometry>
      </instancedMesh>

      <instancedMesh
        ref={headMeshRef}
        args={[undefined, undefined, count]}
        material={headMaterial}
        onClick={handleClick}
      >
        <coneGeometry args={[1, 1, 8]}>
          <instancedBufferAttribute attach="attributes-color" args={[headColorArray, 3]} />
        </coneGeometry>
      </instancedMesh>

      {selectedSample && (
        <Html
          position={tooltipPos}
          center
          distanceFactor={10}
          zIndexRange={[100, 0]}
        >
          <div
            className="bg-slate-900/95 border border-slate-700 rounded-lg p-3 shadow-xl min-w-[160px] pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-semibold text-white text-sm mb-2">气流样本 #{selectedSample.index}</div>
            <div className="text-xs text-slate-300 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">速度:</span>
                <span className="text-cyan-400">{selectedSample.sample.velocity.toFixed(2)} m/s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">温度:</span>
                <span className={selectedSample.sample.temperature > 35 ? 'text-orange-400' : 'text-green-400'}>
                  {selectedSample.sample.temperature.toFixed(1)}°C
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">位置:</span>
                <span className="text-slate-300">
                  ({selectedSample.sample.position[0].toFixed(1)}, {selectedSample.sample.position[1].toFixed(1)}, {selectedSample.sample.position[2].toFixed(1)})
                </span>
              </div>
            </div>
            <button
              className="mt-2 w-full text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 py-1 rounded transition-colors"
              onClick={() => setSelectedSample(null)}
            >
              关闭
            </button>
          </div>
        </Html>
      )}
    </group>
  )
}
