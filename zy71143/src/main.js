import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createSceneObjects } from './scene/objects.js'
import { SightlineAnalyzer } from './analysis/sightline.js'
import { TimelineController } from './interaction/timeline.js'
import { UIController } from './interaction/ui.js'
import { ReportExporter } from './analysis/report.js'
import { sampleSceneData } from './data/sample.js'

class QueueVisionApp {
  constructor() {
    this.scene = null
    this.camera = null
    this.renderer = null
    this.controls = null
    this.objects = {}
    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()
    this.selectedObject = null
    this.isPlaying = false
    this.currentViewpointIndex = 0
    
    this.sightlineAnalyzer = null
    this.timelineController = null
    this.uiController = null
    this.reportExporter = null
    
    this.init()
  }

  init() {
    this.setupThreeJS()
    this.setupControllers()
    this.setupEventListeners()
    this.animate()
  }

  setupThreeJS() {
    const container = document.getElementById('scene-container')
    
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0a0a1a)
    this.scene.fog = new THREE.Fog(0x0a0a1a, 50, 150)

    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    )
    this.camera.position.set(30, 25, 30)

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.maxPolarAngle = Math.PI / 2.1

    this.setupLighting()
    this.setupGround()
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
    this.scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(20, 40, 20)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    directionalLight.shadow.camera.near = 0.5
    directionalLight.shadow.camera.far = 100
    directionalLight.shadow.camera.left = -50
    directionalLight.shadow.camera.right = 50
    directionalLight.shadow.camera.top = 50
    directionalLight.shadow.camera.bottom = -50
    this.scene.add(directionalLight)

    const fillLight = new THREE.DirectionalLight(0x4a90d9, 0.3)
    fillLight.position.set(-20, 10, -20)
    this.scene.add(fillLight)
  }

  setupGround() {
    const gridHelper = new THREE.GridHelper(100, 100, 0x1a4a7a, 0x0f3460)
    gridHelper.position.y = -0.01
    this.scene.add(gridHelper)

    const groundGeometry = new THREE.PlaneGeometry(100, 100)
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x16213e,
      roughness: 0.9,
      metalness: 0.1
    })
    const ground = new THREE.Mesh(groundGeometry, groundMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)
  }

  setupControllers() {
    this.sightlineAnalyzer = new SightlineAnalyzer(this.scene)
    this.timelineController = new TimelineController(this)
    this.uiController = new UIController(this)
    this.reportExporter = new ReportExporter(this)
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.onWindowResize())
    this.renderer.domElement.addEventListener('click', (e) => this.onMouseClick(e))
    this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e))
  }

  onWindowResize() {
    const container = document.getElementById('scene-container')
    this.camera.aspect = container.clientWidth / container.clientHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(container.clientWidth, container.clientHeight)
  }

  onMouseClick(event) {
    const container = document.getElementById('scene-container')
    const rect = container.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1

    this.raycaster.setFromCamera(this.mouse, this.camera)
    
    const allMeshes = []
    Object.values(this.objects).forEach(group => {
      if (group && group.children) {
        group.traverse(obj => {
          if (obj.isMesh && obj.userData.selectable) {
            allMeshes.push(obj)
          }
        })
      }
    })

    const intersects = this.raycaster.intersectObjects(allMeshes)
    
    if (intersects.length > 0) {
      this.selectObject(intersects[0].object)
    } else {
      this.deselectObject()
    }
  }

  onMouseMove(event) {
    const container = document.getElementById('scene-container')
    const rect = container.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1
  }

  selectObject(obj) {
    if (this.selectedObject) {
      this.restoreObjectMaterial(this.selectedObject)
    }
    
    this.selectedObject = obj
    this.highlightObject(obj)
    this.uiController.updateSelectedInfo(obj)
  }

  deselectObject() {
    if (this.selectedObject) {
      this.restoreObjectMaterial(this.selectedObject)
    }
    this.selectedObject = null
    this.uiController.clearSelectedInfo()
  }

  highlightObject(obj) {
    if (!obj.userData.originalMaterial) {
      obj.userData.originalMaterial = obj.material.clone()
    }
    
    const highlightMaterial = new THREE.MeshStandardMaterial({
      color: 0xe94560,
      emissive: 0xe94560,
      emissiveIntensity: 0.3
    })
    obj.material = highlightMaterial
  }

  restoreObjectMaterial(obj) {
    if (obj.userData.originalMaterial) {
      obj.material = obj.userData.originalMaterial
    }
  }

  loadSampleScene() {
    this.clearScene()
    this.objects = createSceneObjects(this.scene, sampleSceneData)
    this.sightlineAnalyzer.analyzeAllViewpoints(
      this.objects.viewpoints,
      this.objects.screens,
      this.objects.obstacles
    )
    this.timelineController.setupViewpoints(this.objects.viewpoints)
    this.uiController.updateStatusDisplay()
    this.uiController.updateReportPreview()
  }

  clearScene() {
    Object.values(this.objects).forEach(group => {
      if (group) {
        this.scene.remove(group)
        if (group.dispose) group.dispose()
      }
    })
    this.objects = {}
    this.deselectObject()
  }

  resetScene() {
    this.loadSampleScene()
    this.timelineController.reset()
    this.isPlaying = false
    this.currentViewpointIndex = 0
  }

  setView(viewType) {
    const positions = {
      top: { pos: [0, 50, 0.01], target: [0, 0, 0] },
      front: { pos: [0, 10, 50], target: [0, 5, 0] },
      free: { pos: [30, 25, 30], target: [0, 5, 0] }
    }
    
    const view = positions[viewType]
    if (view) {
      this.camera.position.set(...view.pos)
      this.controls.target.set(...view.target)
      this.controls.update()
    }
  }

  toggleFilter(filterType, visible) {
    const filterMap = {
      ride: 'ride',
      queue: 'queue',
      screen: 'screens',
      obstacle: 'obstacles',
      viewpoint: 'viewpoints',
      sightline: 'sightlines'
    }
    
    const objKey = filterMap[filterType]
    if (this.objects[objKey]) {
      this.objects[objKey].visible = visible
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate())
    this.controls.update()
    this.render()
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }
}

const app = new QueueVisionApp()
window.app = app
