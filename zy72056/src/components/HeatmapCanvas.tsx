import { useRef, useMemo, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Html } from "@react-three/drei"
import { EffectComposer, Bloom } from "@react-three/postprocessing"
import * as THREE from "three"
import { useAppStore } from "@/store/useAppStore"
import { CONGESTION_COLORS, QUALITY_STATUS_COLORS } from "@/data/types"
import { STATION_BOUNDS } from "@/data/mockStation"
import type { StationPoint, QualityStatus } from "@/data/types"

const FLOOR_HEIGHTS: Record<string, number> = { B1: 0, B2: -20 }

function lerpColor(pos: number): [number, number, number] {
  const colors = CONGESTION_COLORS
  if (pos <= 0) return colors[0].color as [number, number, number]
  if (pos >= 1) return colors[colors.length - 1].color as [number, number, number]
  for (let i = 0; i < colors.length - 1; i++) {
    if (pos >= colors[i].pos && pos <= colors[i + 1].pos) {
      const range = colors[i + 1].pos - colors[i].pos
      const t = (pos - colors[i].pos) / range
      return [
        colors[i].color[0] + (colors[i + 1].color[0] - colors[i].color[0]) * t,
        colors[i].color[1] + (colors[i + 1].color[1] - colors[i].color[1]) * t,
        colors[i].color[2] + (colors[i + 1].color[2] - colors[i].color[2]) * t,
      ]
    }
  }
  return [0.5, 0.5, 0.5]
}

function FloorPlan({ floor, bounds }: { floor: string; bounds: typeof STATION_BOUNDS["B1"] }) {
  const height = FLOOR_HEIGHTS[floor]
  const { minX, maxX, minY, maxY } = bounds
  const w = maxX - minX
  const h = maxY - minY

  const walls = useMemo(() => {
    const arr: [number, number, number, number][] = []
    arr.push([minX, maxY, w, 1])
    arr.push([minX, minY, w, 1])
    arr.push([minX, minY, 1, h])
    arr.push([maxX, minY, 1, h])
    arr.push([minX + 80, minY + 40, 1, 30])
    arr.push([minX + 120, minY + 40, 1, 30])
    arr.push([minX + 40, minY + 70, 120, 1])
    return arr
  }, [minX, maxX, minY, maxY, w, h])

  const corridor = useMemo(() => {
    return [
      { x: minX + w / 2, y: minY + h / 2, w: 8, h: h },
      { x: minX + w / 2, y: minY + h / 2, w: w, h: 8 },
    ]
  }, [minX, minY, w, h])

  return (
    <group position={[0, height, 0]}>
      <mesh position={[minX + w / 2, -0.05, minY + h / 2]} receiveShadow>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#1A1A2E" transparent opacity={0.8} />
      </mesh>

      {corridor.map((c, i) => (
        <mesh key={`corr-${i}`} position={[c.x, -0.02, c.y]}>
          <planeGeometry args={[c.w, c.h]} />
          <meshStandardMaterial color="#16213E" transparent opacity={0.9} />
        </mesh>
      ))}

      {walls.map((wall, i) => (
        <mesh key={`wall-${i}`} position={[wall[0] + wall[2] / 2, 0.5, wall[1] + wall[3] / 2]}>
          <boxGeometry args={[wall[2], 3, wall[3]]} />
          <meshStandardMaterial color="#2D3748" transparent opacity={0.9} />
        </mesh>
      ))}

      <Html position={[minX + 10, 0.1, minY + 10]} style={{ pointerEvents: "none" }}>
        <div className="text-xs text-white/40 whitespace-nowrap">{floor} 站厅</div>
      </Html>
    </group>
  )
}

