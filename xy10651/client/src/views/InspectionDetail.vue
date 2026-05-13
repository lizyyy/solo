<template>
  <div v-if="inspection">
    <el-button @click="$router.back()" style="margin-bottom: 20px">返回</el-button>
    
    <el-card style="margin-bottom: 20px">
      <template #header>
        <span style="font-weight: bold; font-size: 18px">设备巡检详情 - #{{ inspection.id }}</span>
      </template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="影厅">{{ inspection.hall_name }}</el-descriptions-item>
        <el-descriptions-item label="巡检员">{{ inspection.inspector_name || '未分配' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(inspection.status)">{{ getStatusText(inspection.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="巡检时间">{{ formatTime(inspection.inspection_time) }}</el-descriptions-item>
        <el-descriptions-item label="问题">{{ inspection.issues || '-' }}</el-descriptions-item>
        <el-descriptions-item label="解决方案">{{ inspection.resolution || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card style="margin-bottom: 20px" v-if="items && items.length">
      <template #header>
        <span style="font-weight: bold">巡检项目</span>
      </template>
      <el-table :data="items" border>
        <el-table-column prop="name" label="项目名称" />
        <el-table-column prop="status" label="状态">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'passed'" type="success">通过</el-tag>
            <el-tag v-else-if="row.status === 'failed'" type="danger">不通过</el-tag>
            <el-tag v-else type="info">待检查</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="issue" label="问题" v-if="items.some(i => i.issue)" />
      </el-table>
    </el-card>

    <el-card v-if="inspection.status === 'in_progress'" style="margin-bottom: 20px">
      <template #header>
        <span style="font-weight: bold">更新巡检项目</span>
      </template>
      <div v-for="(item, index) in items" :key="index" style="margin-bottom: 15px; padding: 10px; border: 1px solid #eee; border-radius: 4px">
        <h4>{{ item.name }}</h4>
        <el-radio-group v-model="item.status" @change="updateItem(index, item.status)">
          <el-radio label="passed">通过</el-radio>
          <el-radio label="failed">不通过</el-radio>
        </el-radio-group>
        <el-input
          v-if="item.status === 'failed'"
          v-model="item.issue"
          placeholder="请描述问题"
          style="margin-top: 10px"
          @blur="updateItem(index, item.status, item.issue)"
        />
      </div>
      <el-button type="primary" @click="completeInspection">完成巡检</el-button>
    </el-card>

    <el-card>
      <template #header>
        <span style="font-weight: bold">时间线</span>
      </template>
      <el-timeline>
        <el-timeline-item :timestamp="inspection.created_at" placement="top">
          <h4>巡检创建</h4>
          <p>设备巡检任务已创建</p>
        </el-timeline-item>
        <el-timeline-item v-if="inspection.inspector_id" :timestamp="inspection.inspection_time" placement="top" type="primary">
          <h4>开始巡检</h4>
          <p>巡检员: {{ inspection.inspector_name }}</p>
        </el-timeline-item>
        <el-timeline-item v-if="inspection.status === 'passed'" timestamp="巡检通过" placement="top" color="#67c23a">
          <h4>巡检通过</h4>
          <p>所有设备检查通过</p>
        </el-timeline-item>
        <el-timeline-item v-if="inspection.status === 'needs_repair'" timestamp="需要维修" placement="top" color="#e6a23c">
          <h4>发现问题</h4>
          <p>设备需要维修，已创建未覆盖岗位</p>
        </el-timeline-item>
        <el-timeline-item v-if="inspection.status === 'resolved'" :timestamp="inspection.resolved_at" placement="top" color="#67c23a">
          <h4>问题已解决</h4>
          <p>解决人: {{ inspection.resolver_name }}</p>
        </el-timeline-item>
      </el-timeline>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { inspectionsAPI } from '../api'

const route = useRoute()
const inspection = ref(null)
const items = ref([])

const getStatusType = (status) => {
  const map = { pending: 'info', in_progress: 'primary', passed: 'success', needs_repair: 'warning', resolved: 'success' }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = { pending: '待巡检', in_progress: '巡检中', passed: '已通过', needs_repair: '需维修', resolved: '已解决' }
  return map[status] || status
}

const formatTime = (time) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}

const loadDetail = async () => {
  try {
    const res = await inspectionsAPI.get(route.params.id)
    inspection.value = res.data
    items.value = JSON.parse(res.data.items || '[]')
  } catch (err) {
    ElMessage.error('加载详情失败')
  }
}

const updateItem = async (index, status, issue = '') => {
  try {
    await inspectionsAPI.updateItem(route.params.id, index, status, issue)
    ElMessage.success('更新成功')
  } catch (err) {
    ElMessage.error('更新失败')
  }
}

const completeInspection = async () => {
  const hasIssues = items.value.some(i => i.status === 'failed')
  const issues = items.value.filter(i => i.issue).map(i => i.issue).join('; ')
  
  try {
    await inspectionsAPI.complete(route.params.id, issues, '')
    ElMessage.success(hasIssues ? '巡检完成，需要维修' : '巡检通过')
    loadDetail()
  } catch (err) {
    ElMessage.error('操作失败')
  }
}

onMounted(() => {
  loadDetail()
})
</script>
