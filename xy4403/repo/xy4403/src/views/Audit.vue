<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">审计日志</h2>
      <div>
        <el-button type="success" @click="exportAudit">
          <el-icon><Download /></el-icon>
          导出JSON审计记录
        </el-button>
      </div>
    </div>

    <el-card class="card-container">
      <template #header>
        <div class="card-header">
          <span>操作日志</span>
          <div>
            <el-select v-model="filterAction" placeholder="操作类型" clearable style="width: 150px; margin-right: 10px;">
              <el-option label="创建" value="create" />
              <el-option label="更新" value="update" />
              <el-option label="删除" value="delete" />
              <el-option label="导出" value="export" />
              <el-option label="授权" value="override" />
            </el-select>
            <el-select v-model="filterTable" placeholder="数据表" clearable style="width: 150px;">
              <el-option label="批次" value="batches" />
              <el-option label="预约" value="appointments" />
              <el-option label="药液" value="chemical_records" />
              <el-option label="暗袋" value="dark_bags" />
              <el-option label="取片" value="pickup_records" />
            </el-select>
          </div>
        </div>
      </template>
      <el-table :data="filteredLogs" style="width: 100%" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="action" label="操作类型" width="100">
          <template #default="scope">
            <el-tag :type="getActionType(scope.row.action)">
              {{ getActionText(scope.row.action) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="table_name" label="数据表" width="120">
          <template #default="scope">
            {{ getTableText(scope.row.table_name) }}
          </template>
        </el-table-column>
        <el-table-column prop="record_id" label="记录ID" width="100">
          <template #default="scope">
            {{ scope.row.record_id || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="old_values" label="旧值" min-width="200">
          <template #default="scope">
            <template v-if="scope.row.old_values">
              <el-button type="primary" link size="small" @click="showJsonDialog(scope.row.old_values, '旧值详情')">
                查看详情
              </el-button>
            </template>
            <template v-else>-</template>
          </template>
        </el-table-column>
        <el-table-column prop="new_values" label="新值" min-width="200">
          <template #default="scope">
            <template v-if="scope.row.new_values">
              <el-button type="primary" link size="small" @click="showJsonDialog(scope.row.new_values, '新值详情')">
                查看详情
              </el-button>
            </template>
            <template v-else>-</template>
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="100">
          <template #default="scope">
            {{ scope.row.operator || 'admin' }}
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="操作时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.created_at) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showJsonViewer" :title="jsonDialogTitle" width="600px">
      <div class="json-viewer">
        <pre>{{ formattedJson }}</pre>
      </div>
      <template #footer>
        <el-button @click="showJsonViewer = false">关闭</el-button>
        <el-button type="primary" @click="copyJson">复制</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'

const loading = ref(false)
const auditLogs = ref([])
const filterAction = ref('')
const filterTable = ref('')
const showJsonViewer = ref(false)
const jsonDialogTitle = ref('')
const currentJson = ref('')

const filteredLogs = computed(() => {
  let logs = [...auditLogs.value]
  
  if (filterAction.value) {
    logs = logs.filter(log => log.action === filterAction.value)
  }
  
  if (filterTable.value) {
    logs = logs.filter(log => log.table_name === filterTable.value)
  }
  
  return logs
})

const formattedJson = computed(() => {
  try {
    const obj = JSON.parse(currentJson.value)
    return JSON.stringify(obj, null, 2)
  } catch {
    return currentJson.value
  }
})

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

const getActionType = (action) => {
  const types = {
    'create': 'success',
    'update': 'primary',
    'delete': 'danger',
    'export': 'info',
    'override': 'warning'
  }
  return types[action] || 'info'
}

const getActionText = (action) => {
  const texts = {
    'create': '创建',
    'update': '更新',
    'delete': '删除',
    'export': '导出',
    'override': '授权',
    'export_handover': '导出交接单'
  }
  return texts[action] || action
}

const getTableText = (tableName) => {
  const texts = {
    'batches': '批次',
    'appointments': '预约',
    'chemical_records': '药液',
    'dark_bags': '暗袋',
    'pickup_records': '取片',
    'rule_violations': '规则违规'
  }
  return texts[tableName] || tableName
}

const loadAuditLogs = async () => {
  loading.value = true
  try {
    auditLogs.value = await window.electronAPI.getAuditLogs(200)
  } catch (error) {
    ElMessage.error('加载审计日志失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

const showJsonDialog = (jsonStr, title) => {
  currentJson.value = jsonStr
  jsonDialogTitle.value = title
  showJsonViewer.value = true
}

const copyJson = async () => {
  try {
    await navigator.clipboard.writeText(formattedJson.value)
    ElMessage.success('已复制到剪贴板')
  } catch (error) {
    ElMessage.error('复制失败: ' + error.message)
  }
}

const exportAudit = async () => {
  try {
    const result = await window.electronAPI.exportJSON('audit')
    if (result.success) {
      ElMessage.success(`审计记录已导出到: ${result.filePath}`)
    } else if (!result.canceled) {
      ElMessage.error('导出失败')
    }
  } catch (error) {
    ElMessage.error('导出失败: ' + error.message)
  }
}

onMounted(() => {
  loadAuditLogs()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.json-viewer {
  background-color: #f5f7fa;
  padding: 16px;
  border-radius: 4px;
  max-height: 400px;
  overflow-y: auto;
}

.json-viewer pre {
  margin: 0;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
