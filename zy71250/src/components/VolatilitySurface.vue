<template>
  <div ref="containerRef" class="viewport" @mousemove="onMouseMove" @mouseleave="onMouseLeave">
    <div ref="canvasContainer" class="canvas-container"></div>
    
    <div v-if="tooltip.visible" class="tooltip" :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }">
      <h4>{{ tooltip.data?.contractCode || '网格点' }}</h4>
      <div class="row"><span class="label">行权价:</span><span class="value">{{ tooltip.data?.strike?.toFixed(2) }}</span></div>
      <div class="row"><span class="label">到期:</span><span class="value">{{ tooltip.data?.expiry }}天</span></div>
      <div class="row"><span class="label">IV:</span><span class="value">{{ (tooltip.data?.iv * 100).toFixed(2) }}%</span></div>
      <div class="row"><span class="label">类型:</span><span class="value">{{ tooltip.data?.isInterpolated ? '插值' : '实际' }}</span></div>
      <div v-if="tooltip.data?.volume !== undefined" class="row">
        <span class="label">成交量:</span><span class="value">{{ tooltip.data.volume }}</span>
      </div>
      <div v-if="tooltip.data?.status" class="row">
        <span class="label">状态:</span>
        <span :class="['tag', 'tag-' + tooltip.data.status]">{{ statusLabel(tooltip.data.status) }}</span>
      </div>
    </div>
    
    <div class="view-controls">
      <button class="btn btn-secondary" @click="resetCamera">重置视角</button>
      <button class="btn btn-secondary" @click="toggleWireframe">{{ showWireframe ? '实体' : '线框' }}</button>
      <button class="btn btn-secondary" @click="toggleAutoRotate">{{ autoRotate ? '停止旋转' : '自动旋转' }}</button>
    </div>
    
    <div class="axis-legend">
      <div class="axis-item"><span class="axis-dot x"></span>X: 到期日</div>
      <div class="axis-item"><span class="axis-dot y"></span>Y: 行权价</div>
      <div class="axis-item"><span class="axis-dot z"></span>Z: 波动率</div>
    </div>
    
    <div class="color-bar">
      <div class="color-bar-title">波动率</div>
      <div class="color-bar-gradient"></div>
      <div class="color-bar-labels">
        <span>{{ (ivRange.min * 100).toFixed(0) }}%</span>
        <span>{{ ((ivRange.min + ivRange.max) / 2 * 100).toFixed(0) }}%</span>
        <span>{{ (ivRange.max * 100).toFixed(0) }}%</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useOptionStore } from '../stores/optionStore.js'
import { OptionStatus } from '../types/option.js'

const store = useOptionStore()

const containerRef = ref(null)
const canvasContainer = ref(null)
const tooltip = ref({ visible: false, x: 0, y: 0, data: null })
const showWireframe = ref(false)
const autoRotate = ref(false)

const ivRange = computed(() => {
  if (!store.surfaceData) return { min: 0.1, max: 0.6 }
  let min = Infinity, max = -Infinity
  for (const row of store.surfaceData.grid) {
    for (const cell of row) {
      min = Math.min(min, cell.iv)
      max = Math.max(max, cell.iv)
    }
  }
  return { min: Math.max(0, min - 0.05), max: max + 0.05 }
})

let scene, camera, renderer, controls
let surfaceMesh, wireframeMesh, slicePlane
let anomalyMarkers = []
let rawPointSprites = []
let animationId
let raycaster, mouse

function statusLabel(status) {
  const map = { pending: '待处理', normal: '正常', warning: '警告', anomaly: '异常', revoked: '已撤回' }
  return map[status] || status
}

function initThree() {
  const container = canvasContainer.value
  const width = container.clientWidth
  const height = container.clientHeight
  
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0a0e17)
  scene.fog = new THREE.Fog(0x0a0e17, 10, 30)
  
  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000)
  camera.position.set(3, 2.5, 3)
  
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  container.appendChild(renderer.domElement)
  
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.minDistance = 2
  controls.maxDistance = 15
  controls.maxPolarAngle = Math.PI / 2.1
  
  raycaster = new THREE.Raycaster()
  mouse = new THREE.Vector2()
  
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)
  
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
  dirLight.position.set(5, 10, 7)
  dirLight.castShadow = true
  dirLight.shadow.mapSize.width = 2048
  dirLight.shadow.mapSize.height = 2048
  scene.add(dirLight)
  
  const pointLight = new THREE.PointLight(0x3b82f6, 0.5)
  pointLight.position.set(-3, 5, -3)
  scene.add(pointLight)
  
  createAxes()
  createGridFloor()
  
  animate()
}

