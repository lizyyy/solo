<template>
  <div>
    <h2>仪表盘</h2>
    
    <el-row :gutter="20" style="margin-bottom: 30px;">
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="text-align: center;">
            <div style="font-size: 32px; color: #409EFF; font-weight: bold;">{{ summary.total }}</div>
            <div style="color: #909399; margin-top: 10px;">总实验数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="text-align: center;">
            <div style="font-size: 32px; color: #67C23A; font-weight: bold;">{{ summary.running }}</div>
            <div style="color: #909399; margin-top: 10px;">运行中</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="text-align: center;">
            <div style="font-size: 32px; color: #E6A23C; font-weight: bold;">{{ summary.paused }}</div>
            <div style="color: #909399; margin-top: 10px;">已暂停</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div style="text-align: center;">
            <div style="font-size: 32px; color: #F56C6C; font-weight: bold;">{{ summary.need_correction }}</div>
            <div style="color: #909399; margin-top: 10px;">需修正</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <h3>待处理问题</h3>
    <el-table :data="issues" style="width: 100%">
      <el-table-column prop="experiment_id" label="实验ID" width="120" />
      <el-table-column prop="experiment_name" label="实验名称" width="200" />
      <el-table-column prop="type" label="问题类型" width="150">
        <template #default="{ row }">
          <el-tag :type="row.type === 'traffic_ratio' ? 'danger' : 'warning'">
            {{ row.type === 'traffic_ratio' ? '流量比例' : '互斥规则' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="issues" label="问题描述" min-width="300">
        <template #default="{ row }">
          <div v-for="(issue, idx) in row.issues" :key="idx" style="color: #F56C6C;">
            {{ issue }}
          </div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button type="primary" link @click="goToDetail(row.experiment_id)">
            去修正
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const summary = ref({ total: 0, running: 0, paused: 0, need_correction: 0 })
const issues = ref([])

const fetchSummary = async () => {
  try {
    const res = await axios.get('/api/validation/summary')
    summary.value = res.data.summary
    issues.value = res.data.issues
  } catch (err) {
    console.error('获取摘要失败:', err)
  }
}

const goToDetail = (id) => {
  router.push(`/experiments/${id}`)
}

onMounted(() => {
  fetchSummary()
})
</script>
