<template>
  <div class="app-container">
    <header class="app-header">
      <h1>WebGPU 图片滤镜管线体检台</h1>
      <div class="header-actions">
        <div class="status-badge">
          <span class="status-dot" :class="gpuAvailable ? 'available' : 'unavailable'"></span>
          <span>WebGPU: {{ gpuAvailable ? '可用' : '不可用' }}</span>
        </div>
        <div class="status-badge">
          <span class="status-dot available"></span>
          <span>CPU: 可用</span>
        </div>
      </div>
    </header>

    <div class="main-content">
      <aside class="sidebar">
        <div class="sidebar-section">
          <div class="section-title">源图片</div>
          
          <div v-if="!sourceImage" class="drop-zone" 
            :class="{ 'drag-over': isDragOver }"
            @dragover.prevent="handleDragOver"
            @dragleave="handleDragLeave"
            @drop.prevent="handleDrop"
            @click="triggerFileInput">
            <div class="icon">📁</div>
            <div class="label">拖放图片到此处</div>
            <div class="hint">或点击选择文件</div>
            <input type="file" ref="fileInput" accept="image/*" @change="handleFileSelect" style="display: none;">
          </div>

          <div v-else class="image-info">
            <div class="image-thumbnail">
              <img :src="sourceImage.url" :alt="sourceImage.name">
            </div>
            <div class="image-details">
              <h4>{{ sourceImage.name }}</h4>
              <p>{{ sourceImage.width }} × {{ sourceImage.height }} px</p>
              <button class="btn btn-secondary btn-sm" @click="clearImage">更换图片</button>
            </div>
          </div>
        </div>

        <div class="sidebar-section">
          <div class="filter-list-container">
            <div class="filter-list-header">
              <div class="section-title" style="margin: 0;">滤镜管线</div>
              <div class="add-filter-menu">
                <button class="btn btn-primary btn-sm" @click="toggleFilterMenu">
                  + 添加滤镜
                </button>
                <div v-if="showFilterMenu" class="add-filter-dropdown" @click="handleDropdownClick">
                  <div class="filter-category">变换</div>
                  <div v-for="filter in transformFilters" :key="filter.type" 
                    class="filter-option" 
                    @click="addFilter(filter.type)">
                    <span class="filter-option-name">{{ filter.name }}</span>
                    <span class="filter-option-support">
                      {{ filter.supportsGPU ? 'GPU' : '' }}
                      {{ filter.supportsGPU && filter.supportsCPU ? '/' : '' }}
                      {{ filter.supportsCPU ? 'CPU' : '' }}
                    </span>
                  </div>
                  
                  <div class="filter-category">颜色</div>
                  <div v-for="filter in colorFilters" :key="filter.type" 
                    class="filter-option" 
                    @click="addFilter(filter.type)">
                    <span class="filter-option-name">{{ filter.name }}</span>
                    <span class="filter-option-support">
                      {{ filter.supportsGPU ? 'GPU' : '' }}
                      {{ filter.supportsGPU && filter.supportsCPU ? '/' : '' }}
                      {{ filter.supportsCPU ? 'CPU' : '' }}
                    </span>
                  </div>
                  
                  <div class="filter-category">滤镜</div>
                  <div v-for="filter in filterFilters" :key="filter.type" 
                    class="filter-option" 
                    @click="addFilter(filter.type)">
                    <span class="filter-option-name">{{ filter.name }}</span>
                    <span class="filter-option-support">
                      {{ filter.supportsGPU ? 'GPU' : '' }}
                      {{ filter.supportsGPU && filter.supportsCPU ? '/' : '' }}
                      {{ filter.supportsCPU ? 'CPU' : '' }}
                    </span>
                  </div>
                  
                  <div class="filter-category">合成</div>
                  <div v-for="filter in compositeFilters" :key="filter.type" 
                    class="filter-option" 
                    @click="addFilter(filter.type)">
                    <span class="filter-option-name">{{ filter.name }}</span>
                    <span class="filter-option-support">
                      {{ filter.supportsGPU ? 'GPU' : '' }}
                      {{ filter.supportsGPU && filter.supportsCPU ? '/' : '' }}
                      {{ filter.supportsCPU ? 'CPU' : '' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="filter-list" v-if="filterNodes.length > 0">
              <div v-for="(node, index) in filterNodes" 
                :key="node.id" 
                class="filter-node"
                :class="{ 
                  disabled: !node.enabled, 
                  selected: selectedNodeId === node.id,
                  'dragging': draggedNodeId === node.id,
                  'drag-over': dragOverNodeId === node.id
                }"
                :draggable="true"
                @dragstart="handleDragStart(node.id, $event)"
                @dragend="handleDragEnd"
                @dragover.prevent="handleNodeDragOver(node.id)"
                @dragleave="handleNodeDragLeave"
                @drop.prevent="handleNodeDrop(node.id)">
                
                <div class="filter-node-header" @click="toggleNode(node.id)">
                  <div class="filter-node-drag">⋮⋮</div>
                  <div class="filter-node-status" :class="node.status"></div>
                  <span class="filter-node-name">{{ index + 1 }}. {{ getFilterName(node.type) }}</span>
                  <div class="filter-node-actions" @click.stop>
                    <button class="btn btn-secondary btn-icon" @click="toggleNodeEnabled(node.id)">
                      {{ node.enabled ? '👁️' : '👁️‍🗨️' }}
                    </button>
                    <button class="btn btn-secondary btn-icon" @click="removeFilter(node.id)">
                      🗑️
                    </button>
                  </div>
                </div>

                <div v-if="selectedNodeId === node.id" class="filter-node-content">
                  <div v-for="paramDef in getFilterParameters(node.type)" :key="paramDef.name" class="parameter-group">
                    <div class="parameter-label">
                      <span>{{ paramDef.label }}</span>
                      <span v-if="paramDef.type === 'number'" class="parameter-value">
                        {{ node.parameters[paramDef.name] }}
                      </span>
                    </div>

                    <template v-if="paramDef.type === 'number'">
                      <input 
                        v-if="paramDef.min !== undefined && paramDef.max !== undefined"
                        type="range" 
                        :min="paramDef.min" 
                        :max="paramDef.max" 
                        :step="paramDef.step || 1"
                        :value="node.parameters[paramDef.name]"
                        @input="handleRangeInput(node.id, paramDef.name, $event)"
                      >
                      <input 
                        v-else
                        type="number" 
                        :step="paramDef.step || 1"
                        :value="node.parameters[paramDef.name]"
                        @input="handleNumberInput(node.id, paramDef.name, $event)"
                      >
                    </template>

                    <template v-else-if="paramDef.type === 'select'">
                      <select 
                        :value="node.parameters[paramDef.name]"
                        @change="handleSelectInput(node.id, paramDef.name, $event)">
                        <option v-for="opt in paramDef.options" :key="opt.value" :value="opt.value">
                          {{ opt.label }}
                        </option>
                      </select>
                    </template>

                    <template v-else-if="paramDef.type === 'boolean'">
                      <div class="boolean-toggle" @click="updateNodeParameter(node.id, paramDef.name, !node.parameters[paramDef.name])">
                        <div class="toggle-switch" :class="{ active: node.parameters[paramDef.name] }">
                          <div class="toggle-knob"></div>
                        </div>
                        <span>{{ node.parameters[paramDef.name] ? '已启用' : '已禁用' }}</span>
                      </div>
                    </template>

                    <template v-else-if="paramDef.type === 'string'">
                      <input 
                        type="text" 
                        :value="node.parameters[paramDef.name]"
                        @input="handleTextInput(node.id, paramDef.name, $event)"
                      >
                    </template>

                    <template v-else-if="paramDef.type === 'color'">
                      <input 
                        type="color" 
                        :value="node.parameters[paramDef.name]"
                        @input="handleTextInput(node.id, paramDef.name, $event)"
                      >
                    </template>
                  </div>

                  <div v-if="node.gpuTime !== undefined || node.cpuTime !== undefined" style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-color);">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">执行耗时</div>
                    <div v-if="node.gpuTime !== undefined" style="margin-bottom: 4px;">
                      GPU: {{ formatTime(node.gpuTime) }}
                    </div>
                    <div v-if="node.cpuTime !== undefined">
                      CPU: {{ formatTime(node.cpuTime) }}
                    </div>
                    <div v-if="node.gpuTime !== undefined && node.cpuTime !== undefined && node.gpuTime > 0">
                      <span :class="['speedup-badge', node.cpuTime / node.gpuTime > 1 ? 'positive' : 'negative']">
                        加速比: {{ (node.cpuTime / node.gpuTime).toFixed(2) }}x
                      </span>
                    </div>
                  </div>

                  <div v-if="node.error" class="error-box" style="margin-top: 12px;">
                    <div class="error-title">错误</div>
                    <div style="font-size: 12px; font-family: monospace;">{{ node.error }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="empty-state" style="padding: 40px 16px;">
              <div class="icon">🔧</div>
              <h3>暂无滤镜节点</h3>
              <p>点击上方"添加滤镜"按钮开始构建你的滤镜管线</p>
            </div>
          </div>
        </div>
      </aside>

      <main class="content-area">
        <div class="preview-container">
          <div class="preview-toolbar">
            <div class="preview-tabs">
              <div class="preview-tab" :class="{ active: activePreviewTab === 'both' }" @click="activePreviewTab = 'both'">
                双路对比
              </div>
              <div class="preview-tab" :class="{ active: activePreviewTab === 'gpu' }" @click="activePreviewTab = 'gpu'">
                仅 GPU
              </div>
              <div class="preview-tab" :class="{ active: activePreviewTab === 'cpu' }" @click="activePreviewTab = 'cpu'">
                仅 CPU
              </div>
            </div>
          </div>

          <div class="preview-content">
            <div class="preview-panel" v-if="activePreviewTab === 'both' || activePreviewTab === 'gpu'">
              <div class="preview-panel-header">
                <span class="preview-panel-title">
                  <span :class="['status-dot', gpuAvailable ? 'available' : 'unavailable']"></span>
                  GPU 路径
                </span>
                <span v-if="lastResult?.totalGpuTime !== undefined" class="preview-panel-timing">
                  总耗时: {{ formatTime(lastResult.totalGpuTime) }}
                </span>
              </div>
              <div class="preview-panel-body">
                <img v-if="gpuPreviewUrl" :src="gpuPreviewUrl" class="preview-image" alt="GPU Output">
                <div v-else-if="!sourceImage" class="preview-placeholder">
                  <div class="icon">📷</div>
                  <div>请先上传图片</div>
                </div>
                <div v-else class="preview-placeholder">
                  <div class="icon">▶️</div>
                  <div>点击执行查看结果</div>
                </div>
              </div>
            </div>

            <div class="preview-panel" v-if="activePreviewTab === 'both' || activePreviewTab === 'cpu'">
              <div class="preview-panel-header">
                <span class="preview-panel-title">
                  <span class="status-dot available"></span>
                  CPU 路径
                </span>
                <span v-if="lastResult?.totalCpuTime !== undefined" class="preview-panel-timing">
                  总耗时: {{ formatTime(lastResult.totalCpuTime) }}
                </span>
              </div>
              <div class="preview-panel-body">
                <img v-if="cpuPreviewUrl" :src="cpuPreviewUrl" class="preview-image" alt="CPU Output">
                <div v-else-if="!sourceImage" class="preview-placeholder">
                  <div class="icon">📷</div>
                  <div>请先上传图片</div>
                </div>
                <div v-else class="preview-placeholder">
                  <div class="icon">▶️</div>
                  <div>点击执行查看结果</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="results-panel" v-if="lastResult">
          <div class="results-grid" v-if="lastResult.pixelDiff">
            <div class="result-card">
              <div class="result-card-label">差异像素占比</div>
              <div class="result-card-value" 
                :class="lastResult.pixelDiff.differingPercent < 0.1 ? 'good' : 
                       lastResult.pixelDiff.differingPercent < 1 ? 'warning' : 'bad'">
                {{ lastResult.pixelDiff.differingPercent.toFixed(4) }}%
              </div>
            </div>
            <div class="result-card">
              <div class="result-card-label">PSNR (峰值信噪比)</div>
              <div class="result-card-value"
                :class="lastResult.pixelDiff.psnr >= 40 ? 'good' : 
                       lastResult.pixelDiff.psnr >= 30 ? 'warning' : 'bad'">
                {{ lastResult.pixelDiff.psnr === 100 ? '∞' : lastResult.pixelDiff.psnr.toFixed(2) }} dB
              </div>
            </div>
            <div class="result-card" v-if="lastResult.totalGpuTime && lastResult.totalCpuTime">
              <div class="result-card-label">GPU 加速比</div>
              <div class="result-card-value"
                :class="lastResult.totalCpuTime / lastResult.totalGpuTime > 1 ? 'good' : 'bad'">
                {{ (lastResult.totalCpuTime / lastResult.totalGpuTime).toFixed(2) }}x
              </div>
            </div>
            <div class="result-card">
              <div class="result-card-label">执行状态</div>
              <div class="result-card-value" :class="lastResult.success ? 'good' : 'bad'">
                {{ lastResult.success ? '成功' : '失败' }}
              </div>
            </div>
          </div>

          <table class="node-results" v-if="lastResult.nodeResults.length > 0">
            <thead>
              <tr>
                <th>#</th>
                <th>节点</th>
                <th>状态</th>
                <th>GPU 耗时</th>
                <th>CPU 耗时</th>
                <th>加速比</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(result, index) in lastResult.nodeResults" :key="result.nodeId">
                <td>{{ index + 1 }}</td>
                <td>{{ getNodeName(result.nodeId) }}</td>
                <td>
                  <span class="status-indicator">
                    <span class="dot" 
                      :style="{ background: result.success ? '#10b981' : '#ef4444' }"></span>
                    {{ result.success ? '成功' : '失败' }}
                  </span>
                </td>
                <td>{{ formatTime(result.gpuTime) }}</td>
                <td>{{ formatTime(result.cpuTime) }}</td>
                <td>
                  <span v-if="result.gpuTime && result.cpuTime && result.gpuTime > 0"
                    :class="['speedup-badge', result.cpuTime / result.gpuTime > 1 ? 'positive' : 'negative']">
                    {{ (result.cpuTime / result.gpuTime).toFixed(2) }}x
                  </span>
                  <span v-else>-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="action-bar">
          <div class="action-bar-left">
            <button class="btn btn-secondary" @click="importProject">
              📂 导入项目
            </button>
            <button class="btn btn-secondary" @click="exportProject" :disabled="!sourceImage">
              💾 导出项目
            </button>
          </div>
          <div class="action-bar-right">
            <button class="btn btn-secondary" @click="exportMarkdownReport" :disabled="!lastResult">
              📄 Markdown 报告
            </button>
            <button class="btn btn-secondary" @click="exportHTMLReport" :disabled="!lastResult">
              🌐 HTML 报告
            </button>
            <button class="btn btn-primary execute-btn" 
              @click="executePipeline" 
              :disabled="!sourceImage || isExecuting">
              {{ isExecuting ? '⏳ 执行中...' : '▶️ 执行管线' }}
            </button>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { 
  ImageSource, 
  FilterNodeState, 
  FilterType,
  FilterParameterDefinition,
  PipelineExecutionResult
} from '@/types'
import { filterDefinitions, getFilterDefinition } from '@/filters/definitions'
import { WebGPURenderer } from '@/renderers/webgpu'
import { CPURenderer } from '@/renderers/cpu'
import { PipelineManager } from '@/core/pipelineManager'
import { 
  createProject, 
  downloadProject, 
  loadProjectFromFile 
} from '@/core/projectIO'
import { 
  generateMarkdownReport, 
  generateHTMLReport,
  downloadReport
} from '@/core/reportGenerator'

const gpuAvailable = ref(false)
const isExecuting = ref(false)
const isDragOver = ref(false)
const showFilterMenu = ref(false)
const selectedNodeId = ref<string | null>(null)
const draggedNodeId = ref<string | null>(null)
const dragOverNodeId = ref<string | null>(null)
const activePreviewTab = ref<'both' | 'gpu' | 'cpu'>('both')

const sourceImage = ref<ImageSource | null>(null)
const filterNodes = ref<FilterNodeState[]>([])
const lastResult = ref<PipelineExecutionResult | null>(null)
const gpuPreviewUrl = ref<string>('')
const cpuPreviewUrl = ref<string>('')

const fileInput = ref<HTMLInputElement | null>(null)
const hiddenCanvas = document.createElement('canvas')
const hiddenCtx = hiddenCanvas.getContext('2d')!

let pipelineManager: PipelineManager | null = null

const transformFilters = computed(() => 
  filterDefinitions.filter(f => f.category === 'transform')
)
const colorFilters = computed(() => 
  filterDefinitions.filter(f => f.category === 'color')
)
const filterFilters = computed(() => 
  filterDefinitions.filter(f => f.category === 'filter')
)
const compositeFilters = computed(() => 
  filterDefinitions.filter(f => f.category === 'composite')
)

function getFilterName(type: string): string {
  const def = getFilterDefinition(type)
  return def?.name || type
}

function getFilterParameters(type: string): FilterParameterDefinition[] {
  const def = getFilterDefinition(type)
  return def?.parameters || []
}

function getNodeName(nodeId: string): string {
  const node = filterNodes.value.find(n => n.id === nodeId)
  return node ? getFilterName(node.type) : '未知'
}

function formatTime(ms: number | undefined): string {
  if (ms === undefined) return 'N/A'
  if (ms < 1) return `${(ms * 1000).toFixed(2)} μs`
  if (ms < 1000) return `${ms.toFixed(2)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function imageDataToDataUrl(imageData: ImageData): string {
  hiddenCanvas.width = imageData.width
  hiddenCanvas.height = imageData.height
  hiddenCtx.putImageData(imageData, 0, 0)
  return hiddenCanvas.toDataURL('image/png')
}

function handleDragOver() {
  isDragOver.value = true
}

function handleDragLeave() {
  isDragOver.value = false
}

function handleDropdownClick(event: Event) {
  event.stopPropagation()
}

function handleRangeInput(nodeId: string, paramName: string, event: Event) {
  const target = event.target as HTMLInputElement
  updateNodeParameter(nodeId, paramName, parseFloat(target.value))
}

function handleNumberInput(nodeId: string, paramName: string, event: Event) {
  const target = event.target as HTMLInputElement
  updateNodeParameter(nodeId, paramName, parseInt(target.value, 10))
}

function handleSelectInput(nodeId: string, paramName: string, event: Event) {
  const target = event.target as HTMLSelectElement
  updateNodeParameter(nodeId, paramName, target.value)
}

function handleTextInput(nodeId: string, paramName: string, event: Event) {
  const target = event.target as HTMLInputElement
  updateNodeParameter(nodeId, paramName, target.value)
}

function triggerFileInput() {
  fileInput.value?.click()
}

async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    await loadImageFromFile(file)
  }
}

async function handleDrop(event: DragEvent) {
  isDragOver.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file && file.type.startsWith('image/')) {
    await loadImageFromFile(file)
  }
}

async function loadImageFromFile(file: File): Promise<void> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const url = e.target?.result as string
      const img = new Image()
      img.onload = () => {
        const imageSource: ImageSource = {
          id: `img-${Date.now()}`,
          name: file.name,
          width: img.width,
          height: img.height,
          url,
          file
        }
        
        hiddenCanvas.width = img.width
        hiddenCanvas.height = img.height
        hiddenCtx.drawImage(img, 0, 0)
        imageSource.imageData = hiddenCtx.getImageData(0, 0, img.width, img.height)
        
        sourceImage.value = imageSource
        clearResults()
        resolve()
      }
      img.src = url
    }
    reader.readAsDataURL(file)
  })
}

function clearImage() {
  sourceImage.value = null
  clearResults()
}

function toggleFilterMenu() {
  showFilterMenu.value = !showFilterMenu.value
}

function addFilter(type: FilterType) {
  if (pipelineManager) {
    const node = pipelineManager.addNode(type)
    filterNodes.value = pipelineManager.getNodes()
    selectedNodeId.value = node.id
  } else {
    const id = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const def = getFilterDefinition(type)
    const params: Record<string, any> = {}
    def?.parameters.forEach(p => {
      params[p.name] = p.default
    })
    
    const node: FilterNodeState = {
      id,
      type,
      name: def?.name || type,
      parameters: params,
      enabled: true,
      order: filterNodes.value.length,
      status: 'idle'
    }
    filterNodes.value.push(node)
    selectedNodeId.value = node.id
  }
  showFilterMenu.value = false
}

function removeFilter(id: string) {
  if (pipelineManager) {
    pipelineManager.removeNode(id)
    filterNodes.value = pipelineManager.getNodes()
  } else {
    const index = filterNodes.value.findIndex(n => n.id === id)
    if (index !== -1) {
      filterNodes.value.splice(index, 1)
      filterNodes.value.forEach((n, i) => { n.order = i })
    }
  }
  if (selectedNodeId.value === id) {
    selectedNodeId.value = null
  }
}

function toggleNode(id: string) {
  selectedNodeId.value = selectedNodeId.value === id ? null : id
}

function toggleNodeEnabled(id: string) {
  const node = filterNodes.value.find(n => n.id === id)
  if (node) {
    node.enabled = !node.enabled
    if (pipelineManager) {
      pipelineManager.updateNodeEnabled(id, node.enabled)
    }
  }
}

function updateNodeParameter(id: string, paramName: string, value: any) {
  const node = filterNodes.value.find(n => n.id === id)
  if (node) {
    node.parameters[paramName] = value
    if (pipelineManager) {
      pipelineManager.updateNodeParameters(id, node.parameters)
    }
  }
}

function handleDragStart(id: string, event: DragEvent) {
  draggedNodeId.value = id
  event.dataTransfer!.effectAllowed = 'move'
}

function handleDragEnd() {
  draggedNodeId.value = null
  dragOverNodeId.value = null
}

function handleNodeDragOver(id: string) {
  if (draggedNodeId.value && draggedNodeId.value !== id) {
    dragOverNodeId.value = id
  }
}

function handleNodeDragLeave() {
  dragOverNodeId.value = null
}

function handleNodeDrop(targetId: string) {
  if (!draggedNodeId.value || draggedNodeId.value === targetId) return
  
  const draggedIndex = filterNodes.value.findIndex(n => n.id === draggedNodeId.value)
  const targetIndex = filterNodes.value.findIndex(n => n.id === targetId)
  
  if (draggedIndex !== -1 && targetIndex !== -1) {
    const [node] = filterNodes.value.splice(draggedIndex, 1)
    filterNodes.value.splice(targetIndex, 0, node)
    filterNodes.value.forEach((n, i) => { n.order = i })
    
    if (pipelineManager) {
      pipelineManager.setNodes(filterNodes.value)
    }
  }
  
  draggedNodeId.value = null
  dragOverNodeId.value = null
}

function clearResults() {
  lastResult.value = null
  gpuPreviewUrl.value = ''
  cpuPreviewUrl.value = ''
  filterNodes.value.forEach(n => {
    n.status = 'idle'
    n.error = undefined
    n.gpuTime = undefined
    n.cpuTime = undefined
  })
}

async function executePipeline() {
  if (!sourceImage.value || !sourceImage.value.imageData) return
  
  isExecuting.value = true
  clearResults()

  try {
    if (!pipelineManager) {
      pipelineManager = new PipelineManager(new WebGPURenderer(), new CPURenderer())
      const { gpu } = await pipelineManager.initialize()
      gpuAvailable.value = gpu
    }
    
    pipelineManager.setNodes(filterNodes.value)
    filterNodes.value = pipelineManager.getNodes()
    
    const result = await pipelineManager.execute(sourceImage.value.imageData)
    filterNodes.value = pipelineManager.getNodes()
    
    lastResult.value = result
    
    if (result.gpuResult) {
      gpuPreviewUrl.value = imageDataToDataUrl(result.gpuResult.imageData)
    }
    if (result.cpuResult) {
      cpuPreviewUrl.value = imageDataToDataUrl(result.cpuResult.imageData)
    }
  } catch (error) {
    console.error('Pipeline execution failed:', error)
  } finally {
    isExecuting.value = false
  }
}

function exportProject() {
  if (!sourceImage.value) return
  
  const project = createProject(
    `Pipeline_${new Date().toISOString().slice(0, 10)}`,
    '',
    sourceImage.value,
    filterNodes.value
  )
  downloadProject(project)
}

async function importProject() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (file) {
      const project = await loadProjectFromFile(file)
      if (project) {
        filterNodes.value = project.filterNodes.map((n, i) => ({
          ...n,
          order: i,
          status: 'idle' as const
        }))
        clearResults()
      }
    }
  }
  input.click()
}

function exportMarkdownReport() {
  if (!lastResult.value || !sourceImage.value) return
  
  const result = lastResult.value
  const reportData = {
    projectName: `滤镜管线检查报告`,
    timestamp: new Date().toISOString(),
    webgpuAvailable: gpuAvailable.value,
    imageInfo: {
      name: sourceImage.value.name,
      width: sourceImage.value.width,
      height: sourceImage.value.height
    },
    pipelineResult: result,
    nodeDetails: filterNodes.value.map((node, i) => ({
      node,
      result: result.nodeResults[i]
    })).filter((_, i) => i < result.nodeResults.length)
  }
  
  const markdown = generateMarkdownReport(reportData)
  downloadReport(markdown, `filter-report-${Date.now()}.md`, 'markdown')
}

function exportHTMLReport() {
  if (!lastResult.value || !sourceImage.value) return
  
  const result = lastResult.value
  const reportData = {
    projectName: `滤镜管线检查报告`,
    timestamp: new Date().toISOString(),
    webgpuAvailable: gpuAvailable.value,
    imageInfo: {
      name: sourceImage.value.name,
      width: sourceImage.value.width,
      height: sourceImage.value.height
    },
    pipelineResult: result,
    nodeDetails: filterNodes.value.map((node, i) => ({
      node,
      result: result.nodeResults[i]
    })).filter((_, i) => i < result.nodeResults.length)
  }
  
  const html = generateHTMLReport(reportData)
  downloadReport(html, `filter-report-${Date.now()}.html`, 'html')
}

function handleClickOutside(event: MouseEvent) {
  if (showFilterMenu.value && !(event.target as HTMLElement).closest('.add-filter-menu')) {
    showFilterMenu.value = false
  }
}

onMounted(async () => {
  document.addEventListener('click', handleClickOutside)
  
  try {
    const gpuRenderer = new WebGPURenderer()
    const cpuRenderer = new CPURenderer()
    pipelineManager = new PipelineManager(gpuRenderer, cpuRenderer)
    
    const { gpu } = await pipelineManager.initialize()
    gpuAvailable.value = gpu
  } catch (error) {
    console.error('Failed to initialize pipeline manager:', error)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  pipelineManager?.destroy()
})
</script>