function createAxes() {
  const axisGroup = new THREE.Group()
  
  const xGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(2.2, 0, 0)
  ])
  const xMat = new THREE.LineBasicMaterial({ color: 0xef4444 })
  const xAxis = new THREE.Line(xGeo, xMat)
  axisGroup.add(xAxis)
  
  const yGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 2.2, 0)
  ])
  const yMat = new THREE.LineBasicMaterial({ color: 0x10b981 })
  const yAxis = new THREE.Line(yGeo, yMat)
  axisGroup.add(yAxis)
  
  const zGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 2.2)
  ])
  const zMat = new THREE.LineBasicMaterial({ color: 0x3b82f6 })
  const zAxis = new THREE.Line(zGeo, zMat)
  axisGroup.add(zAxis)
  
  axisGroup.position.set(-1.2, 0, -1.2)
  scene.add(axisGroup)
}

function createGridFloor() {
  const gridHelper = new THREE.GridHelper(2.5, 10, 0x374151, 0x1f2937)
  gridHelper.position.y = -0.01
  scene.add(gridHelper)
}

function getColor(iv, min, max) {
  const t = Math.max(0, Math.min(1, (iv - min) / (max - min)))
  
  const colors = [
    new THREE.Color(0x1e3a5f),
    new THREE.Color(0x3b82f6),
    new THREE.Color(0x10b981),
    new THREE.Color(0xf59e0b),
    new THREE.Color(0xef4444),
    new THREE.Color(0x7c2d12)
  ]
  
  const idx = t * (colors.length - 1)
  const i = Math.floor(idx)
  const f = idx - i
  
  if (i >= colors.length - 1) return colors[colors.length - 1]
  
  return colors[i].clone().lerp(colors[i + 1], f)
}

function buildSurface() {
  if (!store.surfaceData) return
  
  clearSurface()
  
  const { grid, anomalies, rawPoints } = store.surfaceData
  const size = grid.length
  const range = ivRange.value
  
  const geometry = new THREE.PlaneGeometry(2, 2, size - 1, size - 1)
  geometry.rotateX(-Math.PI / 2)
  
  const positions = geometry.attributes.position
  const colors = new Float32Array(positions.count * 3)
  
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const idx = i * size + j
      const cell = grid[i][j]
      const normalizedIv = (cell.iv - range.min) / (range.max - range.min)
      const height = Math.max(0.02, normalizedIv * 1.5)
      
      positions.setY(idx, height)
      
      const color = getColor(cell.iv, range.min, range.max)
      colors[idx * 3] = color.r
      colors[idx * 3 + 1] = color.g
      colors[idx * 3 + 2] = color.b
    }
  }
  
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  
  const material = new THREE.MeshPhongMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    shininess: 50,
    transparent: true,
    opacity: 0.9,
    wireframe: showWireframe.value
  })
  
  surfaceMesh = new THREE.Mesh(geometry, material)
  surfaceMesh.receiveShadow = true
  surfaceMesh.castShadow = true
  surfaceMesh.userData.type = 'surface'
  surfaceMesh.userData.grid = grid
  surfaceMesh.userData.size = size
  scene.add(surfaceMesh)
  
  const wireGeo = new THREE.WireframeGeometry(geometry)
  const wireMat = new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.2 })
  wireframeMesh = new THREE.LineSegments(wireGeo, wireMat)
  wireframeMesh.visible = showWireframe.value
  scene.add(wireframeMesh)
  
  for (const anomaly of anomalies) {
    const height = Math.max(0.02, ((anomaly.iv - range.min) / (range.max - range.min)) * 1.5)
    const markerGeo = new THREE.SphereGeometry(0.04, 16, 16)
    const markerMat = new THREE.MeshBasicMaterial({ 
      color: anomaly.record.status === OptionStatus.ANOMALY ? 0xef4444 : 0xf59e0b 
    })
    const marker = new THREE.Mesh(markerGeo, markerMat)
    marker.position.set(anomaly.x * 2 - 1, height + 0.05, anomaly.y * 2 - 1)
    marker.userData.type = 'anomaly'
    marker.userData.data = {
      contractCode: anomaly.record.contractCode,
      strike: anomaly.strike,
      expiry: anomaly.expiry,
      iv: anomaly.iv,
      isInterpolated: false,
      volume: anomaly.record.volume,
      status: anomaly.record.status
    }
    scene.add(marker)
    anomalyMarkers.push(marker)
  }
  
  if (rawPoints) {
    for (const point of rawPoints) {
      if (point.raw.status === OptionStatus.REVOKED) continue
      const height = Math.max(0.02, ((point.value - range.min) / (range.max - range.min)) * 1.5)
      const spriteGeo = new THREE.SphereGeometry(0.025, 8, 8)
      const spriteMat = new THREE.MeshBasicMaterial({ 
        color: point.raw.isInterpolated ? 0x8b5cf6 : 0xffffff,
        transparent: true,
        opacity: 0.8
      })
      const sprite = new THREE.Mesh(spriteGeo, spriteMat)
      sprite.position.set(point.x * 2 - 1, height, point.y * 2 - 1)
      sprite.userData.type = 'rawpoint'
      sprite.userData.data = {
        contractCode: point.raw.contractCode,
        strike: point.raw.strikePrice,
        expiry: point.raw.expiryDays,
        iv: point.value,
        isInterpolated: point.raw.isInterpolated,
        volume: point.raw.volume,
        status: point.raw.status
      }
      scene.add(sprite)
      rawPointSprites.push(sprite)
    }
  }
  
  if (store.sliceView.enabled) {
    updateSlicePlane()
  }
}

