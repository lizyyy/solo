<template>
  <div class="import-export">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="导入作品" name="import">
        <el-card class="card-container">
          <template #header>
            <div class="card-header">
              <span>导入作品数据</span>
              <el-tag type="info">支持 CSV 和 JSON 格式</el-tag>
            </div>
          </template>

          <div class="upload-section">
            <el-upload
              class="upload-demo"
              drag
              :auto-upload="false"
              :on-change="handleFileChange"
              :on-exceed="handleExceed"
              :limit="1"
              accept=".csv,.json"
            >
              <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
              <div class="el-upload__text">
                将文件拖到此处，或<em>点击上传</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">
                  只能上传 csv 或 json 文件，最多选择 1 个文件
                </div>
              </template>
            </el-upload>
          </div>

          <div v-if="previewData.length > 0" class="preview-section">
            <el-divider content-position="left">数据预览</el-divider>
            
            <div class="preview-info">
              <el-alert
                :title="`共 ${previewData.length} 条数据待导入`"
                type="info"
                show-icon
                :closable="false"
              >
                <template #default>
                  <div>
                    <p>
                      <span v-if="validCount > 0" style="color: #67C23A;">
                        有效数据: {{ validCount }} 条
                      </span>
                      <span v-if="validCount > 0 && invalidCount > 0" style="margin: 0 12px;">|</span>
                      <span v-if="invalidCount > 0" style="color: #F56C6C;">
                        无效数据: {{ invalidCount }} 条
                      </span>
                    </p>
                    <p v-if="invalidCount > 0" style="color: #F56C6C; margin-top: 8px;">
                      ⚠️ 缺少作品名称的记录将被跳过
                    </p>
                  </div>
                </template>
              </el-alert>
            </div>

            <el-table :data="previewData" style="width: 100%" max-height="400">
              <el-table-column prop="name" label="作品名称" min-width="150">
                <template #default="scope">
                  <span v-if="scope.row.name">{{ scope.row.name }}</span>
                  <span v-else style="color: #F56C6C;">
                    <el-icon><Warning /></el-icon>
                    缺少名称
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="customer_name" label="客户" width="120" />
              <el-table-column prop="clay_name" label="泥料" width="120" />
              <el-table-column prop="glaze_name" label="釉料" width="120" />
              <el-table-column label="尺寸" width="140">
                <template #default="scope">
                  <span v-if="scope.row.width && scope.row.height && scope.row.depth">
                    {{ scope.row.width }}×{{ scope.row.height }}×{{ scope.row.depth }}
                  </span>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column prop="weight" label="重量(kg)" width="100" />
              <el-table-column prop="delivery_date" label="交付日期" width="120" />
              <el-table-column prop="notes" label="备注" min-width="150" show-overflow-tooltip />
            </el-table>

            <div class="import-actions">
              <el-button type="primary" @click="importData" :loading="importing" :disabled="validCount === 0">
                <el-icon><Upload /></el-icon>
                导入数据
              </el-button>
              <el-button @click="clearPreview">
                <el-icon><Close /></el-icon>
                清除
              </el-button>
            </div>
          </div>

          <el-divider content-position="left">导入模板</el-divider>
          <div class="template-section">
            <p>请下载模板文件，按照格式填写后导入：</p>
            <div class="template-buttons">
              <el-button type="primary" size="small" @click="downloadTemplate('csv')">
                <el-icon><Document /></el-icon>
                下载 CSV 模板
              </el-button>
              <el-button type="primary" size="small" @click="downloadTemplate('json')">
                <el-icon><Document /></el-icon>
                下载 JSON 模板
              </el-button>
            </div>
          </div>

          <el-divider content-position="left">数据格式说明</el-divider>
          <div class="format-section">
            <el-table :data="formatColumns" size="small" style="width: 100%">
              <el-table-column prop="field" label="字段名" width="150" />
              <el-table-column prop="required" label="必填" width="80">
                <template #default="scope">
                  <el-tag v-if="scope.row.required" type="danger" size="small">是</el-tag>
                  <el-tag v-else size="small">否</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="description" label="说明" />
            </el-table>
          </div>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="导出作品" name="export">
        <el-card class="card-container">
          <template #header>
            <div class="card-header">
              <span>导出作品数据</span>
              <el-tag type="info">支持 CSV 和 JSON 格式</el-tag>
            </div>
          </template>

          <div class="filter-section">
            <h4 style="margin: 0 0 12px 0;">筛选条件</h4>
            <el-form :inline="true" :model="filters">
              <el-form-item label="状态">
                <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 120px">
                  <el-option label="待排" value="pending" />
                  <el-option label="已入窑" value="in_kiln" />
                  <el-option label="烧成中" value="firing" />
                  <el-option label="已出窑" value="out_kiln" />
                  <el-option label="已交付" value="delivered" />
                  <el-option label="烧制失败" value="failed" />
                </el-select>
              </el-form-item>
              <el-form-item label="客户">
                <el-select v-model="filters.customer_id" placeholder="全部客户" clearable style="width: 150px" filterable>
                  <el-option v-for="c in customers" :key="c.id" :label="c.name" :value="c.id" />
                </el-select>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="loadArtworks">预览数据</el-button>
                <el-button @click="resetFilters">重置</el-button>
              </el-form-item>
            </el-form>
          </div>

          <div v-if="exportData.length > 0" class="preview-section">
            <el-divider content-position="left">数据预览 ({{ exportData.length }} 条)</el-divider>
            
            <el-table :data="exportData" style="width: 100%" max-height="400">
              <el-table-column prop="name" label="作品名称" min-width="150" />
              <el-table-column prop="customer_name" label="客户" width="120" />
              <el-table-column prop="clay_name" label="泥料" width="120" />
              <el-table-column prop="glaze_name" label="釉料" width="120" />
              <el-table-column label="尺寸" width="140">
                <template #default="scope">
                  <span v-if="scope.row.width && scope.row.height && scope.row.depth">
                    {{ scope.row.width }}×{{ scope.row.height }}×{{ scope.row.depth }}
                  </span>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column prop="weight" label="重量(kg)" width="100" />
              <el-table-column prop="delivery_date" label="交付日期" width="120" />
              <el-table-column label="状态" width="100">
                <template #default="scope">
                  {{ getStatusLabel(scope.row.status) }}
                </template>
              </el-table-column>
              <el-table-column prop="notes" label="备注" min-width="120" show-overflow-tooltip />
            </el-table>

            <div class="export-actions">
              <el-button type="primary" @click="exportArtworks('csv')" :loading="exporting">
                <el-icon><Download /></el-icon>
                导出 CSV
              </el-button>
              <el-button type="primary" @click="exportArtworks('json')" :loading="exporting">
                <el-icon><Download /></el-icon>
                导出 JSON
              </el-button>
            </div>
          </div>
          
          <div v-else-if="!loading.artworks" class="empty-state">
            <el-empty description="点击"预览数据"查看可导出的作品" />
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { 
  UploadFilled, Upload, Download, Document, Close, Warning 
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { artworksApi } from '../api/artworks'
import { importExportApi } from '../api/importExport'
import { customersApi } from '../api/customers'

const activeTab = ref('import')

const loading = reactive({
  artworks: false
})

const importing = ref(false)
const exporting = ref(false)

const previewData = ref([])
const exportData = ref([])
const customers = ref([])

const filters = reactive({
  status: '',
  customer_id: null
})

const formatColumns = [
  { field: 'name', required: true, description: '作品名称，必填' },
  { field: 'customer_name', required: false, description: '客户名称' },
  { field: 'clay_name', required: false, description: '泥料名称，系统会尝试匹配已有的泥料' },
  { field: 'glaze_name', required: false, description: '釉料名称，系统会尝试匹配已有的釉料' },
  { field: 'width', required: false, description: '宽度（cm），数字' },
  { field: 'height', required: false, description: '高度（cm），数字' },
  { field: 'depth', required: false, description: '深度（cm），数字' },
  { field: 'weight', required: false, description: '重量（kg），数字' },
  { field: 'delivery_date', required: false, description: '交付日期，格式：YYYY-MM-DD' },
  { field: 'notes', required: false, description: '备注' }
]

const STATUS_LABELS = {
  pending: '待排',
  in_kiln: '已入窑',
  firing: '烧成中',
  out_kiln: '已出窑',
  delivered: '已交付',
  failed: '烧制失败',
  cancelled: '已取消'
}

const validCount = computed(() => {
  return previewData.value.filter(d => d.name && d.name.trim()).length
})

const invalidCount = computed(() => {
  return previewData.value.filter(d => !d.name || !d.name.trim()).length
})

const getStatusLabel = (status) => {
  return STATUS_LABELS[status] || status
}

const handleFileChange = (file) => {
  const reader = new FileReader()
  
  reader.onload = (e) => {
    try {
      const content = e.target.result
      
      if (file.name.endsWith('.json')) {
        const data = JSON.parse(content)
        previewData.value = Array.isArray(data) ? data : [data]
      } else if (file.name.endsWith('.csv')) {
        previewData.value = parseCSV(content)
      }
      
      ElMessage.success(`解析成功，共 ${previewData.value.length} 条数据`)
    } catch (error) {
      ElMessage.error('文件解析失败，请检查文件格式')
      console.error(error)
    }
  }
  
  if (file.name.endsWith('.json')) {
    reader.readAsText(file.raw)
  } else if (file.name.endsWith('.csv')) {
    reader.readAsText(file.raw)
  } else {
    ElMessage.error('不支持的文件格式')
  }
}

const parseCSV = (content) => {
  const lines = content.split('\n')
  if (lines.length < 2) return []
  
  const headers = lines[0].split(',').map(h => h.trim())
  const data = []
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    
    const values = lines[i].split(',')
    const row = {}
    
    headers.forEach((header, index) => {
      const value = values[index]?.trim() || ''
      
      if (['width', 'height', 'depth', 'weight'].includes(header)) {
        row[header] = value ? parseFloat(value) : null
      } else {
        row[header] = value
      }
    })
    
    data.push(row)
  }
  
  return data
}

