import React, { useEffect, useRef, useCallback } from 'react'
import { ShipStatus, ShipTypes } from '../models/Ship'
import { ChannelStatus, ChannelDirection } from '../models/Channel'
import { TugStatus } from '../models/Resource'
import { ConflictSeverity } from '../engine/RulesEngine'
import './MapCanvas.css'

const MapCanvas = ({
  level,
  currentTime,
  selectedShipId,
  onShipSelect,
  onBerthSelect,
  onChannelSelect,
  conflicts = [],
  simulationSpeed
}) => {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const hoveredElementRef = useRef(null)

  const mapConfig = level?.mapConfig || { width: 1200, height: 800, gridSize: 20 }

  const getShipColor = (ship) => {
    if (ship.isDangerous) return '#FF6B6B'
    if (ship.type === ShipTypes.PASSENGER) return '#4ECDC4'
    if (ship.type === ShipTypes.CONTAINER) return '#45B7D1'
    if (ship.type === ShipTypes.BULK) return '#96CEB4'
    if (ship.type === ShipTypes.TANKER) return '#FFEAA7'
    return '#A8D8EA'
  }

  const getShipStatusColor = (ship) => {
    switch (ship.status) {
      case ShipStatus.WAITING: return '#FF9F43'
      case ShipStatus.APPROACHING:
      case ShipStatus.ENTERING:
      case ShipStatus.EXITING: return '#54A0FF'
      case ShipStatus.BERTHING:
      case ShipStatus.UNBERTHING: return '#F368E0'
      case ShipStatus.DOCKED: return '#1DD1A1'
      case ShipStatus.COMPLETED: return '#5F27CD'
      case ShipStatus.DELAYED: return '#EE5A24'
      default: return '#B2BEC3'
    }
  }

  const getChannelColor = (channel, time) => {
    if (channel.isClosedAtTime(time)) return '#4A5568'
    if (channel.isRestricted) return '#D69E2E'
    return '#3182CE'
  }

  const getChannelOpacity = (channel, time) => {
    if (channel.isClosedAtTime(time)) return 0.5
    if (channel.isRestricted) return 0.8
    return 1.0
  }

  const getBerthColor = (berth) => {
    if (berth.occupiedBy) return '#E53E3E'
    if (berth.isDangerousBerth) return '#ED8936'
    if (berth.isPassengerBerth) return '#48BB78'
    return '#4299E1'
  }

  const drawGrid = (ctx, width, height, gridSize) => {
    ctx.strokeStyle = 'rgba(100, 120, 150, 0.15)'
    ctx.lineWidth = 1

    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
  }

  const drawWaterBackground = (ctx, width, height) => {
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#1a365d')
    gradient.addColorStop(0.5, '#2c5282')
    gradient.addColorStop(1, '#1a365d')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }

  const drawChannel = (ctx, channel, time) => {
    if (channel.points.length < 2) return

    ctx.save()
    ctx.globalAlpha = getChannelOpacity(channel, time)

    ctx.beginPath()
    ctx.moveTo(channel.points[0].x, channel.points[0].y)
    for (let i = 1; i < channel.points.length; i++) {
      ctx.lineTo(channel.points[i].x, channel.points[i].y)
    }
    ctx.strokeStyle = getChannelColor(channel, time)
    ctx.lineWidth = channel.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.lineWidth = 2
    ctx.setLineDash([10, 5])
    ctx.stroke()
    ctx.setLineDash([])

    const midIndex = Math.floor(channel.points.length / 2)
    const midPoint = channel.points[midIndex]
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(channel.name, midPoint.x, midPoint.y - channel.width / 2 - 10)

    if (channel.direction !== ChannelDirection.BIDIRECTIONAL) {
      const direction = channel.direction === ChannelDirection.ONE_WAY_IN ? '→ 进港' : '← 离港'
      ctx.fillStyle = 'rgba(255, 200, 100, 0.9)'
      ctx.fillText(direction, midPoint.x, midPoint.y - channel.width / 2 - 25)
    }

    ctx.restore()
  }

  const drawBerth = (ctx, berth, isSelected) => {
    ctx.save()

    const x = berth.position.x
    const y = berth.position.y
    const width = berth.length
    const height = berth.width

    ctx.fillStyle = getBerthColor(berth)
    ctx.strokeStyle = isSelected ? '#FFD700' : 'rgba(255, 255, 255, 0.5)'
    ctx.lineWidth = isSelected ? 3 : 2

    ctx.fillRect(x, y - height / 2, width, height)
    ctx.strokeRect(x, y - height / 2, width, height)

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(berth.name, x + width / 2, y + 4)

    if (berth.isDangerousBerth) {
      ctx.fillStyle = '#FF4444'
      ctx.fillText('⚠ 危险品', x + width / 2, y - height / 2 - 5)
    }
    if (berth.isPassengerBerth) {
      ctx.fillStyle = '#44FF44'
      ctx.fillText('⚓ 客船', x + width / 2, y + height / 2 + 15)
    }

    ctx.restore()
  }

  const drawWaitingZone = (ctx, zone) => {
    ctx.save()

    ctx.beginPath()
    ctx.arc(zone.position.x, zone.position.y, zone.radius, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 193, 7, 0.2)'
    ctx.fill()

    ctx.strokeStyle = 'rgba(255, 193, 7, 0.6)'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(zone.name, zone.position.x, zone.position.y - zone.radius - 10)
    ctx.fillText(
      `${zone.currentVessels.length}/${zone.maxCapacity}`,
      zone.position.x,
      zone.position.y + 5
    )

    ctx.restore()
  }

  const drawShip = (ctx, ship, isSelected, currentTime) => {
    if (ship.status === ShipStatus.COMPLETED) return
    if (ship.arrivalTime > currentTime) return

    ctx.save()

    const x = ship.currentPosition.x
    const y = ship.currentPosition.y
    const length = ship.length / 3
    const width = ship.width / 3

    let angle = 0
    if (ship.route && ship.route.length > ship.currentRouteIndex) {
      const nextPoint = ship.route[ship.currentRouteIndex]
      angle = Math.atan2(nextPoint.y - y, nextPoint.x - x)
    }

    ctx.translate(x, y)
    ctx.rotate(angle)

    ctx.beginPath()
    ctx.moveTo(length / 2, 0)
    ctx.lineTo(length / 4, -width / 2)
    ctx.lineTo(-length / 2, -width / 2)
    ctx.lineTo(-length / 2, width / 2)
    ctx.lineTo(length / 4, width / 2)
    ctx.closePath()

    ctx.fillStyle = getShipColor(ship)
    ctx.strokeStyle = isSelected ? '#FFD700' : getShipStatusColor(ship)
    ctx.lineWidth = isSelected ? 3 : 2
    ctx.fill()
    ctx.stroke()

    if (ship.isDangerous) {
      ctx.fillStyle = '#FF0000'
      ctx.beginPath()
      ctx.arc(-length / 3, -width / 3, 5, 0, Math.PI * 2)
      ctx.fill()
    }

    if (ship.type === ShipTypes.PASSENGER) {
      ctx.fillStyle = '#00FF00'
      ctx.beginPath()
      ctx.arc(-length / 3, width / 3, 5, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(ship.name, x, y - width / 3 - 15)

    if (ship.deadlineTime && ship.deadlineTime - currentTime < 60) {
      ctx.fillStyle = ship.deadlineTime - currentTime < 30 ? '#FF4444' : '#FFAA00'
      ctx.font = 'bold 9px sans-serif'
      ctx.fillText(
        `剩余: ${Math.max(0, Math.round(ship.deadlineTime - currentTime))}分`,
        x,
        y - width / 3 - 25
      )
    }

    if (ship.route && ship.route.length > ship.currentRouteIndex) {
      ctx.beginPath()
      ctx.moveTo(x, y)
      for (let i = ship.currentRouteIndex; i < ship.route.length; i++) {
        ctx.lineTo(ship.route[i].x, ship.route[i].y)
      }
      ctx.strokeStyle = isSelected ? 'rgba(255, 215, 0, 0.6)' : 'rgba(100, 200, 255, 0.4)'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  const drawTug = (ctx, tug, isAssigned) => {
    ctx.save()

    const x = tug.position.x
    const y = tug.position.y
    const size = 12

    ctx.beginPath()
    ctx.arc(x, y, size, 0, Math.PI * 2)
    ctx.fillStyle = isAssigned ? '#8B5CF6' : '#10B981'
    ctx.strokeStyle = tug.status === TugStatus.MAINTENANCE ? '#6B7280' : '#FFFFFF'
    ctx.lineWidth = 2
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.font = '8px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(tug.name, x, y + size + 12)

    ctx.restore()
  }

  const drawConflict = (ctx, conflict) => {
    if (!conflict.position) return

    ctx.save()

    const x = conflict.position.x
    const y = conflict.position.y
    const radius = 30

    const pulseRadius = radius + Math.sin(Date.now() / 200) * 5

    ctx.beginPath()
    ctx.arc(x, y, pulseRadius, 0, Math.PI * 2)
    ctx.fillStyle = conflict.severity === ConflictSeverity.CRITICAL
      ? 'rgba(239, 68, 68, 0.3)'
      : 'rgba(251, 191, 36, 0.3)'
    ctx.fill()

    ctx.strokeStyle = conflict.severity === ConflictSeverity.CRITICAL
      ? '#EF4444'
      : '#FBBF24'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = conflict.severity === ConflictSeverity.CRITICAL ? '#EF4444' : '#FBBF24'
    ctx.font = 'bold 14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('⚠', x, y + 5)

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.font = '10px sans-serif'
    ctx.fillText(conflict.getTypeName(), x, y + pulseRadius + 15)

    ctx.restore()
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !level) return

    const ctx = canvas.getContext('2d')
    const width = mapConfig.width
    const height = mapConfig.height

    ctx.clearRect(0, 0, width, height)

    drawWaterBackground(ctx, width, height)
    drawGrid(ctx, width, height, mapConfig.gridSize)

    for (const channel of level.channels) {
      drawChannel(ctx, channel, currentTime)
    }

    for (const zone of level.waitingZones) {
      drawWaitingZone(ctx, zone)
    }

    for (const berth of level.berths) {
      drawBerth(ctx, berth, false)
    }

    for (const tug of level.tugs) {
      drawTug(ctx, tug, tug.assignedShipId !== null)
    }

    const allShips = level.getAllVessels()
    for (const ship of allShips) {
      drawShip(ctx, ship, ship.id === selectedShipId, currentTime)
    }

    for (const conflict of conflicts) {
      drawConflict(ctx, conflict)
    }

    if (simulationSpeed > 0) {
      animationRef.current = requestAnimationFrame(draw)
    }
  }, [level, currentTime, selectedShipId, conflicts, simulationSpeed, mapConfig])

  useEffect(() => {
    draw()
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [draw])

  const handleClick = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    const allShips = level?.getAllVessels() || []
    for (const ship of allShips) {
      if (ship.status === ShipStatus.COMPLETED) continue
      if (ship.arrivalTime > currentTime) continue

      const dx = x - ship.currentPosition.x
      const dy = y - ship.currentPosition.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 30) {
        onShipSelect?.(ship)
        return
      }
    }

    for (const berth of level?.berths || []) {
      if (x >= berth.position.x &&
          x <= berth.position.x + berth.length &&
          y >= berth.position.y - berth.width / 2 &&
          y <= berth.position.y + berth.width / 2) {
        onBerthSelect?.(berth)
        return
      }
    }
  }

  return (
    <div className="map-container">
      <canvas
        ref={canvasRef}
        width={mapConfig.width}
        height={mapConfig.height}
        onClick={handleClick}
        className="map-canvas"
      />
    </div>
  )
}

export default MapCanvas
