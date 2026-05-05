<template>
  <div class="panel-container">
    <div class="section">
      <h3>📁 数据导入</h3>
      
      <el-divider content-position="left">仓库地图 (JSON)</el-divider>
      <el-upload
        :action="uploadMapUrl"
        :on-success="handleMapUploadSuccess"
        :on-error="handleUploadError"
        :show-file-list="false"
        :headers="uploadHeaders"
        accept=".json"
      >
        <el-button type="primary">
          <el-icon><Upload /></el-icon>
          上传 warehouse-map.json
        </el-button>
      </el-upload>
      
      <el-divider content-position="left">机器人配置 (YAML)</el-divider>
      <el-upload
        :action="uploadRobotsUrl"
        :on-success="handleRobotsUploadSuccess"
        :on-error="handleUploadError"
        :show-file-list="false"
        :headers="uploadHeaders"
        :data="uploadRobotsData"
        accept=".yaml,.yml"
      >
        <el-button type="success">
          <el-icon><Upload /></el-icon>
          上传 robots.yaml
        </el-button>
      </el-upload>
      
      <el-divider content-position="left">订单数据 (CSV/JSON)</el-divider>
      <el-upload
        :action="uploadOrdersUrl"
        :on-success="handleOrdersUploadSuccess"
        :on-error="handleUploadError"
        :show-file-list="false"
        :headers="uploadHeaders"
        :data="uploadOrdersData"
        accept=".csv,.json"
      >
        <el-button type="warning">
          <el-icon><Upload /></el-icon>
          上传 orders.csv
        </el-button>
      </el-upload>
    </div>
    
    <el-divider />
    
    <div class="section">
      <h3>📋 已加载数据</h3>
      
      <el-descriptions :column="1" border size="small">
        <el-descriptions-item label="地图状态">
          <el-tag :type="mapStatus.type">{{ mapStatus.text }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="机器人状态">
          <el-tag :type="robotsStatus.type">{{ robotsStatus.text }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="订单状态">
          <el-tag :type="ordersStatus.type">{{ ordersStatus.text }}</el-tag>
        </el-descriptions-item>
      </el-descriptions>
    </div>
    
    <el-divider />
    
    <div class="section">
      <h3>🔄 快速加载示例数据</h3>
      <el-button type="info" @click="loadSampleData" style="width: 100%;">
        加载示例数据 (Seed)
      </el-button>
    </div>
    
    <el-divider />
    
    <div class="section">
      <h3>⚠️ 异常测试场景</h3>
      <el-radio-group v-model="selectedAnomaly" size="small" style="width: 100%;">
        <el-radio-button value="collision">碰撞风险</el-radio-button>
        <el-radio-button value="charging">充电场景</el-radio-button>
        <el-radio-button value="narrow">窄通道</el-radio-button>
        <el-radio-button value="fault">故障场景</el-radio-button>
      </el-radio-group>
      <el-button 
        type="danger" 
        @click="loadAnomalyData"
        style="width: 100%; margin-top: 10px;"
      >
        加载异常场景
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { Upload } from '@element-plus/icons-vue'
import api from '../services/api'

const emit = defineEmits(['map-loaded'])

const selectedAnomaly = ref('collision')

const uploadHeaders = reactive({})
const uploadMapUrl = '/api/v1/import/map'
const uploadRobotsUrl = '/api/v1/import/robots'
const uploadOrdersUrl = '/api/v1/import/orders'

const mapId = ref(null)
const uploadRobotsData = computed(() => ({
  warehouse_map_id: mapId.value || ''
}))

const uploadOrdersData = computed(() => ({
  warehouse_map_id: mapId.value || ''
}))

const loadedMaps = ref([])
const loadedRobotsCount = ref(0)
const loadedOrdersCount = ref(0)

const mapStatus = computed(() => {
  if (mapId.value) {
    return { type: 'success', text: '已加载' }
  }
  return { type: 'info', text: '未加载' }
})

const robotsStatus = computed(() => {
  if (loadedRobotsCount.value > 0) {
    return { type: 'success', text: `${loadedRobotsCount.value} 台机器人` }
  }
  return { type: 'info', text: '未加载' }
})

const ordersStatus = computed(() => {
  if (loadedOrdersCount.value > 0) {
    return { type: 'success', text: `${loadedOrdersCount.value} 个订单` }
  }
  return { type: 'info', text: '未加载' }
})

const handleMapUploadSuccess = async (response) => {
  if (response.success) {
    mapId.value = response.map_id
    ElMessage.success(`地图已加载: ${response.map_name}`)
    
    try {
      const result = await api.getMap(response.map_id)
      emit('map-loaded', result)
    } catch (e) {
      console.error('Failed to get map data:', e)
    }
  } else {
    ElMessage.error('上传失败')
  }
}

const handleRobotsUploadSuccess = (response) => {
  if (response.success) {
    loadedRobotsCount.value = response.imported_count
    ElMessage.success(`已加载 ${response.imported_count} 台机器人`)
  } else {
    ElMessage.error('上传失败')
  }
}

const handleOrdersUploadSuccess = (response) => {
  if (response.success) {
    loadedOrdersCount.value = response.imported_count
    ElMessage.success(`已加载 ${response.imported_count} 个订单`)
  } else {
    ElMessage.error('上传失败')
  }
}

const handleUploadError = (error) => {
  console.error('Upload error:', error)
  ElMessage.error('上传失败，请检查文件格式')
}

const loadSampleData = async () => {
  ElMessage.info('正在加载示例数据...')
}

const loadAnomalyData = async () => {
  ElMessage.info(`正在加载 ${selectedAnomaly.value} 异常场景...`)
}
</script>

<style scoped>
.panel-container {
  padding: 5px;
}

.section {
  margin-bottom: 15px;
}

.section h3 {
  font-size: 14px;
  color: #303133;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.el-upload {
  width: 100%;
}

.el-upload button {
  width: 100%;
}

.el-descriptions {
  background: white;
  border-radius: 4px;
}

.el-radio-group {
  display: flex;
}

.el-radio-button {
  flex: 1;
}
</style>
