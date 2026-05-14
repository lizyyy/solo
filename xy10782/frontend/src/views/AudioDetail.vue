<template>
  <div class="audio-detail">
    <el-button @click="goBack" style="margin-bottom: 20px">
      <el-icon><ArrowLeft /></el-icon>
      返回
    </el-button>
    
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>基本信息</template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="ID">{{ audioDetail.id }}</el-descriptions-item>
            <el-descriptions-item label="文件名">{{ audioDetail.filename }}</el-descriptions-item>
            <el-descriptions-item label="时长">{{ audioDetail.duration }} 秒</el-descriptions-item>
            <el-descriptions-item label="抽检比例">{{ audioDetail.sampling_rate }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="getStatusType(audioDetail.status)">
                {{ getStatusText(audioDetail.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatDate(audioDetail.created_at) }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
      
      <el-col :span="12">
        <el-card>
          <template #header>编辑信息</template>
          <el-form :model="editForm" label-width="100px">
            <el-form-item label="转写文本">
              <el-input v-model="editForm.transcription" type="textarea" :rows="4" />
            </el-form-item>
            <el-form-item label="噪声标签">
              <el-input v-model="editForm.noise_tags" placeholder="多个标签用逗号分隔" />
              <div class="tip">关键噪声标签：背景杂音、人声重叠、音频断裂（会触发重新计算）</div>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="updateRecord">保存修改</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>
    
    <el-card style="margin-top: 20px">
      <template #header>详情时间线</template>
      <el-timeline>
        <el-timeline-item
          v-for="item in timeline"
          :key="item.id"
          :timestamp="formatDate(item.created_at)"
          :type="getTimelineType(item.event_type)"
        >
          <div class="timeline-content">
            <strong>{{ getEventText(item.event_type) }}</strong>
            <p>{{ item.event_description }}</p>
            <span class="operator">操作人：{{ item.operator }}</span>
          </div>
        </el-timeline-item>
      </el-timeline>
    </el-card>
    
    <el-card style="margin-top: 20px">
      <template #header>审批记录</template>
      <el-table :data="approvals" border stripe>
        <el-table-column prop="action" label="操作类型" width="120">
          <template #default="{ row }">
            <el-tag>{{ getFlowText(row.action) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="approver" label="审批人" width="120" />
        <el-table-column prop="comment" label="备注" min-width="200" />
        <el-table-column prop="approved_at" label="审批时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.approved_at) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <el-card style="margin-top: 20px">
      <template #header>质检处理</template>
      <div class="flow-buttons">
        <el-button type="success" size="large" @click="processFlow('success')">质检通过</el-button>
        <el-button type="danger" size="large" @click="processFlow('blocked')">质检拦截</el-button>
        <el-button type="warning" size="large" @click="processFlow('compensation')">补偿处理</el-button>
        <el-button type="primary" size="large" @click="processFlow('manual_review')">人工复核</el-button>
      </div>
    </el-card>
    
    <el-dialog v-model="flowDialogVisible" title="质检处理" width="500px">
      <el-form :model="flowForm" label-width="100px">
        <el-form-item label="处理类型">
          <el-select v-model="flowForm.flow_type" disabled>
            <el-option label="质检通过" value="success" />
            <el-option label="质检拦截" value="blocked" />
            <el-option label="补偿处理" value="compensation" />
            <el-option label="人工复核" value="manual_review" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="flowForm.operator" placeholder="请输入操作人姓名" />
        </el-form-item>
        <el-form-item label="错误原因" v-if="flowForm.flow_type === 'blocked'">
          <el-input v-model="flowForm.error_reason" type="textarea" :rows="3" placeholder="请输入错误原因" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="flowForm.comment" type="textarea" :rows="2" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="flowDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitFlow">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { audioApi, timelineApi, approvalApi, qualityApi } from '../api'

const route = useRoute()
const router = useRouter()
const audioDetail = ref({})
const editForm = ref({ transcription: '', noise_tags: '' })
const timeline = ref([])
const approvals = ref([])
const flowDialogVisible = ref(false)

const flowForm = ref({
  audio_record_id: null,
  flow_type: '',
  operator: '',
  comment: '',
  error_reason: ''
})

const loadDetail = async () => {
  try {
    const res = await audioApi.get(route.params.id)
    audioDetail.value = res.data
    editForm.value = {
      transcription: res.data.transcription || '',
      noise_tags: res.data.noise_tags || ''
    }
  } catch (error) {
    ElMessage.error('加载详情失败')
  }
}

const loadTimeline = async () => {
  try {
    const res = await timelineApi.get(route.params.id)
    timeline.value = res.data
  } catch (error) {
    console.error('加载时间线失败')
  }
}

const loadApprovals = async () => {
  try {
    const res = await approvalApi.get(route.params.id)
    approvals.value = res.data
  } catch (error) {
    console.error('加载审批记录失败')
  }
}

const updateRecord = async () => {
  try {
    await audioApi.update(route.params.id, editForm.value)
    ElMessage.success('更新成功')
    loadDetail()
    loadTimeline()
  } catch (error) {
    ElMessage.error('更新失败')
  }
}

const processFlow = (flowType) => {
  flowForm.value = {
    audio_record_id: route.params.id,
    flow_type: flowType,
    operator: '',
    comment: '',
    error_reason: ''
  }
  flowDialogVisible.value = true
}

const submitFlow = async () => {
  if (!flowForm.value.operator) {
    ElMessage.warning('请输入操作人姓名')
    return
  }
  try {
    await qualityApi.processFlow(flowForm.value)
    ElMessage.success('处理成功')
    flowDialogVisible.value = false
    loadDetail()
    loadTimeline()
    loadApprovals()
  } catch (error) {
    ElMessage.error('处理失败')
  }
}

const goBack = () => {
  router.push('/audio')
}

const getStatusType = (status) => {
  const map = { pending: 'info', success: 'success', blocked: 'danger', compensation: 'warning', manual_review: 'warning' }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = { pending: '待处理', success: '质检通过', blocked: '质检拦截', compensation: '补偿处理', manual_review: '人工复核' }
  return map[status] || status
}

const getTimelineType = (eventType) => {
  const map = { create: 'primary', success: 'success', blocked: 'danger', compensation: 'warning', manual_review: 'warning', update_noise_tags: 'info' }
  return map[eventType] || 'primary'
}

const getEventText = (eventType) => {
  const map = { create: '创建记录', success: '质检通过', blocked: '质检拦截', compensation: '补偿处理', manual_review: '人工复核', update_noise_tags: '更新噪声标签' }
  return map[eventType] || eventType
}

const getFlowText = (flowType) => {
  const map = { success: '质检通过', blocked: '质检拦截', compensation: '补偿处理', manual_review: '人工复核' }
  return map[flowType] || flowType
}

const formatDate = (date) => {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

onMounted(() => {
  loadDetail()
  loadTimeline()
  loadApprovals()
})
</script>

<style scoped>
.tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}

.timeline-content {
  padding: 5px 0;
}

.timeline-content p {
  margin: 5px 0;
  color: #606266;
}

.operator {
  font-size: 12px;
  color: #909399;
}

.flow-buttons {
  display: flex;
  gap: 20px;
  justify-content: center;
  padding: 20px 0;
}
</style>
