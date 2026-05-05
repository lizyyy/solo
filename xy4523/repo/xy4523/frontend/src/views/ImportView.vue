<template>
  <div class="import-view">
    <div class="page-header mb-4">
      <h1 class="page-title">📥 数据导入</h1>
      <p class="page-subtitle text-muted">
        导入每日数据：温湿度传感器CSV、授粉计划JSON、隔离棚计划、苗床批次和员工班次
      </p>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-header">
          🌡️ 温湿度传感器数据 (CSV)
        </div>
        <div class="card-body">
          <p class="mb-3 text-muted">
            支持CSV格式，包含字段：苗床编号、日期、时间、温度、湿度
          </p>
          
          <div 
            class="upload-area"
            :class="{ dragover: sensorDragover }"
            @dragover.prevent="sensorDragover = true"
            @dragleave="sensorDragover = false"
            @drop.prevent="handleSensorDrop"
            @click="$refs.sensorInput.click()"
          >
            <div class="upload-area-icon">📁</div>
            <div class="upload-area-text">
              点击或拖拽CSV文件到此处上传
            </div>
            <input 
              ref="sensorInput" 
              type="file" 
              accept=".csv" 
              class="upload-input"
              @change="handleSensorFile"
            />
          </div>
          
          <div v-if="sensorResult" class="mt-3">
            <div class="alert" :class="sensorResult.errors?.length > 0 ? 'alert-warning' : 'alert-success'">
              导入完成：成功 {{ sensorResult.imported }} / {{ sensorResult.total }} 条
              <div v-if="sensorResult.errors?.length > 0" class="mt-2">
                <small>错误：{{ sensorResult.errors.join('; ') }}</small>
              </div>
            </div>
          </div>
          
          <details class="mt-3">
            <summary class="cursor-pointer text-muted">查看CSV格式示例</summary>
            <pre class="mt-2 p-3 bg-light rounded text-sm overflow-x-auto">
seedbed_code,date,time,temperature,humidity
A1,2026-05-05,08:00,24.5,65.2
A1,2026-05-05,12:00,28.3,58.1
A2,2026-05-05,08:00,25.1,62.8</pre>
          </details>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          🌸 授粉计划 (JSON)
        </div>
        <div class="card-body">
          <p class="mb-3 text-muted">
            支持JSON格式，指定各批次植物的授粉计划
          </p>
          
          <div 
            class="upload-area"
            :class="{ dragover: pollinationDragover }"
            @dragover.prevent="pollinationDragover = true"
            @dragleave="pollinationDragover = false"
            @drop.prevent="handlePollinationDrop"
            @click="$refs.pollinationInput.click()"
          >
            <div class="upload-area-icon">📄</div>
            <div class="upload-area-text">
              点击或拖拽JSON文件到此处上传
            </div>
            <input 
              ref="pollinationInput" 
              type="file" 
              accept=".json" 
              class="upload-input"
              @change="handlePollinationFile"
            />
          </div>
          
          <div v-if="pollinationResult" class="mt-3">
            <div class="alert" :class="pollinationResult.errors?.length > 0 ? 'alert-warning' : 'alert-success'">
              导入完成：成功 {{ pollinationResult.imported }} / {{ pollinationResult.total }} 条
            </div>
          </div>
          
          <details class="mt-3">
            <summary class="cursor-pointer text-muted">查看JSON格式示例</summary>
            <pre class="mt-2 p-3 bg-light rounded text-sm overflow-x-auto">
[
  {
    "batch_number": "B001",
    "plant_name": "番茄",
    "plan_date": "2026-05-05",
    "target_plant": "番茄A株",
    "pollen_source": "番茄B株",
    "method": "人工点花",
    "operator": "张三",
    "priority": "high",
    "notes": "优先处理"
  }
]</pre>
          </details>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          🚪 隔离棚开放窗口 (JSON)
        </div>
        <div class="card-body">
          <p class="mb-3 text-muted">
            指定各苗床的隔离棚开放时间段
          </p>
          
          <div 
            class="upload-area"
            :class="{ dragover: isolationDragover }"
            @dragover.prevent="isolationDragover = true"
            @dragleave="isolationDragover = false"
            @drop.prevent="handleIsolationDrop"
            @click="$refs.isolationInput.click()"
          >
            <div class="upload-area-icon">🚪</div>
            <div class="upload-area-text">
              点击或拖拽JSON文件到此处上传
            </div>
            <input 
              ref="isolationInput" 
              type="file" 
              accept=".json" 
              class="upload-input"
              @change="handleIsolationFile"
            />
          </div>
          
          <div v-if="isolationResult" class="mt-3">
            <div class="alert" :class="isolationResult.errors?.length > 0 ? 'alert-warning' : 'alert-success'">
              导入完成：成功 {{ isolationResult.imported }} / {{ isolationResult.total }} 条
            </div>
          </div>
          
          <details class="mt-3">
            <summary class="cursor-pointer text-muted">查看JSON格式示例</summary>
            <pre class="mt-2 p-3 bg-light rounded text-sm overflow-x-auto">
