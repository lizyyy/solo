<template>
  <div class="tunnel-viewer">
    <div ref="container" class="canvas-container"></div>
    <div v-if="riskMarkers.length > 0" class="risk-overlay">
      <div 
        v-for="marker in screenMarkers" 
        :key="marker.id"
        class="risk-marker"
        :class="getRiskMarkerClass(marker.type)"
        :style="{ left: marker.screenX + 'px', top: marker.screenY + 'px' }"
        @click="onRiskClick(marker)"
      >
        {{ getRiskLabel(marker.type) }}
      </div>
    </div>
    <div class="viewer-controls">
      <el-button-group>
        <el-button size="small" @click="resetCamera">
          <el-icon><Refresh /></el-icon>
          重置视图
        </el-button>
        <el-button size="small" @click="toggleWireframe">
          <el-icon><Grid /></el-icon>
          {{ showWireframe ? '隐藏线框' : '显示线框' }}
        </el-button>
      </el-button-group>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RiskTypes, RiskColors } from '@/models'

const props = defineProps({
  sections: {
    type: Array,
    default: () => []
  },
  riskMarkers: {
    type: Array,
    default: () => []
  },
  sensors: {
    type: Array,
    default: () => []
  },
  manholes: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['sectionClick', 'riskClick'])

const container = ref(null)
const scene = ref(null)
const camera = ref(null)
const renderer = ref(null)
const controls = ref(null)
const animationId = ref(null)
const showWireframe = ref(false)
const sectionMeshes = ref(new Map())
const riskObjects = ref(new Map())
const sensorObjects = ref(new Map())
const manholeObjects = ref(new Map())

const screenMarkers = computed(() => {
  const markers = []
  if (!camera.value || !container.value) return markers

  const rect = container.value.getBoundingClientRect()
  const vector = new THREE.Vector3()

  for (const risk of props.riskMarkers) {
    vector.set(risk.position.x, risk.position.y, risk.position.z)
    vector.project(camera.value)

    const x = (vector.x * 0.5 + 0.5) * rect.width
    const y = (-vector.y * 0.5 + 0.5) * rect.height

    if (vector.z < 1 && x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
      markers.push({
        ...risk,
        screenX: x,
        screenY: y - 20
      })
    }
  }

  return markers
})

const initScene = () => {
  if (!container.value) return

  scene.value = new THREE.Scene()
  scene.value.background = new THREE.Color(0x1a1a2e)
  scene.value.fog = new THREE.Fog(0x1a1a2e, 50, 200)

  const width = container.value.clientWidth
  const height = container.value.clientHeight

  camera.value = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000)
  camera.value.position.set(50, 40, 50)

  renderer.value = new THREE.WebGLRenderer({ antialias: true })
  renderer.value.setSize(width, height)
  renderer.value.setPixelRatio(window.devicePixelRatio)
  renderer.value.shadowMap.enabled = true
  container.value.appendChild(renderer.value.domElement)

  controls.value = new OrbitControls(camera.value, renderer.value.domElement)
  controls.value.enableDamping = true
  controls.value.dampingFactor = 0.05
  controls.value.screenSpacePanning = true
  controls.value.minDistance = 5
  controls.value.maxDistance = 200

  addLights()
  addGround()
  addAxisHelper()

  animate()
}

const addLights = () => {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
  scene.value.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(50, 100, 50)
  directionalLight.castShadow = true
  directionalLight.shadow.mapSize.width = 2048
  directionalLight.shadow.mapSize.height = 2048
  scene.value.add(directionalLight)

  const pointLight1 = new THREE.PointLight(0x4fc3f7, 0.5, 100)
  pointLight1.position.set(0, 10, 0)
  scene.value.add(pointLight1)

  const pointLight2 = new THREE.PointLight(0xff9800, 0.3, 100)
  pointLight2.position.set(50, 10, 50)
  scene.value.add(pointLight2)
}

const addGround = () => {
  const groundGeometry = new THREE.PlaneGeometry(200, 200)
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x16213e,
    roughness: 0.9
  })
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -10
  ground.receiveShadow = true
  scene.value.add(ground)

  const gridHelper = new THREE.GridHelper(200, 40, 0x3f51b5, 0x1a1a3e)
  gridHelper.position.y = -9.9
  scene.value.add(gridHelper)
}

const addAxisHelper = () => {
  const axisHelper = new THREE.AxesHelper(10)
  scene.value.add(axisHelper)
}

