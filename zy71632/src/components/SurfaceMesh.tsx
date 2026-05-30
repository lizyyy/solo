import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { generateSurfaceGrid } from '@/utils/gradient'
import type { SurfaceConfig } from '@/types'

interface SurfaceMeshProps {
  config: SurfaceConfig
}

export default function SurfaceMesh({ config }: SurfaceMeshProps) {
  const { invalidate } = useThree()

  const geometry = useMemo(() => {
    const grid = generateSurfaceGrid(config)
    if (!grid) return null

    const { positions, indices, normals } = grid
    const vertexCount = positions.length / 3

    let minZ = Infinity
    let maxZ = -Infinity
    for (let i = 0; i < vertexCount; i++) {
      const z = positions[i * 3 + 2]
      if (z < minZ) minZ = z
      if (z > maxZ) maxZ = z
    }

    const rangeZ = maxZ - minZ || 1
    const colors = new Float32Array(vertexCount * 3)

    for (let i = 0; i < vertexCount; i++) {
      const z = positions[i * 3 + 2]
      const t = (z - minZ) / rangeZ

      const lowColor = new THREE.Color(0.05, 0.05, 0.45)
      const highColor = new THREE.Color(0.55, 0.15, 0.85)
      const blended = lowColor.clone().lerp(highColor, t)

      colors[i * 3] = blended.r
      colors[i * 3 + 1] = blended.g
      colors[i * 3 + 2] = blended.b
    }

    const swappedPositions = new Float32Array(positions.length)
    for (let i = 0; i < vertexCount; i++) {
      swappedPositions[i * 3] = positions[i * 3]
      swappedPositions[i * 3 + 1] = positions[i * 3 + 2]
      swappedPositions[i * 3 + 2] = positions[i * 3 + 1]
    }

    const swappedNormals = new Float32Array(normals.length)
    for (let i = 0; i < vertexCount; i++) {
      swappedNormals[i * 3] = normals[i * 3]
      swappedNormals[i * 3 + 1] = normals[i * 3 + 2]
      swappedNormals[i * 3 + 2] = normals[i * 3 + 1]
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(swappedPositions, 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(swappedNormals, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.setIndex(new THREE.BufferAttribute(indices, 1))

    return geo
  }, [config])

  const axisLabels = useMemo(() => {
    const [xMin, xMax] = config.xRange
    const [yMin, yMax] = config.yRange
    return [
      { position: [xMax + 0.8, 0, 0] as [number, number, number], text: 'X' },
      { position: [0, 0, yMax + 0.8] as [number, number, number], text: 'Y' },
      { position: [0, 2.5, 0] as [number, number, number], text: 'Z' },
    ]
  }, [config.xRange, config.yRange])

  if (!geometry) return null

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          vertexColors
          side={THREE.DoubleSide}
          transparent
          opacity={0.85}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>

      <mesh geometry={geometry}>
        <meshBasicMaterial
          wireframe
          color={new THREE.Color(0.3, 0.2, 0.5)}
          transparent
          opacity={0.2}
        />
      </mesh>

      {axisLabels.map((label) => (
        <Text
          key={label.text}
          position={label.position}
          fontSize={0.5}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {label.text}
        </Text>
      ))}
    </group>
  )
}
