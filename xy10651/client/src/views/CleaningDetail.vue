<template>
  <div v-if="cleaning">
    <el-button @click="$router.back()" style="margin-bottom: 20px">返回</el-button>
    
    <el-card style="margin-bottom: 20px">
      <template #header>
        <span style="font-weight: bold; font-size: 18px">清洁任务详情 - #{{ cleaning.id }}</span>
      </template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="影厅">{{ cleaning.hall_name }}</el-descriptions-item>
        <el-descriptions-item label="影片">{{ cleaning.movie_name }}</el-descriptions-item>
        <el-descriptions-item label="负责人">{{ cleaning.staff_name || '未分配' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(cleaning.status)">{{ getStatusText(cleaning.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="质量评分">{{ cleaning.quality_score || '-' }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ cleaning.notes || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card style="margin-bottom: 20px" v-if="cleaning.old_values">
      <template #header>
        <span style="font-weight: bold">修改记录</span>
      </template>
      <el-row :gutter="20">
        <el-col :span="12">
          <h4>修改前</h4>
          <pre>{{ JSON.stringify(JSON.parse(cleaning.old_values), null, 2) }}</pre>
        </el-col>
        <el-col :span="12">
          <h4>修改后</h4>
          <pre>{{ JSON.stringify(JSON.parse(cleaning.new_values), null, 2) }}</pre>
        </el-col>
      </el-row>
    </el-card>

    <el-card>
      <template #header>
        <span style="font-weight: bold">时间线</span>
      </template>
      <el-timeline>
        <el-timeline-item :timestamp="cleaning.scheduled_time" placement="top">
          <h4>任务创建</h4>
          <p>清洁任务已创建，等待分配人员</p>
        </el-timeline-item>
        <el-timeline-item v-if="cleaning.assigned_staff_id" timestamp="分配人员" placement="top" type="primary">
          <h4>人员已分配</h4>
          <p>负责人: {{ cleaning.staff_name }}</p>
        </el-timeline-item>
        <el-timeline-item v-if="cleaning.actual_start_time" :timestamp="cleaning.actual_start_time" placement="top" type="primary">
          <h4>开始清洁</h4>
          <p>清洁工作已开始</p>
        </el-timeline-item>
        <el-timeline-item v-if="cleaning.actual_end_time" :timestamp="cleaning.actual_end_time" placement="top" type="success">
          <h4>清洁完成</h4>
          <p>质量评分: {{ cleaning.quality_score }}</p>
          <p v-if="cleaning.notes">备注: {{ cleaning.notes }}</p>
        </el-timeline-item>
        <el-timeline-item v-if="cleaning.status === 'reviewed'" timestamp="复核通过" placement="top" color="#67c23a">
          <h4>复核通过</h4>
          <p>清洁质量通过复核</p>
        </el-timeline-item>
        <el-timeline-item v-if="cleaning.status === 'rejected'" timestamp="已驳回" placement="top" color="#f56c6c">
          <h4>已驳回</h4>
          <p>需要重新清洁</p>
        </el-timeline-item>
      </el-timeline>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { cleaningAPI } from '../api'

const route = useRoute()
const cleaning = ref(null)

const getStatusType = (status) => {
  const map = { pending: 'info', in_progress: 'primary', completed: 'warning', reviewed: 'success', rejected: 'danger' }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = { pending: '待分配', in_progress: '清洁中', completed: '待复核', reviewed: '已通过', rejected: '已驳回' }
  return map[status] || status
}

const loadDetail = async () => {
  try {
    const res = await cleaningAPI.get(route.params.id)
    cleaning.value = res.data
  } catch (err) {
    ElMessage.error('加载详情失败')
  }
}

onMounted(() => {
  loadDetail()
})
</script>
