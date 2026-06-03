<template>
  <div class="step-floor-section">
    <h3>第二步：补看楼层剖面草图</h3>
    <p class="step-desc">
      航测内业小魏根据楼层剖面草图补充或修改备注。修改后系统自动标记受影响的记录，方便巡检组复核。
    </p>

    <el-alert 
      v-if="store.affectedRecords.length > 0" 
      title="日常检查提示" 
      type="warning" 
      :closable="false"
      class="daily-check-alert"
    >
      <template #default>
        <p>发现 {{ store.affectedRecords.length }} 条受影响的记录，请巡检组当天复核。</p>
        <el-button type="primary" link size="small" @click="showAffectedRecords = true">
          查看受影响记录
        </el-button>
      </template>
    </el-alert>

    <el-divider>楼层剖面记录</el-divider>

    <el-table :data="store.floorSectionRecords" border stripe class="section-table">
      <el-table-column prop="sectionId" label="剖面编号" width="120" />
      <el-table-column prop="floor" label="楼层" width="80" />
      <el-table-column prop="sectionNote" label="剖面备注" min-width="200" />
      <el-table-column prop="originalSectionNote" label="原始备注" min-width="200" />
      <el-table-column label="修改次数" width="80">
        <template #default="{ row }">
          {{ row.manualChanges?.length || 0 }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button 
            type="primary" 
            link 
            size="small"
            @click="editSection(row)"
          >
            编辑备注
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-divider>关联障碍物记录</el-divider>

    <el-table :data="obstacleRecords" border stripe class="obstacle-table">
      <el-table-column type="index" label="序号" width="60" />
      <el-table-column prop="originalLineNumber" label="原始行号" width="100" />
      <el-table-column prop="wallPanelCode" label="墙板编号" width="120" />
      <el-table-column prop="coordinate" label="坐标" min-width="150">
        <template #default="{ row }">
          <span :class="{ 'mixed-coord': row.isMixedCoordinate }">
            {{ row.coordinate }}
            <el-tag 
              v-if="row.isMixedCoordinate" 
              type="danger" 
              size="small"
              class="coord-tag"
            >
              坐标混合待复核
            </el-tag>
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="obstacleNote" label="障碍物备注" min-width="200" />
      <el-table-column prop="processingStatus" label="处理状态" width="120">
        <template #default="{ row }">
          <el-tag :type="getStatusTagType(row.processingStatus)" size="small">
            {{ getStatusText(row.processingStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button 
            type="primary" 
            link 
            size="small"
            @click="viewAuditTrail(row)"
          >
            查看审计追踪
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="editDialogVisible" title="编辑楼层剖面备注" width="500px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="剖面编号">
          <el-input v-model="editForm.sectionId" disabled />
        </el-form-item>
        <el-form-item label="剖面备注">
          <el-input 
            v-model="editForm.sectionNote" 
            type="textarea" 
            :rows="4"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="auditDialogVisible" title="审计追踪详情" width="700px">
      <div v-if="currentAuditTrail" class="audit-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="原始行号">
            {{ currentAuditTrail.originalLineNumber }}
          </el-descriptions-item>
          <el-descriptions-item label="导入时间">
            {{ formatDateTime(currentAuditTrail.importTimestamp) }}
          </el-descriptions-item>
          <el-descriptions-item label="原始备注" :span="2">
            {{ currentAuditTrail.originalObstacleNote || '(空)' }}
          </el-descriptions-item>
          <el-descriptions-item label="当前状态">
            <el-tag :type="getStatusTagType(currentAuditTrail.processingStatus)">
              {{ getStatusText(currentAuditTrail.processingStatus) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="坐标类型">
            {{ getCoordinateTypeText(currentAuditTrail.coordinateType) }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider>人工修改记录</el-divider>
        <el-timeline v-if="currentAuditTrail.manualChanges.length > 0">
          <el-timeline-item
            v-for="(change, index) in currentAuditTrail.manualChanges"
            :key="index"
            :timestamp="formatDateTime(change.timestamp)"
          >
            <el-card>
              <h4>{{ change.operator }} 进行了修改</h4>
              <p>字段: {{ getFieldText(change.field) }}</p>
              <p>原值: {{ change.oldValue || '(空)' }}</p>
              <p>新值: {{ change.newValue || '(空)' }}</p>
            </el-card>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-else description="暂无修改记录" />

        <el-divider>状态变更历史</el-divider>
        <el-timeline>
          <el-timeline-item
            v-for="(status, index) in currentAuditTrail.statusHistory"
            :key="index"
            :timestamp="formatDateTime(status.timestamp)"
          >
            <el-tag :type="getStatusTagType(status.status)">
              {{ getStatusText(status.status) }}
            </el-tag>
            <span class="operator"> - {{ status.operator }}</span>
          </el-timeline-item>
        </el-timeline>
      </div>
    </el-dialog>

    <el-dialog v-model="showAffectedRecords" title="受影响记录" width="800px">
      <el-table :data="store.affectedRecords" border stripe>
        <el-table-column prop="wallPanelCode" label="墙板编号" width="120" />
        <el-table-column prop="obstacleNote" label="障碍物备注" min-width="200" />
        <el-table-column prop="affectedReason" label="受影响原因" min-width="200" />
        <el-table-column prop="affectedAt" label="受影响时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.affectedAt) }}
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useSimulationStore } from '../stores/simulationStore'

const store = useSimulationStore()

const editDialogVisible = ref(false)
const auditDialogVisible = ref(false)
const showAffectedRecords = ref(false)
const currentAuditTrail = ref(null)

const editForm = reactive({
  id: null,
  sectionId: '',
  sectionNote: ''
})

const obstacleRecords = computed(() => store.obstacleRecords)

const editSection = (row) => {
  editForm.id = row.id
  editForm.sectionId = row.sectionId
  editForm.sectionNote = row.sectionNote
  editDialogVisible.value = true
}

const saveEdit = () => {
  store.updateFloorSectionNote(editForm.id, editForm.sectionNote)
  editDialogVisible.value = false
  ElMessage.success('剖面备注更新成功，相关受影响记录已标记')
}

const viewAuditTrail = (row) => {
  currentAuditTrail.value = store.getRecordAuditTrail(row.id)
  auditDialogVisible.value = true
}

const formatDateTime = (isoString) => {
  if (!isoString) return '-'
  return new Date(isoString).toLocaleString('zh-CN')
}

const getStatusText = (status) => {
  const map = {
    'pending': '待处理',
    'pending_review': '待复核',
    'manual_updated': '已人工更新',
    'modified': '已修改',
    'reviewed': '已复核',
    'approved': '已批准',
    'exported': '已导出'
  }
  return map[status] || status
}

const getStatusTagType = (status) => {
  const map = {
    'pending': 'info',
    'pending_review': 'danger',
    'manual_updated': 'success',
    'modified': 'warning',
    'reviewed': 'success',
    'approved': 'success',
    'exported': 'success'
  }
  return map[status] || 'info'
}

const getCoordinateTypeText = (type) => {
  const map = { 'latlng': '经纬度', 'metric': '米制', 'unknown': '未知' }
  return map[type] || type
}

const getFieldText = (field) => {
  const map = {
    'obstacleNote': '障碍物备注',
    'sectionNote': '剖面备注',
    'coordinate': '坐标',
    'wallPanelCode': '墙板编号'
  }
  return map[field] || field
}
</script>

<style scoped>
.step-floor-section h3 {
  margin-bottom: 10px;
  color: #303133;
}

.step-desc {
  color: #909399;
  margin-bottom: 20px;
}

.daily-check-alert {
  margin-bottom: 20px;
}

.section-table,
.obstacle-table {
  margin-bottom: 20px;
}

.mixed-coord {
  color: #f56c6c;
}

.coord-tag {
  margin-left: 8px;
}

.audit-detail h4 {
  margin-bottom: 10px;
}

.audit-detail p {
  margin: 5px 0;
}

.operator {
  color: #909399;
}
</style>
