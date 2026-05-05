<template>
  <div>
    <div class="import-section">
      <h3 class="section-title">
        <el-icon style="margin-right: 8px; vertical-align: middle;"><Document /></el-icon>
        导入茶样数据
      </h3>
      <p style="color: #606266; margin-bottom: 16px; font-size: 14px;">
        支持导入 CSV 或 JSON 格式的茶样数据文件，包含盲样编号、批次号、冲泡参数、评委打分等信息。
      </p>
      
      <div class="action-bar">
        <el-upload
          :auto-upload="false"
          :show-file-list="false"
          :on-change="handleFileChange"
          accept=".csv,.json"
        >
          <el-button type="primary" size="large">
            <el-icon style="margin-right: 8px;"><Upload /></el-icon>
            选择数据文件
          </el-button>
        </el-upload>
        <el-button type="info" size="large" @click="showSampleFormat = true">
          <el-icon style="margin-right: 8px;"><QuestionFilled /></el-icon>
          查看示例格式
        </el-button>
      </div>

      <div v-if="selectedFile" style="margin-top: 16px; padding: 12px 16px; background: #ecf5ff; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <el-icon style="margin-right: 8px; color: #409eff;"><Document /></el-icon>
          <span style="font-weight: 500;">{{ selectedFile.name }}</span>
          <el-tag size="small" style="margin-left: 12px;">{{ selectedFileType.toUpperCase() }}</el-tag>
        </div>
        <el-button type="primary" size="small" @click="importDataFile">
          确认导入
        </el-button>
      </div>

      <div v-if="samples.length > 0" style="margin-top: 24px;">
        <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">已导入数据预览 ({{ samples.length }} 条)</h4>
        <el-table :data="samples.slice(0, 10)" stripe border size="small" style="width: 100%;">
          <el-table-column prop="blindNumber" label="盲样编号" width="120" />
          <el-table-column prop="batchNumber" label="批次号" width="150" />
          <el-table-column prop="teaName" label="茶样名称" width="150" />
          <el-table-column prop="brewingWaterTemp" label="水温(°C)" width="100" />
          <el-table-column prop="brewingTime" label="冲泡时间(s)" width="110" />
          <el-table-column prop="teaLeafAmount" label="投茶量(g)" width="100" />
          <el-table-column prop="judgeScore" label="打分" width="80" />
        </el-table>
        <div v-if="samples.length > 10" style="margin-top: 8px; text-align: right;">
          <el-text type="info">仅显示前 10 条，共 {{ samples.length }} 条记录</el-text>
        </div>
      </div>
    </div>

    <div class="import-section">
      <h3 class="section-title">
        <el-icon style="margin-right: 8px; vertical-align: middle;"><Picture /></el-icon>
        导入封样照片
      </h3>
      <p style="color: #606266; margin-bottom: 16px; font-size: 14px;">
        选择包含封样照片的目录，系统将自动扫描目录中的图片文件，并尝试与盲样进行关联。
        建议照片文件名包含盲样编号或批次号以便自动匹配。
      </p>
      
      <div class="action-bar">
        <el-button type="primary" size="large" @click="selectPhotoDirectory">
          <el-icon style="margin-right: 8px;"><FolderOpened /></el-icon>
          选择照片目录
        </el-button>
      </div>

      <div v-if="photoPreviewList.length > 0" style="margin-top: 24px;">
        <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">检测到的照片 ({{ photoPreviewList.length }} 张)</h4>
        <div class="photo-grid">
          <div v-for="photo in photoPreviewList.slice(0, 12)" :key="photo.path" class="photo-item">
            <div v-if="photo.preview" style="width: 100%; height: 120px; display: flex; align-items: center; justify-content: center;">
              <img :src="photo.preview" class="photo-preview" style="max-height: 120px;" />
            </div>
            <div v-else class="photo-placeholder" style="width: 100%; height: 120px;">
              <el-icon :size="40"><Picture /></el-icon>
            </div>
            <div class="photo-name">{{ photo.name }}</div>
          </div>
        </div>
        <div v-if="photoPreviewList.length > 12" style="margin-top: 12px; text-align: right;">
          <el-text type="info">仅显示前 12 张，共 {{ photoPreviewList.length }} 张照片</el-text>
        </div>
        
        <div style="margin-top: 16px; display: flex; justify-content: flex-end;">
          <el-button type="primary" @click="confirmImportPhotos">
            <el-icon style="margin-right: 8px;"><Check /></el-icon>
            导入这些照片
          </el-button>
        </div>
      </div>

      <div v-if="photos.length > 0 && photoPreviewList.length === 0" style="margin-top: 24px;">
        <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">已导入的照片 ({{ photos.length }} 张)</h4>
        <el-table :data="photos" stripe border size="small" style="width: 100%;">
          <el-table-column prop="name" label="文件名" min-width="200" />
          <el-table-column label="大小" width="100">
            <template #default="{ row }">
              {{ formatFileSize(row.size) }}
            </template>
          </el-table-column>
          <el-table-column label="关联状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.linkedSampleId ? 'success' : 'warning'" size="small">
                {{ row.linkedSampleId ? '已关联' : '未关联' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <el-dialog v-model="showSampleFormat" title="数据格式示例" width="700px">
      <el-tabs v-model="activeFormatTab">
        <el-tab-pane label="CSV 格式" name="csv">
          <div class="import-hint">
            <p style="margin-bottom: 8px;"><strong>支持的列名（中文或英文均可）：</strong></p>
            <ul style="margin: 0; padding-left: 20px;">
              <li><code>盲样编号</code> / <code>blindNumber</code> / <code>匿名编号</code></li>
              <li><code>批次号</code> / <code>batchNumber</code> / <code>茶样批次</code></li>
              <li><code>茶名</code> / <code>teaName</code> / <code>茶样名称</code></li>
              <li><code>茶类</code> / <code>teaType</code></li>
              <li><code>产地</code> / <code>origin</code></li>
              <li><code>冲泡水温</code> / <code>brewingWaterTemp</code> / <code>水温</code></li>
              <li><code>冲泡时间</code> / <code>brewingTime</code> / <code>浸泡时间</code></li>
              <li><code>投茶量</code> / <code>teaLeafAmount</code></li>
              <li><code>用水量</code> / <code>waterAmount</code></li>
              <li><code>评委</code> / <code>judgeName</code></li>
              <li><code>评委打分</code> / <code>judgeScore</code> / <code>分数</code></li>
              <li><code>评委评语</code> / <code>judgeRemarks</code></li>
              <li><code>审评日期</code> / <code>sampleDate</code></li>
            </ul>
          </div>
          <pre style="background: #fafafa; padding: 16px; border-radius: 4px; overflow-x: auto; font-size: 12px; margin-top: 16px;">盲样编号,批次号,茶名,茶类,产地,冲泡水温,冲泡时间,投茶量,评委,评委打分
B001,20240101-01,西湖龙井,绿茶,杭州,90,180,5,张评委,92
B002,20240101-02,铁观音,乌龙茶,安溪,95,120,7,李评委,88
B003,20240101-03,大红袍,乌龙茶,武夷山,100,60,8,王评委,95</pre>
        </el-tab-pane>
        <el-tab-pane label="JSON 格式" name="json">
          <div class="import-hint">
            <p style="margin-bottom: 8px;"><strong>支持的字段（中文或英文均可）：</strong></p>
            <p>字段名与 CSV 格式相同，可使用对象数组或包含 <code>samples</code> 字段的对象。</p>
          </div>
          <pre style="background: #fafafa; padding: 16px; border-radius: 4px; overflow-x: auto; font-size: 12px; margin-top: 16px;">[
  {
    "盲样编号": "B001",
    "批次号": "20240101-01",
    "茶名": "西湖龙井",
    "茶类": "绿茶",
    "产地": "杭州",
    "冲泡水温": 90,
    "冲泡时间": 180,
    "投茶量": 5,
    "评委": "张评委",
    "评委打分": 92
  }
]</pre>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <el-button @click="showSampleFormat = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  samples: {
    type: Array,
    default: () => []
  },
  photos: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['importSamples', 'importPhotos'])

