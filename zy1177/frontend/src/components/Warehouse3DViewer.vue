<template>
  <div ref="containerRef" class="viewer-container">
    <div class="loading-overlay" v-if="isLoading">
      <el-icon class="loading-icon"><Loading /></el-icon>
      <p>正在加载场景...</p>
    </div>
    
    <div class="info-overlay">
      <el-tag v-if="mapName" type="info">地图: {{ mapName }}</el-tag>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Loading } from '@element-plus/icons-vue'

const props = defineProps({
  mapData: {
    type: Object,
    default: null
  },
  frames: {
    type: Array,
    default: () => []
  },
  currentFrame: {
    type: Number,
    default: 0
  },
  isPlaying: {
    type: Boolean,
    default: false
  }
})

const containerRef = ref(null)
const isLoading = ref(true)
const mapName = ref('')

let scene = null
let camera = null
let renderer = null
let controls = null
let animationId = null
let robots = new Map()
let waypoints = []
let clock = null

const initThree = () => {
  const container = containerRef.value
  if (!container) return
  
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a2e)
  scene.fog = new THREE.Fog(0x1a1a2e, 50, 200)
  
  const width = container.clientWidth
  const height = container.clientHeight
  
  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000)
  camera.position.set(30, 40, 30)
  camera.lookAt(0, 0, 0)
  
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  container.appendChild(renderer.domElement)
  
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.minDistance = 10
  controls.maxDistance = 150
  controls.maxPolarAngle = Math.PI / 2.1
  
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
  scene.add(ambientLight)
  
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
  scene.add(directionalLight)
  
  const gridHelper = new THREE.GridHelper(200, 100, 0x444444, 0x333333)
  scene.add(gridHelper)
  
  clock = new THREE.Clock()
  
  animate()
}

const animate = () => {
  animationId = requestAnimationFrame(animate)
  
  const delta = clock.getDelta()
  
  if (controls) {
    controls.update()
  }
  
  updateRobots(delta)
  
  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}

const updateRobots = (delta) => {
  robots.forEach((robot, id) => {
    if (robot.target) {
      const currentPos = robot.mesh.position
      const target = robot.target
      
      const dx = target.x - currentPos.x
      const dz = target.z - currentPos.z
      const distance = Math.sqrt(dx * dx + dz * dz)
      
      if (distance > 0.1) {
        const speed = robot.speed || 15
        const moveDistance = speed * delta
        const ratio = Math.min(moveDistance / distance, 1)
        
        currentPos.x += dx * ratio
        currentPos.z += dz * ratio
        
        const targetRotation = Math.atan2(dx, dz)
        robot.mesh.rotation.y = THREE.MathUtils.lerp(
          robot.mesh.rotation.y,
          targetRotation,
          0.2
        )
        
        if (robot.wheels) {
          robot.wheels.forEach(wheel => {
            wheel.rotation.x += delta * 5
          })
        }
      }
    }
  })
}

const createFloor = (width, height) => {
  const floorGeometry = new THREE.PlaneGeometry(width * 2, height * 2)
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2a3e,
    roughness: 0.8,
    metalness: 0.2
  })
  const floor = new THREE.Mesh(floorGeometry, floorMaterial)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)
}

const createShelf = (x, y, width = 2, height = 2, depth = 1) => {
  const shelfGroup = new THREE.Group()
  
  const bodyGeometry = new THREE.BoxGeometry(width, height, depth)
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x8B4513,
    roughness: 0.7,
    metalness: 0.1
  })
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
  body.position.y = height / 2
  body.castShadow = true
  body.receiveShadow = true
  shelfGroup.add(body)
  
  for (let i = 0; i < 3; i++) {
    const shelfGeometry = new THREE.BoxGeometry(width * 0.95, 0.1, depth * 0.95)
    const shelfMaterial = new THREE.MeshStandardMaterial({
      color: 0xA0522D,
      roughness: 0.6
    })
    const shelf = new THREE.Mesh(shelfGeometry, shelfMaterial)
    shelf.position.y = height * (i + 1) / 3
    shelf.castShadow = true
    shelfGroup.add(shelf)
  }
  
  shelfGroup.position.set(x, 0, y)
  scene.add(shelfGroup)
  
  return shelfGroup
}

