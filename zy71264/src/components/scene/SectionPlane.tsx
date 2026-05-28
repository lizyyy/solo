import { useMemo, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

interface SectionPlaneProps {
  sectionY: number
}

export const SectionPlane = ({ sectionY }: SectionPlaneProps) => {
  const { gl, scene } = useThree()

  const clippingPlane = useMemo(() => {
    return new THREE.Plane(new THREE.Vector3(0, 1, 0), -sectionY)
  }, [sectionY])

  useEffect(() => {
    gl.localClippingEnabled = true
    return () => {
      gl.localClippingEnabled = false
    }
  }, [gl])

  useEffect(() => {
    clippingPlane.constant = -sectionY
  }, [clippingPlane, sectionY])

  const planeMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: '#00d4ff',
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  }, [])

  const gridMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: '#00d4ff',
      transparent: true,
      opacity: 0.3,
    })
  }, [])

  const gridGeometry = useMemo(() => {
    const points: THREE.Vector3[] = []
    const size = 30
    const divisions = 30

    for (let i = 0; i <= divisions; i++) {
      const pos = (i / divisions - 0.5) * size
      points.push(new THREE.Vector3(pos, 0, -size / 2))
      points.push(new THREE.Vector3(pos, 0, size / 2))
      points.push(new THREE.Vector3(-size / 2, 0, pos))
      points.push(new THREE.Vector3(size / 2, 0, pos))
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    return geometry
  }, [])

  return (
    <group position={[0, sectionY, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={planeMaterial}>
        <planeGeometry args={[30, 30]} />
      </mesh>
      <lineSegments geometry={gridGeometry} material={gridMaterial} />
    </group>
  )
}