function HeatmapLayer({ points, floor, timeHour, bounds }: {
  points: StationPoint[]; floor: string; timeHour: number; bounds: typeof STATION_BOUNDS["B1"]
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const height = FLOOR_HEIGHTS[floor]
  const { getCongestionForHour } = useAppStore()

  const shaderMaterial = useMemo(() => {
    const floorPoints = points.filter(p => p.floor === floor)
    const positions = new Float32Array(120)
    const congestions = new Float32Array(60)
    floorPoints.forEach((p, i) => {
      positions[i * 2] = p.x
      positions[i * 2 + 1] = p.y
      congestions[i] = getCongestionForHour(p.id, timeHour)
    })

    return new THREE.ShaderMaterial({
      uniforms: {
        uPositions: { value: positions },
        uCongestions: { value: congestions },
        uPointCount: { value: floorPoints.length },
        uBounds: { value: new THREE.Vector4(bounds.minX, bounds.maxX, bounds.minY, bounds.maxY) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uPositions[120];
        uniform float uCongestions[60];
        uniform int uPointCount;
        uniform vec4 uBounds;

        vec3 getHeatColor(float t) {
          if (t < 0.25) return mix(vec3(0.1, 0.3, 0.8), vec3(0.1, 0.7, 0.3), t * 4.0);
          if (t < 0.5) return mix(vec3(0.1, 0.7, 0.3), vec3(0.9, 0.8, 0.1), (t - 0.25) * 4.0);
          if (t < 0.75) return mix(vec3(0.9, 0.8, 0.1), vec3(0.9, 0.3, 0.1), (t - 0.5) * 4.0);
          return mix(vec3(0.9, 0.3, 0.1), vec3(0.9, 0.1, 0.1), (t - 0.75) * 4.0);
        }

        void main() {
          float x = mix(uBounds.x, uBounds.y, vUv.x);
          float y = mix(uBounds.z, uBounds.w, vUv.y);
          float totalCongestion = 0.0;
          float totalWeight = 0.0;

          for (int i = 0; i < 60; i++) {
            if (i >= uPointCount) break;
            float px = uPositions[i * 2];
            float py = uPositions[i * 2 + 1];
            float dist = distance(vec2(x, y), vec2(px, py));
            float radius = 25.0;
            if (dist < radius) {
              float weight = 1.0 - (dist / radius);
              weight = weight * weight;
              totalCongestion += uCongestions[i] * weight;
              totalWeight += weight;
            }
          }

          float t = totalWeight > 0.0 ? totalCongestion / totalWeight : 0.0;
          vec3 color = getHeatColor(t);
          float alpha = min(totalWeight * 0.7, 0.6);
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
    })
  }, [points, floor, timeHour, bounds, getCongestionForHour])

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position)
    }
  })

  const { minX, maxX, minY, maxY } = bounds
  const w = maxX - minX
  const h = maxY - minY

  return (
    <mesh
      ref={meshRef}
      position={[minX + w / 2, height + 0.1, minY + h / 2]}
      material={shaderMaterial}
    >
      <planeGeometry args={[w, h]} />
    </mesh>
  )
}

function DeviceMarkers({ points, timeHour }: { points: StationPoint[]; timeHour: number }) {
  const { selectedPointId, selectPoint, getPointQualityStatus, getCongestionForHour } = useAppStore()
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const markers = useMemo(() => {
    return points.map(p => {
      const status = getPointQualityStatus(p) as QualityStatus
      const congestion = getCongestionForHour(p.id, timeHour)
      const color = lerpColor(congestion)
      const height = FLOOR_HEIGHTS[p.floor] ?? 0
      return { ...p, status, congestion, color, height }
    })
  }, [points, timeHour, getPointQualityStatus, getCongestionForHour])

  return (
    <>
      {markers.map(p => (
        <group key={p.id} position={[p.x, p.height + 0.5, p.y]}>
          <mesh
            onClick={(e) => {
              e.stopPropagation()
              selectPoint(p.id)
            }}
            onPointerOver={(e) => {
              e.stopPropagation()
              setHoveredId(p.id)
              document.body.style.cursor = "pointer"
            }}
            onPointerOut={() => {
              setHoveredId(null)
              document.body.style.cursor = "default"
            }}
          >
            <circleGeometry args={[2, 16]} />
            <meshBasicMaterial color={p.color} transparent opacity={0.9} />
          </mesh>

          <mesh position={[0, 0.01, 0]}>
            <ringGeometry args={[2.2, 2.8, 16]} />
            <meshBasicMaterial
              color={QUALITY_STATUS_COLORS[p.status]}
              transparent
              opacity={selectedPointId === p.id ? 1 : 0.7}
            />
          </mesh>

          {selectedPointId === p.id && (
            <SelectedRing position={[0, 0.02, 0]} />
          )}

          {hoveredId === p.id && (
            <Html position={[0, 1, 0]} center>
              <div className="bg-[#1A1A2E]/95 border border-white/20 rounded px-2 py-1 text-xs text-white whitespace-nowrap pointer-events-none shadow-lg">
                <div className="font-medium">{p.name}</div>
                <div className="text-white/60">拥挤度: {(p.congestion * 100).toFixed(0)}%</div>
              </div>
            </Html>
          )}
        </group>
      ))}
    </>
  )
}