const createStation = (x, y, type = 'pickup') => {
  const stationGroup = new THREE.Group()
  
  const baseGeometry = new THREE.CylinderGeometry(3, 3.5, 0.2, 8)
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: type === 'pickup' ? 0x4CAF50 : 0x2196F3,
    roughness: 0.5,
    metalness: 0.3,
    emissive: type === 'pickup' ? 0x2E7D32 : 0x1565C0,
    emissiveIntensity: 0.3
  })
  const base = new THREE.Mesh(baseGeometry, baseMaterial)
  base.position.y = 0.1
  base.castShadow = true
  base.receiveShadow = true
  stationGroup.add(base)
  
  const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 4, 8)
  const poleMaterial = new THREE.MeshStandardMaterial({
    color: 0x607D8B,
    metalness: 0.8
  })
  const pole = new THREE.Mesh(poleGeometry, poleMaterial)
  pole.position.y = 2.2
  pole.castShadow = true
  stationGroup.add(pole)
  
  const signGeometry = new THREE.BoxGeometry(2, 1, 0.1)
  const signMaterial = new THREE.MeshStandardMaterial({
    color: type === 'pickup' ? 0x4CAF50 : 0x2196F3,
    emissive: type === 'pickup' ? 0x2E7D32 : 0x1565C0,
    emissiveIntensity: 0.5
  })
  const sign = new THREE.Mesh(signGeometry, signMaterial)
  sign.position.y = 4.5
  sign.castShadow = true
  stationGroup.add(sign)
  
  stationGroup.position.set(x, 0, y)
  scene.add(stationGroup)
  
  return stationGroup
}

const createChargingStation = (x, y) => {
  const stationGroup = new THREE.Group()
  
  const baseGeometry = new THREE.BoxGeometry(4, 0.3, 4)
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x9C27B0,
    roughness: 0.4,
    metalness: 0.5,
    emissive: 0x6A1B9A,
    emissiveIntensity: 0.3
  })
  const base = new THREE.Mesh(baseGeometry, baseMaterial)
  base.position.y = 0.15
  base.receiveShadow = true
  stationGroup.add(base)
  
  const chargerGeometry = new THREE.BoxGeometry(0.3, 3, 1)
  const chargerMaterial = new THREE.MeshStandardMaterial({
    color: 0xE91E63,
    emissive: 0xAD1457,
    emissiveIntensity: 0.5
  })
  const charger = new THREE.Mesh(chargerGeometry, chargerMaterial)
  charger.position.set(0, 1.5, 1.5)
  charger.castShadow = true
  stationGroup.add(charger)
  
  stationGroup.position.set(x, 0, y)
  scene.add(stationGroup)
  
  return stationGroup
}

const createRobot = (id, x = 0, y = 0, color = 0x3498db) => {
  const robotGroup = new THREE.Group()
  
  const bodyGeometry = new THREE.BoxGeometry(1.5, 0.8, 1.5)
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.3,
    metalness: 0.6,
    emissive: color,
    emissiveIntensity: 0.1
  })
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
  body.position.y = 0.6
  body.castShadow = true
  body.receiveShadow = true
  robotGroup.add(body)
  
  const wheels = []
  const wheelPositions = [
    [0.75, 0.2, 0.75],
    [0.75, 0.2, -0.75],
    [-0.75, 0.2, 0.75],
    [-0.75, 0.2, -0.75]
  ]
  
  const wheelGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.15, 16)
  const wheelMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.9
  })
  
  wheelPositions.forEach(pos => {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial)
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(pos[0], pos[1], pos[2])
    wheel.castShadow = true
    robotGroup.add(wheel)
    wheels.push(wheel)
  })
  
  const lightGeometry = new THREE.SphereGeometry(0.1, 8, 8)
  const lightMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 2
  })
  const light = new THREE.Mesh(lightGeometry, lightMaterial)
  light.position.set(0, 1.1, 0)
  robotGroup.add(light)
  
  const pointLight = new THREE.PointLight(0xffffff, 0.5, 10)
  pointLight.position.set(0, 1.1, 0)
  robotGroup.add(pointLight)
  
  robotGroup.position.set(x, 0, y)
  robotGroup.userData = {
    id: id,
    speed: 15,
    target: null,
    wheels: wheels
  }
  
  scene.add(robotGroup)
  robots.set(id, {
    mesh: robotGroup,
    target: null,
    speed: 15,
    wheels: wheels
  })
  
  return robotGroup
}

const createAisle = (startX, startY, endX, endY, width = 2) => {
  const length = Math.sqrt(
    Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)
  )
  const angle = Math.atan2(endX - startX, endY - startY)
  
  const aisleGeometry = new THREE.PlaneGeometry(width, length)
  const aisleMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a3a4e,
    roughness: 0.9,
    transparent: true,
    opacity: 0.6
  })
  const aisle = new THREE.Mesh(aisleGeometry, aisleMaterial)
  
  aisle.position.set(
    (startX + endX) / 2,
    0.01,
    (startY + endY) / 2
  )
  aisle.rotation.x = -Math.PI / 2
  aisle.rotation.z = -angle
  aisle.receiveShadow = true
  
  scene.add(aisle)
  
  return aisle
}

