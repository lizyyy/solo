export class ConflictDetector {
  constructor(app) {
    this.app = app
    this.conflicts = []
    this.activeConflicts = []
  }
  
  detectAllConflicts() {
    if (!this.app.data) return
    
    this.conflicts = []
    this.detectRestrictedZoneViolations()
    this.detectVehicleCollisions()
    this.detectDelayedPathConflicts()
    
    this.renderConflictList()
  }
  
  detectRestrictedZoneViolations() {
    if (!this.app.data.restrictedZones) return
    
    this.app.data.vehicles.forEach(vehicle => {
      vehicle.path.forEach((point, pathIndex) => {
        this.app.data.restrictedZones.forEach(zone => {
          if (this.isPointInPolygon(point, zone.points)) {
            const time = vehicle.schedule.start + 
              (pathIndex / (vehicle.path.length - 1)) * (vehicle.schedule.end - vehicle.schedule.start)
            
            this.conflicts.push({
              type: 'restricted_zone',
              severity: 'high',
              vehicle: vehicle.name,
              zone: zone.id,
              time: time,
              message: `${vehicle.name} 穿越禁行区 ${zone.id}`
            })
          }
        })
      })
    })
  }
  
  detectVehicleCollisions() {
    const vehicles = this.app.data.vehicles
    const safetyDistance = 5
    const timeStep = 0.5
    
    for (let t = 0; t <= this.app.data.duration; t += timeStep) {
      const positions = []
      
      vehicles.forEach(vehicle => {
        if (t >= vehicle.schedule.start && t <= vehicle.schedule.end) {
          const pos = this.getVehiclePositionAtTime(vehicle, t)
          positions.push({ vehicle, pos, time: t })
        }
      })
      
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const dist = this.distance(positions[i].pos, positions[j].pos)
          if (dist < safetyDistance) {
            const existingConflict = this.conflicts.find(c => 
              c.type === 'vehicle_collision' &&
              ((c.vehicle1 === positions[i].vehicle.name && c.vehicle2 === positions[j].vehicle.name) ||
               (c.vehicle1 === positions[j].vehicle.name && c.vehicle2 === positions[i].vehicle.name)) &&
              Math.abs(c.time - t) < 2
            )
            
            if (!existingConflict) {
              this.conflicts.push({
                type: 'vehicle_collision',
                severity: 'high',
                vehicle1: positions[i].vehicle.name,
                vehicle2: positions[j].vehicle.name,
                time: t,
                message: `${positions[i].vehicle.name} 与 ${positions[j].vehicle.name} 存在碰撞风险`
              })
            }
          }
        }
      }
    }
  }
  
  detectDelayedPathConflicts() {
    if (!this.app.data.flights) return
    
    this.app.data.flights.forEach(flight => {
      if (flight.delayed) {
        const affectedVehicles = this.app.data.vehicles.filter(v => v.flight === flight.id)
        
        affectedVehicles.forEach(vehicle => {
          if (vehicle.schedule.end < flight.schedule.departure + 5) {
            this.conflicts.push({
              type: 'delay_path',
              severity: 'medium',
              vehicle: vehicle.name,
              flight: flight.id,
              time: vehicle.schedule.end,
              message: `${vehicle.name} 路径未更新，航班 ${flight.id} 已延误`
            })
          }
        })
      }
    })
  }
  
  isPointInPolygon(point, polygon) {
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, zi = polygon[i].z
      const xj = polygon[j].x, zj = polygon[j].z
      
      if (((zi > point.z) !== (zj > point.z)) &&
          (point.x < (xj - xi) * (point.z - zi) / (zj - zi) + xi)) {
        inside = !inside
      }
    }
    return inside
  }
  
  getVehiclePositionAtTime(vehicle, time) {
    const schedule = vehicle.schedule
    const path = vehicle.path
    
    if (time <= schedule.start) return path[0]
    if (time >= schedule.end) return path[path.length - 1]
    
    const progress = (time - schedule.start) / (schedule.end - schedule.start)
    const totalSegments = path.length - 1
    const segmentProgress = progress * totalSegments
    const currentSegment = Math.floor(segmentProgress)
    const segmentFraction = segmentProgress - currentSegment
    
    if (currentSegment >= totalSegments) return path[path.length - 1]
    
    const start = path[currentSegment]
    const end = path[currentSegment + 1]
    
    return {
      x: start.x + (end.x - start.x) * segmentFraction,
      z: start.z + (end.z - start.z) * segmentFraction
    }
  }
  
  distance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.z - p2.z, 2))
  }
  
  update(currentTime) {
    this.activeConflicts = this.conflicts.filter(c => 
      Math.abs(c.time - currentTime) < 1
    )
    
    this.renderConflictList()
  }
  
  renderConflictList() {
    const panel = document.getElementById('conflict-panel')
    const list = document.getElementById('conflict-list')
    
    if (this.conflicts.length === 0) {
      panel.style.display = 'none'
      return
    }
    
    panel.style.display = 'block'
    
    const allConflicts = [
      ...this.activeConflicts.map(c => ({ ...c, active: true })),
      ...this.conflicts.filter(c => !this.activeConflicts.includes(c)).map(c => ({ ...c, active: false }))
    ]
    
    list.innerHTML = allConflicts.map(conflict => `
      <div class="conflict-item" style="${conflict.active ? 'border-left: 3px solid #e74c3c;' : 'opacity: 0.6;'}">
        <div><strong>${conflict.message}</strong></div>
        <div style="margin-top: 4px; color: #aaa;">
          时间: ${this.formatTime(conflict.time)}
        </div>
      </div>
    `).join('')
  }
  
  formatTime(time) {
    const mins = Math.floor(time)
    const secs = Math.floor((time - mins) * 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  
  clearConflicts() {
    this.conflicts = []
    this.activeConflicts = []
    document.getElementById('conflict-panel').style.display = 'none'
  }
  
  getConflicts() {
    return this.conflicts
  }
}
