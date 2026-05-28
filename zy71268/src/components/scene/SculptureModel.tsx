import { useMemo } from 'react'
import * as THREE from 'three'
import { EdgesGeometry, LineSegments, LineBasicMaterial } from 'three'
import { Mesh, BufferGeometry } from 'three'

interface SculptureModelProps {
  shape: 'torusKnot' | 'icosahedron' | 'cylinder' | 'cone' | 'dodecahedron'
  color: string
  position: { x: number; y: number; z: number }
}

function brightenColor(hex: string, amount: number): string {
  const c = new THREE.Color(hex)
  c.r = Math.min(1, c.r + amount)
  c.g = Math.min(1, c.g + amount)
  c.b = Math.min(1, c.b + amount)
  return '#' + c.getHexString()
}

function SculptureMesh({ shape }: { shape: SculptureModelProps['shape'] }) {
  switch (shape) {
    case 'torusKnot':
      return <torusKnotGeometry args={[0.8, 0.3, 128, 32]} />
    case 'icosahedron':
      return <icosahedronGeometry args={[1.2, 0]} />
    case 'cylinder':
      return <cylinderGeometry args={[0.6, 0.8, 3, 32]} />
    case 'cone':
      return <coneGeometry args={[0.8, 2.5, 32]} />
    case 'dodecahedron':
      return <dodecahedronGeometry args={[1.0, 0]} />
  }
}

export default function SculptureModel({ shape, color, position }: SculptureModelProps) {
  const edgeColor = useMemo(() => brightenColor(color, 0.25), [color])

  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh>
        <SculptureMesh shape={shape} />
        <meshStandardMaterial color={color} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      <EdgesWithColor shape={shape} color={edgeColor} />
    </group>
  )
}

function EdgesWithColor({ shape, color }: { shape: SculptureModelProps['shape']; color: string }) {
  const geometry = useMemo(() => {
    let geo: BufferGeometry
    switch (shape) {
      case 'torusKnot':
        geo = new THREE.TorusKnotGeometry(0.8, 0.3, 128, 32)
        break
      case 'icosahedron':
        geo = new THREE.IcosahedronGeometry(1.2, 0)
        break
      case 'cylinder':
        geo = new THREE.CylinderGeometry(0.6, 0.8, 3, 32)
        break
      case 'cone':
        geo = new THREE.ConeGeometry(0.8, 2.5, 32)
        break
      case 'dodecahedron':
        geo = new THREE.DodecahedronGeometry(1.0, 0)
        break
    }
    return new EdgesGeometry(geo)
  }, [shape])

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} />
    </lineSegments>
  )
}