[
  {
    "seedbed_code": "A1",
    "start_date": "2026-05-01",
    "end_date": "2026-05-10",
    "is_open": false,
    "reason": "番茄授粉隔离期"
  },
  {
    "seedbed_code": "A2",
    "start_date": "2026-05-05",
    "end_date": "2026-05-06",
    "is_open": true,
    "reason": "通风换气"
  }
]</pre>
          </details>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          🌱 苗床批次 (JSON)
        </div>
        <div class="card-body">
          <p class="mb-3 text-muted">
            导入苗床中的植物批次信息
          </p>
          
          <div 
            class="upload-area"
            :class="{ dragover: batchDragover }"
            @dragover.prevent="batchDragover = true"
            @dragleave="batchDragover = false"
            @drop.prevent="handleBatchDrop"
            @click="$refs.batchInput.click()"
          >
            <div class="upload-area-icon">🌱</div>
            <div class="upload-area-text">
              点击或拖拽JSON文件到此处上传
            </div>
            <input 
              ref="batchInput" 
              type="file" 
              accept=".json" 
              class="upload-input"
              @change="handleBatchFile"
            />
          </div>
          
          <div v-if="batchResult" class="mt-3">
            <div class="alert" :class="batchResult.errors?.length > 0 ? 'alert-warning' : 'alert-success'">
              导入完成：成功 {{ batchResult.imported }} / {{ batchResult.total }} 条
            </div>
          </div>
          
          <details class="mt-3">
            <summary class="cursor-pointer text-muted">查看JSON格式示例</summary>
            <pre class="mt-2 p-3 bg-light rounded text-sm overflow-x-auto">
[
  {
    "seedbed_code": "A1",
    "plant_name": "番茄",
    "variety": "樱桃番茄",
    "batch_number": "B001",
    "quantity": 50,
    "planting_date": "2026-03-15",
    "expected_flowering_start": "2026-05-01",
    "expected_flowering_end": "2026-05-15",
    "pollination_type": "人工授粉",
    "is_isolated": true,
    "notes": "试验批次"
  }
]</pre>
          </details>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          👥 员工班次 (JSON)
        </div>
        <div class="card-body">
          <p class="mb-3 text-muted">
            导入每日员工排班信息
          </p>
          
          <div 
            class="upload-area"
            :class="{ dragover: shiftDragover }"
            @dragover.prevent="shiftDragover = true"
            @dragleave="shiftDragover = false"
            @drop.prevent="handleShiftDrop"
            @click="$refs.shiftInput.click()"
          >
            <div class="upload-area-icon">👥</div>
            <div class="upload-area-text">
              点击或拖拽JSON文件到此处上传
            </div>
            <input 
              ref="shiftInput" 
              type="file" 
              accept=".json" 
              class="upload-input"
              @change="handleShiftFile"
            />
          </div>
          
          <div v-if="shiftResult" class="mt-3">
            <div class="alert" :class="shiftResult.errors?.length > 0 ? 'alert-warning' : 'alert-success'">
              导入完成：成功 {{ shiftResult.imported }} / {{ shiftResult.total }} 条
            </div>
          </div>
          
          <details class="mt-3">
            <summary class="cursor-pointer text-muted">查看JSON格式示例</summary>
            <pre class="mt-2 p-3 bg-light rounded text-sm overflow-x-auto">
