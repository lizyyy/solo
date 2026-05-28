import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RackConfig } from '@/types'
import { useStore } from '@/store/useStore'

const GRID_SIZE = 20
const GRID_RESOLUTION = 40
const MIN_TEMP = 18
const MAX_TEMP = 45

const getHeatmapColor = (t: number): THREE.Color => {
  t = Math.max(0, Math.min(1, t))
  const colors = [
    new THREE.Color('#00d4ff'),
    new THREE.Color('#00ffcc'),
    new THREE.Color('#00ff66'),
    new THREE.Color('#ffff00'),
    new THREE.Color('#ff6b35'),
  ]
  const numStops = colors.length - 1
  const scaledT = t * numStops
  const index = Math.floor(scaledT)
  const fraction = scaledT - index
  if (index >= numStops) return colors[numStops]
  return colors[index].clone().lerp(colors[index + 1], fraction)
}

const createHeatmapTexture = (racks: RackConfig[]): THREE.DataTexture => {
  const width = GRID_RESOLUTION
  const height = GRID_RESOLUTION
  const data = new Uint8Array(width * height * 4)

  const rackGrid: { temp: number; weight: number }[][] = []
  for (let y = 0; y < height; y++) {
    rackGrid[y] = []
    for (let x = 0; x < width; x++) {
      rackGrid[y][x] = { temp: 0, weight: 0 }
    }
  }

  racks.forEach((rack) => {
    const rackX = (rack.col * 1.0 + GRID_SIZE / 2) / GRID_SIZE * width
    const rackZ = (rack.row * 3.2 + GRID_SIZE / 2) / GRID_SIZE * height
    const gridX = Math.floor(rackX)
    const gridZ = Math.floor(rackZ)
    const influenceRadius = 3

    for (let dz = -influenceRadius; dz <= influenceRadius; dz++) {
      for (let dx = -influenceRadius; dx <= influenceRadius; dx++) {
        const gx = gridX + dx
        const gz = gridZ + dz
        if (gx >= 0 && gx < width && gz >= 0 && gz < height) {
          const dist = Math.sqrt(dx * dx + dz * dz)
          const weight = Math.max(0, 1 - dist / (influenceRadius + 1))
          rackGrid[gz][gx].temp += rack.temperature * weight
          rackGrid[gz][gx].weight += weight
        }
      }
    }
  })

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = rackGrid[y][x]
      let temp = cell.weight > 0 ? cell.temp / cell.weight : 22
      const t = (temp - MIN_TEMP) / (MAX_TEMP - MIN_TEMP)
      const color = getHeatmapColor(t)
      const idx = (y * width + x) * 4
      data[idx] = Math.floor(color.r * 255)
      data[idx + 1] = Math.floor(color.g * 255)
      data[idx + 2] = Math.floor(color.b * 255)
      data[idx + 3] = 255
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat)
  texture.needsUpdate = true
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return texture
}

export const HeatmapOverlay = () => {
  const { paramSet, sectionPlaneY } = useStore()
  const floorTextureRef = useRef<THREE.DataTexture | null>(null)
  const floorMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null)
  const rackFrontMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null)
  const timeRef = useRef(0)

  const clippingPlane = useMemo(() => {
    return new THREE.Plane(new THREE.Vector3(0, 1, 0), -sectionPlaneY)
  }, [sectionPlaneY])

  const heatmapData = useMemo(() => {
    return createHeatmapTexture(paramSet.racks)
  }, [paramSet.racks])

  useFrame((_, delta) => {
    timeRef.current += delta
    if (floorMaterialRef.current) {
      const pulse = (Math.sin(timeRef.current * 0.5) + 1) / 2
      floorMaterialRef.current.opacity = 0.3 + pulse * 0.1
    }
    if (rackFrontMaterialRef.current) {
      const pulse = (Math.sin(timeRef.current * 0.5) + 1) / 2
      rackFrontMaterialRef.current.opacity = 0.2 + pulse * 0.1
    }
  })

  const floorMaterial = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      map: heatmapData,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      clippingPlanes: [clippingPlane],
    })
    floorMaterialRef.current = mat
    return mat
  }, [heatmapData, clippingPlane])

  const rackFrontMaterial = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      map: heatmapData,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      clippingPlanes: [clippingPlane],
    })
    rackFrontMaterialRef.current = mat
    return mat
  }, [heatmapData, clippingPlane])

  const rackFronts = useMemo(() => {
    return paramSet.racks.map((rack: RackConfig) => {
      const x = rack.col * 1.0
      const z = rack.row * 3.2
      const isColdAisle = rack.isColdAisle
      const direction = isColdAisle ? 1 : -1
      return {
        position: [x, 1.25, z + direction * 0.61] as [number, number, number],
        rotation: [0, isColdAisle ? 0 : Math.PI, 0] as [number, number, number],
      }
    })
  }, [paramSet.racks])

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={floorMaterial}>
        <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
      </mesh>

      {rackFronts.map((front, index) => (
        <mesh
          key={index}
          position={front.position}
          rotation={front.rotation}
          material={rackFrontMaterial}
        >
          <planeGeometry args={[0.8, 2.5]} />
        </mesh>
      ))}
    </group>
  )
}
