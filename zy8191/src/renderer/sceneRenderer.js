import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { LayerRenderer } from './layerRenderer.js'
import { FindRenderer } from './findRenderer.js'

export class SceneRenderer {
  constructor(canvas) {
    this.canvas = canvas
    this.scene = null
    this.camera = null
    this.renderer = null
    this.controls = null
    this.layerRenderer = null
    this.findRenderer = null
    
    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()
    
    this.onLayerClick = null
    this.onFindClick = null
    
    this.showWireframe = true
    this.showAxes = true
    this.showOutlines = true
    
    this.axesHelper = null
    this.gridHelpers = []
    this.trenchBox = null
    
    this.init()
  }

  init() {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x1a1a2e)
    this.scene.fog = new THREE.Fog(0x1a1a2e, 20, 100)

    const aspect = this.canvas.clientWidth / this.canvas.clientHeight
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000)
    this.camera.position.set(15, 15, 15)
    this.camera.lookAt(5, 0, 5)

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true
    })
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.controls = new OrbitControls(this.camera, this.canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.screenSpacePanning = false
    this.controls.minDistance = 5
    this.controls.maxDistance = 100
    this.controls.maxPolarAngle = Math.PI / 2 + 0.1

    this.setupLights()

    this.layerRenderer = new LayerRenderer(this.scene)
    this.findRenderer = new FindRenderer(this.scene)

    this.setupEventListeners()

    this.animate()
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
    this.scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(10, 20, 10)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    directionalLight.shadow.camera.near = 0.5
    directionalLight.shadow.camera.far = 50
    directionalLight.shadow.camera.left = -20
    directionalLight.shadow.camera.right = 20
    directionalLight.shadow.camera.top = 20
    directionalLight.shadow.camera.bottom = -20
    this.scene.add(directionalLight)

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3)
    directionalLight2.position.set(-10, 10, -10)
    this.scene.add(directionalLight2)
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.onResize())
    this.canvas.addEventListener('click', (event) => this.onMouseClick(event))
    this.canvas.addEventListener('mousemove', (event) => this.onMouseMove(event))
  }

  onResize() {
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  onMouseClick(event) {
    const rect = this.canvas.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    this.raycaster.setFromCamera(this.mouse, this.camera)
    const intersects = this.raycaster.intersectObjects(this.scene.children, true)

    for (const intersect of intersects) {
      const layerData = this.layerRenderer.getLayerByMesh(intersect.object)
      if (layerData && this.onLayerClick) {
        this.onLayerClick(layerData)
        return
      }

      const findData = this.findRenderer.getFindByMesh(intersect.object)
      if (findData && this.onFindClick) {
        this.onFindClick(findData)
        return
      }
    }
  }

  onMouseMove(event) {
    const rect = this.canvas.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }

  createTrenchBoundary(trenchDimensions) {
    const dim = trenchDimensions

    if (this.trenchBox) {
      this.scene.remove(this.trenchBox)
    }

    const width = dim.x_max - dim.x_min
    const height = dim.z_max - dim.z_min
    const depth = dim.y_max - dim.y_min

    const geometry = new THREE.BoxGeometry(width, height, depth)
    const edges = new THREE.EdgesGeometry(geometry)
    const material = new THREE.LineBasicMaterial({
      color: 0x4ade80,
      linewidth: 2,
      transparent: true,
      opacity: 0.5
    })

    this.trenchBox = new THREE.LineSegments(edges, material)
    this.trenchBox.position.set(
      (dim.x_min + dim.x_max) / 2,
      (dim.z_min + dim.z_max) / 2,
      (dim.y_min + dim.y_max) / 2
    )
    this.scene.add(this.trenchBox)
  }

  createGridHelpers(trenchDimensions) {
    this.gridHelpers.forEach(helper => this.scene.remove(helper))
    this.gridHelpers = []

    const dim = trenchDimensions
    const centerX = (dim.x_min + dim.x_max) / 2
    const centerZ = (dim.y_min + dim.y_max) / 2
    const size = Math.max(dim.x_max - dim.x_min, dim.y_max - dim.y_min)

    const gridXY = new THREE.GridHelper(size, 10, 0x444444, 0x333333)
    gridXY.position.set(centerX, 0, centerZ)
    this.scene.add(gridXY)
    this.gridHelpers.push(gridXY)
  }

  createAxesHelper(trenchDimensions) {
    if (this.axesHelper) {
      this.scene.remove(this.axesHelper)
    }

    const size = Math.max(
      trenchDimensions.x_max - trenchDimensions.x_min,
      trenchDimensions.z_max - trenchDimensions.z_min
    )

    this.axesHelper = new THREE.AxesHelper(size * 0.5)
    this.axesHelper.position.set(
      trenchDimensions.x_min,
      trenchDimensions.z_min,
      trenchDimensions.y_min
    )
    this.scene.add(this.axesHelper)
  }

  loadData(contexts, finds, rules) {
    this.clear()

    const trenchDimensions = rules?.trench?.dimensions || {
      x_min: 0, x_max: 10,
      y_min: 0, y_max: 10,
      z_min: 0, z_max: 5
    }

    this.createTrenchBoundary(trenchDimensions)
    this.createGridHelpers(trenchDimensions)
    this.createAxesHelper(trenchDimensions)

    if (contexts && contexts.length > 0) {
      this.layerRenderer.createAllLayers(contexts, trenchDimensions)
    }

    if (finds && finds.length > 0) {
      const contextMap = new Map()
      if (contexts) {
        contexts.forEach(ctx => contextMap.set(ctx.id, ctx))
      }
      this.findRenderer.createAllFinds(finds, contextMap)
    }

    this.camera.position.set(15, 15, 15)
    this.controls.target.set(5, 2, 5)
    this.controls.update()
  }

  highlightLayer(layerId) {
    this.layerRenderer.highlightLayer(layerId)
    
    const layerFinds = this.findRenderer.getFindsByLayer(layerId)
    layerFinds.forEach(({ find }) => {
      this.findRenderer.highlightFind(find.id)
    })
  }

  resetHighlight() {
    this.layerRenderer.resetAllLayers()
    this.findRenderer.resetAllFinds()
  }

  toggleWireframe(show) {
    this.showWireframe = show
    this.layerRenderer.setWireframeVisible(show)
  }

  toggleAxes(show) {
    this.showAxes = show
    if (this.axesHelper) {
      this.axesHelper.visible = show
    }
  }

  toggleOutlines(show) {
    this.showOutlines = show
    if (this.trenchBox) {
      this.trenchBox.visible = show
    }
  }

  clear() {
    this.layerRenderer.clear()
    this.findRenderer.clear()

    if (this.axesHelper) {
      this.scene.remove(this.axesHelper)
      this.axesHelper = null
    }

    this.gridHelpers.forEach(helper => this.scene.remove(helper))
    this.gridHelpers = []

    if (this.trenchBox) {
      this.scene.remove(this.trenchBox)
      this.trenchBox = null
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate())
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }
}

export default SceneRenderer
