import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const STORAGE_KEY = 'railway-crossing-sight-check-state'

const sampleData = {
  sample1: {
    name: '村庄道口（有树木遮挡）',
    speed: 60,
    observerHeight: 3.5,
    obstacles: [
      { id: 'tree1', type: 'tree', name: '大树1', position: { x: 12, z: 40 }, height: 12, width: 4, visible: true },
      { id: 'tree2', type: 'tree', name: '大树2', position: { x: -10, z: 35 }, height: 10, width: 3.5, visible: true },
      { id: 'tree3', type: 'tree', name: '小树1', position: { x: 8, z: 55 }, height: 6, width: 2, visible: true },
      { id: 'building1', type: 'building', name: '农舍', position: { x: -15, z: 25 }, height: 5, width: 8, depth: 6, visible: true }
    ]
  },
  sample2: {
    name: '工厂道口（有建筑遮挡）',
    speed: 70,
    observerHeight: 3.8,
    obstacles: [
      { id: 'factory1', type: 'building', name: '厂房A', position: { x: 15, z: 30 }, height: 8, width: 12, depth: 15, visible: true },
      { id: 'factory2', type: 'building', name: '仓库', position: { x: -12, z: 45 }, height: 6, width: 10, depth: 8, visible: true },
      { id: 'wall1', type: 'wall', name: '围墙', position: { x: 10, z: 50 }, height: 3, width: 15, depth: 0.5, visible: true }
    ]
  },
  sample3: {
    name: '标准道口（无遮挡）',
    speed: 70,
    observerHeight: 3.5,
    obstacles: []
  }
}

class RailwayCrossingApp {
  constructor() {
    this.scene = null
    this.camera = null
    this.renderer = null
    this.controls = null
    this.obstacles = []
    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()
    this.selectedObstacle = null
    this.isDragging = false
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    this.trainPosition = 0
    this.isPlaying = false
    this.playbackSpeed = 0.5
    this.currentView = 'orbit'
    this.state = {
      speed: 60,
      observerHeight: 3.5,
      obstacles: [],
      filteredTypes: new Set(['tree', 'building', 'wall'])
    }
    this.init()
  }

  init() {
    this.setupScene()
    this.setupCamera()
    this.setupRenderer()
    this.setupLights()
    this.createGround()
    this.createRailway()
    this.createCrossing()
    this.createSightLines()
    this.setupControls()
    this.setupEventListeners()
    this.loadState()
    this.updateFilterUI()
    this.animate()
    this.updateSightCheck()
  }

