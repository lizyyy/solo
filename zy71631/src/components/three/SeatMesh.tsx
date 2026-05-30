import { useRef, useMemo, useState } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import useDataStore from '@/stores/dataStore'
import useSceneStore from '@/stores/sceneStore'
import useFilterStore from '@/stores/filterStore'
import { splToColor } from '@/utils'

const SeatMesh = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const seats = useDataStore((state) => state.seats)
  const getMeasurementForSeat = useDataStore((state) => state.getMeasurementForSeat)
  const getFilteredSeatIds = useDataStore((state) => state.getFilteredSeatIds)
  const selectedObject = useSceneStore((state) => state.selectedObject)
  const setSelectedObject = useSceneStore((state) => state.setSelectedObject)
  const currentBand = useSceneStore((state) => state.currentBand)
  const selectedZoneIds = useFilterStore((state) => state.selectedZoneIds)
  const selectedAnomalyTypes = useFilterStore((state) => state.selectedAnomalyTypes)
  const splRange = useFilterStore((state) => state.splRange)

  const filteredSeatIds = useMemo(() => {
    return getFilteredSeatIds(selectedZoneIds, selectedAnomalyTypes, splRange)
  }, [getFilteredSeatIds, selectedZoneIds, selectedAnomalyTypes, splRange])

  const seatColors = useMemo(() => {
    return seats.map((seat) => {
      const measurement = getMeasurementForSeat(seat.id, currentBand)
      const spl = measurement?.splDB ?? 60
      return splToColor(spl)
    })
  }, [seats, currentBand, getMeasurementForSeat])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])

  useFrame(() => {
    if (!meshRef.current) return

    seats.forEach((seat, i) => {
      const isFiltered = filteredSeatIds.includes(seat.id)
      const isSelected = selectedObject?.type === 'seat' && selectedObject.id === seat.id
      const scale = isFiltered ? (isSelected ? 1.3 : 1) : 0.001

      dummy.position.set(seat.x, seat.y, seat.z)
      dummy.scale.set(scale, scale, scale)
      dummy.updateMatrix()
      meshRef.current!.setMatrixAt(i, dummy.matrix)

      const [r, g, b] = seatColors[i]
      color.setRGB(r / 255, g / 255, b / 255)
      if (isSelected) {
        color.multiplyScalar(1.5)
      }
      meshRef.current!.setColorAt(i, color)
    })

    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const instanceId = e.instanceId
    if (instanceId !== undefined && seats[instanceId]) {
      setSelectedObject({ type: 'seat', id: seats[instanceId].id })
    }
  }

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const instanceId = e.instanceId
    if (instanceId !== undefined && seats[instanceId]) {
      setHoveredId(seats[instanceId].id)
      document.body.style.cursor = 'pointer'
    }
  }

  const handlePointerOut = () => {
    setHoveredId(null)
    document.body.style.cursor = 'auto'
  }

  const hoveredSeat = seats.find((s) => s.id === hoveredId)

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, seats.length]}
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
      >
        <boxGeometry args={[0.45, 0.2, 0.45]} />
        <meshStandardMaterial vertexColors toneMapped={false} />
      </instancedMesh>
      {hoveredSeat && (
        <Html position={[hoveredSeat.x, hoveredSeat.y + 0.5, hoveredSeat.z]} center>
          <div className="bg-black/80 text-white px-2 py-1 rounded text-xs whitespace-nowrap pointer-events-none">
            {hoveredSeat.rowLabel}-{hoveredSeat.seatNumber}
          </div>
        </Html>
      )}
    </>
  )
}

export default SeatMesh
