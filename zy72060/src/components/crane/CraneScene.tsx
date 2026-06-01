import { useRef, useEffect, useCallback } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useStore } from '@/store/useStore'
import { VIEW_PRESETS, ViewPreset } from '@/types'
import CraneModel from './CraneModel'
import InspectionPointMarker from './InspectionPointMarker'

function CameraController() {
  const { camera } = useThree()
  const { cameraState, viewPreset } = useStore()
  const prevPresetRef = useRef<ViewPreset>(viewPreset)

  useEffect(() => {
    if (prevPresetRef.current !== viewPreset && viewPreset !== 'free') {
      const target = VIEW_PRESETS[viewPreset]
      if (target) {
        const startPos = camera.position.clone()
        const endPos = new THREE.Vector3(...target.position)
        const startTarget = new THREE.Vector3(0, 5, 0)
        const endTarget = new THREE.Vector3(...target.target)
        let progress = 0

        const animate = () => {
          progress += 0.03
          if (progress >= 1) {
            camera.position.copy(endPos)
            camera.lookAt(endTarget)
            useStore.getState().setCameraState({
              position: [endPos.x, endPos.y, endPos.z],
              target: [endTarget.x, endTarget.y, endTarget.z],
            })
            return
          }
          const eased = 1 - Math.pow(1 - progress, 3)
          camera.position.lerpVectors(startPos, endPos, eased)
          const currentTarget = new THREE.Vector3().lerpVectors(startTarget, endTarget, eased)
          camera.lookAt(currentTarget)
          requestAnimationFrame(animate)
        }
        animate()
      }
    }
    prevPresetRef.current = viewPreset
  }, [viewPreset, camera])

  useEffect(() => {
    camera.position.set(...cameraState.position)
    camera.lookAt(...cameraState.target)
  }, [])

  return null
}

function Scene() {
  const { points, setCameraState } = useStore()
  const controlsRef = useRef<any>(null)

  const handleControlsChange = useCallback(() => {
    if (controlsRef.current) {
      const pos = controlsRef.current.object.position
      const target = controlsRef.current.target
      setCameraState({
        position: [pos.x, pos.y, pos.z],
        target: [target.x, target.y, target.z],
      })
    }
  }, [setCameraState])

  return (
    <>
      <CameraController />
      <OrbitControls
        ref={controlsRef}
        onChange={handleControlsChange}
        target={[0, 5, 0]}
        minDistance={5}
        maxDistance={50}
        enableDamping
        dampingFactor={0.05}
      />
      <ambientLight intensity={0.3} color="#FFE4C4" />
      <directionalLight position={[10, 20, 10]} intensity={0.8} color="#E0F0FF" />
      <directionalLight position={[-5, 10, -5]} intensity={0.2} color="#FFE4C4" />

      <CraneModel />
      {points.map((point) => (
        <InspectionPointMarker key={point.id} point={point} />
      ))}

      <EffectComposer>
        <Bloom
          intensity={0.5}
          luminanceThreshold={0.6}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </>
  )
}

export default function CraneScene() {
  const { selectPoint } = useStore()

  return (
    <div
      className="w-full h-full"
      onClick={(e) => {
        if ((e.target as HTMLElement).tagName === 'CANVAS') {
          const { selectedPointId } = useStore.getState()
          if (selectedPointId) {
            selectPoint(null)
          }
        }
      }}
    >
      <Canvas
        camera={{ position: [15, 10, 15], fov: 50, near: 0.1, far: 200 }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        style={{ background: '#0A1520' }}
      >
        <Scene />
      </Canvas>
    </div>
  )
}
