import * as THREE from 'three'
import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import type { Shelf } from '../../utils/types'

interface ShelfMeshProps {
  shelves: Shelf[]
}

export default function ShelfMesh({ shelves }: ShelfMeshProps) {
  return (
    <group>
      {shelves.map((shelf) => (
        <ShelfItem key={shelf.id} shelf={shelf} />
      ))}
    </group>
  )
}

function ShelfItem({ shelf }: { shelf: Shelf }) {
  const edges = useMemo(() => {
    const geo = new THREE.BoxGeometry(shelf.size[0], shelf.size[1], shelf.size[2])
    const edgesGeo = new THREE.EdgesGeometry(geo)
    geo.dispose()
    return edgesGeo
  }, [shelf.size])

  return (
    <group position={[shelf.position[0], shelf.position[1] + shelf.size[1] / 2, shelf.position[2]]}>
      <mesh>
        <boxGeometry args={[shelf.size[0], shelf.size[1], shelf.size[2]]} />
        <meshStandardMaterial color="#1a2744" transparent opacity={0.7} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#3a5a8a" />
      </lineSegments>
      <Html
        position={[0, shelf.size[1] / 2 + 0.3, 0]}
        center
        style={{
          color: '#00f0ff',
          fontSize: '11px',
          fontFamily: 'monospace',
          background: 'rgba(0,0,0,0.6)',
          padding: '2px 6px',
          borderRadius: '3px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {shelf.zoneCode}
      </Html>
    </group>
  )
}
