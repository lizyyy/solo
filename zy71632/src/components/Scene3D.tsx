import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars, PerspectiveCamera } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import SurfaceMesh from './SurfaceMesh'
import VectorField from './VectorField'
import SkiPath3D from './SkiPath3D'
import { useClassroomStore } from '@/store'
import { generateGradientField, createEvaluator, computeGradient } from '@/utils/gradient'
import type { ViewMode } from '@/types'

function SceneContent({ activeView }: { activeView: ViewMode }) {
  const { project, gradientField, setGradientField, addPath, setViewState } = useClassroomStore()
  const [replayProgress, setReplayProgress] = useState(0)
  const [replayingPathId, setReplayingPathId] = useState<string | null>(null)
  const replayRef = useRef<number | null>(null)

  useEffect(() => {
    const field = generateGradientField(project.surface, project.vectorField.density)
    setGradientField(field)
  }, [project.surface, project.vectorField.density, setGradientField])

  useEffect(() => {
    if (!replayingPathId) return
    let start: number | null = null
    const duration = 5000

    const animate = (time: number) => {
      if (!start) start = time
      const elapsed = time - start
      const progress = Math.min(elapsed / duration, 1)
      setReplayProgress(progress)
      if (progress < 1) {
        replayRef.current = requestAnimationFrame(animate)
      } else {
        setReplayingPathId(null)
      }
    }

    replayRef.current = requestAnimationFrame(animate)
    return () => {
      if (replayRef.current !== null) cancelAnimationFrame(replayRef.current)
    }
  }, [replayingPathId])

  const handleSurfaceClick = useCallback(
    (e: any) => {
      if (activeView !== 'path') return
      e.stopPropagation()
      const point = e.point as THREE.Vector3
      const mathX = point.x
      const mathY = point.z
      const pathId = addPath([mathX, mathY], project.surface.resolution > 60 ? 0.05 : 0.1, 200)
      setReplayingPathId(pathId)
      setReplayProgress(0)
    },
    [activeView, addPath, project.surface.resolution, setReplayingPathId]
  )

  const showSurface = activeView === 'surface' || activeView === 'path' || activeView === 'vector'
  const showVectorField = activeView === 'vector' || activeView === 'surface'
  const showPaths = activeView === 'path' || activeView === 'surface' || activeView === 'vector'

  return (
    <>
      <PerspectiveCamera makeDefault position={project.viewState.cameraPosition} fov={50} />
      <OrbitControls
        target={project.viewState.cameraTarget}
        enableDamping
        dampingFactor={0.1}
        onChange={(e) => {
          const cam = e.target.object as THREE.PerspectiveCamera
          setViewState({
            cameraPosition: [cam.position.x, cam.position.y, cam.position.z],
            cameraTarget: [e.target.target.x, e.target.target.y, e.target.target.z],
          })
        }}
      />

      <ambientLight intensity={0.15} color="#2a1a4e" />
      <directionalLight position={[10, 15, 5]} intensity={0.8} color="#c8d8ff" />
      <directionalLight position={[-5, 10, -5]} intensity={0.3} color="#8866cc" />

      <Stars radius={50} depth={50} count={2000} factor={3} saturation={0.5} fade speed={1} />

      {showSurface && <SurfaceMesh config={project.surface} />}
      {showVectorField && (
        <VectorField
          field={gradientField}
          config={project.vectorField}
          surfaceConfig={project.surface}
        />
      )}
      {showPaths &&
        project.paths.map((p) => (
          <SkiPath3D
            key={p.id}
            path={p}
            isReplaying={replayingPathId === p.id}
            replayProgress={replayingPathId === p.id ? replayProgress : 1}
          />
        ))}

      {showSurface && (
        <mesh
          visible={activeView === 'path'}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.01, 0]}
          onClick={handleSurfaceClick}
        >
          <planeGeometry args={[project.surface.xRange[1] - project.surface.xRange[0], project.surface.yRange[1] - project.surface.yRange[0]]} />
          <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>
      )}

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

export default function Scene3D() {
  const { project } = useClassroomStore()
  const activeView = project.viewState.activeView

  return (
    <div className="w-full h-full">
      <Canvas
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        style={{ background: '#0a0e1a' }}
      >
        <SceneContent activeView={activeView} />
      </Canvas>
    </div>
  )
}
