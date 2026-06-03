<template>
  <el-card class="audit-panel">
    <template #header>
      <div class="panel-header">
        <span><el-icon><DataLine /></el-icon> 审计追踪</span>
        <el-tag size="small" type="warning">
          巡检组可追溯原始证据
        </el-tag>
      </div>
    </template>

    <el-alert type="info" :closable="false" class="audit-alert">
      <template #default>
        <strong>可追溯信息：</strong>每条障碍物记录都保留原始行号、人工改动记录、处理状态历史，巡检组追问时可回溯到原始证据。
      </template>
    </el-alert>

    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-statistic title="总操作记录" :value="auditStats.totalActions" />
      </el-col>
      <el-col :span="6">
        <el-statistic title="今日操作" :value="auditStats.todayActions" />
      </el-col>
      <el-col :span="6">
        <el-statistic title="导入记录" :value="auditStats.actionsByType.import || 0" />
      </el-col>
      <el-col :span="6">
        <el-statistic title="更新记录" :value="auditStats.actionsByType.update || 0" />
      </el-col>
    </el-row>

    <el-divider>操作日志</el-divider>

    <el-table :data="store.auditLogs.slice().reverse()" border stripe size="small" max-height="300">
      <el-table-column prop="timestamp" label="时间" width="180">
        <template #default="{ row }">
          {{ formatDateTime(row.timestamp) }}
        </template>
      </el-table-column>
      <el-table-column prop="operator" label="操作人" width="100" />
      <el-table-column prop="action" label="操作" width="100">
        <template #default="{ row }">
          <el-tag :type="getActionTagType(row.action)" size="small">
            {{ getActionText(row.action) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="entityType" label="对象类型" width="120">
        <template #default="{ row }">
          {{ getEntityTypeText(row.entityType) }}
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" min-width="250" show-overflow-tooltip />
    </el-table>

    <el-divider>导出审计追踪</el-divider>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-button type="primary" @click="exportAuditCSV" :icon="Download">
          导出审计记录 CSV
        </el-button>
      </el-col>
      <el-col :span="12">
        <el-button type="success" @click="showAuditSummary = true" :icon="Document">
          查看审计汇总
        </el-button>
      </el-col>
    </el-row>

    <el-dialog v-model="showAuditSummary" title="审计追踪汇总" width="800px">
      <div v-if="store.obstacleRecords.length > 0">
        <el-table :data="store.obstacleRecords" border stripe size="small">
          <el-table-column prop="originalLineNumber" label="原始行号" width="100" />
          <el-table-column prop="wallPanelCode" label="墙板编号" width="120" />
          <el-table-column prop="originalObstacleNote" label="原始备注" min-width="150" show-overflow-tooltip />
          <el-table-column prop="obstacleNote" label="当前备注" min-width="150" show-overflow-tooltip />
          <el-table-column label="修改次数" width="80">
            <template #default="{ row }">
              <el-badge :value="row.manualChanges?.length || 0" />
            </template>
          </el-table-column>
          <el-table-column prop="processingStatus" label="当前状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getStatusTagType(row.processingStatus)" size="small">
                {{ getStatusText(row.processingStatus) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="isMixedCoordinate" label="坐标混合" width="100">
            <template #default="{ row }">
              <el-tag :type="row.isMixedCoordinate ? 'danger' : 'success'" size="small">
                {{ row.isMixedCoordinate ? '是(待复核)' : '否' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <el-empty v-else description="暂无数据" />
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { DataLine, Download, Document } from '@element-plus/icons-vue'
import { useSimulationStore } from '../stores/simulationStore'
import { getAuditStatistics, exportAuditTrailAsCSV } from '../utils/auditUtils'
import { downloadFile } from '../utils/exportUtils'

const store = useSimulationStore()

const showAuditSummary = ref(false)

const auditStats = computed(() => {
  return getAuditStatistics(store.auditLogs)
})

const formatDateTime = (isoString) => {
  if (!isoString) return '-'
  return new Date(isoString).toLocaleString('zh-CN')
}

const getActionText = (action) => {
  const map = {
    'import': '导入',
    'update': '更新',
    'create': '创建',
    'delete': '删除',
    'export': '导出'
  }
  return map[action] || action
}

const getActionTagType = (action) => {
  const map = {
    'import': 'success',
    'update': 'warning',
    'create': 'primary',
    'delete': 'danger',
    'export': 'info'
  }
  return map[action] || 'info'
}

const getEntityTypeText = (type) => {
  const map = {
    'obstacle': '障碍物记录',
    'floorSection': '楼层剖面',
    'instruction': '现场说明'
  }
  return map[type] || type
}

const getStatusText = (status) => {
  const map = {
    'pending': '待处理',
    'pending_review': '待复核',
    'manual_updated': '已更新',
    'reviewed': '已复核'
  }
  return map[status] || status
}

const getStatusTagType = (status) => {
  const map = {
    'pending': 'info',
    'pending_review': 'danger',
    'manual_updated': 'success',
    'reviewed': 'success'
  }
  return map[status] || 'info'
}

const exportAuditCSV = () => {
  if (store.obstacleRecords.length === 0) {
    ElMessage.warning('暂无审计数据可导出')
    return
  }
  const csvContent = exportAuditTrailAsCSV(store.obstacleRecords)
  downloadFile({
    data: csvContent,
    filename: `审计追踪_${formatDate(new Date())}.csv`,
    mimeType: 'text/csv;charset=utf-8;'
  })
  ElMessage.success('审计记录导出成功')
}

const formatDate = (date) => {
  return date.toISOString().slice(0, 10)
}
</script>

<style scoped>
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.audit-alert {
  margin-bottom: 20px;
}

.stats-row {
  margin-bottom: 20px;
}
</style>
