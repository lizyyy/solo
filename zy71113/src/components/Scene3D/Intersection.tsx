import * as THREE from 'three'
import type { IntersectionGeometry } from '../../types'

interface IntersectionProps {
  intersection: IntersectionGeometry
}

function Intersection({ intersection }: IntersectionProps) {
  const roadShape = new THREE.Shape()
  roadShape.moveTo(-20, -20)
  roadShape.lineTo(-20, -8)
  roadShape.lineTo(-8, -8)
  roadShape.lineTo(-8, -20)
  roadShape.lineTo(8, -20)
  roadShape.lineTo(8, -8)
  roadShape.lineTo(20, -8)
  roadShape.lineTo(20, 8)
  roadShape.lineTo(8, 8)
  roadShape.lineTo(8, 20)
  roadShape.lineTo(-8, 20)
  roadShape.lineTo(-8, 8)
  roadShape.lineTo(-20, 8)
  roadShape.lineTo(-20, -20)

  const grassShape = new THREE.Shape()
  grassShape.moveTo(-20, -20)
  grassShape.lineTo(-20, 20)
  grassShape.lineTo(20, 20)
  grassShape.lineTo(20, -20)
  grassShape.lineTo(-20, -20)
  grassShape.holes.push(roadShape)

  const roadGeometry = new THREE.ShapeGeometry(roadShape)
  const grassGeometry = new THREE.ShapeGeometry(grassShape)

  const laneMarkings: JSX.Element[] = []
  intersection.lanes.forEach((lane) => {
    if (lane.position.length >= 2) {
      const points = lane.position.map((p) => new THREE.Vector2(p.x, p.y))
      const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p.x, 0.02, p.y)))
      const geometry = new THREE.TubeGeometry(curve, 20, 0.1, 8, false)
      laneMarkings.push(
        <mesh key={lane.id} geometry={geometry}>
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      )
    }
  })

  const crosswalks: JSX.Element[] = []
  intersection.crosswalks.forEach((crosswalk) => {
    if (crosswalk.position.length >= 2) {
      const start = crosswalk.position[0]
      const end = crosswalk.position[1]
      const dx = end.x - start.x
      const dy = end.y - start.y
      const length = Math.sqrt(dx * dx + dy * dy)
      const angle = Math.atan2(dy, dx)

      const stripes = Math.floor(length / 1.5)
      for (let i = 0; i < stripes; i++) {
        const t = (i + 0.5) / stripes
        const x = start.x + dx * t
        const y = start.y + dy * t
        crosswalks.push(
          <mesh
            key={`${crosswalk.id}-${i}`}
            position={[x, 0.03, y]}
            rotation={[-Math.PI / 2, 0, angle]}
          >
            <planeGeometry args={[0.5, crosswalk.width * 0.8]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        )
      }
    }
  })

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={grassGeometry} receiveShadow>
        <meshStandardMaterial color="#1a472a" />
      </mesh>

      <mesh geometry={roadGeometry} position={[0, 0, 0.01]} receiveShadow>
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>

      {laneMarkings}
      {crosswalks}
    </group>
  )
}

export default Intersection
