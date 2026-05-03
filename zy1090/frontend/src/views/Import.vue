<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">数据导入</h2>
    </div>

    <el-tabs v-model="activeTab" type="border-card">
      <el-tab-pane label="材料导入" name="material">
        <div class="import-section">
          <h4 class="form-section-title">导入说明</h4>
          <p style="color: #606266; margin-bottom: 16px">
            支持 CSV 和 JSON 格式导入材料数据。导入前请确保数据格式正确。
          </p>

          <el-alert
            title="CSV 格式示例"
            type="info"
            :closable="false"
            style="margin-bottom: 16px"
          >
            <div class="template-example">
name,categoryId,unit,description,safetyStock,allergens
大豆蜡,1,g,天然大豆蜡,50,
薰衣草香精,2,ml,进口薰衣草香精,10,fragrance
玻璃杯,3,piece,100ml 耐热玻璃杯,20,
            </div>
          </el-alert>

          <el-alert
            title="JSON 格式示例"
            type="info"
            :closable="false"
            style="margin-bottom: 16px"
          >
            <div class="template-example">
[
  {
    "name": "大豆蜡",
    "categoryId": 1,
    "unit": "g",
    "description": "天然大豆蜡",
    "safetyStock": 50,
    "allergens": []
  },
  {
    "name": "薰衣草香精",
    "categoryId": 2,
    "unit": "ml",
    "description": "进口薰衣草香精",
    "safetyStock": 10,
    "allergens": ["fragrance"]
  }
]
            </div>
          </el-alert>

          <el-upload
            :action="apiBase + '/import/materials'"
            :headers="uploadHeaders"
            :on-success="handleMaterialUploadSuccess"
            :on-error="handleUploadError"
            :before-upload="beforeMaterialUpload"
            :show-file-list="false"
            :auto-upload="false"
            ref="materialUploadRef"
            accept=".csv,.json"
          >
            <el-button type="primary">
              <el-icon><Upload /></el-icon> 选择文件
            </el-button>
            <span style="margin-left: 12px; color: #909399">{{ materialFileName || '未选择文件' }}</span>
          </el-upload>

          <div v-if="materialUploadResult" style="margin-top: 20px">
            <el-alert
              :title="`导入成功：${materialUploadResult.success} 条`"
              type="success"
              :closable="false"
              style="margin-bottom: 8px"
            />
            <el-alert
              v-if="materialUploadResult.failed > 0"
              :title="`导入失败：${materialUploadResult.failed} 条`"
              type="warning"
              :closable="false"
            >
              <div v-for="(err, idx) in materialUploadResult.errors" :key="idx" class="danger-text">
                行 {{ err.row }}: {{ err.message }}
              </div>
            </el-alert>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="材料批次导入" name="materialBatch">
        <div class="import-section">
          <h4 class="form-section-title">导入说明</h4>
          <p style="color: #606266; margin-bottom: 16px">
            支持 CSV 和 JSON 格式导入材料批次数据。
          </p>

          <el-alert
            title="CSV 格式示例"
            type="info"
            :closable="false"
            style="margin-bottom: 16px"
          >
            <div class="template-example">
materialId,batchNo,supplierId,purchaseDate,originalQuantity,unit,unitCost,safetyStock,expiryDate,allergens
1,20240101001,1,2024-01-01,5000,g,0.05,100,2025-01-01,
2,20240101002,2,2024-01-01,1000,ml,0.8,50,2024-12-31,fragrance
            </div>
          </el-alert>

          <el-alert
            title="JSON 格式示例"
            type="info"
            :closable="false"
            style="margin-bottom: 16px"
          >
            <div class="template-example">