function clearSurface() {
  if (surfaceMesh) {
    scene.remove(surfaceMesh)
    surfaceMesh.geometry.dispose()
    surfaceMesh.material.dispose()
    surfaceMesh = null
  }
  if (wireframeMesh) {
    scene.remove(wireframeMesh)
    wireframeMesh.geometry.dispose()
    wireframeMesh.material.dispose()
    wireframeMesh = null
  }
  for (const marker of anomalyMarkers) {
    scene.remove(marker)
    marker.geometry.dispose()
    marker.material.dispose()
  }
  anomalyMarkers = []
  for (const sprite of rawPointSprites) {
    scene.remove(sprite)
    sprite.geometry.dispose()
    sprite.material.dispose()
  }
  rawPointSprites = []
  if (slicePlane) {
    scene.remove(slicePlane)
    slicePlane.geometry.dispose()
    slicePlane.material.dispose()
    slicePlane = null
  }
}

function updateSlicePlane() {
  if (!store.sliceView.enabled || !store.surfaceData) return
  
  if (slicePlane) {
    scene.remove(slicePlane)
    slicePlane.geometry.dispose()
    slicePlane.material.dispose()
  }
  
  const { type, value } = store.sliceView
  const { grid, minExpiry, maxExpiry, minStrike, maxStrike } = store.surfaceData
  const range = ivRange.value
  
  let sliceData = []
  
  if (type === 'expiry') {
    const normX = (value - minExpiry) / (maxExpiry - minExpiry)
    const rowIdx = Math.round(normX * (grid.length - 1))
    const row = grid[Math.max(0, Math.min(grid.length - 1, rowIdx))]
    sliceData = row.map((cell, j) => ({
      x: j / (row.length - 1) * 2 - 1,
      y: Math.max(0.02, ((cell.iv - range.min) / (range.max - range.min)) * 1.5),
      z: normX * 2 - 1,
      cell
    }))
  } else {
    const normY = (value - minStrike) / (maxStrike - minStrike)
    const colIdx = Math.round(normY * (grid[0].length - 1))
    const clampedIdx = Math.max(0, Math.min(grid[0].length - 1, colIdx))
    sliceData = grid.map((row, i) => ({
      x: i / (grid.length - 1) * 2 - 1,
      y: Math.max(0.02, ((row[clampedIdx].iv - range.min) / (range.max - range.min)) * 1.5),
      z: normY * 2 - 1,
      cell: row[clampedIdx]
    }))
  }
  
  const sliceGeo = new THREE.BufferGeometry()
  const positions = []
  
  for (let i = 0; i < sliceData.length - 1; i++) {
    const p1 = sliceData[i]
    const p2 = sliceData[i + 1]
    
    if (type === 'expiry') {
      positions.push(p1.x, 0, p1.z, p2.x, 0, p2.z, p2.x, p2.y, p2.z)
      positions.push(p1.x, 0, p1.z, p2.x, p2.y, p2.z, p1.x, p1.y, p1.z)
    } else {
      positions.push(p1.x, 0, p1.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z)
      positions.push(p1.x, 0, p1.z, p2.x, p2.y, p2.z, p2.x, 0, p2.z)
    }
  }
  
  sliceGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  sliceGeo.computeVertexNormals()
  
  const sliceMat = new THREE.MeshBasicMaterial({
    color: 0x3b82f6,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide
  })
  
  slicePlane = new THREE.Mesh(sliceGeo, sliceMat)
  scene.add(slicePlane)
}

