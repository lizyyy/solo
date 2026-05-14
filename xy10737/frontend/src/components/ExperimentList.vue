<template>
  <div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2>实验列表</h2>
      <el-button type="primary" @click="showCreateDialog = true">
        <el-icon><Plus /></el-icon>
        新建实验
      </el-button>
    </div>

    <el-table :data="experiments" style="width: 100%" v-loading="loading">
      <el-table-column prop="id" label="ID" width="100" />
      <el-table-column prop="name" label="实验名称" min-width="200" />
      <el-table-column prop="status" label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">
            {{ getStatusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="分组情况" width="200">
        <template #default="{ row }">
          <div v-for="group in row.groups" :key="group.id" style="margin-bottom: 5px;">
            <span :style="{ color: group.is_control ? '#67C23A' : '#409EFF' }">{{ group.name }}</span>
            : {{ group.traffic_ratio }}%
          </div>
        </template>
      </el-table-column>
      <el-table-column label="验证状态" width="120">
        <template #default="{ row }">
          <el-tag v-if="row.need_recalculation" type="danger">需重新计算</el-tag>
          <el-tag v-else type="success">正常</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="180">
        <template #default="{ row }">
          {{ formatDate(row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button type="primary" link @click="goToDetail(row.id)">查看详情</el-button>
          <el-button type="success" link @click="exportExperiment(row.id)">导出</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showCreateDialog" title="新建实验" width="600px">
      <el-form :model="newExperiment" label-width="100px">
        <el-form-item label="实验名称">
          <el-input v-model="newExperiment.name" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="newExperiment.description" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createExperiment">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const router = useRouter()
const experiments = ref([])
const loading = ref(false)
const showCreateDialog = ref(false)
const newExperiment = ref({
  name: '',
  description: '',
  groups: [
    { id: 'g1', name: '对照组', traffic_ratio: 50, is_control: true },
    { id: 'g2', name: '实验组', traffic_ratio: 50, is_control: false }
  ],
  metrics: [
    { id: 'm1', name: '主要指标', definition: '定义', unit: '%', is_primary: true }
  ],
  mutex_rules: []
})

const fetchExperiments = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/experiments')
    experiments.value = res.data
  } catch (err) {
    console.error('获取实验列表失败:', err)
  } finally {
    loading.value = false
  }
}

const getStatusType = (status) => {
  const types = { running: 'success', paused: 'warning', draft: 'info', completed: '' }
  return types[status] || ''
}

const getStatusLabel = (status) => {
  const labels = { running: '运行中', paused: '已暂停', draft: '草稿', completed: '已完成' }
  return labels[status] || status
}

const formatDate = (date) => {
  return new Date(date).toLocaleString('zh-CN')
}

const goToDetail = (id) => {
  router.push(`/experiments/${id}`)
}

const createExperiment = async () => {
  try {
    await axios.post('/api/experiments', { ...newExperiment.value, status: 'draft' })
    showCreateDialog.value = false
    ElMessage.success('创建成功')
    fetchExperiments()
  } catch (err) {
    ElMessage.error('创建失败')
  }
}

const exportExperiment = async (id) => {
  try {
    const res = await axios.post('/api/export', 
      { experiment_id: id, format: 'json', include_report: true },
      { responseType: 'blob' }
    )
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = `${id}.json`
    a.click()
    window.URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (err) {
    ElMessage.error('导出失败')
  }
}

onMounted(() => {
  fetchExperiments()
})
</script>
