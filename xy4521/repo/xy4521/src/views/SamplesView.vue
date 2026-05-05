<template>
  <div>
    <div class="filter-bar">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索盲样编号、批次号、茶名..."
        style="width: 300px;"
        clearable
        prefix-icon="Search"
      />
      <el-select v-model="filterRisk" placeholder="风险等级" clearable style="width: 150px;">
        <el-option label="高风险" value="high" />
        <el-option label="中风险" value="medium" />
        <el-option label="低风险" value="low" />
        <el-option label="无风险" value="none" />
      </el-select>
      <el-select v-model="filterStatus" placeholder="复核状态" clearable style="width: 150px;">
        <el-option label="待复核" value="pending" />
        <el-option label="复核中" value="reviewing" />
        <el-option label="已完成" value="completed" />
      </el-select>
      <el-button type="primary" @click="resetFilters">
        <el-icon style="margin-right: 6px;"><Refresh /></el-icon>
        重置
      </el-button>
    </div>

    <el-table 
      :data="filteredSamples" 
      stripe 
      border 
      v-loading="loading"
      :row-class-name="getTableRowClass"
      @row-click="handleRowClick"
      highlight-current-row
      style="width: 100%;"
    >
      <el-table-column type="index" label="序号" width="60" align="center" />
      <el-table-column prop="blindNumber" label="盲样编号" width="120" fixed="left">
        <template #default="{ row }">
          <span style="font-weight: 600; font-size: 15px;">{{ row.blindNumber || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="batchNumber" label="批次号" width="160" />
      <el-table-column prop="teaName" label="茶样名称" min-width="150" />
      <el-table-column prop="teaType" label="茶类" width="100" />
      <el-table-column prop="brewingWaterTemp" label="水温(°C)" width="100" align="center" />
      <el-table-column prop="brewingTime" label="冲泡时间(s)" width="110" align="center" />
      <el-table-column prop="teaLeafAmount" label="投茶量(g)" width="100" align="center" />
      <el-table-column prop="judgeName" label="评委" width="100" />
      <el-table-column prop="judgeScore" label="打分" width="80" align="center">
        <template #default="{ row }">
          <span v-if="row.judgeScore !== null && row.judgeScore !== undefined" :style="{ color: row.judgeScore >= 90 ? '#67c23a' : row.judgeScore >= 80 ? '#e6a23c' : '#f56c6c' }">
            {{ row.judgeScore }}
          </span>
          <span v-else style="color: #c0c4cc;">-</span>
        </template>
      </el-table-column>
      <el-table-column label="照片" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="getSamplePhotos(row).length > 0 ? 'success' : 'danger'" size="small">
            {{ getSamplePhotos(row).length }} 张
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="风险" width="100" align="center">
        <template #default="{ row }">
          <el-tag v-if="getSampleRiskLevel(row) === 'high'" type="danger" size="small">高风险</el-tag>
          <el-tag v-else-if="getSampleRiskLevel(row) === 'medium'" type="warning" size="small">中风险</el-tag>
          <el-tag v-else-if="getSampleRiskLevel(row) === 'low'" type="success" size="small">低风险</el-tag>
          <el-tag v-else type="info" size="small">无风险</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="复核状态" width="100" align="center">
        <template #default="{ row }">
          <span :class="getStatusClass(row)">
            {{ getStatusText(row) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right" align="center">
        <template #default="{ row }">
          <el-button type="primary" size="small" link @click.stop="openDetailDialog(row)">
            详情
          </el-button>
          <el-button type="warning" size="small" link @click.stop="showRemarkDialog(row)">
            备注
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-if="filteredSamples.length > 0"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
      :current-page="currentPage"
      :page-sizes="[10, 20, 50, 100]"
      :page-size="pageSize"
      layout="total, sizes, prev, pager, next, jumper"
      :total="filteredSamples.length"
      style="margin-top: 20px; justify-content: flex-end;"
    />

    <el-dialog v-model="detailDialogVisible" title="盲样详情" width="900px">
      <div v-if="currentSample">
        <el-descriptions :column="3" border>
          <el-descriptions-item label="盲样编号">{{ currentSample.blindNumber || '-' }}</el-descriptions-item>
          <el-descriptions-item label="批次号">{{ currentSample.batchNumber || '-' }}</el-descriptions-item>
          <el-descriptions-item label="茶样名称">{{ currentSample.teaName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="茶类">{{ currentSample.teaType || '-' }}</el-descriptions-item>
          <el-descriptions-item label="产地">{{ currentSample.origin || '-' }}</el-descriptions-item>
          <el-descriptions-item label="审评日期">{{ currentSample.sampleDate || '-' }}</el-descriptions-item>
          <el-descriptions-item label="冲泡水温" :span="1">{{ currentSample.brewingWaterTemp ? `${currentSample.brewingWaterTemp}°C` : '-' }}</el-descriptions-item>
          <el-descriptions-item label="冲泡时间" :span="1">{{ currentSample.brewingTime ? `${currentSample.brewingTime}秒` : '-' }}</el-descriptions-item>
          <el-descriptions-item label="投茶量" :span="1">{{ currentSample.teaLeafAmount ? `${currentSample.teaLeafAmount}g` : '-' }}</el-descriptions-item>
          <el-descriptions-item label="评委">{{ currentSample.judgeName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="评委打分">{{ currentSample.judgeScore !== null && currentSample.judgeScore !== undefined ? currentSample.judgeScore : '-' }}</el-descriptions-item>
          <el-descriptions-item label="用水量">{{ currentSample.waterAmount ? `${currentSample.waterAmount}ml` : '-' }}</el-descriptions-item>
          <el-descriptions-item label="评委评语" :span="3">{{ currentSample.judgeRemarks || '-' }}</el-descriptions-item>
        </el-descriptions>

        <div class="risk-section" style="margin-top: 24px;">
          <h4 class="section-title">
            <el-icon style="margin-right: 6px; vertical-align: middle;"><Warning /></el-icon>
            风险检测
          </h4>
          <div v-if="getSampleRisks(currentSample).length > 0">
            <div v-for="risk in getSampleRisks(currentSample)" :key="risk.id" 
                 class="risk-evidence-item"
                 :class="`risk-evidence-${risk.level}`">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong>{{ risk.title }}</strong>
                <el-tag :type="getRiskTagType(risk.level)" size="small">
                  {{ getRiskLevelText(risk.level) }}
                </el-tag>
              </div>
              <p style="margin: 0 0 8px 0; font-size: 13px;">{{ risk.description }}</p>
              <div style="background: rgba(255,255,255,0.5); padding: 8px 12px; border-radius: 4px;">
                <div style="font-size: 12px; font-weight: 500; margin-bottom: 4px;">风险证据:</div>
                <ul style="margin: 0; padding-left: 18px;">
                  <li v-for="(evidence, idx) in risk.evidence" :key="idx" style="font-size: 12px; margin: 2px 0;">
                    {{ evidence }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div v-else class="empty-state" style="padding: 30px;">
            <el-icon :size="40" style="color: #67c23a;"><CircleCheck /></el-icon>
            <div style="margin-top: 8px; color: #67c23a;">该盲样无风险</div>
          </div>
        </div>

        <div class="risk-section" style="margin-top: 24px;">
          <h4 class="section-title">
            <el-icon style="margin-right: 6px; vertical-align: middle;"><Picture /></el-icon>
            封样照片 ({{ getSamplePhotos(currentSample).length }} 张)
          </h4>
          <div v-if="getSamplePhotos(currentSample).length > 0" class="photo-grid">
            <div v-for="photo in getSamplePhotos(currentSample)" :key="photo.id" class="photo-item">
              <div style="width: 100%; height: 120px; display: flex; align-items: center; justify-content: center;">
                <img 
                  :src="photo.preview || ''" 
                  class="photo-preview" 
                  style="max-height: 120px; cursor: pointer;"
                  @click="showPhotoPreview(photo)"
                />
              </div>
              <div class="photo-name">{{ photo.name }}</div>
            </div>
          </div>
          <div v-else class="empty-state" style="padding: 30px;">
            <el-icon :size="40" style="color: #f56c6c;"><PictureFilled /></el-icon>
            <div style="margin-top: 8px; color: #f56c6c;">暂无封样照片</div>
          </div>
        </div>

        <div class="remark-section">
          <div class="remark-header">
            <h4 class="remark-title">
              <el-icon style="margin-right: 6px; vertical-align: middle;"><EditPen /></el-icon>
              复核状态与备注
            </h4>
            <el-select v-model="currentStatus" @change="handleStatusChange" size="small" style="width: 140px;">
              <el-option label="待复核" value="pending" />
              <el-option label="复核中" value="reviewing" />
              <el-option label="已完成" value="completed" />
            </el-select>
          </div>
          <el-input
            v-model="currentRemark"
            type="textarea"
            :rows="4"
            placeholder="输入人工复核备注信息..."
            class="remark-textarea"
          />
          <div style="margin-top: 12px; text-align: right;">
            <el-button type="primary" size="small" @click="saveRemark">
              <el-icon style="margin-right: 6px;"><Check /></el-icon>
              保存备注
            </el-button>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="remarkDialogVisible" title="人工复核备注" width="600px">
      <div v-if="currentSample">
        <div style="margin-bottom: 16px;">
          <el-tag type="primary" size="large">
            盲样: {{ currentSample.blindNumber || '未知' }}
          </el-tag>
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 500;">复核状态:</label>
          <el-select v-model="currentStatus" style="width: 100%;">
            <el-option label="待复核" value="pending" />
            <el-option label="复核中" value="reviewing" />
            <el-option label="已完成" value="completed" />
          </el-select>
        </div>
        <div>
          <label style="display: block; margin-bottom: 8px; font-weight: 500;">备注内容:</label>
          <el-input
            v-model="currentRemark"
            type="textarea"
            :rows="6"
            placeholder="输入人工复核备注信息..."
            class="remark-textarea"
          />
        </div>
      </div>
      <template #footer>
        <el-button @click="remarkDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRemarkAndClose">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="photoPreviewVisible" title="照片预览" width="800px">
      <div v-if="previewPhoto" style="text-align: center;">
        <img 
          :src="previewPhoto.preview || ''" 
          style="max-width: 100%; max-height: 500px;"
        />
        <div style="margin-top: 12px; color: #606266;">
          {{ previewPhoto.name }}
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getRiskLevelText, RISK_LEVELS } from '../utils/riskDetector'

const props = defineProps({
  samples: {
    type: Array,
    default: () => []
  },
  photos: {
    type: Array,
    default: () => []
  },
  risks: {
    type: Array,
    default: () => []
  },
  remarks: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['updateRemark', 'updateStatus'])

const electronAPI = window.electronAPI || {}

const searchKeyword = ref('')
const filterRisk = ref('')
const filterStatus = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const loading = ref(false)

const detailDialogVisible = ref(false)
const remarkDialogVisible = ref(false)
const photoPreviewVisible = ref(false)
const currentSample = ref(null)
const currentRemark = ref('')
const currentStatus = ref('pending')
const previewPhoto = ref(null)

const filteredSamples = computed(() => {
  let result = [...props.samples]

  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(sample => 
      (sample.blindNumber && sample.blindNumber.toString().toLowerCase().includes(keyword)) ||
      (sample.batchNumber && sample.batchNumber.toString().toLowerCase().includes(keyword)) ||
      (sample.teaName && sample.teaName.toString().toLowerCase().includes(keyword))
    )
  }

  if (filterRisk.value) {
    if (filterRisk.value === 'none') {
      result = result.filter(sample => getSampleRiskLevel(sample) === null)
    } else {
      result = result.filter(sample => getSampleRiskLevel(sample) === filterRisk.value)
    }
  }

  if (filterStatus.value) {
    result = result.filter(sample => {
      const status = props.remarks[sample.id]?.status || 
                     props.remarks[sample.id] ||
                     'pending'
      return status === filterRisk.value || 
             (props.remarks[sample.id]?.status === filterStatus.value)
    })
  }

  return result
})

const getSamplePhotos = (sample) => {
  const linkedPhotos = props.photos.filter(p => 
    p.linkedSampleId === sample.id || 
    (sample.photoIds && sample.photoIds.includes(p.id))
  )
  return linkedPhotos
}

const getSampleRisks = (sample) => {
  return props.risks.filter(risk => 
    risk.sampleIds && risk.sampleIds.includes(sample.id)
  )
}

const getSampleRiskLevel = (sample) => {
  const sampleRisks = getSampleRisks(sample)
  if (sampleRisks.length === 0) return null

  if (sampleRisks.some(r => r.level === RISK_LEVELS.HIGH)) return 'high'
  if (sampleRisks.some(r => r.level === RISK_LEVELS.MEDIUM)) return 'medium'
  if (sampleRisks.some(r => r.level === RISK_LEVELS.LOW)) return 'low'

  return null
}

const getTableRowClass = ({ row }) => {
  const level = getSampleRiskLevel(row)
  if (level === 'high') return 'risk-high'
  if (level === 'medium') return 'risk-medium'
  if (level === 'low') return 'risk-low'
  return ''
}

const getStatusText = (sample) => {
  const status = props.remarks[sample.id]?.status || 
                 (props.remarks[sample.id] && typeof props.remarks[sample.id] === 'object' ? props.remarks[sample.id].status : null) ||
                 'pending'
  switch (status) {
    case 'pending': return '待复核'
    case 'reviewing': return '复核中'
    case 'completed': return '已完成'
    default: return '待复核'
  }
}

const getStatusClass = (sample) => {
  const status = props.remarks[sample.id]?.status || 
                 (props.remarks[sample.id] && typeof props.remarks[sample.id] === 'object' ? props.remarks[sample.id].status : null) ||
                 'pending'
  return `status-badge status-badge-${status}`
}

const getRiskTagType = (level) => {
  switch (level) {
    case RISK_LEVELS.HIGH: return 'danger'
    case RISK_LEVELS.MEDIUM: return 'warning'
    case RISK_LEVELS.LOW: return 'success'
    default: return 'info'
  }
}

const handleRowClick = (row) => {
  openDetailDialog(row)
}

const openDetailDialog = async (sample) => {
  currentSample.value = sample
  
  const remarkData = props.remarks[sample.id]
  if (remarkData) {
    if (typeof remarkData === 'object') {
      currentRemark.value = remarkData.content || ''
      currentStatus.value = remarkData.status || 'pending'
    } else {
      currentRemark.value = remarkData
      currentStatus.value = 'pending'
    }
  } else {
    currentRemark.value = ''
    currentStatus.value = 'pending'
  }

  const photos = getSamplePhotos(sample)
  for (const photo of photos) {
    if (!photo.preview) {
      try {
        const result = await electronAPI.getImageBase64(photo.path)
        if (result.success) {
          photo.preview = result.data
        }
      } catch (e) {
        console.error('加载照片失败:', e)
      }
    }
  }

  detailDialogVisible.value = true
}

const showRemarkDialog = (sample) => {
  currentSample.value = sample
  
  const remarkData = props.remarks[sample.id]
  if (remarkData) {
    if (typeof remarkData === 'object') {
      currentRemark.value = remarkData.content || ''
      currentStatus.value = remarkData.status || 'pending'
    } else {
      currentRemark.value = remarkData
      currentStatus.value = 'pending'
    }
  } else {
    currentRemark.value = ''
    currentStatus.value = 'pending'
  }

  remarkDialogVisible.value = true
}

const showPhotoPreview = (photo) => {
  previewPhoto.value = photo
  photoPreviewVisible.value = true
}

const saveRemark = () => {
  if (!currentSample.value) return
  
  emit('updateRemark', currentSample.value.id, currentRemark.value)
  emit('updateStatus', currentSample.value.id, currentStatus.value)
  ElMessage.success('备注已保存')
}

const saveRemarkAndClose = () => {
  saveRemark()
  remarkDialogVisible.value = false
}

const handleStatusChange = (newStatus) => {
  if (currentSample.value) {
    emit('updateStatus', currentSample.value.id, newStatus)
  }
}

const resetFilters = () => {
  searchKeyword.value = ''
  filterRisk.value = ''
  filterStatus.value = ''
  currentPage.value = 1
}

const handleSizeChange = (val) => {
  pageSize.value = val
}

const handleCurrentChange = (val) => {
  currentPage.value = val
}
</script>