  setupScene() {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x87ceeb)
    this.scene.fog = new THREE.Fog(0x87ceeb, 100, 500)
  }

  setupCamera() {
    const container = document.getElementById('canvas-container')
    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    )
    this.camera.position.set(50, 40, 50)
  }

  setupRenderer() {
    const container = document.getElementById('canvas-container')
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(this.renderer.domElement)
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(50, 100, 50)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    directionalLight.shadow.camera.near = 0.5
    directionalLight.shadow.camera.far = 500
    directionalLight.shadow.camera.left = -100
    directionalLight.shadow.camera.right = 100
    directionalLight.shadow.camera.top = 100
    directionalLight.shadow.camera.bottom = -100
    this.scene.add(directionalLight)
  }

  createGround() {
    const groundGeometry = new THREE.PlaneGeometry(400, 400)
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x3d5c3d,
      roughness: 0.8
    })
    const ground = new THREE.Mesh(groundGeometry, groundMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)

    const roadGeometry = new THREE.PlaneGeometry(15, 400)
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      roughness: 0.9
    })
    const road = new THREE.Mesh(roadGeometry, roadMaterial)
    road.rotation.x = -Math.PI / 2
    road.position.y = 0.01
    road.receiveShadow = true
    this.scene.add(road)

    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 })
    const linePoints = []
    for (let i = -100; i <= 100; i += 4) {
      linePoints.push(new THREE.Vector3(-2, 0.02, i))
      linePoints.push(new THREE.Vector3(-2, 0.02, i + 2))
      linePoints.push(new THREE.Vector3(2, 0.02, i))
      linePoints.push(new THREE.Vector3(2, 0.02, i + 2))
    }
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints)
    const roadLines = new THREE.LineSegments(lineGeometry, lineMaterial)
    this.scene.add(roadLines)
  }

  createRailway() {
    const sleeperMaterial = new THREE.MeshStandardMaterial({ color: 0x5c3a21 })
    const railMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 })

    const sleeperGeometry = new THREE.BoxGeometry(3, 0.2, 0.4)
    const railGeometry = new THREE.BoxGeometry(0.15, 0.15, 400)

    for (let z = -100; z <= 100; z += 2) {
      const sleeper = new THREE.Mesh(sleeperGeometry, sleeperMaterial)
      sleeper.position.set(0, 0.1, z)
      sleeper.castShadow = true
      sleeper.receiveShadow = true
      this.scene.add(sleeper)
    }

    const rail1 = new THREE.Mesh(railGeometry, railMaterial)
    rail1.position.set(-0.7, 0.3, 0)
    rail1.castShadow = true
    this.scene.add(rail1)

    const rail2 = new THREE.Mesh(railGeometry, railMaterial)
    rail2.position.set(0.7, 0.3, 0)
    rail2.castShadow = true
    this.scene.add(rail2)

    const ballastGeometry = new THREE.PlaneGeometry(4, 400)
    const ballastMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 })
    const ballast = new THREE.Mesh(ballastGeometry, ballastMaterial)
    ballast.rotation.x = -Math.PI / 2
    ballast.position.y = 0.05
    this.scene.add(ballast)

    this.createTrain()
  }

  createTrain() {
    const trainGroup = new THREE.Group()
    trainGroup.name = 'train'

    const bodyGeometry = new THREE.BoxGeometry(3, 3.5, 12)
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x2c5282 })
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
    body.position.y = 2.5
    body.castShadow = true
    trainGroup.add(body)

    const cabinGeometry = new THREE.BoxGeometry(2.8, 1.5, 5)
    const cabinMaterial = new THREE.MeshStandardMaterial({ color: 0x1a365d })
    const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial)
    cabin.position.set(0, 5, 2)
    cabin.castShadow = true
    trainGroup.add(cabin)

    const windowGeometry = new THREE.PlaneGeometry(1.5, 1)
    const windowMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x87ceeb, 
      transparent: true, 
      opacity: 0.7 
    })
    const frontWindow = new THREE.Mesh(windowGeometry, windowMaterial)
    frontWindow.position.set(0, 5, 4.51)
    trainGroup.add(frontWindow)

    const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16)
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
    const wheelPositions = [
      [-1, 0.5, -4], [1, 0.5, -4],
      [-1, 0.5, 4], [1, 0.5, 4]
    ]
    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(pos[0], pos[1], pos[2])
      trainGroup.add(wheel)
    })

    const observerMarkerGeometry = new THREE.SphereGeometry(0.3, 16, 16)
    const observerMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 })
    this.observerMarker = new THREE.Mesh(observerMarkerGeometry, observerMarkerMaterial)
    this.observerMarker.position.set(0, 3.5, 4)
    trainGroup.add(this.observerMarker)

    trainGroup.position.z = 80
    this.scene.add(trainGroup)
    this.train = trainGroup
  }

  createCrossing() {
    const crossingGroup = new THREE.Group()
    crossingGroup.name = 'crossing'

    const crossingGeometry = new THREE.PlaneGeometry(10, 6)
    const crossingMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x8b4513,
      roughness: 0.7
    })
    const crossing = new THREE.Mesh(crossingGeometry, crossingMaterial)
    crossing.rotation.x = -Math.PI / 2
    crossing.position.y = 0.15
    crossing.receiveShadow = true
    crossingGroup.add(crossing)

    const gateGeometry = new THREE.BoxGeometry(0.3, 3, 4)
    const gateMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xff0000,
      transparent: true,
      opacity: 0.8
    })
    
    const gate1 = new THREE.Mesh(gateGeometry, gateMaterial)
    gate1.position.set(-5, 1.5, 0)
    gate1.castShadow = true
    crossingGroup.add(gate1)

    const gate2 = new THREE.Mesh(gateGeometry, gateMaterial)
    gate2.position.set(5, 1.5, 0)
    gate2.castShadow = true
    crossingGroup.add(gate2)

    const lightGeometry = new THREE.BoxGeometry(0.15, 0.15, 0.15)
    const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 })
    for (let i = 0; i < 4; i++) {
      const light1 = new THREE.Mesh(lightGeometry, lightMaterial)
      light1.position.set(
        i < 2 ? -4.8 : 4.8,
        2.5 + (i % 2) * 0.4,
        i < 2 ? -1 : 1
      )
      crossingGroup.add(light1)
    }

    const signGeometry = new THREE.BoxGeometry(0.1, 1.5, 1.5)
    const signMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff })
    const sign1 = new THREE.Mesh(signGeometry, signMaterial)
    sign1.position.set(-7, 2, 0)
    sign1.castShadow = true
    crossingGroup.add(sign1)

    this.scene.add(crossingGroup)
  }

  createSightLines() {
    this.sightLineLeft = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 })
    )
    this.sightLineRight = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 })
    )
    this.scene.add(this.sightLineLeft)
    this.scene.add(this.sightLineRight)

    this.requiredSightArcLeft = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({ color: 0xffaa00, dashSize: 1, gapSize: 0.5 })
    )
    this.requiredSightArcRight = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({ color: 0xffaa00, dashSize: 1, gapSize: 0.5 })
    )
    this.scene.add(this.requiredSightArcLeft)
    this.scene.add(this.requiredSightArcRight)

    this.rectificationZone = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ 
        color: 0xff0000, 
        transparent: true, 
        opacity: 0.3,
        side: THREE.DoubleSide
      })
    )
    this.rectificationZone.rotation.x = -Math.PI / 2
    this.rectificationZone.position.y = 0.1
    this.scene.add(this.rectificationZone)
  }

  setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.maxPolarAngle = Math.PI / 2.1
    this.controls.minDistance = 10
    this.controls.maxDistance = 200
  }

  addObstacle(data) {
    let geometry, material, mesh
    
    switch (data.type) {
      case 'tree':
        const treeGroup = new THREE.Group()
        const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, data.height * 0.4, 8)
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x5c3a21 })
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial)
        trunk.position.y = data.height * 0.2
        trunk.castShadow = true
        treeGroup.add(trunk)

        const crownGeometry = new THREE.SphereGeometry(data.width, 16, 16)
        const crownMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 })
        const crown = new THREE.Mesh(crownGeometry, crownMaterial)
        crown.position.y = data.height * 0.6
        crown.castShadow = true
        treeGroup.add(crown)
        
        mesh = treeGroup
        break

      case 'building':
        geometry = new THREE.BoxGeometry(data.width, data.height, data.depth || data.width)
        material = new THREE.MeshStandardMaterial({ color: 0x808080 })
        mesh = new THREE.Mesh(geometry, material)
        mesh.position.y = data.height / 2
        mesh.castShadow = true
        mesh.receiveShadow = true
        break

      case 'wall':
        geometry = new THREE.BoxGeometry(data.width, data.height, data.depth || 0.5)
        material = new THREE.MeshStandardMaterial({ color: 0x696969 })
        mesh = new THREE.Mesh(geometry, material)
        mesh.position.y = data.height / 2
        mesh.castShadow = true
        break

      default:
        geometry = new THREE.BoxGeometry(data.width || 2, data.height, data.depth || 2)
        material = new THREE.MeshStandardMaterial({ color: 0x888888 })
        mesh = new THREE.Mesh(geometry, material)
        mesh.position.y = data.height / 2
        mesh.castShadow = true
    }

    mesh.position.x = data.position.x
    mesh.position.z = data.position.z
    mesh.userData = { ...data, isObstacle: true }
    
    this.scene.add(mesh)
    this.obstacles.push(mesh)
    
    return mesh
  }

  removeObstacle(obstacle) {
    this.scene.remove(obstacle)
    const index = this.obstacles.indexOf(obstacle)
    if (index > -1) {
      this.obstacles.splice(index, 1)
    }
  }

  clearObstacles() {
    this.obstacles.forEach(obs => this.scene.remove(obs))
    this.obstacles = []
  }

  calculateBrakingDistance(speedKmh) {
    const speedMs = speedKmh * 1000 / 3600
    const deceleration = 1.5
    const reactionTime = 2
    const reactionDistance = speedMs * reactionTime
    const brakingDistance = (speedMs * speedMs) / (2 * deceleration)
    return reactionDistance + brakingDistance
  }

  calculateSightDistance() {
    if (!this.train) return { left: Infinity, right: Infinity, leftPoint: null, rightPoint: null }

    const observerPos = new THREE.Vector3()
    this.observerMarker.getWorldPosition(observerPos)
    observerPos.y = this.state.observerHeight

    const sightAngle = 70 * Math.PI / 180
    const directions = [
      { angle: -sightAngle, name: 'left' },
      { angle: sightAngle, name: 'right' }
    ]

    const results = {}

    directions.forEach(({ angle, name }) => {
      const direction = new THREE.Vector3(
        Math.sin(angle),
        0,
        -Math.cos(angle)
      ).normalize()

      this.raycaster.set(observerPos, direction)
      this.raycaster.far = 200

      const intersects = this.raycaster.intersectObjects(
        this.obstacles.filter(o => o.visible),
        true
      )

      if (intersects.length > 0) {
        results[name] = intersects[0].distance
        results[`${name}Point`] = intersects[0].point
      } else {
        results[name] = 200
        results[`${name}Point`] = null
      }
    })

    return {
      left: results.left,
      right: results.right,
      leftPoint: results.leftPoint,
      rightPoint: results.rightPoint,
      observerPos
    }
  }

  updateSightLines() {
    const sightData = this.calculateSightDistance()
    const requiredDistance = this.calculateBrakingDistance(this.state.speed)

    const observerPos = sightData.observerPos || new THREE.Vector3(0, this.state.observerHeight, 80)
    const sightAngle = 70 * Math.PI / 180

    const updateLine = (line, angle, distance, color) => {
      const endPoint = new THREE.Vector3(
        observerPos.x + Math.sin(angle) * distance,
        observerPos.y,
        observerPos.z - Math.cos(angle) * distance
      )
      const points = [observerPos.clone(), endPoint]
      line.geometry.setFromPoints(points)
      line.material.color.set(color)
    }

    const leftColor = sightData.left < requiredDistance ? 0xff0000 : 0x00ff00
    const rightColor = sightData.right < requiredDistance ? 0xff0000 : 0x00ff00

    updateLine(this.sightLineLeft, -sightAngle, Math.min(sightData.left, requiredDistance + 10), leftColor)
    updateLine(this.sightLineRight, sightAngle, Math.min(sightData.right, requiredDistance + 10), rightColor)

    const updateArc = (arc, distance, side) => {
      const points = []
      const startAngle = side === 'left' ? -sightAngle : 0
      const endAngle = side === 'left' ? 0 : sightAngle
      
      for (let a = startAngle; a <= endAngle; a += 0.05) {
        points.push(new THREE.Vector3(
          Math.sin(a) * distance,
          0.1,
          -Math.cos(a) * distance
        ))
      }
      arc.geometry.setFromPoints(points)
      arc.position.set(0, 0, observerPos.z)
      arc.computeLineDistances()
    }

    updateArc(this.requiredSightArcLeft, requiredDistance, 'left')
    updateArc(this.requiredSightArcRight, requiredDistance, 'right')

    const minSight = Math.min(sightData.left, sightData.right)
    const areaNeedRectify = minSight < requiredDistance
    this.updateRectificationZone(areaNeedRectify, requiredDistance)

    return { sightData, requiredDistance }
  }

  updateRectificationZone(show, distance) {
    if (show && distance > 0) {
      this.rectificationZone.visible = true
      this.rectificationZone.scale.set(distance * 1.5, distance, 1)
      this.rectificationZone.position.z = this.train ? this.train.position.z - distance / 2 : -distance / 2
    } else {
      this.rectificationZone.visible = false
    }
  }

  updateSightCheck() {
    const { sightData, requiredDistance } = this.updateSightLines()
    
    const minSight = Math.min(sightData.left, sightData.right)
    const isPass = minSight >= requiredDistance
    
    document.getElementById('currentSightDistance').textContent = minSight.toFixed(1) + ' m'
    document.getElementById('currentSightDistance').className = `value ${isPass ? 'pass' : 'fail'}`
    
    document.getElementById('requiredSightDistance').textContent = requiredDistance.toFixed(1) + ' m'
    
    const rectArea = isPass ? 0 : (requiredDistance * requiredDistance * 0.5)
    document.getElementById('rectificationArea').textContent = rectArea.toFixed(1) + ' m²'
    document.getElementById('rectificationArea').className = `value ${isPass ? 'pass' : 'warning'}`

    this.updateReport(sightData, requiredDistance, isPass)
  }

  updateReport(sightData, requiredDistance, isPass) {
    const reportBox = document.getElementById('sightReport')
    const blockingObstacles = this.getBlockingObstacles(sightData, requiredDistance)

    let html = '<div class="report-content">'
    
    html += `<div class="report-item">
      <span class="report-label">检查结果</span>
      <span class="report-value ${isPass ? 'pass' : 'fail'}">${isPass ? '✓ 合格' : '✗ 不合格'}</span>
    </div>`
    
    html += `<div class="report-item">
      <span class="report-label">运行速度</span>
      <span class="report-value">${this.state.speed} km/h</span>
    </div>`
    
    html += `<div class="report-item">
      <span class="report-label">观察点高度</span>
      <span class="report-value">${this.state.observerHeight.toFixed(1)} m</span>
    </div>`
    
    html += `<div class="report-item">
      <span class="report-label">左侧视距</span>
      <span class="report-value ${sightData.left >= requiredDistance ? 'pass' : 'fail'}">${sightData.left.toFixed(1)} m</span>
    </div>`
    
    html += `<div class="report-item">
      <span class="report-label">右侧视距</span>
      <span class="report-value ${sightData.right >= requiredDistance ? 'pass' : 'fail'}">${sightData.right.toFixed(1)} m</span>
    </div>`

    if (blockingObstacles.length > 0) {
      html += `<div class="report-item" style="flex-direction: column; align-items: flex-start;">
        <span class="report-label" style="margin-bottom: 8px;">遮挡物列表:</span>
      </div>`
      blockingObstacles.forEach(obs => {
        html += `<div class="report-item" style="padding-left: 12px;">
          <span class="report-label">• ${obs.name}</span>
          <span class="report-value warning">${obs.distance.toFixed(1)}m</span>
        </div>`
      })
    }

    html += '</div>'
    reportBox.innerHTML = html
  }

  getBlockingObstacles(sightData, requiredDistance) {
    const blockers = []
    const observerPos = sightData.observerPos || new THREE.Vector3()
    
    this.obstacles.forEach(obs => {
      if (!obs.visible) return
      const distance = obs.position.distanceTo(observerPos)
      if (distance < requiredDistance) {
        blockers.push({
          name: obs.userData.name,
          distance: distance,
          type: obs.userData.type
        })
      }
    })
    
    return blockers.sort((a, b) => a.distance - b.distance)
  }

  updateFilterUI() {
    const container = document.getElementById('obstacleFilters')
    const types = [
      { type: 'tree', name: '树木', color: '#228b22' },
      { type: 'building', name: '建筑', color: '#808080' },
      { type: 'wall', name: '围墙', color: '#696969' }
    ]

    container.innerHTML = types.map(t => `
      <div class="filter-item">
        <input type="checkbox" id="filter-${t.type}" 
               ${this.state.filteredTypes.has(t.type) ? 'checked' : ''}>
        <div class="filter-color" style="background: ${t.color}"></div>
        <label for="filter-${t.type}">${t.name}</label>
      </div>
    `).join('')

    types.forEach(t => {
      document.getElementById(`filter-${t.type}`).addEventListener('change', (e) => {
        if (e.target.checked) {
          this.state.filteredTypes.add(t.type)
        } else {
          this.state.filteredTypes.delete(t.type)
        }
        this.updateObstacleVisibility()
        this.saveState()
      })
    })
  }

  updateObstacleVisibility() {
    this.obstacles.forEach(obs => {
      obs.visible = this.state.filteredTypes.has(obs.userData.type)
    })
    this.updateSightCheck()
  }

  setView(viewType) {
    this.currentView = viewType
    
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewType)
    })

    switch (viewType) {
      case 'top':
        this.camera.position.set(0, 150, 0.1)
        this.controls.target.set(0, 0, 0)
        break
      case 'driver':
        if (this.train) {
          const trainPos = this.train.position.clone()
          this.camera.position.set(trainPos.x, this.state.observerHeight + 0.5, trainPos.z - 2)
          this.controls.target.set(0, this.state.observerHeight, trainPos.z - 50)
        }
        break
      case 'orbit':
        this.camera.position.set(50, 40, 50)
        this.controls.target.set(0, 0, 0)
        break
    }
  }

  loadSample(sampleId) {
    const sample = sampleData[sampleId]
    if (!sample) return

    this.clearObstacles()
    
    this.state.speed = sample.speed
    this.state.observerHeight = sample.observerHeight
    this.state.filteredTypes = new Set(['tree', 'building', 'wall'])

    document.getElementById('speedSlider').value = sample.speed
    document.getElementById('speedValue').textContent = sample.speed
    document.getElementById('observerHeight').value = sample.observerHeight
    document.getElementById('observerHeightValue').textContent = sample.observerHeight.toFixed(1)

    const brakingDistance = this.calculateBrakingDistance(sample.speed)
    document.getElementById('brakingDistance').textContent = brakingDistance.toFixed(1)

    sample.obstacles.forEach(obs => this.addObstacle(obs))

    this.updateFilterUI()
    this.updateSightCheck()
    this.saveState()
  }

  resetState() {
    this.clearObstacles()
    this.state = {
      speed: 60,
      observerHeight: 3.5,
      obstacles: [],
      filteredTypes: new Set(['tree', 'building', 'wall'])
    }
    this.trainPosition = 0
    this.train.position.z = 80
    document.getElementById('speedSlider').value = 60
    document.getElementById('speedValue').textContent = '60'
    document.getElementById('observerHeight').value = 3.5
    document.getElementById('observerHeightValue').textContent = '3.5'
    document.getElementById('timelineSlider').value = 0
    document.getElementById('sampleSelect').value = ''
    document.getElementById('brakingDistance').textContent = this.calculateBrakingDistance(60).toFixed(1)
    this.updateFilterUI()
    this.updateSightCheck()
    this.saveState()
  }

  saveState() {
    const stateToSave = {
      speed: this.state.speed,
      observerHeight: this.state.observerHeight,
      filteredTypes: Array.from(this.state.filteredTypes),
      obstacles: this.obstacles.map(obs => ({
        id: obs.userData.id,
        type: obs.userData.type,
        name: obs.userData.name,
        position: { x: obs.position.x, z: obs.position.z },
        height: obs.userData.height,
        width: obs.userData.width,
        depth: obs.userData.depth,
        visible: obs.visible
      })),
      trainPosition: this.trainPosition,
      currentView: this.currentView
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave))
  }

  loadState() {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) {
      this.loadSample('sample1')
      return
    }

    try {
      const savedState = JSON.parse(saved)
      
      this.state.speed = savedState.speed || 60
      this.state.observerHeight = savedState.observerHeight || 3.5
      this.state.filteredTypes = new Set(savedState.filteredTypes || ['tree', 'building', 'wall'])
      
      document.getElementById('speedSlider').value = this.state.speed
      document.getElementById('speedValue').textContent = this.state.speed
      document.getElementById('observerHeight').value = this.state.observerHeight
      document.getElementById('observerHeightValue').textContent = this.state.observerHeight.toFixed(1)
      document.getElementById('brakingDistance').textContent = this.calculateBrakingDistance(this.state.speed).toFixed(1)

      if (savedState.obstacles && savedState.obstacles.length > 0) {
        savedState.obstacles.forEach(obs => this.addObstacle(obs))
      } else {
        this.loadSample('sample1')
      }

      this.trainPosition = savedState.trainPosition || 0
      this.train.position.z = 80 - (this.trainPosition / 100) * 160
      document.getElementById('timelineSlider').value = this.trainPosition

      if (savedState.currentView) {
        this.setView(savedState.currentView)
      }

      this.updateFilterUI()
      this.updateObstacleVisibility()
    } catch (e) {
      console.error('Failed to load saved state:', e)
      this.loadSample('sample1')
    }
  }

  exportReport() {
    const sightData = this.calculateSightDistance()
    const requiredDistance = this.calculateBrakingDistance(this.state.speed)
    const minSight = Math.min(sightData.left, sightData.right)
    const isPass = minSight >= requiredDistance
    const blockingObstacles = this.getBlockingObstacles(sightData, requiredDistance)

    const report = {
      title: '铁路道口视距检查报告',
      date: new Date().toLocaleString('zh-CN'),
      parameters: {
        speed: this.state.speed,
        observerHeight: this.state.observerHeight,
        requiredDistance: requiredDistance
      },
      results: {
        leftSight: sightData.left,
        rightSight: sightData.right,
        minSight: minSight,
        isPass: isPass
      },
      blockingObstacles: blockingObstacles,
      recommendation: isPass 
        ? '该道口视距符合安全要求，无需整改。' 
        : `该道口视距不足，建议移除或整改以下区域内的遮挡物，确保视距达到 ${requiredDistance.toFixed(1)} 米以上。`
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${report.title}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; }
        h1 { color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
        .section { margin: 20px 0; }
        .pass { color: #48bb78; font-weight: bold; }
        .fail { color: #f56565; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f7fafc; }
        .recommendation { background: #fef5e7; padding: 15px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>${report.title}</h1>
    <p><strong>检查时间:</strong> ${report.date}</p>
    
    <div class="section">
        <h2>一、检查参数</h2>
        <table>
            <tr><th>参数</th><th>数值</th></tr>
            <tr><td>列车运行速度</td><td>${report.parameters.speed} km/h</td></tr>
            <tr><td>司机观察点高度</td><td>${report.parameters.observerHeight.toFixed(1)} m</td></tr>
            <tr><td>要求安全视距</td><td>${report.parameters.requiredDistance.toFixed(1)} m</td></tr>
        </table>
    </div>
    
    <div class="section">
        <h2>二、检查结果</h2>
        <table>
            <tr><th>项目</th><th>数值</th><th>状态</th></tr>
            <tr><td>左侧视距</td><td>${report.results.leftSight.toFixed(1)} m</td><td class="${report.results.leftSight >= report.parameters.requiredDistance ? 'pass' : 'fail'}">${report.results.leftSight >= report.parameters.requiredDistance ? '合格' : '不合格'}</td></tr>
            <tr><td>右侧视距</td><td>${report.results.rightSight.toFixed(1)} m</td><td class="${report.results.rightSight >= report.parameters.requiredDistance ? 'pass' : 'fail'}">${report.results.rightSight >= report.parameters.requiredDistance ? '合格' : '不合格'}</td></tr>
            <tr><td>最小视距</td><td>${report.results.minSight.toFixed(1)} m</td><td class="${report.results.isPass ? 'pass' : 'fail'}">${report.results.isPass ? '合格' : '不合格'}</td></tr>
        </table>
    </div>
    
    ${report.blockingObstacles.length > 0 ? `
    <div class="section">
        <h2>三、影响视距的遮挡物</h2>
        <table>
            <tr><th>遮挡物名称</th><th>距离道口</th></tr>
            ${report.blockingObstacles.map(o => `<tr><td>${o.name}</td><td>${o.distance.toFixed(1)} m</td></tr>`).join('')}
        </table>
    </div>
    ` : ''}
    
    <div class="recommendation">
        <h2>四、整改建议</h2>
        <p>${report.recommendation}</p>
    </div>
</body>
</html>`

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `道口视距检查报告_${new Date().toISOString().slice(0,10)}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  setupEventListeners() {
    const container = document.getElementById('canvas-container')

    container.addEventListener('mousedown', (e) => this.onMouseDown(e))
    container.addEventListener('mousemove', (e) => this.onMouseMove(e))
    container.addEventListener('mouseup', () => this.onMouseUp())
    container.addEventListener('mouseleave', () => this.onMouseUp())

    document.getElementById('speedSlider').addEventListener('input', (e) => {
      this.state.speed = parseInt(e.target.value)
      document.getElementById('speedValue').textContent = this.state.speed
      document.getElementById('brakingDistance').textContent = this.calculateBrakingDistance(this.state.speed).toFixed(1)
      this.updateSightCheck()
      this.saveState()
    })

    document.getElementById('observerHeight').addEventListener('input', (e) => {
      this.state.observerHeight = parseFloat(e.target.value)
      document.getElementById('observerHeightValue').textContent = this.state.observerHeight.toFixed(1)
      if (this.observerMarker) {
        this.observerMarker.position.y = this.state.observerHeight
      }
      this.updateSightCheck()
      this.saveState()
    })

    document.getElementById('sampleSelect').addEventListener('change', (e) => {
      if (e.target.value) {
        this.loadSample(e.target.value)
      }
    })

    document.getElementById('resetBtn').addEventListener('click', () => this.resetState())
    document.getElementById('exportBtn').addEventListener('click', () => this.exportReport())

    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setView(btn.dataset.view))
    })

    document.getElementById('timelineSlider').addEventListener('input', (e) => {
      this.trainPosition = parseInt(e.target.value)
      if (this.train) {
        this.train.position.z = 80 - (this.trainPosition / 100) * 160
        this.updateSightCheck()
        this.saveState()
      }
    })

    document.getElementById('playBtn').addEventListener('click', () => {
      this.isPlaying = true
    })

    document.getElementById('stopBtn').addEventListener('click', () => {
      this.isPlaying = false
    })

    window.addEventListener('resize', () => {
      const container = document.getElementById('canvas-container')
      this.camera.aspect = container.clientWidth / container.clientHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(container.clientWidth, container.clientHeight)
    })
  }

  onMouseDown(e) {
    const container = document.getElementById('canvas-container')
    const rect = container.getBoundingClientRect()
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

    this.raycaster.setFromCamera(this.mouse, this.camera)
    const intersects = this.raycaster.intersectObjects(this.obstacles, true)

    if (intersects.length > 0) {
      this.controls.enabled = false
      this.isDragging = true
      
      let obj = intersects[0].object
      while (obj.parent && !obj.userData.isObstacle) {
        obj = obj.parent
      }
      this.selectedObstacle = obj
    }
  }

  onMouseMove(e) {
    if (!this.isDragging || !this.selectedObstacle) return

    const container = document.getElementById('canvas-container')
    const rect = container.getBoundingClientRect()
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

    this.raycaster.setFromCamera(this.mouse, this.camera)
    const intersectPoint = new THREE.Vector3()
    this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint)

    if (intersectPoint) {
      this.selectedObstacle.position.x = Math.max(-50, Math.min(50, intersectPoint.x))
      this.selectedObstacle.position.z = Math.max(-50, Math.min(50, intersectPoint.z))
      this.updateSightCheck()
    }
  }

  onMouseUp() {
    if (this.isDragging) {
      this.isDragging = false
      this.selectedObstacle = null
      this.saveState()
    }
    this.controls.enabled = true
  }

  animate() {
    requestAnimationFrame(() => this.animate())

    if (this.isPlaying && this.train) {
      this.trainPosition += this.playbackSpeed
      if (this.trainPosition > 100) this.trainPosition = 0
      this.train.position.z = 80 - (this.trainPosition / 100) * 160
      document.getElementById('timelineSlider').value = this.trainPosition
      this.updateSightCheck()
    }

    if (this.currentView === 'driver' && this.train) {
      const trainPos = this.train.position.clone()
      this.camera.position.lerp(
        new THREE.Vector3(trainPos.x, this.state.observerHeight + 0.5, trainPos.z - 2),
        0.1
      )
      this.controls.target.lerp(
        new THREE.Vector3(0, this.state.observerHeight, trainPos.z - 50),
        0.1
      )
    }

    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }
}

new RailwayCrossingApp()
