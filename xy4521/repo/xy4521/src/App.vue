<template>
  <div class="layout-container">
    <header class="header-bar">
      <div class="app-title">
        <el-icon :size="24" style="margin-right: 8px; vertical-align: middle;">
          <DocumentChecked />
        </el-icon>
        茶叶审评盲样核对工具
      </div>
      <div class="app-info">
        <span style="margin-right: 20px;">
          数据文件: {{ dataFilePath || '未保存' }}
        </span>
        <el-button type="primary" size="small" @click="saveAllData" :loading="saving">
          <el-icon><Save /></el-icon>
          保存数据
        </el-button>
      </div>
    </header>

    <div style="display: flex; flex: 1; overflow: hidden;">
      <el-menu
        :default-active="activeMenu"
        class="sidebar-menu"
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409eff"
        @select="handleMenuSelect"
      >
        <el-menu-item index="dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <span>数据概览</span>
        </el-menu-item>
        <el-menu-item index="import">
          <el-icon><Upload /></el-icon>
          <span>导入数据</span>
        </el-menu-item>
        <el-menu-item index="samples">
          <el-icon><List /></el-icon>
          <span>盲样列表</span>
        </el-menu-item>
        <el-menu-item index="risks">
          <el-icon><Warning /></el-icon>
          <span>风险检测</span>
        </el-menu-item>
        <el-menu-item index="export">
          <el-icon><Download /></el-icon>
          <span>导出数据</span>
        </el-menu-item>
      </el-menu>

      <div class="content-wrapper">
        <DashboardView
          v-if="activeMenu === 'dashboard'"
          :samples="samples"
          :risks="risks"
          :review-status="reviewStatus"
        />
        <ImportView
          v-else-if="activeMenu === 'import'"
          @import-samples="handleImportSamples"
          @import-photos="handleImportPhotos"
          :samples="samples"
          :photos="photos"
        />
        <SamplesView
          v-else-if="activeMenu === 'samples'"
          :samples="samples"
          :photos="photos"
          :risks="risks"
          :remarks="remarks"
          @update-remark="handleUpdateRemark"
          @update-status="handleUpdateStatus"
        />
        <RisksView
          v-else-if="activeMenu === 'risks'"
          :risks="risks"
          :samples="samples"
        />
        <ExportView
          v-else-if="activeMenu === 'export'"
          :samples="samples"
          :risks="risks"
          :remarks="remarks"
          :review-status="reviewStatus"
          :photos="photos"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import DashboardView from './views/DashboardView.vue'
import ImportView from './views/ImportView.vue'
import SamplesView from './views/SamplesView.vue'
import RisksView from './views/RisksView.vue'
import ExportView from './views/ExportView.vue'
import { detectRisks } from './utils/riskDetector'
import { parseCSV, parseJSON } from './utils/dataParser'

const activeMenu = ref('dashboard')
const samples = ref([])
const photos = ref([])
const risks = ref([])
const remarks = ref({})
const reviewStatus = ref({})
const dataFilePath = ref('')
const saving = ref(false)

const electronAPI = window.electronAPI || {}

const handleMenuSelect = (index) => {
  activeMenu.value = index
}

const handleImportSamples = async (filePath, fileType) => {
  try {
    const result = await electronAPI.readFile(filePath)
    if (!result.success) {
      throw new Error(result.error)
    }

    let parsedData
    if (fileType === 'csv') {
      parsedData = parseCSV(result.data)
    } else if (fileType === 'json') {
      parsedData = parseJSON(result.data)
    }

    if (!parsedData || parsedData.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }

    const newSamples = parsedData.map((item, index) => ({
      id: `sample_${Date.now()}_${index}`,
      blindNumber: item.blindNumber || item.盲样编号 || item.匿名编号 || `B${String(index + 1).padStart(3, '0')}`,
      batchNumber: item.batchNumber || item.批次号 || item.茶样批次 || '',
      teaName: item.teaName || item.茶名 || item.茶样名称 || '',
      teaType: item.teaType || item.茶类 || item.茶叶类型 || '',
      origin: item.origin || item.产地 || '',
      brewingWaterTemp: item.brewingWaterTemp || item.冲泡水温 || item.水温 || null,
      brewingTime: item.brewingTime || item.冲泡时间 || item.浸泡时间 || null,
      teaLeafAmount: item.teaLeafAmount || item.投茶量 || item.用茶量 || null,
      waterAmount: item.waterAmount || item.用水量 || null,
      judgeName: item.judgeName || item.评委姓名 || item.评委 || '',
      judgeScore: item.judgeScore || item.评委打分 || item.分数 || null,
      judgeRemarks: item.judgeRemarks || item.评委评语 || '',
      sampleDate: item.sampleDate || item.审评日期 || item.日期 || null,
      importedAt: new Date().toISOString(),
      photoIds: []
    }))

    samples.value = [...samples.value, ...newSamples]
    updateRisks()
    ElMessage.success(`成功导入 ${newSamples.length} 条茶样数据`)
  } catch (error) {
    ElMessage.error(`导入失败: ${error.message}`)
  }
}

