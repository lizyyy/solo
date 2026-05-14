<template>
  <div class="calendar-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>执行日历</span>
          <div class="header-actions">
            <el-date-picker
              v-model="currentMonth"
              type="month"
              placeholder="选择月份"
              @change="loadCalendar"
            />
            <el-button type="primary" @click="showExportPanel">
              <el-icon><Download /></el-icon> 导出
            </el-button>
            <el-button @click="loadCalendar">
              <el-icon><Refresh /></el-icon> 刷新
            </el-button>
          </div>
        </div>
      </template>
      
      <div class="calendar-grid">
        <div class="calendar-header">
          <div v-for="day in weekDays" :key="day" class="week-day">{{ day }}</div>
        </div>
        <div class="calendar-body">
          <div v-for="(day, index) in calendarDays" :key="index" 
               :class="['calendar-day', { 'other-month': day.isOtherMonth, 'today': day.isToday }]">
            <div class="day-number">{{ day.day }}</div>
            <div v-if="day.stats" class="day-stats">
              <el-tag v-if="day.stats.success" type="success" size="small">成 {{ day.stats.success }}</el-tag>
              <el-tag v-if="day.stats.failed" type="danger" size="small">败 {{ day.stats.failed }}</el-tag>
              <el-tag v-if="day.stats.missed" type="warning" size="small">错 {{ day.stats.missed }}</el-tag>
              <el-tag v-if="day.stats.compensated" type="info" size="small">补 {{ day.stats.compensated }}</el-tag>
            </div>
            <div class="day-executions">
              <div v-for="exec in day.executions.slice(0, 3)" :key="exec.id" 
                   :class="['execution-item', exec.status]"
                   @click="showExecutionDetail(exec)">
                <el-tooltip :content="exec.task_name">
                  <span class="execution-time">{{ formatTime(exec.scheduled_time) }}</span>
                </el-tooltip>
              </div>
              <el-button v-if="day.executions.length > 3" type="text" size="small" @click="showDayDetail(day)">
                +{{ day.executions.length - 3 }} 更多
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <el-dialog v-model="detailVisible" title="执行详情" width="800px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="任务名称">{{ currentExecution?.task_name }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(currentExecution?.status)">{{ currentExecution?.status }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="计划时间">{{ currentExecution?.scheduled_time }}</el-descriptions-item>
        <el-descriptions-item label="实际开始时间">{{ currentExecution?.actual_start_time || '-' }}</el-descriptions-item>
        <el-descriptions-item label="实际结束时间">{{ currentExecution?.actual_end_time || '-' }}</el-descriptions-item>
        <el-descriptions-item label="重试次数">{{ currentExecution?.retry_count }}</el-descriptions-item>
        <el-descriptions-item label="是否错过">{{ currentExecution?.is_missed ? '是' : '否' }}</el-descriptions-item>
        <el-descriptions-item label="是否补偿">{{ currentExecution?.is_compensated ? '是' : '否' }}</el-descriptions-item>
        <el-descriptions-item label="需人工复核">{{ currentExecution?.needs_review ? '是' : '否' }}</el-descriptions-item>
      </el-descriptions>
      
      <el-divider />
      
      <div class="action-buttons">
        <el-button type="success" @click="markSuccess">标记成功</el-button>
        <el-button type="warning" @click="markBlocked">标记拦截</el-button>
        <el-button type="info" @click="markCompensated">标记补偿</el-button>
        <el-button type="danger" @click="markReview">人工复核</el-button>
      </div>
    </el-dialog>

    <el-dialog v-model="exportVisible" title="导出日历" width="500px">
      <el-form :model="exportForm" label-width="100px">
        <el-form-item label="导出月份">
          <el-date-picker v-model="exportForm.month" type="month" />
        </el-form-item>
        <el-form-item label="导出格式">
          <el-radio-group v-model="exportForm.format">
            <el-radio label="xlsx">Excel</el-radio>
            <el-radio label="csv">CSV</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="exportVisible = false">取消</el-button>
        <el-button type="primary" @click="doExport">导出</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="diffVisible" title="差异预览" width="900px">
      <el-alert title="对比差异说明" type="info" :closable="false" style="margin-bottom: 20px">
        左侧为原始数据，右侧为重新计算后的数据，红色表示有变化的字段
      </el-alert>
      <el-table :data="diffData" border>
        <el-table-column label="字段" prop="field" width="150" />
        <el-table-column label="原始值" prop="original">
          <template #default="{ row }">
            <span :style="{ color: row.changed ? '#f56c6c' : '' }">{{ row.original }}</span>
          </template>
        </el-table-column>
        <el-table-column label="新值" prop="new">
          <template #default="{ row }">
            <span :style="{ color: row.changed ? '#67c23a' : '' }">{{ row.new }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Refresh } from '@element-plus/icons-vue'
import { calendarApi, executionApi, exportApi } from '../api'
import dayjs from 'dayjs'

const currentMonth = ref(new Date())
const calendarData = ref([])
const detailVisible = ref(false)
const exportVisible = ref(false)
const diffVisible = ref(false)
const currentExecution = ref(null)

const exportForm = ref({
  month: new Date(),
  format: 'xlsx'
})

const diffData = ref([])

const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const calendarDays = computed(() => {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDay = firstDay.getDay()
  
  const days = []
  
  for (let i = startDay - 1; i >= 0; i--) {
    const date = new Date(year, month, -i)
    days.push({
      date: date,
      day: date.getDate(),
      isOtherMonth: true,
      executions: [],
      stats: {}
    })
  }
  
  const dataMap = {}
  calendarData.value.forEach(d => {
    dataMap[d.date] = d
  })
  
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const date = new Date(year, month, i)
    const dateStr = dayjs(date).format('YYYY-MM-DD')
    const dayData = dataMap[dateStr] || { executions: [], stats: {} }
    days.push({
      date: date,
      day: i,
      isOtherMonth: false,
      isToday: dayjs(date).isSame(dayjs(), 'day'),
      executions: dayData.executions || [],
      stats: dayData.stats || {}
    })
  }
  
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    const date = new Date(year, month + 1, i)
    days.push({
      date: date,
      day: i,
      isOtherMonth: true,
      executions: [],
      stats: {}
    })
  }
  
  return days
})