const handleExceed = () => {
  ElMessage.warning('只能选择一个文件')
}

const importData = async () => {
  importing.value = true
  try {
    const validData = previewData.value.filter(d => d.name && d.name.trim())
    const res = await importExportApi.importArtworks(validData)
    
    if (res.data.success) {
      ElMessage.success(`成功导入 ${res.data.imported} 条数据`)
      previewData.value = []
    } else {
      ElMessage.error(res.data.error || '导入失败')
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '导入失败')
  } finally {
    importing.value = false
  }
}

const clearPreview = () => {
  previewData.value = []
}

const downloadTemplate = (format) => {
  const template = [
    {
      name: '示例作品1',
      customer_name: '张三',
      clay_name: '高白泥',
      glaze_name: '透明釉',
      width: 15,
      height: 20,
      depth: 10,
      weight: 1.5,
      delivery_date: '2026-05-20',
      notes: '需要素烧后再釉烧'
    },
    {
      name: '示例作品2',
      customer_name: '李四',
      clay_name: '紫砂泥',
      glaze_name: '',
      width: 10,
      height: 8,
      depth: 5,
      weight: 0.5,
      delivery_date: '',
      notes: '只需要素烧'
    }
  ]
  
  let content, filename, mimeType
  
  if (format === 'csv') {
    const headers = ['name', 'customer_name', 'clay_name', 'glaze_name', 'width', 'height', 'depth', 'weight', 'delivery_date', 'notes']
    content = headers.join(',') + '\n'
    template.forEach(row => {
      content += headers.map(h => row[h] || '').join(',') + '\n'
    })
    filename = 'artworks_template.csv'
    mimeType = 'text/csv;charset=utf-8'
  } else {
    content = JSON.stringify(template, null, 2)
    filename = 'artworks_template.json'
    mimeType = 'application/json;charset=utf-8'
  }
  
  const blob = new Blob(['\uFEFF' + content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  
  ElMessage.success('模板下载成功')
}

const loadArtworks = async () => {
  loading.artworks = true
  try {
    const params = {}
    if (filters.status) params.status = filters.status
    if (filters.customer_id) params.customer_id = filters.customer_id
    
    const res = await artworksApi.getAll(params)
    exportData.value = res.data
  } catch (error) {
    ElMessage.error('加载数据失败')
  } finally {
    loading.artworks = false
  }
}

const loadCustomers = async () => {
  try {
    const res = await customersApi.getAll()
    customers.value = res.data
  } catch (error) {
    console.error('加载客户失败:', error)
  }
}

const resetFilters = () => {
  filters.status = ''
  filters.customer_id = null
  exportData.value = []
}

const exportArtworks = async (format) => {
  exporting.value = true
  try {
    const res = await importExportApi.exportArtworks({
      status: filters.status || undefined,
      customer_id: filters.customer_id || undefined,
      format
    })
    
    const blob = new Blob(['\uFEFF' + res.data], { 
      type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8' 
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `artworks_${new Date().toISOString().split('T')[0]}.${format}`
    a.click()
    URL.revokeObjectURL(url)
    
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error('导出失败')
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  loadCustomers()
})
</script>

<style scoped>
.import-export {
  min-height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.upload-section {
  margin-bottom: 20px;
}

.upload-demo :deep(.el-upload) {
  width: 100%;
}

.upload-demo :deep(.el-upload-dragger) {
  width: 100%;
}

.filter-section {
  padding: 16px;
  background: #f5f7fa;
  border-radius: 6px;
}

.preview-section {
  margin-top: 20px;
}

.preview-info {
  margin-bottom: 16px;
}

.import-actions, .export-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
}

.template-section {
  margin-top: 12px;
}

.template-buttons {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.format-section {
  margin-top: 12px;
}

.empty-state {
  padding: 40px 0;
}
</style>