const electronAPI = window.electronAPI || {}

const selectedFile = ref(null)
const selectedFileType = ref('')
const showSampleFormat = ref(false)
const activeFormatTab = ref('csv')
const photoPreviewList = ref([])
const pendingPhotoImport = ref([])

const handleFileChange = (file) => {
  const fileName = file.name.toLowerCase()
  if (fileName.endsWith('.csv')) {
    selectedFileType.value = 'csv'
  } else if (fileName.endsWith('.json')) {
    selectedFileType.value = 'json'
  } else {
    ElMessage.error('不支持的文件格式，请选择 CSV 或 JSON 文件')
    return
  }
  selectedFile.value = file.raw
}

const importDataFile = async () => {
  if (!selectedFile.value) return

  try {
    const filePath = selectedFile.value.path
    emit('importSamples', filePath, selectedFileType.value)
    selectedFile.value = null
  } catch (error) {
    ElMessage.error(`读取文件失败: ${error.message}`)
  }
}

const selectPhotoDirectory = async () => {
  try {
    const result = await electronAPI.selectDirectory()
    if (result && result.length > 0) {
      const dirPath = result[0]
      await scanPhotoDirectory(dirPath)
    }
  } catch (error) {
    ElMessage.error(`选择目录失败: ${error.message}`)
  }
}

const scanPhotoDirectory = async (dirPath) => {
  try {
    const result = await electronAPI.listDirectory(dirPath)
    if (!result.success) {
      throw new Error(result.error)
    }

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
    const imageFiles = result.data.filter(file => {
      if (!file.isFile) return false
      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
      return imageExtensions.includes(ext)
    })

    if (imageFiles.length === 0) {
      ElMessage.info('该目录下没有找到图片文件')
      return
    }

    pendingPhotoImport.value = imageFiles
    
    photoPreviewList.value = []
    for (const file of imageFiles.slice(0, 12)) {
      const preview = await loadPhotoPreview(file.path)
      photoPreviewList.value.push({
        ...file,
        preview
      })
    }

    ElMessage.success(`检测到 ${imageFiles.length} 张图片`)
  } catch (error) {
    ElMessage.error(`扫描目录失败: ${error.message}`)
  }
}

const loadPhotoPreview = async (filePath) => {
  try {
    const result = await electronAPI.getImageBase64(filePath)
    if (result.success) {
      return result.data
    }
  } catch (error) {
    console.error('加载预览失败:', error)
  }
  return null
}

const confirmImportPhotos = () => {
  if (pendingPhotoImport.value.length === 0) {
    ElMessage.warning('没有可导入的照片')
    return
  }
  emit('importPhotos', pendingPhotoImport.value)
  photoPreviewList.value = []
  pendingPhotoImport.value = []
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>
