import { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { ViewpointPreset } from '@/types'
import { VIEWPOINT_PRESETS } from '@/types'
import { useExhibitionStore } from '@/store/useExhibitionStore'
import WallMesh from './WallMesh'
import ArtworkMesh from './ArtworkMesh'
import LightFixture from './LightFixture'
import PathLine from './PathLine'
import SafetyZoneMesh from './SafetyZoneMesh'
import FloorGrid from './FloorGrid'

function CameraController() {
  const cameraPosition = useExhibitionStore((s) => s.cameraPosition)
  const cameraTarget = useExhibitionStore((s) => s.cameraTarget)
  const controlsRef = useRef<any>(null)
  const { camera } = useThree()

  useEffect(() => {
    camera.position.set(...cameraPosition)
    if (controlsRef.current) {
      controlsRef.current.target.set(...cameraTarget)
      controlsRef.current.update()
    }
  }, [cameraPosition, cameraTarget, camera])

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      onChange={() => {
        if (controlsRef.current) {
          const store = useExhibitionStore.getState()
          store.setCamera(
            [camera.position.x, camera.position.y, camera.position.z],
            [controlsRef.current.target.x, controlsRef.current.target.y, controlsRef.current.target.z]
          )
        }
      }}
    />
  )
}

function PlaybackUpdater() {
  const isPlaying = useExhibitionStore((s) => s.isPlaying)
  const playbackSpeed = useExhibitionStore((s) => s.playbackSpeed)

  useFrame((_, delta) => {
    if (isPlaying) {
      const store = useExhibitionStore.getState()
      const paths = store.paths
      if (paths.length === 0) return
      const maxTime = Math.max(...paths.flatMap((p) => p.points.map((pt) => pt.time)), 1)
      const next = store.playbackTime + delta * playbackSpeed
      store.setPlaybackTime(next > maxTime ? 0 : next)
    }
  })

  return null
}

function SceneContent() {
  const walls = useExhibitionStore((s) => s.walls)
  const artworks = useExhibitionStore((s) => s.artworks)
  const lights = useExhibitionStore((s) => s.lights)
  const paths = useExhibitionStore((s) => s.paths)
  const safetyZones = useExhibitionStore((s) => s.safetyZones)
  const conflicts = useExhibitionStore((s) => s.conflicts)
  const showPaths = useExhibitionStore((s) => s.showPaths)
  const selectedId = useExhibitionStore((s) => s.selectedId)
  const selectedType = useExhibitionStore((s) => s.selectedType)
  const playbackTime = useExhibitionStore((s) => s.playbackTime)

  const conflictIds = new Set(conflicts.flatMap((c) => c.affectedIds))

  return (
    <>
      <ambientLight intensity={0.3} />

      {walls.map((wall) => (
        <WallMesh key={wall.id} wall={wall} />
      ))}

      {artworks.map((artwork) => (
        <ArtworkMesh
          key={artwork.id}
          artwork={artwork}
          isConflict={conflictIds.has(artwork.id)}
          isSelected={selectedId === artwork.id && selectedType === 'artwork'}
        />
      ))}

      {lights.map((light) => (
        <LightFixture
          key={light.id}
          light={light}
          isConflict={conflictIds.has(light.id)}
          isSelected={selectedId === light.id && selectedType === 'light'}
        />
      ))}

      {showPaths && paths.map((path) => (
        <PathLine
          key={path.id}
          path={path}
          isConflict={conflictIds.has(path.id)}
          isSelected={selectedId === path.id && selectedType === 'path'}
          currentTime={playbackTime}
        />
      ))}

      {safetyZones.map((zone) => (
        <SafetyZoneMesh
          key={zone.id}
          zone={zone}
          artwork={artworks.find((a) => a.id === zone.artworkId)}
        />
      ))}

      <FloorGrid />
      <CameraController />
      <PlaybackUpdater />
    </>
  )
}

const VIEWPOINT_LABELS: Record<ViewpointPreset, string> = {
  front: '正面',
  back: '背面',
  left: '左侧',
  right: '右侧',
  top: '俯瞰',
  free: '自由',
}

export default function ExhibitionScene() {
  const currentViewpoint = useExhibitionStore((s) => s.currentViewpoint)
  const setViewpoint = useExhibitionStore((s) => s.setViewpoint)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [8, 6, 8], fov: 50, near: 0.1, far: 100 }}
        style={{ background: '#1a1a2e' }}
      >
        <SceneContent />
      </Canvas>

      <div style={{
        position: 'absolute',
        bottom: 60,
        left: 12,
        display: 'flex',
        gap: 6,
        zIndex: 10,
      }}>
        {(Object.keys(VIEWPOINT_PRESETS) as ViewpointPreset[]).map((vp) => (
          <button
            key={vp}
            onClick={() => setViewpoint(vp)}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.2)',
              background: currentViewpoint === vp ? 'rgba(59,130,246,0.8)' : 'rgba(0,0,0,0.5)',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {VIEWPOINT_LABELS[vp]}
          </button>
        ))}
      </div>
    </div>
  )
}