[
  {
    "shift_date": "2026-05-05",
    "employee_name": "张三",
    "shift_type": "早班",
    "start_time": "08:00",
    "end_time": "16:00",
    "assigned_areas": "A1,A2,A3温室"
  },
  {
    "shift_date": "2026-05-05",
    "employee_name": "李四",
    "shift_type": "晚班",
    "start_time": "16:00",
    "end_time": "24:00",
    "assigned_areas": "B1,B2温室"
  }
]</pre>
          </details>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          🏠 基础数据设置
        </div>
        <div class="card-body">
          <p class="mb-3 text-muted">
            首次使用时配置温室和苗床基础数据
          </p>
          
          <div class="form-group">
            <label class="form-label">温室名称</label>
            <input 
              v-model="newGreenhouseName"
              type="text" 
              class="form-input" 
              placeholder="如：A温室、番茄温室"
            />
          </div>
          
          <button class="btn btn-primary btn-sm w-full mb-4" @click="addGreenhouse">
            ➕ 添加温室
          </button>
          
          <div v-if="store.greenhouses.length > 0" class="mb-4">
            <label class="form-label">选择温室添加苗床</label>
            <select v-model="selectedGreenhouseId" class="form-select">
              <option :value="null">请选择温室</option>
              <option v-for="gh in store.greenhouses" :key="gh.id" :value="gh.id">
                {{ gh.name }}
              </option>
            </select>
            
            <div v-if="selectedGreenhouseId" class="mt-3">
              <div class="form-row">
                <div class="form-group flex-1">
                  <label class="form-label">苗床编号</label>
                  <input 
                    v-model="newSeedbedCode"
                    type="text" 
                    class="form-input" 
                    placeholder="如：A1、01"
                  />
                </div>
                <div class="form-group flex-1">
                  <label class="form-label">苗床名称</label>
                  <input 
                    v-model="newSeedbedName"
                    type="text" 
                    class="form-input" 
                    placeholder="如：东一区"
                  />
                </div>
              </div>
              <button class="btn btn-secondary btn-sm w-full" @click="addSeedbed">
                ➕ 添加苗床
              </button>
            </div>
          </div>
          
          <div v-if="store.greenhouses.length > 0" class="mt-4">
            <label class="form-label text-bold">当前配置</label>
            <div 
              v-for="gh in store.greenhouses" 
              :key="gh.id"
              class="p-3 mb-2 bg-light rounded"
            >
              <div class="text-bold mb-2">🏠 {{ gh.name }}</div>
              <div class="flex flex-wrap gap-2">
                <span 
                  v-for="sb in getSeedbedsForGreenhouse(gh.id)" 
                  :key="sb.id"
                  class="badge badge-info"
                >
                  苗床 {{ sb.code }}{{ sb.name ? ` (${sb.name})` : '' }}
                </span>
                <span v-if="getSeedbedsForGreenhouse(gh.id).length === 0" class="text-muted">
                  暂无苗床
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAppStore } from '@/stores/appStore'
import { importApi } from '@/utils/api'

const store = useAppStore()

const sensorDragover = ref(false)
const pollinationDragover = ref(false)
const isolationDragover = ref(false)
const batchDragover = ref(false)
const shiftDragover = ref(false)

const sensorResult = ref(null)
const pollinationResult = ref(null)
const isolationResult = ref(null)
const batchResult = ref(null)
const shiftResult = ref(null)

const newGreenhouseName = ref('')
const selectedGreenhouseId = ref(null)
const newSeedbedCode = ref('')
const newSeedbedName = ref('')

const handleSensorFile = async (e) => {
  const file = e.target.files[0]
  if (!file) return
  
  try {
    const response = await importApi.sensor(file)
    sensorResult.value = response.data
    store.addNotification('温湿度数据导入成功', 'success')
  } catch (e) {
    store.addNotification('导入失败: ' + e.message, 'error')
  }
  e.target.value = ''
}

const handleSensorDrop = (e) => {
  sensorDragover.value = false
  const file = e.dataTransfer.files[0]
  if (file && file.name.endsWith('.csv')) {
    const input = document.createElement('input')
    input.type = 'file'
    const dt = new DataTransfer()
    dt.items.add(file)
    input.files = dt.files
    handleSensorFile({ target: input })
  }
}

