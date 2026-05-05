<template>
  <div class="page-container">
    <el-skeleton :loading="loading" animated>
      <template #default>
        <div class="page-header-section">
          <el-button @click="goBack">
            <el-icon><ArrowLeft /></el-icon>
            返回列表
          </el-button>
          <h2 class="page-title">线索详情</h2>
          <div class="page-actions">
            <el-button type="primary" @click="handleExport">
              <el-icon><Download /></el-icon>
              导出核对报告
            </el-button>
            <el-button type="primary" @click="goToEdit">
              <el-icon><Edit /></el-icon>
              编辑
            </el-button>
          </div>
        </div>

        <el-row :gutter="20">
          <el-col :span="16">
            <div class="card-container">
              <h3 class="section-title">基本信息</h3>
              <el-descriptions :column="2" border>
                <el-descriptions-item label="ID">{{ lead.id }}</el-descriptions-item>
                <el-descriptions-item label="学员姓名">
                  <span style="font-weight: 600">{{ lead.name }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="手机号">{{ lead.phone }}</el-descriptions-item>
                <el-descriptions-item label="课程">{{ lead.course }}</el-descriptions-item>
                <el-descriptions-item label="预约时间">
                  {{ lead.appointment_time_formatted }}
                </el-descriptions-item>
                <el-descriptions-item label="当前状态">
                  <el-tag :type="statusType" size="large">
                    {{ lead.status_label }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="负责人">{{ lead.responsible }}</el-descriptions-item>
                <el-descriptions-item label="最后更新">
                  {{ lead.updated_at_formatted }}
                </el-descriptions-item>
                <el-descriptions-item label="创建时间" :span="2">
                  {{ lead.created_at_formatted }}
                </el-descriptions-item>
                <el-descriptions-item label="备注" :span="2">
                  <div v-if="lead.notes" class="notes-content">
                    {{ lead.notes }}
                  </div>
                  <span v-else style="color: #909399">暂无备注</span>
                </el-descriptions-item>
              </el-descriptions>
            </div>

            <div class="card-container">
              <h3 class="section-title">修改历史</h3>
              <el-timeline v-if="history.length > 0">
                <el-timeline-item
                  v-for="(item, index) in history"
                  :key="item.id"
                  :timestamp="item.changed_at_formatted"
                  placement="top"
                >
                  <el-card>
                    <template #header>
                      <div class="history-header">
                        <span class="history-index">修改记录 {{ history.length - index }}</span>
                        <el-tag size="small">{{ item.field_name }}</el-tag>
                      </div>
                    </template>
                    <div class="history-content">
                      <div class="history-row">
                        <span class="history-label">修改前：</span>
                        <span class="history-value history-old">
                          {{ item.old_value_label || item.old_value || '(空)' }}
                        </span>
                      </div>
                      <el-divider direction="vertical" />
                      <div class="history-row">
                        <span class="history-label">修改后：</span>
                        <span class="history-value history-new">
                          {{ item.new_value_label || item.new_value || '(空)' }}
                        </span>
                      </div>
                    </div>
                  </el-card>
                </el-timeline-item>
              </el-timeline>
              <el-empty v-else description="暂无修改记录" />
            </div>
          </el-col>

          <el-col :span="8">
            <div class="card-container">
              <h3 class="section-title">状态流转说明</h3>
              <div class="status-flow">
                <div v-for="status in statusList" :key="status.value" class="status-item">
                  <el-tag :type="getStatusType(status.value)" size="small">
                    {{ status.label }}
                  </el-tag>
                  <span class="status-desc" v-if="getNextStatuses(status.value).length > 0">
                    → {{ getNextStatuses(status.value).join('、') }}
                  </span>
                </div>
              </div>
            </div>

            <div class="card-container">
              <h3 class="section-title">快速操作</h3>
              <div class="quick-actions">
                <el-button type="primary" @click="goToEdit" style="width: 100%">
                  编辑线索
                </el-button>
                <el-button @click="handleExport" style="width: 100%">
                  导出报告
                </el-button>
                <el-button type="danger" @click="handleDelete" style="width: 100%">
                  删除线索
                </el-button>
              </div>
            </div>
          </el-col>
        </el-row>
      </template>
    </el-skeleton>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Edit, Download } from '@element-plus/icons-vue'
import { useLeadsStore } from '@/stores/leads'

const route = useRoute()
const router = useRouter()
const leadsStore = useLeadsStore()

const loading = ref(false)
const leadId = computed(() => Number(route.params.id))

const lead = computed(() => leadsStore.currentLead)
const history = computed(() => leadsStore.currentLeadHistory)

const statusType = computed(() => {
  return lead.value ? leadsStore.getStatusType(lead.value.status) : 'info'
})

const statusList = computed(() => leadsStore.metadata.statuses)

const getStatusType = (status) => {
  return leadsStore.getStatusType(status)
}

const getNextStatuses = (status) => {
  const allowed = leadsStore.getAllowedStatuses(status)
  return allowed
    .filter(s => s !== status)
    .map(s => leadsStore.getStatusLabel(s))
}

const goBack = () => {
  router.push('/')
}

const goToEdit = () => {
  router.push(`/leads/${leadId.value}/edit`)
}

const handleExport = async () => {
  try {
    await leadsStore.exportMarkdownReport(leadId.value)
    ElMessage.success('导出成功')
  } catch (err) {
    ElMessage.error(err.message || '导出失败')
  }
}

const handleDelete = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要删除线索 "${lead.value?.name}" 吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await leadsStore.deleteLead(leadId.value)
    ElMessage.success('删除成功')
    router.push('/')
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '删除失败')
    }
  }
}

onMounted(async () => {
  loading.value = true
  try {
    if (leadsStore.metadata.statuses.length === 0) {
      await leadsStore.fetchMetadata()
    }
    await leadsStore.fetchLeadById(leadId.value)
  } catch (err: any) {
    ElMessage.error(err.message || '加载失败')
    router.push('/')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page-header-section {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  gap: 16px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  flex: 1;
}

.page-actions {
  display: flex;
  gap: 12px;
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.notes-content {
  white-space: pre-wrap;
  line-height: 1.6;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-index {
  font-weight: 600;
  color: #303133;
}

.history-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.history-row {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.history-label {
  color: #909399;
  font-size: 14px;
}

.history-value {
  font-weight: 600;
  font-size: 14px;
}

.history-old {
  color: #909399;
}

.history-new {
  color: #67c23a;
}

.status-flow {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-desc {
  color: #909399;
  font-size: 13px;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