const loadCalendar = async () => {
  try {
    const year = currentMonth.value.getFullYear()
    const month = currentMonth.value.getMonth() + 1
    const res = await calendarApi.get(year, month)
    calendarData.value = res.data
  } catch (e) {
    ElMessage.error('加载日历失败')
  }
}

const formatTime = (time) => {
  return dayjs(time).format('HH:mm')
}

const getStatusType = (status) => {
  const map = {
    success: 'success',
    failed: 'danger',
    running: 'primary',
    scheduled: 'info',
    blocked: 'warning',
    compensated: 'info',
    reviewing: 'warning'
  }
  return map[status] || 'info'
}

const showExecutionDetail = (exec) => {
  currentExecution.value = exec
  detailVisible.value = true
}

const showDayDetail = (day) => {
  console.log('Show day detail:', day)
}

const showExportPanel = () => {
  exportForm.value.month = currentMonth.value
  exportVisible.value = true
}

const doExport = async () => {
  try {
    const year = exportForm.value.month.getFullYear()
    const month = exportForm.value.month.getMonth() + 1
    const res = await exportApi.calendar(year, month)
    
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `task_calendar_${year}_${month}.xlsx`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    
    ElMessage.success('导出成功')
    exportVisible.value = false
  } catch (e) {
    ElMessage.error('导出失败')
  }
}

const markSuccess = async () => {
  try {
    await executionApi.updateStatus(currentExecution.value.id, 'success')
    ElMessage.success('已标记为成功')
    detailVisible.value = false
    loadCalendar()
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

const markBlocked = async () => {
  try {
    await executionApi.updateStatus(currentExecution.value.id, 'blocked')
    ElMessage.success('已标记为拦截')
    detailVisible.value = false
    loadCalendar()
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

const markCompensated = async () => {
  try {
    await executionApi.compensate(currentExecution.value.id)
    ElMessage.success('已标记为补偿')
    detailVisible.value = false
    loadCalendar()
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

const markReview = async () => {
  try {
    await executionApi.review(currentExecution.value.id)
    ElMessage.success('已标记为人工复核')
    detailVisible.value = false
    loadCalendar()
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

onMounted(() => {
  loadCalendar()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-actions {
  display: flex;
  gap: 10px;
}
.calendar-grid {
  border: 1px solid #ebeef5;
}
.calendar-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: #f5f7fa;
  border-bottom: 1px solid #ebeef5;
}
.week-day {
  padding: 10px;
  text-align: center;
  font-weight: bold;
}
.calendar-body {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}
.calendar-day {
  min-height: 120px;
  padding: 8px;
  border-right: 1px solid #ebeef5;
  border-bottom: 1px solid #ebeef5;
}
.calendar-day.other-month {
  background: #fafafa;
  color: #c0c4cc;
}
.calendar-day.today {
  background: #ecf5ff;
}
.day-number {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 8px;
}
.day-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.day-executions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.execution-item {
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  cursor: pointer;
}
.execution-item.success {
  background: #f0f9eb;
  color: #67c23a;
}
.execution-item.failed {
  background: #fef0f0;
  color: #f56c6c;
}
.execution-item.running {
  background: #ecf5ff;
  color: #409eff;
}
.execution-item.blocked {
  background: #fdf6ec;
  color: #e6a23c;
}
.execution-item.compensated {
  background: #f4f4f5;
  color: #909399;
}
.action-buttons {
  display: flex;
  gap: 10px;
  justify-content: center;
}
</style>
