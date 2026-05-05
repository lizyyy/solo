<template>
  <div class="panel-container">
    <div class="section">
      <h3>⚙️ 调度配置</h3>
      
      <el-form label-position="top" size="small">
        <el-form-item label="调度算法">
          <el-select v-model="config.algorithm" style="width: 100%;">
            <el-option label="贪心算法 (Greedy)" value="greedy" />
            <el-option label="A*算法" value="a_star" />
            <el-option label="遗传算法" value="genetic" />
            <el-option label="强化学习" value="reinforcement_learning" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="批次名称">
          <el-input v-model="config.batchName" placeholder="请输入批次名称" />
        </el-form-item>
        
        <el-form-item label="描述">
          <el-input 
            v-model="config.description" 
            type="textarea" 
            :rows="2"
            placeholder="可选描述"
          />
        </el-form-item>
        
        <el-divider content-position="left">高级参数</el-divider>
        
        <el-form-item label="安全距离 (米)">
          <el-slider 
            v-model="config.safetyDistance" 
            :min="1" 
            :max="5" 
            :step="0.5"
            show-input
          />
        </el-form-item>
        
        <el-form-item label="最大速度 (m/s)">
          <el-slider 
            v-model="config.maxSpeed" 
            :min="0.5" 
            :max="3" 
            :step="0.1"
            show-input
          />
        </el-form-item>
        
        <el-form-item label="时间步长 (秒)">
          <el-slider 
            v-model="config.timeStep" 
            :min="0.1" 
            :max="2" 
            :step="0.1"
            show-input
          />
        </el-form-item>
      </el-form>
    </div>
    
    <el-divider />
    
    <div class="section">
      <h3>🚀 执行调度</h3>
      
      <el-button 
        type="primary" 
        @click="createAndRunBatch"
        :loading="isRunning"
        style="width: 100%; margin-bottom: 10px;"
      >
        {{ isRunning ? '调度中...' : '创建并运行调度批次' }}
      </el-button>
      
      <el-alert
        v-if="lastResult"
        :title="'执行结果: ' + (lastResult.success ? '成功' : '失败')"
        :type="lastResult.success ? 'success' : 'error'"
        show-icon
        :closable="false"
      >
        <template #default>
          <div v-if="lastResult.success">
            <p>分配任务数: {{ lastResult.result?.total_assignments || 0 }}</p>
            <p>涉及机器人: {{ lastResult.result?.assigned_robots || 0 }}</p>
          </div>
          <div v-else>
            <p>{{ lastResult.message }}</p>
          </div>
        </template>
      </el-alert>
    </div>
    
    <el-divider />
    
    <div class="section">
      <h3>📊 调度历史</h3>
      
      <el-table 
        :data="batches" 
        size="small"
        style="width: 100%;"
        max-height="200"
        @row-click="handleRowClick"
        highlight-current-row
      >
        <el-table-column prop="name" label="名称" min-width="80" />
        <el-table-column prop="algorithm" label="算法" width="80">
          <template #default="{ row }">
            <el-tag size="small">{{ row.algorithm }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag 
              :type="getStatusType(row.status)" 
              size="small"
            >
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      
      <div v-if="selectedBatch" class="batch-actions" style="margin-top: 10px;">
        <el-button 
          type="success" 
          size="small"
          @click="generateReplay"
          :loading="isGenerating"
        >
          生成回放帧
        </el-button>
        <el-button 
          type="info" 
          size="small"
          @click="viewReport"
        >
          查看报告
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '../services/api'

const props = defineProps({
  warehouseMapId: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['batch-created'])

const config = reactive({
  algorithm: 'greedy',
  batchName: '调度批次',
  description: '',
  safetyDistance: 2.0,
  maxSpeed: 1.0,
  timeStep: 0.5
})

const isRunning = ref(false)
const isGenerating = ref(false)
const batches = ref([])
const selectedBatch = ref(null)
const lastResult = ref(null)

const getStatusType = (status) => {
  const typeMap = {
    'completed': 'success',
    'running': 'warning',
    'pending': 'info',
    'failed': 'danger',
    'paused': ''
  }
  return typeMap[status] || 'info'
}

const loadBatches = async () => {
  try {
    const result = await api.getBatches(props.warehouseMapId)
    batches.value = result.batches || []
  } catch (e) {
    console.error('Failed to load batches:', e)
  }
}

const createAndRunBatch = async () => {
  if (!props.warehouseMapId) {
    ElMessage.warning('请先加载仓库地图')
    return
  }
  
  isRunning.value = true
  lastResult.value = null
  
  try {
    const createResult = await api.createBatch(
      props.warehouseMapId,
      config.batchName,
      config.description,
      config.algorithm
    )
    
    if (createResult.success) {
      const runResult = await api.runScheduling(createResult.batch_id)
      lastResult.value = runResult
      
      if (runResult.success) {
        ElMessage.success('调度执行成功')
        emit('batch-created', createResult.batch_id)
        await loadBatches()
      } else {
        ElMessage.error('调度执行失败: ' + (runResult.message || '未知错误'))
      }
    } else {
      ElMessage.error('创建批次失败')
    }
  } catch (e) {
    console.error('Scheduling error:', e)
    lastResult.value = {
      success: false,
      message: e.message || '执行出错'
    }
    ElMessage.error('执行出错: ' + e.message)
  } finally {
    isRunning.value = false
  }
}

const handleRowClick = (row) => {
  selectedBatch.value = row
}

const generateReplay = async () => {
  if (!selectedBatch.value) return
  
  isGenerating.value = true
  
  try {
    const result = await api.generateFrames(selectedBatch.value.id, config.timeStep)
    if (result.success) {
      ElMessage.success(`已生成 ${result.result.total_frames} 帧回放数据`)
    } else {
      ElMessage.error('生成失败')
    }
  } catch (e) {
    ElMessage.error('生成出错: ' + e.message)
  } finally {
    isGenerating.value = false
  }
}

const viewReport = async () => {
  if (!selectedBatch.value) return
  
  try {
    const report = await api.getBatchReport(selectedBatch.value.id, 'markdown')
    await ElMessageBox.alert(
      '<pre style="white-space: pre-wrap; font-size: 12px; max-height: 400px; overflow-y: auto;">' + report + '</pre>',
      '调度报告',
      {
        dangerouslyUseHTMLString: true,
        confirmButtonText: '关闭',
        customClass: 'report-dialog'
      }
    )
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('获取报告失败: ' + e.message)
    }
  }
}

watch(() => props.warehouseMapId, () => {
  loadBatches()
})

onMounted(() => {
  loadBatches()
})
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

.batch-actions {
  display: flex;
  gap: 10px;
}
</style>
