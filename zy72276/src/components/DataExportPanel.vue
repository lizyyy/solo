<template>
  <el-card class="export-panel">
    <template #header>
      <div class="panel-header">
        <span><el-icon><Download /></el-icon> 数据导出</span>
        <el-tag size="small" type="info">
          明细、页面展示、接口返回 读同一份结果
        </el-tag>
      </div>
    </template>

    <el-alert type="info" :closable="false" class="consistency-alert">
      <template #default>
        <strong>数据一致性保证：</strong>所有导出数据和页面展示都来源于同一的
        <code>unifiedResult</code> 对象，确保不会出现"一个地方显示异常、另一个地方消失"的情况。
      </template>
    </el-alert>

    <el-row :gutter="20" class="export-buttons">
      <el-col :span="8">
        <el-button 
          type="primary" 
          size="large" 
          style="width: 100%;"
          @click="exportData('excel')"
          :disabled="!hasData"
          :icon="Document"
        >
          导出 Excel
        </el-button>
      </el-col>
      <el-col :span="8">
        <el-button 
          type="success" 
          size="large" 
          style="width: 100%;"
          @click="exportData('csv')"
          :disabled="!hasData"
          :icon="Tickets"
        >
          导出 CSV
        </el-button>
      </el-col>
      <el-col :span="8">
        <el-button 
          type="warning" 
          size="large" 
          style="width: 100%;"
          @click="exportData('json')"
          :disabled="!hasData"
          :icon="Files"
        >
          导出 JSON
        </el-button>
      </el-col>
    </el-row>

    <el-divider>API 接口数据预览</el-divider>

    <el-alert type="success" :closable="false">
      <template #default>
        以下是 API 返回格式预览，与导出和页面展示使用同一份数据：
        <code>/api/simulation/result</code>
      </template>
    </el-alert>

    <div class="api-preview">
      <el-collapse>
        <el-collapse-item title="查看 API 返回数据结构" name="api">
          <pre class="json-preview">{{ apiPreview }}</pre>
        </el-collapse-item>
      </el-collapse>
    </div>

    <el-divider>统一数据源验证</el-divider>

    <el-descriptions :column="3" border size="small">
      <el-descriptions-item label="障碍物记录数">
        {{ unifiedResult?.obstacleRecords?.length || 0 }}
      </el-descriptions-item>
      <el-descriptions-item label="楼层剖面数">
        {{ unifiedResult?.floorSectionRecords?.length || 0 }}
      </el-descriptions-item>
      <el-descriptions-item label="现场说明数">
        {{ unifiedResult?.siteInstructions?.length || 0 }}
      </el-descriptions-item>
      <el-descriptions-item label="受影响记录数">
        {{ unifiedResult?.affectedRecords?.length || 0 }}
      </el-descriptions-item>
      <el-descriptions-item label="数据生成时间" :span="2">
        {{ formatDateTime(unifiedResult?.generatedAt) }}
      </el-descriptions-item>
    </el-descriptions>
  </el-card>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Document, Tickets, Files } from '@element-plus/icons-vue'
import { useSimulationStore } from '../stores/simulationStore'
import { 
  exportUnifiedData, 
  downloadFile, 
  getUnifiedResultForAPI 
} from '../utils/exportUtils'

const store = useSimulationStore()

const unifiedResult = computed(() => store.getUnifiedResult())

const hasData = computed(() => {
  return unifiedResult.value && unifiedResult.value.obstacleRecords.length > 0
})

const apiPreview = computed(() => {
  const result = getUnifiedResultForAPI(unifiedResult.value)
  return JSON.stringify(result, null, 2)
})

const exportData = (format) => {
  try {
    const result = exportUnifiedData(unifiedResult.value, format)
    downloadFile(result)
    ElMessage.success(`${format.toUpperCase()} 导出成功`)
  } catch (error) {
    ElMessage.error(error.message)
  }
}

const formatDateTime = (isoString) => {
  if (!isoString) return '-'
  return new Date(isoString).toLocaleString('zh-CN')
}
</script>

<style scoped>
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.consistency-alert {
  margin-bottom: 20px;
}

.export-buttons {
  margin-bottom: 20px;
}

.api-preview {
  margin-top: 10px;
}

.json-preview {
  background: #f5f7fa;
  padding: 15px;
  border-radius: 4px;
  max-height: 400px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.5;
}
</style>
