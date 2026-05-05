<template>
  <div class="import-container">
    <el-card shadow="hover">
      <template #header>
        <span class="card-title">数据导入</span>
      </template>
      
      <el-steps :active="activeStep" align-center style="margin-bottom: 40px">
        <el-step title="选择数据类型" />
        <el-step title="上传文件" />
        <el-step title="导入结果" />
      </el-steps>

      <div v-if="activeStep === 0" class="step-content">
        <h3 class="step-title">请选择要导入的数据类型</h3>
        
        <el-row :gutter="20">
          <el-col :span="6" v-for="(item, index) in dataTypes" :key="index">
            <div 
              class="data-type-card" 
              :class="{ active: selectedType === item.value }"
              @click="selectedType = item.value"
            >
              <el-icon size="48" :color="selectedType === item.value ? '#409eff' : '#909399'">
                <component :is="item.icon" />
              </el-icon>
              <div class="type-name">{{ item.label }}</div>
              <div class="type-desc">{{ item.description }}</div>
            </div>
          </el-col>
        </el-row>

        <div class="step-actions">
          <el-button type="primary" @click="goToStep(1)" :disabled="!selectedType">
            下一步
            <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>
      </div>

      <div v-if="activeStep === 1" class="step-content">
        <h3 class="step-title">上传 {{ getCurrentTypeLabel() }} 文件</h3>
        
        <el-tabs v-model="uploadTab" type="border-card" style="margin-top: 20px">
          <el-tab-pane label="文件上传" name="file">
            <el-upload
              ref="uploadRef"
              :action="getUploadUrl()"
              :headers="uploadHeaders"
              :multiple="true"
              :limit="10"
              :file-list="fileList"
              :on-change="handleFileChange"
              :on-success="handleUploadSuccess"
              :on-error="handleUploadError"
              :before-upload="beforeUpload"
              :auto-upload="false"
              :accept="getAcceptTypes()"
              drag
            >
              <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
              <div class="el-upload__text">
                将文件拖到此处，或<em>点击上传</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">
                  <span v-if="selectedType === 'photos'">支持 JPG、PNG 格式的叶片照片</span>
                  <span v-else-if="selectedType === 'flight_path'">支持 JSON 格式的无人机航迹文件</span>
                  <span v-else-if="selectedType === 'alarms'">支持 JSON、CSV 格式的 SCADA 告警文件</span>
                  <span v-else-if="selectedType === 'work_orders'">支持 JSON、CSV 格式的维修工单文件</span>
                </div>
              </template>
            </el-upload>
          </el-tab-pane>

          <el-tab-pane label="手动输入JSON" name="json">
            <el-form :model="jsonForm" label-width="100px" style="margin-top: 20px">
              <el-form-item label="关联风机" prop="turbine_id">
                <el-select 
                  v-model="jsonForm.turbine_id" 
                  placeholder="请选择风机（可选）" 
                  style="width: 100%"
                  clearable
                >
                  <el-option 
                    v-for="turbine in turbineList" 
                    :key="turbine.id" 
                    :label="`${turbine.turbine_id} - ${turbine.name}`"
                    :value="turbine.id"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="JSON数据">
                <el-input
                  v-model="jsonForm.json_data"
                  type="textarea"
                  :rows="15"
                  placeholder="请输入JSON格式的数据"
                  class="json-textarea"
                />
              </el-form-item>
            </el-form>
          </el-tab-pane>
        </el-tabs>

        <div class="step-actions">
          <el-button @click="goToStep(0)">
            <el-icon><ArrowLeft /></el-icon>
            上一步
          </el-button>
          <el-button type="primary" @click="handleUpload" :loading="uploading">
            <el-icon v-if="uploadTab === 'file'"><Upload /></el-icon>
            <el-icon v-else><DocumentAdd /></el-icon>
            {{ uploadTab === 'file' ? '上传并导入' : '导入JSON数据' }}
          </el-button>
        </div>
      </div>

      <div v-if="activeStep === 2" class="step-content">
        <div class="result-summary" :class="importResult.success > 0 ? 'success' : 'error'">
          <el-icon size="64" :color="importResult.success > 0 ? '#67c23a' : '#f56c6c'">
            <component :is="importResult.success > 0 ? 'CircleCheckFilled' : 'CircleCloseFilled'" />
          </el-icon>
          <h2 v-if="importResult.success > 0">导入完成</h2>
          <h2 v-else>导入失败</h2>
        </div>

        <el-descriptions :column="2" border style="margin-top: 20px">
          <el-descriptions-item label="数据类型">{{ getCurrentTypeLabel() }}</el-descriptions-item>
          <el-descriptions-item label="成功数量">
            <span style="color: #67c23a; font-weight: bold">{{ importResult.success }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="失败数量">
            <span style="color: #f56c6c; font-weight: bold">{{ importResult.failed }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="跳过数量">
            <span style="color: #e6a23c; font-weight: bold">{{ importResult.skipped }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <el-card v-if="importResult.errors.length > 0" shadow="never" style="margin-top: 20px">
          <template #header>
            <span style="color: #f56c6c">错误详情</span>
          </template>
          <div class="error-list">
            <div v-for="(error, index) in importResult.errors" :key="index" class="error-item">
              <el-tag type="danger" size="small">错误</el-tag>
              <span class="error-file">{{ error.file }}</span>
              <span class="error-msg">{{ error.message }}</span>
            </div>
          </div>
        </el-card>

        <div class="step-actions">
          <el-button @click="resetImport">
            <el-icon><Refresh /></el-icon>
            继续导入
          </el-button>
          <el-button type="primary" @click="$router.push('/risk-assessments')">
            查看风险评估
          </el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type UploadInstance, type UploadProps, type UploadFile } from 'element-plus'
import { getTurbines } from '@/api/turbines'
import { importPhotos, importFlightPath, importAlarms, importWorkOrders } from '@/api/import'
import { Picture, Location, Warning, Document, UploadFilled, ArrowRight, ArrowLeft, Upload, DocumentAdd, Refresh, CircleCheckFilled, CircleCloseFilled } from '@element-plus/icons-vue'

const router = useRouter()
const uploadRef = ref<UploadInstance>()

const activeStep = ref(0)
const selectedType = ref<string>('')
const uploadTab = ref('file')
const uploading = ref(false)
const fileList = ref<UploadFile[]>([])

const jsonForm = reactive({
  turbine_id: undefined as number | undefined,
  json_data: '',
})

const importResult = reactive({
  success: 0,
  failed: 0,
  skipped: 0,
  errors: [] as { file: string; message: string }[],
})

const turbineList = ref<any[]>([])

const dataTypes = [
  { value: 'photos', label: '叶片照片', icon: 'Picture', description: '导入叶片分段照片进行AI检测' },
  { value: 'flight_path', label: '无人机航迹', icon: 'Location', description: '导入无人机飞行路径JSON' },
  { value: 'alarms', label: 'SCADA告警', icon: 'Warning', description: '导入SCADA系统告警数据' },
  { value: 'work_orders', label: '维修工单', icon: 'Document', description: '导入历史维修工单数据' },
]

const uploadHeaders = computed(() => {
  const token = localStorage.getItem('token')
  return {
    Authorization: token ? `Bearer ${token}` : '',
  }
})

const getCurrentTypeLabel = () => {
  const type = dataTypes.find(t => t.value === selectedType.value)
  return type?.label || ''
}

const getAcceptTypes = () => {
  switch (selectedType.value) {
    case 'photos': return '.jpg,.jpeg,.png'
    case 'flight_path': return '.json'
    case 'alarms': return '.json,.csv'
    case 'work_orders': return '.json,.csv'
    default: return ''
  }
}

const getUploadUrl = () => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  switch (selectedType.value) {
    case 'photos': return `${baseUrl}/api/v1/import/photos`
    case 'flight_path': return `${baseUrl}/api/v1/import/flight-path`
    case 'alarms': return `${baseUrl}/api/v1/import/alarms`
    case 'work_orders': return `${baseUrl}/api/v1/import/work-orders`
    default: return ''
  }
}

const goToStep = (step: number) => {
  activeStep.value = step
}

const handleFileChange: UploadProps['onChange'] = (uploadFile, uploadFiles) => {
  fileList.value = uploadFiles
}

const beforeUpload: UploadProps['beforeUpload'] = (file) => {
  const maxSize = selectedType.value === 'photos' ? 10 * 1024 * 1024 : 5 * 1024 * 1024
  if (file.size > maxSize) {
    ElMessage.warning(`文件 ${file.name} 超过 ${maxSize / 1024 / 1024}MB 限制`)
    return false
  }
  return true
}

const handleUploadSuccess: UploadProps['onSuccess'] = (response, file, files) => {
  console.log('Upload success:', response)
}

const handleUploadError: UploadProps['onError'] = (error, file, files) => {
  console.error('Upload error:', error)
}

const handleUpload = async () => {
  uploading.value = true
  
  try {
    importResult.success = 0
    importResult.failed = 0
    importResult.skipped = 0
    importResult.errors = []

    if (uploadTab.value === 'file') {
      if (fileList.value.length === 0) {
        ElMessage.warning('请先选择文件')
        uploading.value = false
        return
      }

      const formData = new FormData()
      fileList.value.forEach((file, index) => {
        if (file.raw) {
          formData.append(`files`, file.raw)
        }
      })

      let result: any
      switch (selectedType.value) {
        case 'photos':
          result = await importPhotos(formData)
          break
        case 'flight_path':
          result = await importFlightPath(formData)
          break
        case 'alarms':
          result = await importAlarms(formData)
          break
        case 'work_orders':
          result = await importWorkOrders(formData)
          break
      }

      if (result) {
        importResult.success = result.success_count
        importResult.failed = result.failed_count
        importResult.skipped = result.skipped_count
        if (result.errors) {
          importResult.errors = result.errors
        }
      }
    } else {
      if (!jsonForm.json_data) {
        ElMessage.warning('请输入JSON数据')
        uploading.value = false
        return
      }

      let parsedData
      try {
        parsedData = JSON.parse(jsonForm.json_data)
      } catch (e) {
        ElMessage.error('JSON格式错误，请检查')
        uploading.value = false
        return
      }

      ElMessage.info('JSON导入功能正在开发中，建议使用文件上传方式')
      uploading.value = false
      return
    }

    goToStep(2)
  } catch (error: any) {
    ElMessage.error(error.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

const resetImport = () => {
  activeStep.value = 0
  selectedType.value = ''
  uploadTab.value = 'file'
  fileList.value = []
  jsonForm.turbine_id = undefined
  jsonForm.json_data = ''
  importResult.success = 0
  importResult.failed = 0
  importResult.skipped = 0
  importResult.errors = []
}

onMounted(() => {
  fetchTurbines()
})

const fetchTurbines = async () => {
  try {
    const result = await getTurbines({ limit: 1000 })
    turbineList.value = result.items
  } catch (error: any) {
    console.error('Failed to fetch turbines:', error)
  }
}
</script>

<style scoped>
.import-container {
  min-height: 100%;
  padding: 20px;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.step-content {
  padding: 0 20px;
}

.step-title {
  font-size: 16px;
  color: #303133;
  margin-bottom: 24px;
  text-align: center;
}

.data-type-card {
  padding: 24px 16px;
  border: 2px solid #e4e7ed;
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: #fff;
}

.data-type-card:hover {
  border-color: #a0cfff;
  background: #ecf5ff;
}

.data-type-card.active {
  border-color: #409eff;
  background: #ecf5ff;
}

.type-name {
  font-size: 16px;
  font-weight: 600;
  margin-top: 12px;
  color: #303133;
}

.type-desc {
  font-size: 13px;
  color: #909399;
  margin-top: 8px;
}

.step-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 40px;
}

.result-summary {
  text-align: center;
  padding: 40px;
  border-radius: 8px;
}

.result-summary.success {
  background: #f0f9eb;
}

.result-summary.error {
  background: #fef0f0;
}

.result-summary h2 {
  margin-top: 16px;
  color: #303133;
}

.error-list {
  max-height: 300px;
  overflow-y: auto;
}

.error-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f5f7fa;
}

.error-item:last-child {
  border-bottom: none;
}

.error-file {
  font-family: monospace;
  color: #606266;
}

.error-msg {
  color: #f56c6c;
}

.json-textarea :deep(textarea) {
  font-family: monospace;
  font-size: 13px;
  line-height: 1.5;
}
</style>