[
  {
    "materialId": 1,
    "batchNo": "20240101001",
    "supplierId": 1,
    "purchaseDate": "2024-01-01",
    "originalQuantity": 5000,
    "unit": "g",
    "unitCost": 0.05,
    "safetyStock": 100,
    "expiryDate": "2025-01-01",
    "allergens": []
  }
]
            </div>
          </el-alert>

          <el-upload
            :action="apiBase + '/import/material-batches'"
            :headers="uploadHeaders"
            :on-success="handleBatchUploadSuccess"
            :on-error="handleUploadError"
            :before-upload="beforeBatchUpload"
            :show-file-list="false"
            :auto-upload="false"
            ref="batchUploadRef"
            accept=".csv,.json"
          >
            <el-button type="primary">
              <el-icon><Upload /></el-icon> 选择文件
            </el-button>
            <span style="margin-left: 12px; color: #909399">{{ batchFileName || '未选择文件' }}</span>
          </el-upload>

          <div v-if="batchUploadResult" style="margin-top: 20px">
            <el-alert
              :title="`导入成功：${batchUploadResult.success} 条`"
              type="success"
              :closable="false"
              style="margin-bottom: 8px"
            />
            <el-alert
              v-if="batchUploadResult.failed > 0"
              :title="`导入失败：${batchUploadResult.failed} 条`"
              type="warning"
              :closable="false"
            >
              <div v-for="(err, idx) in batchUploadResult.errors" :key="idx" class="danger-text">
                行 {{ err.row }}: {{ err.message }}
              </div>
            </el-alert>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="下载模板" name="template">
        <div class="import-section">
          <h4 class="form-section-title">下载导入模板</h4>
          <p style="color: #606266; margin-bottom: 20px">
            下载标准模板文件，按照模板格式整理数据后导入。
          </p>

          <el-descriptions :column="1" border>
            <el-descriptions-item label="材料导入模板">
              <el-button type="primary" link @click="downloadTemplate('material', 'csv')">
                <el-icon><Download /></el-icon> 下载 CSV 模板
              </el-button>
              <el-button type="primary" link @click="downloadTemplate('material', 'json')">
                <el-icon><Download /></el-icon> 下载 JSON 模板
              </el-button>
            </el-descriptions-item>
            <el-descriptions-item label="材料批次导入模板">
              <el-button type="primary" link @click="downloadTemplate('materialBatch', 'csv')">
                <el-icon><Download /></el-icon> 下载 CSV 模板
              </el-button>
              <el-button type="primary" link @click="downloadTemplate('materialBatch', 'json')">
                <el-icon><Download /></el-icon> 下载 JSON 模板
              </el-button>
            </el-descriptions-item>
          </el-descriptions>

          <div v-if="templates" style="margin-top: 20px">
            <el-divider>模板字段说明</el-divider>
            
            <h4 class="form-section-title">材料字段说明</h4>
            <el-table :data="templateFieldList('material')" border size="small">
              <el-table-column prop="name" label="字段名" width="150" />
              <el-table-column prop="type" label="类型" width="100" />
              <el-table-column prop="required" label="必填" width="80">
                <template #default="{ row }">
                  <el-tag v-if="row.required" type="danger" size="small">是</el-tag>
                  <span v-else style="color: #909399">否</span>
                </template>
              </el-table-column>
              <el-table-column prop="description" label="说明" />
            </el-table>

            <h4 class="form-section-title" style="margin-top: 24px">材料批次字段说明</h4>
            <el-table :data="templateFieldList('materialBatch')" border size="small">
              <el-table-column prop="name" label="字段名" width="180" />
              <el-table-column prop="type" label="类型" width="100" />
              <el-table-column prop="required" label="必填" width="80">
                <template #default="{ row }">
                  <el-tag v-if="row.required" type="danger" size="small">是</el-tag>
                  <span v-else style="color: #909399">否</span>
                </template>
              </el-table-column>
              <el-table-column prop="description" label="说明" />
            </el-table>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { importAPI } from '@/api'

const activeTab = ref('material')
const templates = ref(null)

const materialFileName = ref('')
const materialUploadResult = ref(null)
const materialUploadRef = ref(null)

const batchFileName = ref('')
const batchUploadResult = ref(null)
const batchUploadRef = ref(null)

const apiBase = '/api'
const uploadHeaders = {}

const loadTemplates = async () => {
  try {
    const res = await importAPI.templates()
    templates.value = res.data
  } catch (e) {
    console.error('加载模板失败', e)
  }
}

const templateFieldList = (type) => {
  if (!templates.value) return []
  const fields = type === 'material' 
    ? templates.value.material?.fields 
    : templates.value.materialBatch?.fields
  return fields || []
}

const beforeMaterialUpload = (file) => {
  const isValid = file.name.endsWith('.csv') || file.name.endsWith('.json')
  if (!isValid) {
    ElMessage.error('只支持 CSV 和 JSON 格式文件')
    return false
  }
  materialFileName.value = file.name
  materialUploadResult.value = null
  
  const formData = new FormData()
  formData.append('file', file)
  importAPI.materials(formData).then(res => {
    materialUploadResult.value = res.data
    if (res.data.success > 0) {
      ElMessage.success(`成功导入 ${res.data.success} 条数据`)
    }
  }).catch(e => {
    ElMessage.error('导入失败')
  })
  
  return false
}

const beforeBatchUpload = (file) => {
  const isValid = file.name.endsWith('.csv') || file.name.endsWith('.json')
  if (!isValid) {
    ElMessage.error('只支持 CSV 和 JSON 格式文件')
    return false
  }
  batchFileName.value = file.name
  batchUploadResult.value = null
  
  const formData = new FormData()
  formData.append('file', file)
  importAPI.materialBatches(formData).then(res => {
    batchUploadResult.value = res.data
    if (res.data.success > 0) {
      ElMessage.success(`成功导入 ${res.data.success} 条数据`)
    }
  }).catch(e => {
    ElMessage.error('导入失败')
  })
  
  return false
}

const handleMaterialUploadSuccess = (response) => {
  materialUploadResult.value = response
  if (response.success > 0) {
    ElMessage.success(`成功导入 ${response.success} 条数据`)
  }
}

const handleBatchUploadSuccess = (response) => {
  batchUploadResult.value = response
  if (response.success > 0) {
    ElMessage.success(`成功导入 ${response.success} 条数据`)
  }
}

const handleUploadError = (error) => {
  ElMessage.error('导入失败：' + (error.message || '未知错误'))
}

const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const downloadTemplate = (type, format) => {
  if (!templates.value) {
    ElMessage.warning('模板数据加载中，请稍后重试')
    return
  }
  
  const template = type === 'material' 
    ? templates.value.material 
    : templates.value.materialBatch
  
  if (!template) return
  
  const content = format === 'csv' ? template.csvExample : template.jsonExample
  const mimeType = format === 'csv' ? 'text/csv' : 'application/json'
  const ext = format === 'csv' ? 'csv' : 'json'
  const name = type === 'material' ? '材料' : '材料批次'
  
  downloadFile(content, `${name}导入模板.${ext}`, mimeType)
  ElMessage.success('模板下载成功')
}

onMounted(() => {
  loadTemplates()
})
</script>
