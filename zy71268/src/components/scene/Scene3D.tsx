import { forwardRef, useRef, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import * as THREE from 'three'
import { useSculptureStore } from '@/store/useSculptureStore'
import SculptureModel from './SculptureModel'
import COGMarker from './COGMarker'
import BaseOutline from './BaseOutline'
import WindArrow from './WindArrow'
import SupportCone from './SupportCone'

function SceneContent() {
  const sculptures = useSculptureStore((s) => s.sculptures)
  const selectedId = useSculptureStore((s) => s.selectedId)
  const sculpture = sculptures.find((s) => s.id === selectedId) ?? null
  const updateCOG = useSculptureStore((s) => s.updateCOG)

  const handleCOGDrag = useCallback(
    (id: string, cog: { x: number; y: number; z: number }) => {
      updateCOG(id, cog)
    },
    [updateCOG]
  )

  if (!sculpture) return null

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow />

      <SculptureModel
        shape={sculpture.shape}
        color={sculpture.color}
        position={sculpture.position}
      />

      <COGMarker
        cog={sculpture.centerOfGravity}
        cogLimit={sculpture.cogLimit}
        sculptureId={sculpture.id}
        onDrag={handleCOGDrag}
      />

      <BaseOutline
        base={sculpture.base}
        baseMinRequired={sculpture.baseMinRequired}
      />

      <WindArrow windLoad={sculpture.windLoad} />

      <SupportCone
        base={sculpture.base}
        cog={sculpture.centerOfGravity}
        cogLimit={sculpture.cogLimit}
      />

      <Grid
        args={[20, 20]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#1a2332"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#2a3a4f"
        fadeDistance={25}
        fadeStrength={1}
        infiniteGrid
        position={[0, 0, 0]}
      />

      <OrbitControls
        makeDefault
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2 - 0.05}
        enableDamping
        dampingFactor={0.1}
      />
    </>
  )
}

const Scene3D = forwardRef<THREE.WebGLRenderer>((_, ref) => {
  const internalRef = useRef<THREE.WebGLRenderer | null>(null)

  const handleCreated = useCallback(
    ({ gl }: { gl: THREE.WebGLRenderer }) => {
      internalRef.current = gl
      if (typeof ref === 'function') {
        ref(gl)
      } else if (ref) {
        (ref as React.MutableRefObject<THREE.WebGLRenderer | null>).current = gl
      }
    },
    [ref]
  )

  return (
    <Canvas
      camera={{ position: [5, 5, 5], fov: 45, near: 0.1, far: 100 }}
      onCreated={handleCreated}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      style={{ background: '#0d1117' }}
    >
      <SceneContent />
    </Canvas>
  )
})

Scene3D.displayName = 'Scene3D'

export default Scene3D