const handleImportPhotos = async (photoList) => {
  const existingNames = new Set(photos.value.map(p => p.name))
  const newPhotos = []

  for (const photo of photoList) {
    if (!existingNames.has(photo.name)) {
      const photoItem = {
        id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: photo.name,
        path: photo.path,
        size: photo.size,
        mtime: photo.mtime,
        importedAt: new Date().toISOString(),
        linkedSampleId: null
      }
      newPhotos.push(photoItem)
      existingNames.add(photo.name)
    }
  }

  if (newPhotos.length > 0) {
    photos.value = [...photos.value, ...newPhotos]
    autoLinkPhotos()
    updateRisks()
    ElMessage.success(`成功导入 ${newPhotos.length} 张照片`)
  } else {
    ElMessage.info('没有新的照片需要导入')
  }
}

const autoLinkPhotos = () => {
  samples.value.forEach(sample => {
    const matchingPhotos = photos.value.filter(photo => {
      const sampleKeywords = [sample.blindNumber, sample.batchNumber, sample.teaName]
        .filter(Boolean)
        .map(k => k.toLowerCase())
      
      const photoName = photo.name.toLowerCase()
      return sampleKeywords.some(keyword => photoName.includes(keyword))
    })

    matchingPhotos.forEach(photo => {
      if (!photo.linkedSampleId) {
        photo.linkedSampleId = sample.id
        if (!sample.photoIds.includes(photo.id)) {
          sample.photoIds.push(photo.id)
        }
      }
    })
  })
}

const handleUpdateRemark = (sampleId, remark) => {
  remarks.value[sampleId] = {
    content: remark,
    updatedAt: new Date().toISOString()
  }
}

const handleUpdateStatus = (sampleId, status) => {
  reviewStatus.value[sampleId] = {
    status: status,
    updatedAt: new Date().toISOString()
  }
}

const updateRisks = () => {
  risks.value = detectRisks(samples.value, photos.value)
}

const saveAllData = async () => {
  saving.value = true
  try {
    const data = {
      samples: samples.value,
      photos: photos.value,
      remarks: remarks.value,
      reviewStatus: reviewStatus.value,
      risks: risks.value,
      savedAt: new Date().toISOString()
    }

    const result = await electronAPI.saveLocalData(data)
    if (result.success) {
      const filePath = await electronAPI.getDataFilePath()
      dataFilePath.value = filePath
      ElMessage.success('数据保存成功')
    } else {
      throw new Error(result.error)
    }
  } catch (error) {
    ElMessage.error(`保存失败: ${error.message}`)
  } finally {
    saving.value = false
  }
}

const loadLocalData = async () => {
  try {
    const result = await electronAPI.loadLocalData()
    if (result.success && result.data) {
      const data = result.data
      samples.value = data.samples || []
      photos.value = data.photos || []
      remarks.value = data.remarks || {}
      reviewStatus.value = data.reviewStatus || {}
      updateRisks()
      
      const filePath = await electronAPI.getDataFilePath()
      dataFilePath.value = filePath
    }
  } catch (error) {
    console.error('加载本地数据失败:', error)
  }
}

watch([samples, photos, remarks, reviewStatus], () => {
  updateRisks()
}, { deep: true })

onMounted(() => {
  loadLocalData()
})
</script>