function onMouseMove(event) {
  const rect = containerRef.value.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  
  tooltip.value.x = event.clientX - rect.left + 15
  tooltip.value.y = event.clientY - rect.top + 15
  
  raycaster.setFromCamera(mouse, camera)
  
  const intersects = raycaster.intersectObjects([
    surfaceMesh,
    ...anomalyMarkers,
    ...rawPointSprites
  ].filter(Boolean))
  
  if (intersects.length > 0) {
    const hit = intersects[0]
    
    if (hit.object.userData.type === 'surface' && hit.face) {
      const size = hit.object.userData.size
      const grid = hit.object.userData.grid
      
      const uv = hit.uv
      const i = Math.round(uv.y * (size - 1))
      const j = Math.round(uv.x * (size - 1))
      
      const cell = grid[Math.max(0, Math.min(size - 1, i))]?.[Math.max(0, Math.min(size - 1, j))]
      
      if (cell) {
        tooltip.value.visible = true
        tooltip.value.data = {
          contractCode: cell.source?.contractCode || null,
          strike: cell.strike,
          expiry: cell.expiry,
          iv: cell.iv,
          isInterpolated: cell.isInterpolated,
          volume: cell.source?.volume,
          status: cell.source?.status
        }
        return
      }
    }
    
    if (hit.object.userData.data) {
      tooltip.value.visible = true
      tooltip.value.data = hit.object.userData.data
      return
    }
  }
  
  tooltip.value.visible = false
}

function onMouseLeave() {
  tooltip.value.visible = false
}

function resetCamera() {
  camera.position.set(3, 2.5, 3)
  controls.target.set(0, 0.3, 0)
  controls.update()
}

function toggleWireframe() {
  showWireframe.value = !showWireframe.value
  if (surfaceMesh) {
    surfaceMesh.material.wireframe = showWireframe.value
  }
  if (wireframeMesh) {
    wireframeMesh.visible = showWireframe.value
  }
}

function toggleAutoRotate() {
  autoRotate.value = !autoRotate.value
  controls.autoRotate = autoRotate.value
}

function animate() {
  animationId = requestAnimationFrame(animate)
  controls.update()
  
  const time = Date.now() * 0.001
  for (let i = 0; i < anomalyMarkers.length; i++) {
    const marker = anomalyMarkers[i]
    marker.scale.setScalar(1 + Math.sin(time * 3 + i) * 0.15)
  }
  
  renderer.render(scene, camera)
}

function onResize() {
  if (!containerRef.value) return
  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight
  
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

watch(() => store.surfaceData, () => {
  buildSurface()
}, { deep: true })

watch(() => store.sliceView, () => {
  if (store.sliceView.enabled) {
    updateSlicePlane()
  } else if (slicePlane) {
    scene.remove(slicePlane)
    slicePlane.geometry.dispose()
    slicePlane.material.dispose()
    slicePlane = null
  }
}, { deep: true })

watch(ivRange, () => {
  buildSurface()
})

onMounted(() => {
  initThree()
  window.addEventListener('resize', onResize)
  setTimeout(() => {
    buildSurface()
    resetCamera()
  }, 100)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  cancelAnimationFrame(animationId)
  clearSurface()
  if (renderer) {
    renderer.dispose()
    renderer.domElement.remove()
  }
})

defineExpose({
  getRenderer: () => renderer,
  getScene: () => scene,
  takeScreenshot: () => {
    renderer.render(scene, camera)
    return renderer.domElement.toDataURL('image/png')
  }
})
</script>

<style scoped>
.canvas-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.view-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 6px;
  z-index: 10;
}

.view-controls .btn {
  padding: 4px 10px;
  font-size: 12px;
}

.axis-legend {
  position: absolute;
  bottom: 12px;
  left: 12px;
  background: rgba(17, 24, 39, 0.8);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 11px;
  z-index: 10;
}

.axis-item {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.axis-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.axis-dot.x { background: #ef4444; }
.axis-dot.y { background: #10b981; }
.axis-dot.z { background: #3b82f6; }

.color-bar {
  position: absolute;
  bottom: 12px;
  right: 12px;
  background: rgba(17, 24, 39, 0.8);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 8px 12px;
  z-index: 10;
}

.color-bar-title {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.color-bar-gradient {
  width: 120px;
  height: 12px;
  border-radius: 3px;
  background: linear-gradient(to right, #1e3a5f, #3b82f6, #10b981, #f59e0b, #ef4444, #7c2d12);
}

.color-bar-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-secondary);
  margin-top: 2px;
}
</style>
