import { useRef, useState, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { RackConfig, AnomalyItem } from '@/types'
import { useStore } from '@/store/useStore'

interface RackArrayProps {
  readonly?: boolean
}

const RACK_SIZE: [number, number, number] = [0.8, 2.5, 1.2]
const MIN_TEMP = 18
const MAX_TEMP = 45

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

export const RackArray = ({ readonly = false }: RackArrayProps) => {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const { paramSet, anomalies, hoveredRackId, setHoveredRackId, sectionPlaneY } = useStore()
  const [selectedRack, setSelectedRack] = useState<RackConfig | null>(null)
  const [tooltipPos, setTooltipPos] = useState<[number, number, number]>([0, 0, 0])
  const timeRef = useRef(0)

  const missingPowerRackIds = useMemo(() => {
    return anomalies
      .filter((a: AnomalyItem) => a.type === 'missing_power' && a.rackId)
      .map((a: AnomalyItem) => a.rackId)
  }, [anomalies])

  const hotspotRackIds = useMemo(() => {
    return anomalies
      .filter((a: AnomalyItem) => a.type === 'hotspot_occluded' && a.rackId)
      .map((a: AnomalyItem) => a.rackId)
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

      let scale = 1
      if (hoveredRackId === rack.id) {
        scale = 1.03
      }

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

      dummy.scale.set(scale, scale, scale)
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

  const handlePointerMove = (event: any) => {
    if (readonly) return
    const instanceId = event.instanceId
    if (instanceId !== undefined && instanceId >= 0) {
      const rack = paramSet.racks[instanceId]
      if (rack) {
        setHoveredRackId(rack.id)
      }
    }
  }

  const handlePointerOut = () => {
    if (!readonly) {
      setHoveredRackId(null)
    }
  }

  const handleClick = (event: any) => {
    if (readonly) return
    const instanceId = event.instanceId
    if (instanceId !== undefined && instanceId >= 0) {
      const rack = paramSet.racks[instanceId]
      if (rack) {
        setSelectedRack(rack)
        setTooltipPos([rack.col * 1.0, 2.5, rack.row * 3.2])
      }
    }
  }

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
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
        material={frontMaterial}
        castShadow
        receiveShadow
      >
        <boxGeometry args={RACK_SIZE}>
          <instancedBufferAttribute attach="attributes-color" args={[colorArray, 3]} />
        </boxGeometry>
      </instancedMesh>

      {selectedRack && (
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
            <div className="font-semibold text-white text-sm mb-2">{selectedRack.label}</div>
            <div className="text-xs text-slate-300 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">功率:</span>
                <span className="text-cyan-400">{selectedRack.powerKw} kW</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">温度:</span>
                <span className={selectedRack.temperature > 35 ? 'text-orange-400' : 'text-green-400'}>
                  {selectedRack.temperature}°C
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">位置:</span>
                <span className="text-slate-300">R{selectedRack.row} C{selectedRack.col}</span>
              </div>
            </div>
            <button
              className="mt-2 w-full text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 py-1 rounded transition-colors"
              onClick={() => setSelectedRack(null)}
            >
              关闭
            </button>
          </div>
        </Html>
      )}
    </group>
  )
}
