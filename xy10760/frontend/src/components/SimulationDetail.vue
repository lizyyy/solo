<template>
  <el-drawer
    v-model="visible"
    title="模拟详情"
    direction="rtl"
    size="800px"
    :before-close="handleClose"
  >
    <div v-loading="loading" class="detail-content">
      <el-descriptions title="基本信息" border :column="2" class="mb-20">
        <el-descriptions-item label="模拟ID">
          {{ detail.simulation?.id }}
        </el-descriptions-item>
        <el-descriptions-item label="模拟状态">
          <el-tag :type="getStatusType(detail.simulation?.simulation_status)">
            {{ getStatusText(detail.simulation?.simulation_status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="最终审批结果">
          {{ detail.simulation?.final_approval_result }}
        </el-descriptions-item>
        <el-descriptions-item label="发布状态">
          <el-tag :type="detail.simulation?.published ? 'success' : 'info'">
            {{ detail.simulation?.published ? '已发布' : '未发布' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建人">
          {{ detail.simulation?.created_by }}
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">
          {{ formatDate(detail.simulation?.created_at) }}
        </el-descriptions-item>
      </el-descriptions>

      <el-descriptions title="申请单信息" border :column="2" class="mb-20">
        <el-descriptions-item label="申请单号">
          {{ detail.application?.application_no }}
        </el-descriptions-item>
        <el-descriptions-item label="申请人">
          {{ detail.application?.applicant }}
        </el-descriptions-item>
        <el-descriptions-item label="申请部门">
          {{ detail.application?.department }}
        </el-descriptions-item>
        <el-descriptions-item label="申请类型">
          {{ detail.application?.application_type }}
        </el-descriptions-item>
        <el-descriptions-item label="申请金额">
          {{ detail.application?.amount }} 元
        </el-descriptions-item>
        <el-descriptions-item label="申请单状态">
          {{ detail.application?.status }}
        </el-descriptions-item>
      </el-descriptions>

      <el-descriptions title="规则版本信息" border :column="2" class="mb-20">
        <el-descriptions-item label="版本号">
          {{ detail.rule_version?.version }}
        </el-descriptions-item>
        <el-descriptions-item label="规则名称">
          {{ detail.rule_version?.name }}
        </el-descriptions-item>
        <el-descriptions-item label="规则描述" :span="2">
          {{ detail.rule_version?.description }}
        </el-descriptions-item>
        <el-descriptions-item label="是否启用">
          {{ detail.rule_version?.is_active ? '是' : '否' }}
        </el-descriptions-item>
        <el-descriptions-item label="创建人">
          {{ detail.rule_version?.created_by }}
        </el-descriptions-item>
      </el-descriptions>

      <div class="mb-20">
        <h4>命中条件</h4>
        <el-table :data="detail.hit_conditions || []" border stripe size="small">
          <el-table-column prop="condition_type" label="条件类型" width="120" />
          <el-table-column prop="condition_expression" label="条件表达式" min-width="150" />
          <el-table-column prop="condition_value" label="条件值" width="120" />
          <el-table-column prop="operator" label="运算符" width="80" />
          <el-table-column prop="priority" label="优先级" width="80" />
        </el-table>
      </div>

      <div class="mb-20">
        <h4>审批人信息</h4>
        <el-table :data="detail.approvers || []" border stripe size="small">
          <el-table-column prop="name" label="姓名" width="100" />
          <el-table-column prop="email" label="邮箱" width="180" />
          <el-table-column prop="department" label="部门" width="120" />
          <el-table-column prop="level" label="级别" width="80">
            <template #default="{ row }">
              L{{ row.level }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="row.is_active ? 'success' : 'danger'" size="small">
                {{ row.is_active ? '正常' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div v-if="detail.skip_reason" class="mb-20">
        <h4>跳过原因 <el-tag type="warning" size="small">需人工确认</el-tag></h4>
        <el-descriptions border :column="2">
          <el-descriptions-item label="原因编码">
            {{ detail.skip_reason?.reason_code }}
          </el-descriptions-item>
          <el-descriptions-item label="原因内容">
            {{ detail.skip_reason?.reason_text }}
          </el-descriptions-item>
          <el-descriptions-item label="是否需要确认">
            {{ detail.skip_reason?.need_manual_confirm ? '是' : '否' }}
          </el-descriptions-item>
          <el-descriptions-item label="确认状态">
            <el-tag :type="detail.simulation?.skip_manual_confirmed ? 'success' : 'warning'">
              {{ detail.simulation?.skip_manual_confirmed ? '已确认' : '待确认' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="确认人" v-if="detail.simulation?.skip_confirmed_by">
            {{ detail.simulation?.skip_confirmed_by }}
          </el-descriptions-item>
          <el-descriptions-item label="确认时间" v-if="detail.simulation?.skip_confirmed_at">
            {{ formatDate(detail.simulation?.skip_confirmed_at) }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <div v-if="detail.simulation?.approver_errors?.length > 0" class="mb-20">
        <h4>
          <el-icon color="#F56C6C"><Warning /></el-icon>
          审批人异常明细
        </h4>
        <el-alert
          title="检测到审批人异常，请复核"
          type="warning"
          :closable="false"
          class="mb-10"
        />
        <el-table :data="detail.simulation?.approver_errors || []" border stripe size="small">
          <el-table-column prop="approver_name" label="审批人姓名" width="120" />
          <el-table-column prop="error_type" label="异常类型" width="100">
            <template #default="{ row }">
              <el-tag type="danger" size="small">
                {{ row.error_type === 'not_found' ? '不存在' : '已停用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="error_message" label="异常说明" min-width="200" />
        </el-table>
      </div>

      <div v-if="detail.simulation?.error_details" class="mb-20">
        <h4>
          <el-icon color="#F56C6C"><CircleClose /></el-icon>
          系统错误明细
        </h4>
        <el-alert
          :title="detail.simulation?.error_details"
          type="error"
          :closable="false"
        />
      </div>
    </div>

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="handleClose">关闭</el-button>
        <el-button 
          type="warning" 
          @click="handleConfirmSkip"
          v-if="detail.skip_reason && !detail.simulation?.skip_manual_confirmed"
        >
          确认跳过
        </el-button>
        <el-button type="success" @click="handlePublish" v-if="!detail.simulation?.published">
          发布
        </el-button>
        <el-button type="primary" @click="handleExport">
          导出Excel
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Warning, CircleClose } from '@element-plus/icons-vue'
import { simulationApi } from '../api'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  simulationId: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['update:visible'])

const loading = ref(false)
const detail = ref({
  simulation: null,
  application: null,
  rule_version: null,
  hit_conditions: [],
  approvers: [],
  skip_reason: null
})

const visible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

watch(() => props.visible, (newVal) => {
  if (newVal && props.simulationId) {
    loadDetail()
  }
})

watch(() => props.simulationId, () => {
  if (props.visible) {
    loadDetail()
  }
})

const loadDetail = async () => {
  loading.value = true
  try {
    const res = await simulationApi.get(props.simulationId)
    detail.value = res.data
  } catch (error) {
    ElMessage.error('加载详情失败')
  } finally {
    loading.value = false
  }
}

const handleClose = () => {
  visible.value = false
}

const handleConfirmSkip = async () => {
  try {
    await ElMessageBox.confirm('确认要跳过审批吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await simulationApi.confirmSkip(props.simulationId, { confirmed_by: 'admin' })
    ElMessage.success('确认成功')
    loadDetail()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败')
    }
  }
}

const handlePublish = async () => {
  try {
    await simulationApi.publish(props.simulationId)
    ElMessage.success('发布成功')
    loadDetail()
  } catch (error) {
    ElMessage.error('发布失败')
  }
}

const handleExport = () => {
  simulationApi.export(props.simulationId)
}

const getStatusType = (status) => {
  const map = {
    success: 'success',
    warning: 'warning',
    error: 'danger'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    success: '成功',
    warning: '警告',
    error: '失败'
  }
  return map[status] || '未知'
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('zh-CN')
}
</script>

<style scoped>
.detail-content {
  padding: 0 20px;
}

.mb-20 {
  margin-bottom: 20px;
}

.mb-10 {
  margin-bottom: 10px;
}

h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #333;
  display: flex;
  align-items: center;
  gap: 8px;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
