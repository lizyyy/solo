<template>
  <div>
    <h2 style="margin-bottom: 20px">报告导出</h2>

    <el-card style="margin-bottom: 20px">
      <template #header>
        <span style="font-weight: bold">筛选条件</span>
      </template>
      <el-form :model="filters" :inline="true" label-width="100px">
        <el-form-item label="开始日期">
          <el-date-picker v-model="filters.start_date" type="date" placeholder="选择开始日期" />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-date-picker v-model="filters.end_date" type="date" placeholder="选择结束日期" />
        </el-form-item>
        <el-form-item label="负责人">
          <el-select v-model="filters.responsible_person" placeholder="请选择" clearable>
            <el-option v-for="staff in staffList" :key="staff.id" :label="staff.name" :value="staff.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadReport">查询</el-button>
          <el-button @click="exportReport">导出Excel</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card style="margin-bottom: 20px" v-if="reportData">
      <template #header>
        <span style="font-weight: bold">责任节点统计</span>
      </template>
      <el-table :data="reportData.responsibility_nodes" border>
        <el-table-column prop="task_id" label="任务ID" width="100" />
        <el-table-column prop="task" label="任务" width="250" />
        <el-table-column prop="responsible_person" label="负责人" width="120" />
        <el-table-column prop="start_time" label="开始时间" width="180">
          <template #default="{ row }">{{ formatTime(row.start_time) }}</template>
        </el-table-column>
        <el-table-column prop="end_time" label="结束时间" width="180">
          <template #default="{ row }">{{ formatTime(row.end_time) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="quality_score" label="质量评分" width="100" />
        <el-table-column prop="has_changes" label="有修改" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.has_changes" type="warning">是</el-tag>
            <el-tag v-else type="info">否</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card style="margin-bottom: 20px" v-if="reportData">
          <template #header>
            <span style="font-weight: bold">清洁任务</span>
          </template>
          <el-table :data="reportData.cleanings" border max-height="300">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="hall_name" label="影厅" width="100" />
            <el-table-column prop="movie_name" label="影片" width="150" />
            <el-table-column prop="staff_name" label="负责人" width="100" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row.status)" size="small">{{ getStatusText(row.status) }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card style="margin-bottom: 20px" v-if="reportData">
          <template #header>
            <span style="font-weight: bold">换班记录</span>
          </template>
          <el-table :data="reportData.shifts" border max-height="300">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="from_staff_name" label="原负责人" width="100" />
            <el-table-column prop="to_staff_name" label="新负责人" width="100" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'danger' : 'warning'" size="small">
                  {{ row.status === 'approved' ? '已批准' : row.status === 'rejected' ? '已拒绝' : '待审批' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="callback_count" label="回调次数" width="100" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-card v-if="reportData">
      <template #header>
        <span style="font-weight: bold">操作审计日志</span>
      </template>
      <el-table :data="reportData.audit_logs" border max-height="400">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="table_name" label="表名" width="150" />
        <el-table-column prop="record_id" label="记录ID" width="100" />
        <el-table-column prop="action" label="操作" width="100" />
        <el-table-column prop="changer_name" label="操作人" width="120" />
        <el-table-column prop="changed_at" label="时间" width="180">
          <template #default="{ row }">{{ formatTime(row.changed_at) }}</template>
        </el-table-column>
        <el-table-column label="修改前后对比" width="300">
          <template #default="{ row }">
            <div v-if="row.old_values || row.new_values">
              <el-popover placement="top" title="详细对比" width="400" trigger="click">
                <template #reference>
                  <el-button type="primary" link size="small">查看详情</el-button>
                </template>
                <div v-if="row.old_values">
                  <h4>修改前:</h4>
                  <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px">{{ row.old_values }}</pre>
                </div>
                <div v-if="row.new_values" style="margin-top: 10px">
                  <h4>修改后:</h4>
                  <pre style="background: #f0f9ff; padding: 10px; border-radius: 4px">{{ row.new_values }}</pre>
                </div>
              </el-popover>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { reportsAPI, staffAPI } from '../api'

const staffList = ref([])
const reportData = ref(null)
const filters = ref({
  start_date: null,
  end_date: null,
  responsible_person: null
})

const loadStaff = async () => {
  try {
    const res = await staffAPI.list()
    staffList.value = res.data
  } catch (err) {
    ElMessage.error('加载员工失败')
  }
}

const loadReport = async () => {
  try {
    const params = {}
    if (filters.value.start_date) {
      params.start_date = new Date(filters.value.start_date).toISOString().split('T')[0]
    }
    if (filters.value.end_date) {
      params.end_date = new Date(filters.value.end_date).toISOString().split('T')[0]
    }
    if (filters.value.responsible_person) {
      params.responsible_person = filters.value.responsible_person
    }
    
    const res = await reportsAPI.summary(params)
    reportData.value = res.data
  } catch (err) {
    ElMessage.error('加载报告失败')
  }
}

const exportReport = async () => {
  try {
    const params = {}
    if (filters.value.start_date) {
      params.start_date = new Date(filters.value.start_date).toISOString().split('T')[0]
    }
    if (filters.value.end_date) {
      params.end_date = new Date(filters.value.end_date).toISOString().split('T')[0]
    }
    if (filters.value.responsible_person) {
      params.responsible_person = filters.value.responsible_person
    }
    
    const res = await reportsAPI.export(params)
    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cleaning_report.xlsx'
    a.click()
    window.URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (err) {
    ElMessage.error('导出失败')
  }
}

const formatTime = (time) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}

const getStatusType = (status) => {
  const map = { pending: 'info', in_progress: 'primary', completed: 'warning', reviewed: 'success', rejected: 'danger' }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = { pending: '待分配', in_progress: '清洁中', completed: '待复核', reviewed: '已通过', rejected: '已驳回' }
  return map[status] || status
}

onMounted(() => {
  loadStaff()
  loadReport()
})
</script>
