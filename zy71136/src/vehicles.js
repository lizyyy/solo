import * as THREE from 'three'

export class VehicleManager {
  constructor(scene, app) {
    this.scene = scene
    this.app = app
    this.vehicles = []
    this.pathLines = []
  }
  
  createVehicles(vehiclesData) {
    this.clear()
    
    vehiclesData.forEach(vehicleData => {
      const vehicle = this.createVehicle(vehicleData)
      this.vehicles.push(vehicle)
      this.scene.add(vehicle.mesh)
      
      if (vehicleData.path) {
        const pathLine = this.createPathLine(vehicleData.path, vehicle.color)
        this.pathLines.push(pathLine)
        this.scene.add(pathLine)
      }
    })
  }
  
  createVehicle(vehicleData) {
    const colors = {
      ferry: 0x1abc9c,
      fuel: 0xf39c12,
      baggage: 0x9b59b6
    }
    
    const color = colors[vehicleData.type] || 0x95a5a6
    const group = new THREE.Group()
    
    const bodyGeometry = new THREE.BoxGeometry(4, 2, 2.5)
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: color,
      metalness: 0.3,
      roughness: 0.7
    })
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
    body.position.y = 1.2
    body.castShadow = true
    group.add(body)
    
    const cabinGeometry = new THREE.BoxGeometry(1.5, 1.5, 2.2)
    const cabinMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      transparent: true,
      opacity: 0.8
    })
    const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial)
    cabin.position.set(-1, 2, 0)
    cabin.castShadow = true
    group.add(cabin)
    
    const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16)
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
    
    const wheelPositions = [
      [1.2, 0.4, 1.3],
      [1.2, 0.4, -1.3],
      [-1.2, 0.4, 1.3],
      [-1.2, 0.4, -1.3]
    ]
    
    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(pos[0], pos[1], pos[2])
      group.add(wheel)
    })
    
    const topMarkerGeometry = new THREE.SphereGeometry(0.3, 16, 16)
    const topMarkerMaterial = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.5
    })
    const topMarker = new THREE.Mesh(topMarkerGeometry, topMarkerMaterial)
    topMarker.position.y = 2.8
    group.add(topMarker)
    
    group.position.set(vehicleData.path[0].x, 0, vehicleData.path[0].z)
    
    group.userData.vehicleId = vehicleData.id
    group.userData.vehicleType = vehicleData.type
    group.userData.tooltip = this.createVehicleTooltip(vehicleData)
    
    return {
      id: vehicleData.id,
      type: vehicleData.type,
      name: vehicleData.name,
      mesh: group,
      path: vehicleData.path,
      schedule: vehicleData.schedule,
      color: color,
      highlighted: false
    }
  }
  
  createVehicleTooltip(vehicleData) {
    const typeNames = {
      ferry: '摆渡车',
      fuel: '油车',
      baggage: '行李车'
    }
    
    return `
      <div class="tooltip-title">${vehicleData.name}</div>
      <div>类型: ${typeNames[vehicleData.type] || vehicleData.type}</div>
      <div>航班: ${vehicleData.flight || 'N/A'}</div>
      <div>出发: ${this.formatTime(vehicleData.schedule.start)}</div>
      <div>到达: ${this.formatTime(vehicleData.schedule.end)}</div>
    `
  }
  
  formatTime(time) {
    const mins = Math.floor(time)
    const secs = Math.floor((time - mins) * 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  
  createPathLine(path, color) {
    const points = path.map(p => new THREE.Vector3(p.x, 0.1, p.z))
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineDashedMaterial({
      color: color,
      dashSize: 1,
      gapSize: 0.5,
      linewidth: 2,
      transparent: true,
      opacity: 0.6
    })
    const line = new THREE.Line(geometry, material)
    line.computeLineDistances()
    return line
  }
  
  updateVehicles(currentTime) {
    this.vehicles.forEach(vehicle => {
      const path = vehicle.path
      const schedule = vehicle.schedule
      
      if (currentTime < schedule.start || currentTime > schedule.end) {
        return
      }
      
      const progress = (currentTime - schedule.start) / (schedule.end - schedule.start)
      const totalSegments = path.length - 1
      const segmentProgress = progress * totalSegments
      const currentSegment = Math.floor(segmentProgress)
      const segmentFraction = segmentProgress - currentSegment
      
      if (currentSegment < totalSegments) {
        const start = path[currentSegment]
        const end = path[currentSegment + 1]
        
        vehicle.mesh.position.x = start.x + (end.x - start.x) * segmentFraction
        vehicle.mesh.position.z = start.z + (end.z - start.z) * segmentFraction
        
        const angle = Math.atan2(end.x - start.x, end.z - start.z)
        vehicle.mesh.rotation.y = angle
      } else if (currentSegment >= totalSegments) {
        const lastPoint = path[path.length - 1]
        vehicle.mesh.position.x = lastPoint.x
        vehicle.mesh.position.z = lastPoint.z
      }
    })
  }
  
  resetVehicles() {
    this.vehicles.forEach(vehicle => {
      const startPoint = vehicle.path[0]
      vehicle.mesh.position.set(startPoint.x, 0, startPoint.z)
      vehicle.mesh.rotation.y = 0
      vehicle.highlighted = false
      vehicle.mesh.children.forEach(child => {
        if (child.material && child.material.emissive) {
          child.material.emissiveIntensity = child === vehicle.mesh.children[vehicle.mesh.children.length - 1] ? 0.5 : 0
        }
      })
    })
  }
  
  setVisibility(filters) {
    this.vehicles.forEach(vehicle => {
      const visible = filters[vehicle.type]
      vehicle.mesh.visible = visible
    })
    
    this.pathLines.forEach((line, index) => {
      const vehicle = this.vehicles[index]
      if (vehicle) {
        line.visible = filters[vehicle.type]
      }
    })
  }
  
  highlightVehicle(vehicleId) {
    this.vehicles.forEach(vehicle => {
      const isHighlighted = vehicle.id === vehicleId
      vehicle.highlighted = isHighlighted
      
      vehicle.mesh.children.forEach(child => {
        if (child.material && child.material.emissive) {
          child.material.emissiveIntensity = isHighlighted ? 1 : (child === vehicle.mesh.children[vehicle.mesh.children.length - 1] ? 0.5 : 0)
        }
      })
    })
  }
  
  getVehicleMeshes() {
    return this.vehicles.map(v => v.mesh)
  }
  
  getVehicles() {
    return this.vehicles
  }
  
  clear() {
    this.vehicles.forEach(v => this.scene.remove(v.mesh))
    this.pathLines.forEach(l => this.scene.remove(l))
    this.vehicles = []
    this.pathLines = []
  }
}
