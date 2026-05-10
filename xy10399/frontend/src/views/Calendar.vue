<template>
  <div class="calendar-page">
    <el-card class="filter-card">
      <div class="filter-row">
        <el-form :inline="true" :model="filters" class="filter-form">
          <el-form-item label="门店">
            <el-select v-model="filters.storeId" placeholder="全部门店" clearable @change="loadData">
              <el-option
                v-for="store in stores"
                :key="store.id"
                :label="store.name"
                :value="store.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="日期范围">
            <el-date-picker
              v-model="filters.dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              @change="loadData"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadData">
              <el-icon><Search /></el-icon>
              查询
            </el-button>
            <el-button @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
      </div>
    </el-card>

    <el-card class="calendar-card">
      <template #header>
        <div class="card-header">
          <span>📅 排班日历</span>
          <div class="legend">
            <span class="legend-item"><span class="dot original"></span> 原排班</span>
            <span class="legend-item"><span class="dot transfer"></span> 借调班次</span>
          </div>
        </div>
      </template>

      <el-table
        :data="calendarData"
        :span-method="arraySpanMethod"
        border
        stripe
        class="calendar-table"
      >
        <el-table-column
          prop="employeeName"
          label="员工"
          width="120"
          fixed="left"
        >
          <template #default="{ row }">
            <div class="employee-cell">
              <div class="employee-name">{{ row.employeeName }}</div>
              <div class="employee-store" v-if="row.originalStore">
                原门店: {{ row.originalStore }}
              </div>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column
          v-for="day in weekDays"
          :key="day.date"
          :label="day.label"
          align="center"
        >
          <template #default="{ row }">
            <div class="day-cell">
              <template v-for="schedule in getDaySchedules(row.employeeId, day.date)" :key="schedule.id">
                <el-tooltip placement="top">
                  <template #content>
                    <div class="schedule-tooltip">
                      <div><strong>门店:</strong> {{ schedule.storeName }}</div>
                      <div><strong>时间:</strong> {{ schedule.start_time }} - {{ schedule.end_time }}</div>
                      <div><strong>类型:</strong> {{ schedule.shift_type === 'transfer' ? '借调' : '原排班' }}</div>
                      <div v-if="schedule.shift_type === 'transfer' && schedule.originalStoreName">
                        <strong>原门店:</strong> {{ schedule.originalStoreName }}
                      </div>
                    </div>
                  </template>
                  <div
                    class="schedule-item"
                    :class="schedule.shift_type"
                  >
                    <div class="schedule-time">{{ schedule.start_time }}-{{ schedule.end_time }}</div>
                    <div class="schedule-store">{{ schedule.storeName }}</div>
                  </div>
                </el-tooltip>
              </template>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-row :gutter="20" class="stats-row">
      <el-col :span="8">
        <el-card class="stat-card original">
          <div class="stat-icon">📋</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.originalCount }}</div>
            <div class="stat-label">原排班数量</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="stat-card transfer">
          <div class="stat-icon">🔄</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.transferCount }}</div>
            <div class="stat-label">借调班次</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="stat-card total">
          <div class="stat-icon">👥</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.employeeCount }}</div>
            <div class="stat-label">涉及员工</div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { stores as storesApi, schedules as schedulesApi, employees as employeesApi } from '../api'

const stores = ref([])
const employees = ref([])
const schedules = ref([])

const filters = ref({
  storeId: null,
  dateRange: [
    dayjs().startOf('week').format('YYYY-MM-DD'),
    dayjs().endOf('week').format('YYYY-MM-DD')
  ]
})

const weekDays = computed(() => {
  if (!filters.value.dateRange || filters.value.dateRange.length < 2) return []
  
  const days = []
  let current = dayjs(filters.value.dateRange[0])
  const end = dayjs(filters.value.dateRange[1])
  
  while (current.isBefore(end) || current.isSame(end, 'day')) {
    days.push({
      date: current.format('YYYY-MM-DD'),
      label: `${current.format('MM-DD')} ${['日','一','二','三','四','五','六'][current.day()]}`
    })
    current = current.add(1, 'day')
  }
  
  return days
})

