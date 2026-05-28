import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import { useTermWallStore } from "@/store/useTermWallStore"

const PRESETS: Record<string, { pos: [number, number, number]; target: [number, number, number] }> = {
  perspective: { pos: [15, 12, 15], target: [0, 2, 0] },
  front: { pos: [0, 5, 20], target: [0, 2, 0] },
  side: { pos: [20, 5, 0], target: [0, 2, 0] },
  top: { pos: [0, 25, 0.01], target: [0, 0, 0] },
}

export default function CameraController() {
  const cameraPreset = useTermWallStore((s) => s.cameraPreset)
  const controlsRef = useRef<any>(null)
  const targetPos = useRef(new THREE.Vector3(...(PRESETS.perspective.pos)))
  const targetLookAt = useRef(new THREE.Vector3(...(PRESETS.perspective.target)))

  const preset = PRESETS[cameraPreset] || PRESETS.perspective
  targetPos.current.set(...preset.pos)
  targetLookAt.current.set(...preset.target)

  useFrame(({ camera }) => {
    camera.position.lerp(targetPos.current, 0.03)
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLookAt.current, 0.03)
      controlsRef.current.update()
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={5}
      maxDistance={60}
      maxPolarAngle={Math.PI / 2.1}
    />
  )
}
