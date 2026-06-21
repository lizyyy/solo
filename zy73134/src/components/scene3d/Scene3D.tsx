import React, { useEffect, useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useStationStore } from '@/store/stationStore'
import OceanFloor from './OceanFloor'
import StationMarker from './StationMarker'
import CloudOverlay from './CloudOverlay'
import { StationRecord } from '@/types/station'

const lngLatToXZ = (lng: number, lat: number): [number, number] => {
  const x = (lng - 122.5) * 20
  const z = (lat - 30.5) * 20
  return [x, z]
}

interface CameraControllerProps {
  controlsRef: React.MutableRefObject<any>
}

const CameraController: React.FC<CameraControllerProps> = ({ controlsRef }) => {
  const { camera } = useThree()
  const { records, selectedId, getLatestByStation } = useStationStore()
  const flyTargetRef = useRef<{ pos: THREE.Vector3; lookAt: THREE.Vector3; t: number } | null>(null)
  const resetTriggerRef = useRef(0)

  useEffect(() => {
    const handleFlyTo = (e: Event) => {
      const custom = e as CustomEvent<{ id: string }>
      const id = custom.detail?.id
      if (!id) return

      const allRecords = getLatestByStation()
      const rec = allRecords.find((r) => r.id === id) || records.find((r) => r.id === id)
      if (!rec) return

      const [x, z] = lngLatToXZ(rec.lng, rec.lat)
      const h = rec.energy_output * 0.4 + 2

      flyTargetRef.current = {
        pos: new THREE.Vector3(x + 18, h + 20, z + 18),
        lookAt: new THREE.Vector3(x, h / 2, z),
        t: 0,
      }
    }

    const handleReset = () => {
      resetTriggerRef.current += 1
      flyTargetRef.current = {
        pos: new THREE.Vector3(0, 80, 120),
        lookAt: new THREE.Vector3(0, 0, 0),
        t: 0,
      }
    }

    window.addEventListener('fly-to-station', handleFlyTo)
    window.addEventListener('reset-camera', handleReset)
    return () => {
      window.removeEventListener('fly-to-station', handleFlyTo)
      window.removeEventListener('reset-camera', handleReset)
    }
  }, [camera, records, getLatestByStation])

  useFrame((_, delta) => {
    const ft = flyTargetRef.current
    if (ft && ft.t < 1) {
      ft.t = Math.min(1, ft.t + delta * 1.6)
      const eased = 1 - Math.pow(1 - ft.t, 3)
      const startPos = camera.position.clone()
      const startLook = new THREE.Vector3()
      if (controlsRef.current) {
        startLook.copy(controlsRef.current.target || new THREE.Vector3())
      }
      const flyStartPos = (ft as any)._startPos
      const flyStartLook = (ft as any)._startLook
      if (!flyStartPos) {
        ;(ft as any)._startPos = startPos.clone()
        ;(ft as any)._startLook = startLook.clone()
      }
      const sp = (ft as any)._startPos
      const sl = (ft as any)._startLook
      camera.position.lerpVectors(sp, ft.pos, eased)
      if (controlsRef.current) {
        controlsRef.current.target.lerpVectors(sl, ft.lookAt, eased)
        controlsRef.current.update()
      }
      if (ft.t >= 1) {
        flyTargetRef.current = null
      }
    }
  })

  return null
}

const Scene3DInner: React.FC = () => {
  const controlsRef = useRef<any>(null)
  const { getLatestByStation, viewMode, selectedId, selectStation } = useStationStore()

  const stations: StationRecord[] = useMemo(() => {
    const latest = getLatestByStation()
    if (viewMode === 'anomaly') {
      return latest.filter(
        (r) => r.time_conflict || r.result_abnormal || r.cloud_impact === '严重',
      )
    }
    return latest
  }, [viewMode, getLatestByStation])

  const getBatchTint = (r: StationRecord): string => {
    if (viewMode !== 'batch') return ''
    if (r.status === '原始') return '#5A8EB8'
    if (r.status === '已核对') return '#00D4AA'
    return '#FFB703'
  }

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 80, 120]} fov={45} near={0.1} far={1000} />
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        minDistance={40}
        maxDistance={260}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 0, 0]}
      />

      <CameraController controlsRef={controlsRef} />

      <ambientLight intensity={0.35} color="#C2DBFF" />
      <directionalLight
        position={[60, 100, 40]}
        intensity={1.2}
        color="#E8F4FF"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <hemisphereLight
        args={['#C2DBFF', '#071A2F', 0.6]}
      />
      <pointLight position={[0, 40, 0]} intensity={0.5} color="#00D4AA" distance={200} />

      <OceanFloor />

      {stations.map((r) => (
        <StationMarker
          key={r.id}
          record={r}
          isSelected={selectedId === r.id}
          onClick={() => selectStation(r.id)}
          customColor={getBatchTint(r)}
        />
      ))}

      <CloudOverlay />

      <Suspense fallback={null}>
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.15}
            luminanceSmoothing={0.9}
            intensity={0.6}
            mipmapBlur
            radius={0.8}
          />
        </EffectComposer>
      </Suspense>
    </>
  )
}

