<template>
  <div class="import-page">
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>导入电池数据</span>
            </div>
          </template>
          <el-upload
            :auto-upload="false"
            :show-file-list="false"
            :on-change="handleBatteryFileChange"
            accept=".xlsx,.xls"
          >
            <div class="upload-area">
              <el-icon class="upload-icon" size="60"><Upload /></el-icon>
              <div class="upload-text">点击或拖拽Excel文件到此处</div>
              <div class="upload-hint">支持 .xlsx、.xls 格式</div>
            </div>
          </el-upload>
          <div class="selected-file" v-if="selectedBatteryFile">
            <el-icon><Document /></el-icon>
            <span>{{ selectedBatteryFile.name }}</span>
            <el-button type="text" size="small" @click="selectedBatteryFile = null">移除</el-button>
          </div>
          <div class="import-actions">
            <el-button type="primary" @click="uploadBatteries" :loading="batteryUploading" :disabled="!selectedBatteryFile">
              开始导入
            </el-button>
          </div>
          <div class="template-info">
            <div class="template-title">Excel模板格式:</div>
            <el-table :data="batteryTemplate" :show-header="false" size="small" style="width: 100%">
              <el-table-column prop="field" label="字段" />
              <el-table-column prop="desc" label="说明" />
              <el-table-column prop="required" label="必填" width="60">
                <template #default="{ row }">
                  <el-tag v-if="row.required" type="danger" size="small">是</el-tag>
                  <el-tag v-else type="info" size="small">否</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>导入作业波次</span>
            </div>
          </template>
          <el-upload
            :auto-upload="false"
            :show-file-list="false"
            :on-change="handleWaveFileChange"
            accept=".xlsx,.xls"
          >
            <div class="upload-area">
              <el-icon class="upload-icon" size="60"><Upload /></el-icon>
              <div class="upload-text">点击或拖拽Excel文件到此处</div>
              <div class="upload-hint">支持 .xlsx、.xls 格式</div>
            </div>
          </el-upload>
          <div class="selected-file" v-if="selectedWaveFile">
            <el-icon><Document /></el-icon>
            <span>{{ selectedWaveFile.name }}</span>
            <el-button type="text" size="small" @click="selectedWaveFile = null">移除</el-button>
          </div>
          <div class="import-actions">
            <el-button type="primary" @click="uploadWaves" :loading="waveUploading" :disabled="!selectedWaveFile">
              开始导入
            </el-button>
          </div>
          <div class="template-info">
            <div class="template-title">Excel模板格式:</div>
            <el-table :data="waveTemplate" :show-header="false" size="small" style="width: 100%">
              <el-table-column prop="field" label="字段" />
              <el-table-column prop="desc" label="说明" />
              <el-table-column prop="required" label="必填" width="60">
                <template #default="{ row }">
                  <el-tag v-if="row.required" type="danger" size="small">是</el-tag>
                  <el-tag v-else type="info" size="small">否</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <span>导入历史记录</span>
          <el-button type="text" @click="loadImportHistory">刷新</el-button>
        </div>
      </template>
      <el-table :data="importHistory" style="width: 100%">
        <el-table-column prop="batchCode" label="批次号" width="160" />
        <el-table-column prop="fileName" label="文件名" min-width="200" />
        <el-table-column prop="fileType" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.fileType === 'batteries' ? 'primary' : 'success'" size="small">
              {{ row.batchCode?.startsWith('IB') ? '电池' : '波次' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="totalRecords" label="总记录数" width="100" />
        <el-table-column prop="successCount" label="成功" width="80">
          <template #default="{ row }">
            <span style="color: #67C23A">{{ row.successCount }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="failCount" label="失败" width="80">
          <template #default="{ row }">
            <span style="color: #F56C6C">{{ row.failCount }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusName(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdBy" label="操作人" width="100" />
        <el-table-column prop="createdAt" label="导入时间" width="160" />
        <el-table-column label="错误日志" width="100">
          <template #default="{ row }">
            <el-button v-if="row.errorLog" type="text" size="small" @click="viewErrorLog(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="resultDialogVisible" :title="resultTitle" width="500px">
      <el-result :icon="resultIcon" :title="resultMessage">
        <template #sub-title>
          <div v-if="importResult">
            <p>成功: <span style="color: #67C23A">{{ importResult.successCount || 0 }}</span> 条</p>
            <p>失败: <span style="color: #F56C6C">{{ importResult.failCount || 0 }}</span> 条</p>
            <p v-if="importResult.errors && importResult.errors.length">
              <el-tag type="info" size="small" v-for="(err, idx) in importResult.errors" :key="idx" style="margin: 2px;">
                {{ err }}
              </el-tag>
            </p>
          </div>
        </template>
      </el-result>
    </el-dialog>

    <el-dialog v-model="errorDialogVisible" title="错误日志" width="600px">
      <el-input type="textarea" v-model="currentErrorLog" :rows="10" readonly />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'

const selectedBatteryFile = ref(null)
const selectedWaveFile = ref(null)
const batteryUploading = ref(false)
const waveUploading = ref(false)
const importHistory = ref([])

const resultDialogVisible = ref(false)
const resultTitle = ref('')
const resultIcon = ref('success')
const resultMessage = ref('')
const importResult = ref(null)

const errorDialogVisible = ref(false)
const currentErrorLog = ref('')

const batteryTemplate = [
  { field: 'A列: 电池编号', desc: '唯一标识，如 BAT-001', required: true },
  { field: 'B列: 叉车编号', desc: '关联的叉车编号', required: false },
  { field: 'C列: 电池类型', desc: 'LITHIUM/LEAD_ACID', required: false },
  { field: 'D列: 容量(kWh)', desc: '电池容量，默认80', required: false },
  { field: 'E列: 当前电量(%)', desc: '0-100，默认80', required: false },
  { field: 'F列: 健康状态', desc: 'GOOD/WARNING/REPLACE', required: false },
  { field: 'G列: 健康分数', desc: '0-100，默认95', required: false }
]

const waveTemplate = [
  { field: 'A列: 波次编号', desc: '唯一标识，如 WAVE-001', required: true },
  { field: 'B列: 波次名称', desc: '波次描述名称', required: true },
  { field: 'C列: 开始时间', desc: '格式: YYYY-MM-DDTHH:mm:ss', required: true },
  { field: 'D列: 结束时间', desc: '格式: YYYY-MM-DDTHH:mm:ss', required: true },
  { field: 'E列: 优先级', desc: '1-10，数字越小越优先', required: false },
  { field: 'F列: 需求叉车数', desc: '需要的叉车数量', required: false }
]

const getStatusType = (status) => {
  const map = { 'COMPLETED': 'success', 'PARTIAL': 'warning', 'FAILED': 'danger', 'PROCESSING': 'info' }
  return map[status] || 'info'
}

const getStatusName = (status) => {
  const map = { 'COMPLETED': '完成', 'PARTIAL': '部分失败', 'FAILED': '失败', 'PROCESSING': '处理中' }
  return map[status] || status
}

const handleBatteryFileChange = (file) => {
  selectedBatteryFile.value = file.raw
}

const handleWaveFileChange = (file) => {
  selectedWaveFile.value = file.raw
}

const uploadBatteries = async () => {
  if (!selectedBatteryFile.value) return
  
  batteryUploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', selectedBatteryFile.value)
    
    const res = await request.post('/import/batteries', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    
    importResult.value = res.data
    resultTitle.value = '导入结果'
    resultIcon.value = res.data?.failCount > 0 ? 'warning' : 'success'
    resultMessage.value = res.data?.failCount > 0 ? '部分数据导入失败' : '导入成功'
    resultDialogVisible.value = true
    
    selectedBatteryFile.value = null
    await loadImportHistory()
  } catch (e) {
    ElMessage.error('导入失败: ' + (e.message || '未知错误'))
  } finally {
    batteryUploading.value = false
  }
}

const uploadWaves = async () => {
  if (!selectedWaveFile.value) return
  
  waveUploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', selectedWaveFile.value)
    
    const res = await request.post('/import/waves', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    
    importResult.value = res.data
    resultTitle.value = '导入结果'
    resultIcon.value = res.data?.failCount > 0 ? 'warning' : 'success'
    resultMessage.value = res.data?.failCount > 0 ? '部分数据导入失败' : '导入成功'
    resultDialogVisible.value = true
    
    selectedWaveFile.value = null
    await loadImportHistory()
  } catch (e) {
    ElMessage.error('导入失败: ' + (e.message || '未知错误'))
  } finally {
    waveUploading.value = false
  }
}

const loadImportHistory = async () => {
  const res = await request.get('/reports/import-history')
  importHistory.value = res.data || []
}

const viewErrorLog = (row) => {
  currentErrorLog.value = row.errorLog
  errorDialogVisible.value = true
}

onMounted(() => {
  loadImportHistory()
})
</script>

<style scoped>
.import-page {
  min-height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.upload-area {
  border: 2px dashed #DCDFE6;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.upload-area:hover {
  border-color: #409EFF;
  background: #ecf5ff;
}

.upload-icon {
  color: #909399;
}

.upload-text {
  margin-top: 10px;
  color: #606266;
  font-size: 14px;
}

.upload-hint {
  margin-top: 5px;
  color: #909399;
  font-size: 12px;
}

.selected-file {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  margin-top: 10px;
  background: #F5F7FA;
  border-radius: 4px;
}

.import-actions {
  margin-top: 15px;
  text-align: center;
}

.template-info {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #EBEEF5;
}

.template-title {
  font-size: 14px;
  color: #606266;
  margin-bottom: 10px;
}
</style>