const createSectionMesh = (section) => {
  const group = new THREE.Group()
  group.userData = { type: 'section', id: section.id, data: section }

  const start = section.startPoint
  const end = section.endPoint
  const width = section.width
  const height = section.height

  const dx = end.x - start.x
  const dy = end.y - start.y
  const dz = end.z - start.z
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz)

  const tunnelGeometry = new THREE.BoxGeometry(width, height, length)
  
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a5568,
    roughness: 0.8,
    metalness: 0.2
  })

  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x2d3748,
    roughness: 0.9
  })

  const wallMaterialWire = new THREE.MeshStandardMaterial({
    color: 0x60a5fa,
    roughness: 0.5,
    wireframe: showWireframe.value,
    transparent: true,
    opacity: 0.7
  })

  const tunnelMesh = new THREE.Mesh(tunnelGeometry, wallMaterialWire)
  tunnelMesh.castShadow = true
  tunnelMesh.receiveShadow = true
  group.add(tunnelMesh)

  const edgesGeometry = new THREE.EdgesGeometry(tunnelGeometry)
  const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.8 })
  const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial)
  group.add(edges)

  const midX = (start.x + end.x) / 2
  const midY = (start.y + end.y) / 2
  const midZ = (start.z + end.z) / 2
  group.position.set(midX, midY, midZ)

  if (length > 0) {
    const direction = new THREE.Vector3(dx, dy, dz).normalize()
    const quaternion = new THREE.Quaternion()
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction)
    group.setRotationFromQuaternion(quaternion)
  }

  return group
}

const createRiskMarker = (risk) => {
  const group = new THREE.Group()
  group.userData = { type: 'risk', id: risk.id, data: risk }

  const color = RiskColors[risk.type] || 0xff0000
  
  const coneGeometry = new THREE.ConeGeometry(1, 3, 8)
  const coneMaterial = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.8
  })
  const cone = new THREE.Mesh(coneGeometry, coneMaterial)
  cone.position.y = 2
  cone.rotation.x = Math.PI
  group.add(cone)

  const ringGeometry = new THREE.RingGeometry(0.8, 1.2, 16)
  const ringMaterial = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.6
  })
  const ring = new THREE.Mesh(ringGeometry, ringMaterial)
  ring.position.y = 0.05
  ring.rotation.x = -Math.PI / 2
  group.add(ring)

  group.position.set(risk.position.x, risk.position.y, risk.position.z)

  return group
}

const createSensorMarker = (sensor) => {
  const group = new THREE.Group()
  group.userData = { type: 'sensor', id: sensor.id, data: sensor }

  const geometry = new THREE.SphereGeometry(0.5, 16, 16)
  const material = new THREE.MeshStandardMaterial({
    color: sensor.alarmStatus === 'danger' ? 0xf56c6c : 
           sensor.alarmStatus === 'warning' ? 0xe6a23c : 0x67c23a,
    emissive: sensor.alarmStatus === 'normal' ? 0x67c23a : 0xf56c6c,
    emissiveIntensity: 0.2
  })
  const sphere = new THREE.Mesh(geometry, material)
  group.add(sphere)

  group.position.set(sensor.position.x, sensor.position.y, sensor.position.z)

  return group
}

const createManholeMarker = (manhole) => {
  const group = new THREE.Group()
  group.userData = { type: 'manhole', id: manhole.id, data: manhole }

  const geometry = new THREE.CylinderGeometry(0.8, 0.8, 0.2, 16)
  const material = new THREE.MeshStandardMaterial({
    color: manhole.status === 'open' ? 0xf56c6c : 0x4a5568,
    roughness: 0.7
  })
  const cylinder = new THREE.Mesh(geometry, material)
  group.add(cylinder)

  if (manhole.status === 'open') {
    const warningGeometry = new THREE.TorusGeometry(1, 0.1, 8, 16)
    const warningMaterial = new THREE.MeshBasicMaterial({
      color: 0xf56c6c,
      transparent: true,
      opacity: 0.7
    })
    const warning = new THREE.Mesh(warningGeometry, warningMaterial)
    warning.rotation.x = Math.PI / 2
    warning.position.y = 1
    group.add(warning)
  }

  group.position.set(manhole.position.x, manhole.position.y, manhole.position.z)

  return group
}

