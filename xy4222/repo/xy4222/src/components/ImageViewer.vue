<template>
  <div class="image-viewer">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="tool-group">
        <button 
          class="tool-btn" 
          :class="{ active: currentTool === 'select' }"
          @click="currentTool = 'select'"
          title="选择工具"
        >
          🔍 选择
        </button>
        <button 
          class="tool-btn" 
          :class="{ active: currentTool === 'rect' }"
          @click="currentTool = 'rect'"
          title="矩形批注"
        >
          ⬜ 矩形批注
        </button>
      </div>
      <div class="tool-group">
        <button class="tool-btn" @click="zoomIn" title="放大">
          🔍+
        </button>
        <span class="zoom-info">{{ Math.round(zoom * 100) }}%</span>
        <button class="tool-btn" @click="zoomOut" title="缩小">
          🔍-
        </button>
        <button class="tool-btn" @click="resetZoom" title="重置">
          重置
        </button>
      </div>
    </div>

    <!-- 图片显示区域 -->
    <div 
      class="image-container" 
      ref="imageContainer"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
    >
      <!-- 图片占位（实际项目中会显示真实图片） -->
      <div 
        class="image-placeholder"
        :style="{ 
          transform: `scale(${zoom})`,
          transformOrigin: 'top left'
        }"
      >
        <div class="placeholder-content">
          <div class="placeholder-title">{{ image?.fileName }}</div>
          <div class="placeholder-meta">
            <span v-if="image?.part">部位: {{ image.part }}</span>
            <span v-if="image?.stage">阶段: {{ getStageLabel(image.stage) }}</span>
          </div>
          <div class="placeholder-info">
            (此处显示实际图片，支持缩放和批注)
          </div>
        </div>

        <!-- 批注框 -->
        <div 
          v-for="annotation in annotations" 
          :key="annotation.id"
          class="annotation-box"
          :class="{ 
            'selected': selectedAnnotation?.id === annotation.id,
            [`type-${annotation.type}`]: true
          }"
          :style="{
            left: `${annotation.position.x}px`,
            top: `${annotation.position.y}px`,
            width: `${annotation.position.width}px`,
            height: `${annotation.position.height}px`,
            borderColor: getAnnotationColor(annotation.type)
          }"
          @mousedown.stop="selectAnnotation(annotation)"
        >
          <div class="annotation-number">
            {{ getAnnotationNumber(annotation.id) }}
          </div>
          <div class="resize-handle" @mousedown.stop></div>
        </div>

        <!-- 正在绘制的矩形 -->
        <div 
          v-if="isDrawing && currentTool === 'rect'"
          class="drawing-box"
          :style="{
            left: `${Math.min(drawingStart.x, drawingEnd.x)}px`,
            top: `${Math.min(drawingStart.y, drawingEnd.y)}px`,
            width: `${Math.abs(drawingEnd.x - drawingStart.x)}px`,
            height: `${Math.abs(drawingEnd.y - drawingStart.y)}px`
          }"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { AnnotationTypeColors } from '../models/AnnotationType'
import { ShootingStageLabels } from '../models/ShootingStage'

