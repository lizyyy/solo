import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import TWEEN from '@tweenjs/tween.js'
import { AirportScene } from './scene.js'
import { VehicleManager } from './vehicles.js'
import { TimelineController } from './timeline.js'
import { ConflictDetector } from './collision.js'
import { ReportExporter } from './report.js'
import { sampleData } from './sampleData.js'

class App {
  constructor() {
    this.scene = null
    this.camera = null
    this.renderer = null
    this.controls = null
    this.airportScene = null
    this.vehicleManager = null
    this.timeline = null
    this.conflictDetector = null
    this.reportExporter = null
    
    this.data = null
    this.isPlaying = false
    this.playbackSpeed = 1
    this.currentTime = 0
    this.currentView = 'perspective'
    this.followVehicle = null
    this.vehicleFilters = { ferry: true, fuel: true, baggage: true }
    
    this.init()
    this.setupEventListeners()
    this.animate()
  }
  
  init() {
    const container = document.getElementById('canvas-container')
    const width = container.clientWidth
    const height = container.clientHeight
    
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x1a1a2e)
    this.scene.fog = new THREE.Fog(0x1a1a2e, 100, 500)
    
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000)
    this.camera.position.set(80, 60, 80)
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(width, height)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(this.renderer.domElement)
    
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.maxPolarAngle = Math.PI / 2.1
    
    this.addLighting()
    
    this.airportScene = new AirportScene(this.scene)
    this.vehicleManager = new VehicleManager(this.scene, this)
    this.timeline = new TimelineController(this)
    this.conflictDetector = new ConflictDetector(this)
    this.reportExporter = new ReportExporter(this)
  }
  
  addLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
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
  
  setupEventListeners() {
    window.addEventListener('resize', () => this.onResize())
    
    document.getElementById('load-sample').addEventListener('click', () => {
      this.loadData(sampleData)
    })
    
    document.getElementById('import-btn').addEventListener('click', () => {
      document.getElementById('import-file').click()
    })
    
    document.getElementById('import-file').addEventListener('change', (e) => {
      const file = e.target.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target.result)
            this.loadData(data)
          } catch (err) {
            alert('JSON格式错误')
          }
        }
        reader.readAsText(file)
      }
    })
    
    document.getElementById('reset-btn').addEventListener('click', () => {
      this.resetState()
    })
    
    document.getElementById('export-report').addEventListener('click', () => {
      this.reportExporter.export()
    })
    
    document.querySelectorAll('#vehicle-filters input').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        this.vehicleFilters[checkbox.value] = checkbox.checked
        this.updateVehicleVisibility()
      })
    })
    
    document.querySelectorAll('.btn-view').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-view').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        this.setView(btn.dataset.view)
      })
    })
    
    document.querySelector('[data-view="perspective"]').classList.add('active')
    
    this.renderer.domElement.addEventListener('click', (e) => this.onCanvasClick(e))
    this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e))
  }
  
  loadData(data) {
    this.data = data
    this.airportScene.build(data)
    this.vehicleManager.createVehicles(data.vehicles)
    this.timeline.setup(data)
    this.resetState()
  }
  
  resetState() {
    this.currentTime = 0
    this.isPlaying = false
    this.timeline.updateSlider(0)
    this.timeline.updateTimeDisplay(0)
    this.vehicleManager.resetVehicles()
    this.conflictDetector.clearConflicts()
    this.conflictDetector.detectAllConflicts()
  }
  
  setView(viewType) {
    this.currentView = viewType
    this.controls.enabled = viewType !== 'follow'
    
    if (viewType === 'top') {
      new TWEEN.Tween(this.camera.position)
        .to({ x: 0, y: 120, z: 0.1 }, 1000)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .start()
      this.controls.target.set(0, 0, 0)
    } else if (viewType === 'perspective') {
      new TWEEN.Tween(this.camera.position)
        .to({ x: 80, y: 60, z: 80 }, 1000)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .start()
      this.controls.target.set(0, 0, 0)
    }
  }
  
  updateVehicleVisibility() {
    this.vehicleManager.setVisibility(this.vehicleFilters)
  }
  
  onCanvasClick(event) {
    const mouse = new THREE.Vector2()
    const rect = this.renderer.domElement.getBoundingClientRect()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, this.camera)
    
    const vehicleMeshes = this.vehicleManager.getVehicleMeshes()
    const intersects = raycaster.intersectObjects(vehicleMeshes, true)
    
    if (intersects.length > 0) {
      let vehicle = intersects[0].object
      while (vehicle.parent && !vehicle.userData.vehicleId) {
        vehicle = vehicle.parent
      }
      if (vehicle.userData.vehicleId) {
        this.followVehicle = vehicle
        if (this.currentView === 'follow') {
          this.vehicleManager.highlightVehicle(vehicle.userData.vehicleId)
        }
      }
    }
  }
  
  onMouseMove(event) {
    const mouse = new THREE.Vector2()
    const rect = this.renderer.domElement.getBoundingClientRect()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, this.camera)
    
    const hoverTargets = [
      ...this.vehicleManager.getVehicleMeshes(),
      ...this.airportScene.getHoverTargets()
    ]
    
    const intersects = raycaster.intersectObjects(hoverTargets, true)
    const tooltip = document.getElementById('info-tooltip')
    
    if (intersects.length > 0) {
      let target = intersects[0].object
      while (target.parent && !target.userData.tooltip) {
        target = target.parent
      }
      if (target.userData.tooltip) {
        tooltip.style.display = 'block'
        tooltip.style.left = (event.clientX + 15) + 'px'
        tooltip.style.top = (event.clientY + 15) + 'px'
        tooltip.innerHTML = target.userData.tooltip
      } else {
        tooltip.style.display = 'none'
      }
    } else {
      tooltip.style.display = 'none'
    }
  }
  
  onResize() {
    const container = document.getElementById('canvas-container')
    const width = container.clientWidth
    const height = container.clientHeight
    
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }
  
  update(deltaTime) {
    if (this.isPlaying && this.data) {
      const timeIncrement = deltaTime * this.playbackSpeed * 10
      this.currentTime = Math.min(this.currentTime + timeIncrement, this.data.duration)
      this.timeline.updateSlider(this.currentTime / this.data.duration * 100)
      this.timeline.updateTimeDisplay(this.currentTime)
      this.vehicleManager.updateVehicles(this.currentTime)
      this.conflictDetector.update(this.currentTime)
      
      if (this.currentTime >= this.data.duration) {
        this.isPlaying = false
      }
    }
    
    if (this.currentView === 'follow' && this.followVehicle) {
      const vehiclePos = this.followVehicle.position
      this.camera.position.lerp(
        new THREE.Vector3(vehiclePos.x + 15, vehiclePos.y + 10, vehiclePos.z + 15),
        0.05
      )
      this.controls.target.copy(vehiclePos)
    }
    
    TWEEN.update()
    this.controls.update()
  }
  
  animate() {
    requestAnimationFrame(() => this.animate())
    
    const deltaTime = 1 / 60
    this.update(deltaTime)
    
    this.renderer.render(this.scene, this.camera)
  }
}

const app = new App()
export default app