const Scene3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { getLatestByStation, viewMode } = useStationStore()

  const latestList = getLatestByStation()
  const totalCount = latestList.length
  const anomalyCount = latestList.filter(
    (r) => r.time_conflict || r.result_abnormal,
  ).length
  const cloudCount = latestList.filter((r) => r.cloud_impact !== '无').length

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 120%, rgba(0,212,170,0.10) 0%, rgba(10,37,64,0) 55%), radial-gradient(ellipse at 20% 30%, rgba(0,180,200,0.08) 0%, rgba(10,37,64,0) 60%), linear-gradient(180deg, #041122 0%, #071A2F 40%, #0A2540 100%)',
      }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        className="w-full h-full"
      >
        <Scene3DInner />
      </Canvas>

      <div className="absolute top-[18%] left-[10%] text-[11px] font-mono text-teal-glow/35 tracking-widest pointer-events-none select-none">
        TIDAL-GRID v2.6 · ZHOUSHAN-ARCHIPELAGO
      </div>
      <div className="absolute bottom-[8%] left-[10%] text-[11px] font-mono text-teal-glow/25 tracking-widest pointer-events-none select-none">
        COORD · WGS-84 / EPSG:4326
      </div>

      <div className="absolute bottom-4 left-4 glass rounded-xl px-4 py-3 border border-deepsea-500/40 z-10 max-w-[280px]">
        <p className="text-[11px] font-display font-semibold text-teal-glow mb-2 tracking-wider">
          图例 · LEGEND
        </p>
        <div className="space-y-1.5 text-[11px] text-deepsea-100/90">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-teal-glow shadow-[0_0_6px_rgba(0,212,170,0.8)] inline-block" />
            <span>正常 · 已核对</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-alert-yellow shadow-[0_0_6px_rgba(255,183,3,0.8)] inline-block" />
            <span>待确认 · 原始记录</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-alert-red shadow-[0_0_6px_rgba(255,90,95,0.8)] inline-block" />
            <span>异常 · 时间冲突 / 结果超阈</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-alert-gray shadow-[0_0_6px_rgba(138,148,166,0.8)] inline-block" />
            <span>云遮严重 · 数据待复核</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-deepsea-600/40 flex items-center justify-between text-[10.5px] text-deepsea-200/80">
          <span>总站点 <span className="font-mono text-teal-glow">{totalCount}</span></span>
          <span>异常 <span className="font-mono text-alert-red">{anomalyCount}</span></span>
          <span>云遮 <span className="font-mono text-alert-yellow">{cloudCount}</span></span>
        </div>
      </div>

      <div className="absolute top-4 right-4 glass rounded-lg px-3 py-2 text-[10.5px] text-deepsea-200/70 font-mono z-10 border border-deepsea-500/40">
        <div>拖动旋转 · 滚轮缩放</div>
        <div className="text-teal-glow/70">点击标记查看详情</div>
      </div>

      {viewMode === 'batch' && (
        <div className="absolute top-20 right-4 glass rounded-lg px-3 py-2 text-[10.5px] z-10 border border-deepsea-500/40">
          <div className="font-display font-semibold text-teal-glow mb-1">按批次着色</div>
          <div className="space-y-1 text-deepsea-100/85">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded bg-deepsea-300" />
              <span>原始</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded bg-teal-glow" />
              <span>已核对</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded bg-alert-yellow" />
              <span>已修正</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Scene3D