const calendarData = computed(() => {
  const employeeMap = new Map()
  
  schedules.value.forEach(schedule => {
    if (!employeeMap.has(schedule.employee_id)) {
      const emp = employees.value.find(e => e.id === schedule.employee_id)
      employeeMap.set(schedule.employee_id, {
        employeeId: schedule.employee_id,
        employeeName: schedule.employee_name,
        originalStore: emp?.original_store_name,
        schedules: []
      })
    }
    employeeMap.get(schedule.employee_id).schedules.push(schedule)
  })
  
  return Array.from(employeeMap.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName))
})

const stats = computed(() => {
  const originalCount = schedules.value.filter(s => s.shift_type === 'regular').length
  const transferCount = schedules.value.filter(s => s.shift_type === 'transfer').length
  const employeeIds = new Set(schedules.value.map(s => s.employee_id))
  
  return {
    originalCount,
    transferCount,
    employeeCount: employeeIds.size
  }
})

const getDaySchedules = (employeeId, date) => {
  return schedules.value.filter(
    s => s.employee_id === employeeId && s.date === date
  )
}

const arraySpanMethod = ({ row, column, rowIndex, columnIndex }) => {
  if (columnIndex === 0) {
    return {
      rowspan: 1,
      colspan: 1
    }
  }
}

const loadStores = async () => {
  try {
    const res = await storesApi.getAll()
    stores.value = res.data.stores
  } catch (e) {
    ElMessage.error('加载门店数据失败')
  }
}

const loadEmployees = async () => {
  try {
    const res = await employeesApi.getAll(filters.value.storeId)
    employees.value = res.data.employees
  } catch (e) {
    ElMessage.error('加载员工数据失败')
  }
}

const loadSchedules = async () => {
  if (!filters.value.dateRange || filters.value.dateRange.length < 2) return
  
  try {
    const res = await schedulesApi.getByDate(
      filters.value.dateRange[0],
      filters.value.dateRange[1],
      filters.value.storeId
    )
    schedules.value = res.data.schedules
  } catch (e) {
    ElMessage.error('加载排班数据失败')
  }
}

const loadData = async () => {
  await Promise.all([loadEmployees(), loadSchedules()])
}

const resetFilters = () => {
  filters.value = {
    storeId: null,
    dateRange: [
      dayjs().startOf('week').format('YYYY-MM-DD'),
      dayjs().endOf('week').format('YYYY-MM-DD')
    ]
  }
  loadData()
}

onMounted(async () => {
  await loadStores()
  await loadData()
})
</script>

<style scoped>
.calendar-page {
  max-width: 1600px;
  margin: 0 auto;
}

.filter-card {
  margin-bottom: 20px;
}

.filter-row {
  display: flex;
  justify-content: center;
}

.filter-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 16px;
}

.legend {
  display: flex;
  gap: 20px;
  font-weight: normal;
  font-size: 14px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.dot.original {
  background: #67c23a;
}

.dot.transfer {
  background: #e6a23c;
}

.employee-cell {
  padding: 4px 0;
}

.employee-name {
  font-weight: 600;
  color: #303133;
}

.employee-store {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.day-cell {
  min-height: 60px;
  padding: 4px;
}

.schedule-item {
  padding: 6px 8px;
  margin-bottom: 4px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.schedule-item:hover {
  transform: scale(1.02);
}

.schedule-item.original {
  background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
  color: white;
}

.schedule-item.transfer {
  background: linear-gradient(135deg, #e6a23c 0%, #ebb563 100%);
  color: white;
}

.schedule-time {
  font-weight: 600;
}

.schedule-store {
  font-size: 11px;
  opacity: 0.9;
}

.schedule-tooltip {
  line-height: 1.8;
}

.stats-row {
  margin-top: 20px;
}

.stat-card {
  text-align: center;
  border: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.stat-card .el-card__body {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 24px;
}

.stat-icon {
  font-size: 48px;
}

.stat-content {
  text-align: left;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
}

.stat-label {
  font-size: 14px;
  color: #606266;
  margin-top: 8px;
}

.stat-card.original .stat-value {
  color: #67c23a;
}

.stat-card.transfer .stat-value {
  color: #e6a23c;
}

.stat-card.total .stat-value {
  color: #409eff;
}

.calendar-table :deep(.el-table__row:hover) {
  background-color: #f5f7fa !important;
}
</style>