const props = defineProps({
  image: {
    type: Object,
    default: null
  },
  annotations: {
    type: Array,
    default: () => []
  },
  selectedAnnotation: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['annotation-selected', 'annotation-created'])

const imageContainer = ref(null)
const currentTool = ref('select') // 'select' or 'rect'
const zoom = ref(1)
const isDrawing = ref(false)
const drawingStart = ref({ x: 0, y: 0 })
const drawingEnd = ref({ x: 0, y: 0 })

// 获取批注颜色
function getAnnotationColor(type) {
  return AnnotationTypeColors[type] || '#778ca3'
}

// 获取阶段标签
function getStageLabel(stage) {
  return ShootingStageLabels[stage] || stage
}

// 获取批注序号
function getAnnotationNumber(annotationId) {
  const index = props.annotations.findIndex(a => a.id === annotationId)
  return index >= 0 ? index + 1 : '?'
}

// 选择批注
function selectAnnotation(annotation) {
  if (currentTool.value === 'select') {
    emit('annotation-selected', annotation)
  }
}

// 鼠标事件处理
function handleMouseDown(e) {
  if (currentTool.value === 'rect') {
    const rect = getImageRect()
    isDrawing.value = true
    drawingStart.value = {
      x: (e.clientX - rect.left) / zoom.value,
      y: (e.clientY - rect.top) / zoom.value
    }
    drawingEnd.value = { ...drawingStart.value }
  }
}

function handleMouseMove(e) {
  if (!isDrawing.value) return
  
  const rect = getImageRect()
  drawingEnd.value = {
    x: (e.clientX - rect.left) / zoom.value,
    y: (e.clientY - rect.top) / zoom.value
  }
}

function handleMouseUp() {
  if (!isDrawing.value) return
  
  isDrawing.value = false
  
  // 检查最小尺寸
  const width = Math.abs(drawingEnd.value.x - drawingStart.value.x)
  const height = Math.abs(drawingEnd.value.y - drawingStart.value.y)
  
  if (width >= 10 && height >= 10) {
    const position = {
      x: Math.min(drawingStart.value.x, drawingEnd.value.x),
      y: Math.min(drawingStart.value.y, drawingEnd.value.y),
      width,
      height
    }
    
    emit('annotation-created', { position })
  }
}

// 获取图片区域
function getImageRect() {
  if (!imageContainer.value) return { left: 0, top: 0 }
  return imageContainer.value.getBoundingClientRect()
}

// 缩放控制
function zoomIn() {
  zoom.value = Math.min(zoom.value * 1.2, 3)
}

function zoomOut() {
  zoom.value = Math.max(zoom.value / 1.2, 0.2)
}

function resetZoom() {
  zoom.value = 1
}
</script>

<style scoped>
.image-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fafafa;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: white;
  border-bottom: 1px solid #e8e8e8;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-btn {
  padding: 6px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.tool-btn:hover {
  border-color: #1890ff;
  color: #1890ff;
}

.tool-btn.active {
  background: #1890ff;
  border-color: #1890ff;
  color: white;
}

.zoom-info {
  font-size: 0.85rem;
  color: #666;
  min-width: 50px;
  text-align: center;
}

.image-container {
  flex: 1;
  overflow: auto;
  padding: 20px;
  position: relative;
}

.image-placeholder {
  width: 800px;
  height: 600px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  position: relative;
  overflow: hidden;
}

.placeholder-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  text-align: center;
  padding: 40px;
}

.placeholder-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 16px;
}

.placeholder-meta {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  font-size: 1rem;
  opacity: 0.9;
}

.placeholder-info {
  font-size: 0.9rem;
  opacity: 0.7;
}

/* 批注框样式 */
.annotation-box {
  position: absolute;
  border: 2px solid;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: all 0.2s;
}

.annotation-box:hover {
  background: rgba(255, 255, 255, 0.2);
}

.annotation-box.selected {
  box-shadow: 0 0 0 2px #1890ff, 0 0 10px rgba(24, 144, 255, 0.5);
}

.annotation-number {
  position: absolute;
  top: -12px;
  left: -12px;
  width: 24px;
  height: 24px;
  background: #1890ff;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
}

.resize-handle {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 8px;
  height: 8px;
  background: #1890ff;
  border-radius: 2px;
  cursor: se-resize;
}

/* 绘制中的框 */
.drawing-box {
  position: absolute;
  border: 2px dashed #1890ff;
  background: rgba(24, 144, 255, 0.1);
  pointer-events: none;
}

/* 批注类型颜色 */
.type-crack {
  border-color: #ff6b6b !important;
}

.type-color_restoration {
  border-color: #4ecdc4 !important;
}

.type-damage {
  border-color: #ff8c42 !important;
}

.type-stain {
  border-color: #a55eea !important;
}

.type-hole {
  border-color: #eb3b5a !important;
}

.type-other {
  border-color: #778ca3 !important;
}
</style>
