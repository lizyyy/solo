import * as THREE from 'three'

export class AirportScene {
  constructor(scene) {
    this.scene = scene
    this.gates = []
    this.restrictedZones = []
    this.operationNodes = []
    this.hoverTargets = []
  }
  
  build(data) {
    this.clear()
    this.createGround()
    this.createTaxiways()
    
    if (data.gates) {
      data.gates.forEach(gate => this.createGate(gate))
    }
    
    if (data.restrictedZones) {
      data.restrictedZones.forEach(zone => this.createRestrictedZone(zone))
    }
    
    if (data.operationNodes) {
      data.operationNodes.forEach(node => this.createOperationNode(node))
    }
    
    this.createTerminal()
  }
  
  clear() {
    [...this.gates, ...this.restrictedZones, ...this.operationNodes].forEach(obj => {
      this.scene.remove(obj)
    })
    this.gates = []
    this.restrictedZones = []
    this.operationNodes = []
    this.hoverTargets = []
  }
  
  createGround() {
    const groundGeometry = new THREE.PlaneGeometry(200, 200)
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d3436,
      roughness: 0.8,
      metalness: 0.2
    })
    const ground = new THREE.Mesh(groundGeometry, groundMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)
    
    const gridHelper = new THREE.GridHelper(200, 40, 0x4a5568, 0x2d3748)
    gridHelper.position.y = 0.01
    this.scene.add(gridHelper)
  }
  
  createTaxiways() {
    const taxiwayMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a5568,
      roughness: 0.9
    })
    
    const mainTaxiway = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 8),
      taxiwayMaterial
    )
    mainTaxiway.rotation.x = -Math.PI / 2
    mainTaxiway.position.y = 0.02
    mainTaxiway.position.z = -30
    this.scene.add(mainTaxiway)
    
    const crossTaxiway = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 100),
      taxiwayMaterial
    )
    crossTaxiway.rotation.x = -Math.PI / 2
    crossTaxiway.position.y = 0.02
    crossTaxiway.position.x = 0
    this.scene.add(crossTaxiway)
    
    const taxiwayEdges = new THREE.EdgesGeometry(new THREE.PlaneGeometry(200, 8))
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xf1c40f, linewidth: 2 })
    const mainTaxiwayLines = new THREE.LineSegments(taxiwayEdges, lineMaterial)
    mainTaxiwayLines.rotation.x = -Math.PI / 2
    mainTaxiwayLines.position.y = 0.03
    mainTaxiwayLines.position.z = -30
    this.scene.add(mainTaxiwayLines)
  }
  
  createGate(gate) {
    const group = new THREE.Group()
    group.position.set(gate.x, 0, gate.z)
    
    const standGeometry = new THREE.PlaneGeometry(15, 12)
    const standMaterial = new THREE.MeshStandardMaterial({
      color: 0x34495e,
      side: THREE.DoubleSide
    })
    const stand = new THREE.Mesh(standGeometry, standMaterial)
    stand.rotation.x = -Math.PI / 2
    stand.position.y = 0.02
    group.add(stand)
    
    const standEdges = new THREE.EdgesGeometry(standGeometry)
    const standLines = new THREE.LineSegments(
      standEdges,
      new THREE.LineBasicMaterial({ color: 0x3498db })
    )
    standLines.rotation.x = -Math.PI / 2
    standLines.position.y = 0.03
    group.add(standLines)
    
    const markerGeometry = new THREE.ConeGeometry(1.5, 3, 4)
    const markerMaterial = new THREE.MeshStandardMaterial({
      color: 0x3498db,
      emissive: 0x3498db,
      emissiveIntensity: 0.3
    })
    const marker = new THREE.Mesh(markerGeometry, markerMaterial)
    marker.rotation.x = Math.PI
    marker.position.y = 1.5
    marker.position.z = -4
    group.add(marker)
    
    const label = this.createTextLabel(gate.id, 0x3498db)
    label.position.y = 4
    label.position.z = -4
    group.add(label)
    
    group.userData.tooltip = `
      <div class="tooltip-title">停机位 ${gate.id}</div>
      <div>航班: ${gate.flight || '无'}</div>
      <div>状态: ${gate.status || '空闲'}</div>
    `
    group.userData.gateId = gate.id
    this.hoverTargets.push(group)
    
    this.gates.push(group)
    this.scene.add(group)
  }
  
  createRestrictedZone(zone) {
    const shape = new THREE.Shape()
    shape.moveTo(zone.points[0].x, zone.points[0].z)
    for (let i = 1; i < zone.points.length; i++) {
      shape.lineTo(zone.points[i].x, zone.points[i].z)
    }
    shape.closePath()
    
    const geometry = new THREE.ShapeGeometry(shape)
    const material = new THREE.MeshStandardMaterial({
      color: 0xe74c3c,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    })
    
    const zoneMesh = new THREE.Mesh(geometry, material)
    zoneMesh.rotation.x = -Math.PI / 2
    zoneMesh.position.y = 0.05
    
    const edges = new THREE.EdgesGeometry(geometry)
    const edgeLines = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0xe74c3c })
    )
    edgeLines.rotation.x = -Math.PI / 2
    edgeLines.position.y = 0.06
    
    const warningMarkers = zone.points.map((point, i) => {
      const marker = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.8),
        new THREE.MeshStandardMaterial({
          color: 0xe74c3c,
          emissive: 0xe74c3c,
          emissiveIntensity: 0.5
        })
      )
      marker.position.set(point.x, 1, point.z)
      return marker
    })
    
    const group = new THREE.Group()
    group.add(zoneMesh)
    group.add(edgeLines)
    warningMarkers.forEach(m => group.add(m))
    
    const centerX = zone.points.reduce((s, p) => s + p.x, 0) / zone.points.length
    const centerZ = zone.points.reduce((s, p) => s + p.z, 0) / zone.points.length
    const label = this.createTextLabel('⚠ 禁区', 0xe74c3c)
    label.position.set(centerX, 3, centerZ)
    group.add(label)
    
    group.userData.tooltip = `
      <div class="tooltip-title" style="color: #e74c3c;">禁行区 ${zone.id}</div>
      <div>类型: ${zone.type || '安全禁区'}</div>
      <div>禁止任何车辆进入</div>
    `
    this.hoverTargets.push(group)
    group.userData.zoneData = zone
    
    this.restrictedZones.push(group)
    this.scene.add(group)
  }
  
  createOperationNode(node) {
    const group = new THREE.Group()
    group.position.set(node.x, 0, node.z)
    
    const colors = {
      fuel: 0xf39c12,
      baggage: 0x9b59b6,
      ferry: 0x1abc9c,
      maintenance: 0x95a5a6
    }
    
    const color = colors[node.type] || 0x95a5a6
    
    const baseGeometry = new THREE.CylinderGeometry(2, 2.5, 0.3, 8)
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.2
    })
    const base = new THREE.Mesh(baseGeometry, baseMaterial)
    base.position.y = 0.15
    group.add(base)
    
    const iconGeometry = new THREE.TorusGeometry(1, 0.2, 8, 16)
    const iconMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: color,
      emissiveIntensity: 0.5
    })
    const icon = new THREE.Mesh(iconGeometry, iconMaterial)
    icon.rotation.x = Math.PI / 2
    icon.position.y = 0.6
    group.add(icon)
    
    const label = this.createTextLabel(node.name, color)
    label.position.y = 2.5
    group.add(label)
    
    group.userData.tooltip = `
      <div class="tooltip-title">作业节点 ${node.name}</div>
      <div>类型: ${this.getNodeTypeName(node.type)}</div>
      <div>容量: ${node.capacity || 1} 辆车</div>
    `
    this.hoverTargets.push(group)
    group.userData.nodeData = node
    
    this.operationNodes.push(group)
    this.scene.add(group)
  }
  
  createTerminal() {
    const terminalGeometry = new THREE.BoxGeometry(60, 15, 12)
    const terminalMaterial = new THREE.MeshStandardMaterial({
      color: 0xecf0f1,
      roughness: 0.7
    })
    const terminal = new THREE.Mesh(terminalGeometry, terminalMaterial)
    terminal.position.set(0, 7.5, 60)
    terminal.castShadow = true
    terminal.receiveShadow = true
    this.scene.add(terminal)
    
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0x3498db,
      emissive: 0x3498db,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.6
    })
    
    for (let i = 0; i < 10; i++) {
      const windowMesh = new THREE.Mesh(
        new THREE.BoxGeometry(4, 4, 0.1),
        windowMaterial
      )
      windowMesh.position.set(-25 + i * 6, 8, 66.1)
      this.scene.add(windowMesh)
    }
    
    const roofGeometry = new THREE.BoxGeometry(65, 1, 18)
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c3e50
    })
    const roof = new THREE.Mesh(roofGeometry, roofMaterial)
    roof.position.set(0, 15.5, 60)
    this.scene.add(roof)
  }
  
  createTextLabel(text, color) {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    canvas.width = 256
    canvas.height = 64
    
    context.fillStyle = 'rgba(0, 0, 0, 0.7)'
    context.fillRect(0, 0, 256, 64)
    
    context.font = 'bold 28px Arial'
    context.fillStyle = '#' + color.toString(16).padStart(6, '0')
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(text, 128, 32)
    
    const texture = new THREE.CanvasTexture(canvas)
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true
    })
    const sprite = new THREE.Sprite(material)
    sprite.scale.set(6, 1.5, 1)
    
    return sprite
  }
  
  getNodeTypeName(type) {
    const names = {
      fuel: '加油区',
      baggage: '行李装卸',
      ferry: '摆渡车停靠',
      maintenance: '维修区'
    }
    return names[type] || type
  }
  
  getHoverTargets() {
    return this.hoverTargets
  }
  
  getRestrictedZones() {
    return this.restrictedZones
  }
}