function SelectedRing({ position }: { position: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (meshRef.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.15
      meshRef.current.scale.set(s, s, s)
    }
  })
  return (
    <mesh ref={meshRef} position={position}>
      <ringGeometry args={[3, 3.6, 24]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
    </mesh>
  )
}

function CameraController() {
  return (
    <OrbitControls
      enableRotate={false}
      enablePan={true}
      enableZoom={true}
      maxZoom={2}
      minZoom={0.3}
      mouseButtons={{
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
      }}
    />
  )
}

export default function HeatmapCanvas() {
  const { filter, getFilteredPoints } = useAppStore()
  const points = getFilteredPoints()

  return (
    <div className="flex-1 relative bg-[#0D1117]">
      <Canvas
        orthographic
        camera={{ position: [100, 120, 100], zoom: 3.5, near: 0.1, far: 1000 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        onPointerMissed={() => useAppStore.getState().selectPoint(null)}
      >
        <color attach="background" args={["#0D1117"]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[100, 150, 100]} intensity={0.5} castShadow />

        {filter.floors.map(floor => (
          <FloorPlan
            key={`floor-${floor}`}
            floor={floor}
            bounds={STATION_BOUNDS[floor as keyof typeof STATION_BOUNDS] ?? STATION_BOUNDS.B1}
          />
        ))}

        {filter.floors.map(floor => (
          <HeatmapLayer
            key={`heat-${floor}`}
            points={points}
            floor={floor}
            timeHour={filter.timeHour}
            bounds={STATION_BOUNDS[floor as keyof typeof STATION_BOUNDS] ?? STATION_BOUNDS.B1}
          />
        ))}

        <DeviceMarkers points={points} timeHour={filter.timeHour} />

        <CameraController />

        <EffectComposer>
          <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={0.4} mipmapBlur />
        </EffectComposer>
      </Canvas>

      <div className="absolute top-4 left-4 flex flex-col gap-1 pointer-events-none">
        {CONGESTION_COLORS.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: `rgb(${Math.round(c.color[0] * 255)}, ${Math.round(c.color[1] * 255)}, ${Math.round(c.color[2] * 255)})` }}
            />
            <span className="text-[10px] text-white/60">
              {i === 0 ? "空闲" : i === CONGESTION_COLORS.length - 1 ? "拥堵" : `${Math.round(c.pos * 100)}%`}
            </span>
          </div>
        ))}
      </div>

      <div className="absolute top-4 right-4 flex gap-2 pointer-events-none">
        {(Object.keys(QUALITY_STATUS_COLORS) as QualityStatus[]).map(status => (
          <div key={status} className="flex items-center gap-1.5 bg-[#1A1A2E]/80 px-2 py-1 rounded">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: QUALITY_STATUS_COLORS[status] }} />
            <span className="text-[10px] text-white/70">
              {status === "ok" ? "正常" : status === "warning" ? "警告" : "异常"}
            </span>
          </div>
        ))}
      </div>

      <div className="absolute bottom-4 left-4 text-[10px] text-white/40 pointer-events-none">
        鼠标左键拖动平移 | 滚轮缩放 | 当前时段: {filter.timeHour}:00
      </div>
    </div>
  )
}