const handlePollinationFile = async (e) => {
  const file = e.target.files[0]
  if (!file) return
  
  try {
    const response = await importApi.pollinationPlans(file)
    pollinationResult.value = response.data
    store.addNotification('授粉计划导入成功', 'success')
  } catch (e) {
    store.addNotification('导入失败: ' + e.message, 'error')
  }
  e.target.value = ''
}

const handlePollinationDrop = (e) => {
  pollinationDragover.value = false
  const file = e.dataTransfer.files[0]
  if (file && file.name.endsWith('.json')) {
    const input = document.createElement('input')
    input.type = 'file'
    const dt = new DataTransfer()
    dt.items.add(file)
    input.files = dt.files
    handlePollinationFile({ target: input })
  }
}

const handleIsolationFile = async (e) => {
  const file = e.target.files[0]
  if (!file) return
  
  try {
    const response = await importApi.isolation(file)
    isolationResult.value = response.data
    store.addNotification('隔离计划导入成功', 'success')
  } catch (e) {
    store.addNotification('导入失败: ' + e.message, 'error')
  }
  e.target.value = ''
}

const handleIsolationDrop = (e) => {
  isolationDragover.value = false
  const file = e.dataTransfer.files[0]
  if (file && file.name.endsWith('.json')) {
    const input = document.createElement('input')
    input.type = 'file'
    const dt = new DataTransfer()
    dt.items.add(file)
    input.files = dt.files
    handleIsolationFile({ target: input })
  }
}

const handleBatchFile = async (e) => {
  const file = e.target.files[0]
  if (!file) return
  
  try {
    const response = await importApi.plantBatches(file)
    batchResult.value = response.data
    store.addNotification('苗床批次导入成功', 'success')
  } catch (e) {
    store.addNotification('导入失败: ' + e.message, 'error')
  }
  e.target.value = ''
}

const handleBatchDrop = (e) => {
  batchDragover.value = false
  const file = e.dataTransfer.files[0]
  if (file && file.name.endsWith('.json')) {
    const input = document.createElement('input')
    input.type = 'file'
    const dt = new DataTransfer()
    dt.items.add(file)
    input.files = dt.files
    handleBatchFile({ target: input })
  }
}

const handleShiftFile = async (e) => {
  const file = e.target.files[0]
  if (!file) return
  
  try {
    const response = await importApi.employeeShifts(file)
    shiftResult.value = response.data
    store.addNotification('员工班次导入成功', 'success')
  } catch (e) {
    store.addNotification('导入失败: ' + e.message, 'error')
  }
  e.target.value = ''
}

const handleShiftDrop = (e) => {
  shiftDragover.value = false
  const file = e.dataTransfer.files[0]
  if (file && file.name.endsWith('.json')) {
    const input = document.createElement('input')
    input.type = 'file'
    const dt = new DataTransfer()
    dt.items.add(file)
    input.files = dt.files
    handleShiftFile({ target: input })
  }
}

const addGreenhouse = async () => {
  if (!newGreenhouseName.value.trim()) {
    store.addNotification('请输入温室名称', 'error')
    return
  }
  
  try {
    await store.createGreenhouse({ name: newGreenhouseName.value.trim() })
    newGreenhouseName.value = ''
  } catch (e) {
    console.error(e)
  }
}

const addSeedbed = async () => {
  if (!selectedGreenhouseId.value || !newSeedbedCode.value.trim()) {
    store.addNotification('请选择温室并输入苗床编号', 'error')
    return
  }
  
  try {
    await store.createSeedbed({
      greenhouse_id: selectedGreenhouseId.value,
      code: newSeedbedCode.value.trim(),
      name: newSeedbedName.value.trim() || null
    })
    newSeedbedCode.value = ''
    newSeedbedName.value = ''
  } catch (e) {
    console.error(e)
  }
}

const getSeedbedsForGreenhouse = (greenhouseId) => {
  return store.seedbeds.filter(s => s.greenhouse_id === greenhouseId)
}
</script>

<style scoped>
.page-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
}

.page-subtitle {
  font-size: 14px;
}

.flex-1 {
  flex: 1;
}

.bg-light {
  background-color: #f8f9fa;
}

.text-sm {
  font-size: 12px;
}

.rounded {
  border-radius: var(--radius);
}

.upload-area.dragover {
  border-color: var(--primary-color);
  background-color: rgba(45, 90, 39, 0.05);
}

.overflow-x-auto {
  overflow-x: auto;
}
</style>
