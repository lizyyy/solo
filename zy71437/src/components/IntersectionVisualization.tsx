import React, { useRef, useEffect } from 'react'
import type { Scenario, PhaseConfig } from '../../shared/types.js'

interface Vehicle {
  laneId: string
  progress: number
  speed: number
  x: number
  y: number
  angle: number
}

interface Props {
  scenario: Scenario
  currentPhaseIndex: number
  phaseConfig: PhaseConfig[]
}

const CANVAS_SIZE = 500
const CENTER = CANVAS_SIZE / 2
const ROAD_WIDTH = 120
const LANE_WIDTH = 30
const INTERSECTION_SIZE = ROAD_WIDTH

export default function IntersectionVisualization({ scenario, currentPhaseIndex, phaseConfig }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const vehiclesRef = useRef<Vehicle[]>([])
  const animationRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const currentPhase = phaseConfig[currentPhaseIndex]
    const activeLaneIds = new Set<string>()

    if (currentPhase) {
      currentPhase.movements.forEach(movement => {
        const approach = scenario.approaches.find(a => a.id === movement.approachId)
        if (approach) {
          approach.lanes.forEach(lane => {
            if (lane.type === movement.laneType) {
              activeLaneIds.add(lane.id)
            }
          })
        }
      })
    }

    const getApproachLaneBounds = (approach: typeof scenario.approaches[0], laneIndex: number) => {
      const laneCount = approach.lanes.length
      const totalWidth = laneCount * LANE_WIDTH
      const startOffset = -totalWidth / 2 + laneIndex * LANE_WIDTH

      let x1 = 0, y1 = 0, x2 = 0, y2 = 0
      const stopLineDist = INTERSECTION_SIZE / 2 + 10

      switch (approach.direction) {
        case 'north':
          x1 = CENTER + startOffset
          y1 = 0
          x2 = CENTER + startOffset
          y2 = CENTER - stopLineDist
          break
        case 'south':
          x1 = CENTER - startOffset - LANE_WIDTH
          y1 = CANVAS_SIZE
          x2 = CENTER - startOffset - LANE_WIDTH
          y2 = CENTER + stopLineDist
          break
        case 'east':
          x1 = CANVAS_SIZE
          y1 = CENTER + startOffset
          x2 = CENTER + stopLineDist
          y2 = CENTER + startOffset
          break
        case 'west':
          x1 = 0
          y1 = CENTER - startOffset - LANE_WIDTH
          x2 = CENTER - stopLineDist
          y2 = CENTER - startOffset - LANE_WIDTH
          break
      }

      return { x1, y1, x2, y2, startOffset }
    }

    const getLaneCenter = (approach: typeof scenario.approaches[0], laneIndex: number, progress: number) => {
      const bounds = getApproachLaneBounds(approach, laneIndex)
      const t = progress / 100
      const x = bounds.x1 + (bounds.x2 - bounds.x1) * t
      const y = bounds.y1 + (bounds.y2 - bounds.y1) * t
      let angle = 0
      
      switch (approach.direction) {
        case 'north': angle = -Math.PI / 2; break
        case 'south': angle = Math.PI / 2; break
        case 'east': angle = 0; break
        case 'west': angle = Math.PI; break
      }
      
      return { x, y, angle }
    }

    const drawRoad = () => {
      ctx.fillStyle = '#334155'
      
      if (scenario.intersectionType === 'cross' || scenario.intersectionType === 'T') {
        ctx.fillRect(CENTER - ROAD_WIDTH / 2, 0, ROAD_WIDTH, CANVAS_SIZE)
        ctx.fillRect(0, CENTER - ROAD_WIDTH / 2, CANVAS_SIZE, ROAD_WIDTH)
      }

      ctx.fillStyle = '#334155'
      ctx.fillRect(CENTER - INTERSECTION_SIZE / 2, CENTER - INTERSECTION_SIZE / 2, INTERSECTION_SIZE, INTERSECTION_SIZE)
    }

    const drawLanes = () => {
      scenario.approaches.forEach(approach => {
        approach.lanes.forEach((lane, laneIndex) => {
          const bounds = getApproachLaneBounds(approach, laneIndex)
          const isActive = activeLaneIds.has(lane.id)

          ctx.fillStyle = isActive ? 'rgba(34, 197, 94, 0.3)' : 'rgba(71, 85, 105, 0.5)'
          
          const laneLength = Math.sqrt(Math.pow(bounds.x2 - bounds.x1, 2) + Math.pow(bounds.y2 - bounds.y1, 2))
          
          ctx.save()
          ctx.translate(bounds.x1, bounds.y1)
          
          let angle = 0
          switch (approach.direction) {
            case 'north': angle = Math.PI / 2; break
            case 'south': angle = -Math.PI / 2; break
            case 'east': angle = 0; break
            case 'west': angle = Math.PI; break
          }
          ctx.rotate(angle)
          
          ctx.fillRect(-LANE_WIDTH / 2, 0, LANE_WIDTH, laneLength)

          if (lane.type === 'bus') {
            ctx.fillStyle = 'rgba(59, 130, 246, 0.5)'
            for (let i = 0; i < laneLength; i += 20) {
              ctx.fillRect(-LANE_WIDTH / 2 + 5, i, LANE_WIDTH - 10, 8)
            }
          }

          ctx.restore()

          if (lane.type !== 'bus') {
            ctx.save()
            const arrowX = (bounds.x1 + bounds.x2) / 2
            const arrowY = (bounds.y1 + bounds.y2) / 2
            ctx.translate(arrowX, arrowY)
            
            let arrowAngle = 0
            switch (approach.direction) {
              case 'north': arrowAngle = -Math.PI / 2; break
              case 'south': arrowAngle = Math.PI / 2; break
              case 'east': arrowAngle = 0; break
              case 'west': arrowAngle = Math.PI; break
            }

            if (lane.type === 'left') {
              arrowAngle += Math.PI / 4
            } else if (lane.type === 'right') {
              arrowAngle -= Math.PI / 4
            }

            ctx.rotate(arrowAngle)
            ctx.fillStyle = '#F1F5F9'
            
            if (lane.type === 'straight') {
              ctx.beginPath()
              ctx.moveTo(-8, 0)
              ctx.lineTo(8, 0)
              ctx.lineTo(0, -12)
              ctx.closePath()
              ctx.fill()
              ctx.fillRect(-2, 0, 4, 10)
            } else {
              ctx.beginPath()
              ctx.moveTo(-8, 0)
              ctx.lineTo(8, 0)
              ctx.lineTo(0, -12)
              ctx.closePath()
              ctx.fill()
              ctx.beginPath()
              ctx.arc(0, 8, 10, Math.PI, Math.PI * 1.5, lane.type === 'right')
              ctx.lineWidth = 3
              ctx.strokeStyle = '#F1F5F9'
              ctx.stroke()
            }
            
            ctx.restore()
          }

          if (lane.type === 'bus') {
            ctx.save()
            const textX = (bounds.x1 + bounds.x2) / 2
            const textY = (bounds.y1 + bounds.y2) / 2
            ctx.translate(textX, textY)
            
            let textAngle = 0
            switch (approach.direction) {
              case 'north': textAngle = -Math.PI / 2; break
              case 'south': textAngle = Math.PI / 2; break
              case 'east': textAngle = 0; break
              case 'west': textAngle = Math.PI; break
            }
            ctx.rotate(textAngle)
            
            ctx.fillStyle = '#3B82F6'
            ctx.font = 'bold 10px Arial'
            ctx.textAlign = 'center'
            ctx.fillText('BUS', 0, 4)
            ctx.restore()
          }
        })
      })
    }

    const drawLaneDividers = () => {
      ctx.strokeStyle = '#F1F5F9'
      ctx.lineWidth = 2
      ctx.setLineDash([8, 6])

      scenario.approaches.forEach(approach => {
        const laneCount = approach.lanes.length
        const totalWidth = laneCount * LANE_WIDTH
        const startOffset = -totalWidth / 2

        for (let i = 1; i < laneCount; i++) {
          const dividerOffset = startOffset + i * LANE_WIDTH
          let x1 = 0, y1 = 0, x2 = 0, y2 = 0
          const stopLineDist = INTERSECTION_SIZE / 2 + 10

          switch (approach.direction) {
            case 'north':
              x1 = CENTER + dividerOffset
              y1 = 0
              x2 = CENTER + dividerOffset
              y2 = CENTER - stopLineDist
              break
            case 'south':
              x1 = CENTER - dividerOffset
              y1 = CANVAS_SIZE
              x2 = CENTER - dividerOffset
              y2 = CENTER + stopLineDist
              break
            case 'east':
              x1 = CANVAS_SIZE
              y1 = CENTER + dividerOffset
              x2 = CENTER + stopLineDist
              y2 = CENTER + dividerOffset
              break
            case 'west':
              x1 = 0
              y1 = CENTER - dividerOffset
              x2 = CENTER - stopLineDist
              y2 = CENTER - dividerOffset
              break
          }

          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
        }
      })

      ctx.setLineDash([])
    }

    const drawZebraCrossings = () => {
      ctx.fillStyle = '#E2E8F0'
      
      scenario.approaches.forEach(approach => {
        const laneCount = approach.lanes.length
        const totalWidth = laneCount * LANE_WIDTH
        const crossingWidth = totalWidth + 20
        const stripeWidth = 8
        const stripeGap = 6
        const crossingLength = 20
        const distFromCenter = INTERSECTION_SIZE / 2 + 2

        let cx = CENTER, cy = CENTER
        let angle = 0

        switch (approach.direction) {
          case 'north':
            cy = CENTER - distFromCenter - crossingLength / 2
            angle = 0
            break
          case 'south':
            cy = CENTER + distFromCenter + crossingLength / 2
            angle = 0
            break
          case 'east':
            cx = CENTER + distFromCenter + crossingLength / 2
            angle = Math.PI / 2
            break
          case 'west':
            cx = CENTER - distFromCenter - crossingLength / 2
            angle = Math.PI / 2
            break
        }

        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(angle)

        for (let i = -crossingWidth / 2; i < crossingWidth / 2; i += stripeWidth + stripeGap) {
          ctx.fillRect(i, -crossingLength / 2, stripeWidth, crossingLength)
        }

        ctx.restore()
      })
    }

    const drawStopLines = () => {
      ctx.strokeStyle = '#F1F5F9'
      ctx.lineWidth = 3
      ctx.setLineDash([])

      scenario.approaches.forEach(approach => {
        const laneCount = approach.lanes.length
        const totalWidth = laneCount * LANE_WIDTH
        const stopLineDist = INTERSECTION_SIZE / 2 + 5

        let x1 = 0, y1 = 0, x2 = 0, y2 = 0

        switch (approach.direction) {
          case 'north':
            x1 = CENTER - totalWidth / 2
            y1 = CENTER - stopLineDist
            x2 = CENTER + totalWidth / 2
            y2 = CENTER - stopLineDist
            break
          case 'south':
            x1 = CENTER - totalWidth / 2
            y1 = CENTER + stopLineDist
            x2 = CENTER + totalWidth / 2
            y2 = CENTER + stopLineDist
            break
          case 'east':
            x1 = CENTER + stopLineDist
            y1 = CENTER - totalWidth / 2
            x2 = CENTER + stopLineDist
            y2 = CENTER + totalWidth / 2
            break
          case 'west':
            x1 = CENTER - stopLineDist
            y1 = CENTER - totalWidth / 2
            x2 = CENTER - stopLineDist
            y2 = CENTER + totalWidth / 2
            break
        }

        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      })
    }

    const drawTrafficLights = () => {
      scenario.approaches.forEach(approach => {
        const laneCount = approach.lanes.length
        const totalWidth = laneCount * LANE_WIDTH
        const stopLineDist = INTERSECTION_SIZE / 2 + 5

        approach.lanes.forEach((lane, laneIndex) => {
          const isActive = activeLaneIds.has(lane.id)
          const laneCenter = -totalWidth / 2 + laneIndex * LANE_WIDTH + LANE_WIDTH / 2
          
          let lx = CENTER, ly = CENTER
          
          switch (approach.direction) {
            case 'north':
              lx = CENTER + laneCenter
              ly = CENTER - stopLineDist - 8
              break
            case 'south':
              lx = CENTER - laneCenter
              ly = CENTER + stopLineDist + 8
              break
            case 'east':
              lx = CENTER + stopLineDist + 8
              ly = CENTER + laneCenter
              break
            case 'west':
              lx = CENTER - stopLineDist - 8
              ly = CENTER - laneCenter
              break
          }

          ctx.fillStyle = '#1E293B'
          ctx.beginPath()
          ctx.arc(lx, ly, 7, 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = isActive ? '#22C55E' : '#EF4444'
          ctx.beginPath()
          ctx.arc(lx, ly, 5, 0, Math.PI * 2)
          ctx.fill()
        })
      })
    }

    const drawVehicles = () => {
      vehiclesRef.current.forEach(vehicle => {
        ctx.save()
        ctx.translate(vehicle.x, vehicle.y)
        ctx.rotate(vehicle.angle)
        
        ctx.fillStyle = '#FCD34D'
        ctx.fillRect(-8, -5, 16, 10)
        
        ctx.fillStyle = '#1E293B'
        ctx.fillRect(4, -4, 3, 8)
        
        ctx.restore()
      })
    }

    const drawLegend = () => {
      const legendX = CANVAS_SIZE - 120
      const legendY = 10
      const itemHeight = 22

      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
      ctx.fillRect(legendX - 5, legendY - 5, 115, 120)
      ctx.strokeStyle = '#CBD5E1'
      ctx.lineWidth = 1
      ctx.strokeRect(legendX - 5, legendY - 5, 115, 120)

      ctx.font = 'bold 11px Arial'
      ctx.fillStyle = '#1E293B'
      ctx.textAlign = 'left'
      ctx.fillText('图例', legendX, legendY + 12)

      const items = [
        { color: '#22C55E', label: '通行车道', alpha: 0.5 },
        { color: '#475569', label: '禁行车道', alpha: 0.5 },
        { color: '#3B82F6', label: '公交专用', alpha: 0.7 },
        { color: '#FCD34D', label: '车辆' },
        { color: '#22C55E', label: '绿灯', circle: true },
        { color: '#EF4444', label: '红灯', circle: true },
      ]

      items.forEach((item, i) => {
        const y = legendY + 28 + i * itemHeight
        
        if (item.circle) {
          ctx.fillStyle = item.color
          ctx.beginPath()
          ctx.arc(legendX + 5, y - 5, 5, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillStyle = item.color
          ctx.globalAlpha = item.alpha || 1
          ctx.fillRect(legendX, y - 10, 10, 10)
          ctx.globalAlpha = 1
        }

        ctx.font = '10px Arial'
        ctx.fillStyle = '#475569'
        ctx.fillText(item.label, legendX + 18, y - 2)
      })
    }

    const updateVehicles = (deltaTime: number) => {
      vehiclesRef.current = vehiclesRef.current.filter(v => v.progress < 100)

      vehiclesRef.current.forEach(vehicle => {
        vehicle.progress += vehicle.speed * deltaTime * 60
        const approach = scenario.approaches.find(a => 
          a.lanes.some(l => l.id === vehicle.laneId)
        )
        if (approach) {
          const laneIndex = approach.lanes.findIndex(l => l.id === vehicle.laneId)
          const pos = getLaneCenter(approach, laneIndex, vehicle.progress)
          vehicle.x = pos.x
          vehicle.y = pos.y
          vehicle.angle = pos.angle
        }
      })

      if (currentPhase) {
        currentPhase.movements.forEach(movement => {
          const approach = scenario.approaches.find(a => a.id === movement.approachId)
          if (approach) {
            approach.lanes.forEach(lane => {
              if (lane.type === movement.laneType && Math.random() < 0.02) {
                const existingInLane = vehiclesRef.current.filter(v => v.laneId === lane.id).length
                if (existingInLane < 3) {
                  const laneIndex = approach.lanes.findIndex(l => l.id === lane.id)
                  const pos = getLaneCenter(approach, laneIndex, 0)
                  vehiclesRef.current.push({
                    laneId: lane.id,
                    progress: 0,
                    speed: 0.5 + Math.random() * 0.3,
                    x: pos.x,
                    y: pos.y,
                    angle: pos.angle
                  })
                }
              }
            })
          }
        })
      }
    }

    let lastTime = performance.now()

    const render = (time: number) => {
      const deltaTime = Math.min((time - lastTime) / 1000, 0.1)
      lastTime = time

      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

      drawRoad()
      drawLanes()
      drawLaneDividers()
      drawZebraCrossings()
      drawStopLines()
      drawTrafficLights()
      updateVehicles(deltaTime)
      drawVehicles()
      drawLegend()

      animationRef.current = requestAnimationFrame(render)
    }

    animationRef.current = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animationRef.current)
    }
  }, [scenario, currentPhaseIndex, phaseConfig])

  return (
    <div className="w-full max-w-[500px] mx-auto">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="w-full h-auto border border-gray-200 rounded-lg shadow-sm"
      />
    </div>
  )
}