const clearScene = () => {
  if (!scene) return
  
  while (scene.children.length > 0) {
    const object = scene.children[0]
    scene.remove(object)
    if (object.geometry) object.geometry.dispose()
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(m => m.dispose())
      } else {
        object.material.dispose()
      }
    }
  }
  
  robots.clear()
  waypoints = []
}

const loadMap = async (mapData) => {
  if (!mapData || !scene) return
  
  isLoading.value = true
  mapName.value = mapData.name || ''
  
  await nextTick()
  
  clearScene()
  
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
  scene.add(ambientLight)
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(50, 100, 50)
  directionalLight.castShadow = true
  scene.add(directionalLight)
  
  const gridHelper = new THREE.GridHelper(200, 100, 0x444444, 0x333333)
  scene.add(gridHelper)
  
  const width = mapData.width || 100
  const height = mapData.height || 100
  
  createFloor(width, height)
  
  const data = mapData.map_data || {}
  
  if (data.shelves && Array.isArray(data.shelves)) {
    data.shelves.forEach(shelf => {
      createShelf(
        shelf.x || 0,
        shelf.y || 0,
        shelf.width || 2,
        shelf.height || 2,
        shelf.depth || 1
      )
    })
  }
  
  if (data.stations && Array.isArray(data.stations)) {
    data.stations.forEach(station => {
      createStation(
        station.x || 0,
        station.y || 0,
        station.type || 'pickup'
      )
    })
  }
  
  if (data.charging_stations && Array.isArray(data.charging_stations)) {
    data.charging_stations.forEach(station => {
      createChargingStation(
        station.x || 0,
        station.y || 0
      )
    })
  }
  
  if (data.aisles && Array.isArray(data.aisles)) {
    data.aisles.forEach(aisle => {
      createAisle(
        aisle.start_x || 0,
        aisle.start_y || 0,
        aisle.end_x || 0,
        aisle.end_y || 0,
        aisle.width || 2
      )
    })
  }
  
  isLoading.value = false
}

const updateRobotPositions = (frameData) => {
  if (!frameData || !frameData.robots) return
  
  frameData.robots.forEach(robotData => {
    const id = robotData.robot_id
    const robot = robots.get(id)
    
    if (!robot) {
      const colors = [0x3498db, 0xe74c3c, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c]
      const colorIndex = robots.size % colors.length
      const newRobot = createRobot(
        id,
        robotData.x || 0,
        robotData.z || robotData.y || 0,
        colors[colorIndex]
      )
      robots.set(id, {
        mesh: newRobot,
        target: {
          x: robotData.x || 0,
          z: robotData.z || robotData.y || 0
        },
        speed: robotData.speed || 15,
        wheels: newRobot.userData.wheels
      })
    } else {
      robot.target = {
        x: robotData.x || 0,
        z: robotData.z || robotData.y || 0
      }
      robot.speed = (robotData.speed || 1) * 15
    }
  })
}

const setInitialFrame = (frame) => {
  if (!frame || !frame.robots) return
  
  frame.robots.forEach(robotData => {
    const colors = [0x3498db, 0xe74c3c, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c]
    const colorIndex = robots.size % colors.length
    
    if (!robots.has(robotData.robot_id)) {
      const robotMesh = createRobot(
        robotData.robot_id,
        robotData.x || 0,
        robotData.z || robotData.y || 0,
        colors[colorIndex]
      )
      
      robotMesh.rotation.y = robotData.orientation || 0
      
      robots.set(robotData.robot_id, {
        mesh: robotMesh,
        target: {
          x: robotData.x || 0,
          z: robotData.z || robotData.y || 0
        },
        speed: (robotData.speed || 1) * 15,
        wheels: robotMesh.userData.wheels
      })
    }
  })
}

watch(() => props.mapData, (newMap) => {
  if (newMap) {
    loadMap(newMap)
  }
}, { immediate: true })

watch(() => props.currentFrame, (frameIndex) => {
  if (props.frames && props.frames.length > frameIndex) {
    updateRobotPositions(props.frames[frameIndex])
  }
})

onMounted(() => {
  initThree()
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  
  if (renderer) {
    renderer.dispose()
    if (containerRef.value && renderer.domElement) {
      containerRef.value.removeChild(renderer.domElement)
    }
  }
  
  if (controls) {
    controls.dispose()
  }
  
  clearScene()
})

defineExpose({
  setInitialFrame
})
</script>

<style scoped>
.viewer-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(26, 26, 46, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.loading-icon {
  font-size: 48px;
  color: #409EFF;
  animation: spin 1s linear infinite;
}

.loading-overlay p {
  margin-top: 15px;
  color: #909399;
  font-size: 14px;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.info-overlay {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 10;
}
</style>
