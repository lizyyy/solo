<template>
  <div class="audio-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>音频质检列表</span>
          <el-button type="primary" @click="showCreateDialog">
            <el-icon><Plus /></el-icon>
            添加记录
          </el-button>
        </div>
      </template>
      
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable>
            <el-option label="待处理" value="pending" />
            <el-option label="质检通过" value="success" />
            <el-option label="质检拦截" value="blocked" />
            <el-option label="补偿处理" value="compensation" />
            <el-option label="人工复核" value="manual_review" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">搜索</el-button>
        </el-form-item>
      </el-form>
      
      <el-table :data="audioList" border stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="filename" label="文件名" min-width="150" />
        <el-table-column prop="duration" label="时长(秒)" width="120" />
        <el-table-column prop="noise_tags" label="噪声标签" min-width="150" show-overflow-tooltip />
        <el-table-column prop="sampling_rate" label="抽检比例" width="100" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDetail(row.id)">详情</el-button>
            <el-button link type="success" @click="processFlow(row, 'success')">通过</el-button>
            <el-button link type="danger" @click="processFlow(row, 'blocked')">拦截</el-button>
            <el-button link type="warning" @click="processFlow(row, 'manual_review')">复核</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <el-dialog v-model="createDialogVisible" title="添加音频记录" width="500px">
      <el-form :model="createForm" label-width="100px">
        <el-form-item label="文件名">
          <el-input v-model="createForm.filename" placeholder="请输入文件名" />
        </el-form-item>
        <el-form-item label="时长(秒)">
          <el-input-number v-model="createForm.duration" :min="0" :step="0.1" />
        </el-form-item>
        <el-form-item label="转写文本">
          <el-input v-model="createForm.transcription" type="textarea" :rows="3" placeholder="请输入转写文本" />
        </el-form-item>
        <el-form-item label="噪声标签">
          <el-input v-model="createForm.noise_tags" placeholder="多个标签用逗号分隔" />
        </el-form-item>
        <el-form-item label="抽检比例">
          <el-input-number v-model="createForm.sampling_rate" :min="0" :max="1" :step="0.1" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createRecord">确定</el-button>
      </template>
    </el-dialog>
    
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
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { audioApi, qualityApi } from '../api'

const router = useRouter()
const audioList = ref([])
const searchForm = ref({ status: '' })
const createDialogVisible = ref(false)
const flowDialogVisible = ref(false)

const createForm = ref({
  filename: '',
  duration: 0,
  transcription: '',
  noise_tags: '',
  sampling_rate: 1.0
})

const flowForm = ref({
  audio_record_id: null,
  flow_type: '',
  operator: '',
  comment: '',
  error_reason: ''
})

const loadData = async () => {
  try {
    const res = await audioApi.list({ status: searchForm.value.status })
    audioList.value = res.data
  } catch (error) {
    ElMessage.error('加载数据失败')
  }
}

const showCreateDialog = () => {
  createForm.value = {
    filename: '',
    duration: 0,
    transcription: '',
    noise_tags: '',
    sampling_rate: 1.0
  }
  createDialogVisible.value = true
}

const createRecord = async () => {
  try {
    await audioApi.create(createForm.value)
    ElMessage.success('添加成功')
    createDialogVisible.value = false
    loadData()
  } catch (error) {
    ElMessage.error('添加失败')
  }
}

const viewDetail = (id) => {
  router.push(`/audio/${id}`)
}

const processFlow = (row, flowType) => {
  flowForm.value = {
    audio_record_id: row.id,
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
    loadData()
  } catch (error) {
    ElMessage.error('处理失败')
  }
}

const getStatusType = (status) => {
  const map = {
    pending: 'info',
    success: 'success',
    blocked: 'danger',
    compensation: 'warning',
    manual_review: 'warning'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    pending: '待处理',
    success: '质检通过',
    blocked: '质检拦截',
    compensation: '补偿处理',
    manual_review: '人工复核'
  }
  return map[status] || status
}

const formatDate = (date) => {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-form {
  margin-bottom: 20px;
}
</style>