const updateScene = () => {
  if (!scene.value) return

  for (const [id, mesh] of sectionMeshes.value) {
    scene.value.remove(mesh)
  }
  sectionMeshes.value.clear()

  for (const [id, obj] of riskObjects.value) {
    scene.value.remove(obj)
  }
  riskObjects.value.clear()

  for (const [id, obj] of sensorObjects.value) {
    scene.value.remove(obj)
  }
  sensorObjects.value.clear()

  for (const [id, obj] of manholeObjects.value) {
    scene.value.remove(obj)
  }
  manholeObjects.value.clear()

  for (const section of props.sections) {
    const mesh = createSectionMesh(section)
    sectionMeshes.value.set(section.id, mesh)
    scene.value.add(mesh)
  }

  for (const risk of props.riskMarkers) {
    const obj = createRiskMarker(risk)
    riskObjects.value.set(risk.id, obj)
    scene.value.add(obj)
  }

  for (const sensor of props.sensors) {
    const obj = createSensorMarker(sensor)
    sensorObjects.value.set(sensor.id, obj)
    scene.value.add(obj)
  }

  for (const manhole of props.manholes) {
    const obj = createManholeMarker(manhole)
    manholeObjects.value.set(manhole.id, obj)
    scene.value.add(obj)
  }
}

const animate = () => {
  animationId.value = requestAnimationFrame(animate)
  
  const time = Date.now() * 0.001
  for (const [id, obj] of riskObjects.value) {
    if (obj.children[0]) {
      obj.children[0].position.y = 2 + Math.sin(time * 2 + id.charCodeAt(id.length - 1)) * 0.3
    }
    if (obj.children[1]) {
      const scale = 1 + Math.sin(time * 3) * 0.1
      obj.children[1].scale.set(scale, scale, scale)
    }
  }

  controls.value.update()
  renderer.value.render(scene.value, camera.value)
}

const resetCamera = () => {
  if (camera.value && controls.value) {
    camera.value.position.set(50, 40, 50)
    controls.value.target.set(0, 0, 0)
    controls.value.update()
  }
}

const toggleWireframe = () => {
  showWireframe.value = !showWireframe.value
  updateScene()
}

const getRiskMarkerClass = (type) => {
  const classMap = {
    [RiskTypes.OXYGEN_DEFICIENCY]: 'risk-oxygen',
    [RiskTypes.FLAMMABLE_GAS]: 'risk-gas',
    [RiskTypes.WATER_ACCUMULATION]: 'risk-water',
    [RiskTypes.UNOPENED_TICKET]: 'risk-ticket'
  }
  return classMap[type] || ''
}

const getRiskLabel = (type) => {
  const labelMap = {
    [RiskTypes.OXYGEN_DEFICIENCY]: '缺氧',
    [RiskTypes.FLAMMABLE_GAS]: '可燃气体',
    [RiskTypes.WATER_ACCUMULATION]: '积水',
    [RiskTypes.UNOPENED_TICKET]: '未闭环'
  }
  return labelMap[type] || '风险'
}

const onRiskClick = (marker) => {
  emit('riskClick', marker)
}

const handleResize = () => {
  if (!container.value || !camera.value || !renderer.value) return
  
  const width = container.value.clientWidth
  const height = container.value.clientHeight
  
  camera.value.aspect = width / height
  camera.value.updateProjectionMatrix()
  renderer.value.setSize(width, height)
}

const handleClick = (event) => {
  if (!container.value || !camera.value || !scene.value) return

  const rect = container.value.getBoundingClientRect()
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  )

  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(mouse, camera.value)

  const allMeshes = []
  for (const [id, mesh] of sectionMeshes.value) {
    mesh.traverse((child) => {
      if (child.isMesh) {
        allMeshes.push(child)
      }
    })
  }

  const intersects = raycaster.intersectObjects(allMeshes)

  if (intersects.length > 0) {
    let target = intersects[0].object
    while (target.parent && !target.userData.type) {
      target = target.parent
    }
    
    if (target.userData.type === 'section') {
      emit('sectionClick', target.userData.data)
    }
  }
}

watch(() => [props.sections, props.riskMarkers, props.sensors, props.manholes], () => {
  updateScene()
}, { deep: true })

onMounted(() => {
  initScene()
  updateScene()
  
  window.addEventListener('resize', handleResize)
  if (container.value) {
    container.value.addEventListener('click', handleClick)
  }
})

onUnmounted(() => {
  if (animationId.value) {
    cancelAnimationFrame(animationId.value)
  }
  if (renderer.value) {
    renderer.value.dispose()
  }
  window.removeEventListener('resize', handleResize)
  if (container.value) {
    container.value.removeEventListener('click', handleClick)
  }
})
</script>

<style scoped>
.tunnel-viewer {
  width: 100%;
  height: 100%;
  position: relative;
}

.canvas-container {
  width: 100%;
  height: 100%;
}

.risk-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.viewer-controls {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
}
</style>
