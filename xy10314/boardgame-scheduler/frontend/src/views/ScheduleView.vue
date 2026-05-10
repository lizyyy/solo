<template>
  <div class="schedule-view">
    <div class="toolbar">
      <div class="toolbar-left">
        <el-date-picker
          v-model="selectedDate"
          type="date"
          placeholder="选择日期"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          @change="handleDateChange"
        />
        <el-button type="primary" @click="handleRefresh">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
      <div class="toolbar-right">
        <el-button type="success" @click="handleNewReservation">
          <el-icon><Plus /></el-icon>
          新建预约
        </el-button>
        <el-button type="warning" @click="handleExport">
          <el-icon><Download /></el-icon>
          导出当天安排
        </el-button>
      </div>
    </div>

    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon" style="background: #e6f7ff">
              <el-icon size="32" color="#1890ff"><Calendar /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ totalReservations }}</div>
              <div class="stat-label">今日预约</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon" style="background: #fff7e6">
              <el-icon size="32" color="#fa8c16"><Crown /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ privateCount }}</div>
              <div class="stat-label">包场</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon" style="background: #f6ffed">
              <el-icon size="32" color="#52c41a"><UserFilled /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ sharedCount }}</div>
              <div class="stat-label">拼桌</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon" style="background: #fff1f0">
              <el-icon size="32" color="#f5222d"><Money /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">¥{{ dailyRevenue.toFixed(2) }}</div>
              <div class="stat-label">今日营收</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="schedule-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>日程调度 - {{ selectedDate }}</span>
          <div class="legend">
            <el-tag type="danger" effect="light" size="small">包场</el-tag>
            <el-tag type="success" effect="light" size="small">拼桌</el-tag>
            <el-tag type="info" effect="light" size="small">已取消</el-tag>
          </div>
        </div>
      </template>
      
      <div class="schedule-grid" v-loading="store.loading">
        <div class="time-header">
          <div class="time-slot" v-for="hour in timeSlots" :key="hour">
            {{ hour }}:00
          </div>
        </div>

        <div class="table-rows">
          <div 
            v-for="table in store.tables" 
            :key="table.id" 
            class="table-row"
          >
            <div class="table-label">
              <div class="table-name">{{ table.name }}</div>
              <div class="table-capacity">容纳{{ table.capacity }}人</div>
            </div>
            <div class="table-slots">
              <div 
                v-for="hour in timeSlots" 
                :key="hour" 
                class="time-slot"
                :class="{ locked: isTableLocked(table.id, hour) }"
                @click="handleSlotClick(table, hour)"
              >
                <template v-if="!isTableLocked(table.id, hour)">
                  <el-icon size="14" color="#d9d9d9"><Plus /></el-icon>
                </template>
              </div>

              <div 
                v-for="reservation in getReservationsForTable(table.id)"
                :key="reservation.id"
                class="reservation-block"
                :class="getReservationClass(reservation)"
                :style="getReservationStyle(reservation)"
                @click.stop="handleReservationClick(reservation)"
              >
                <div class="reservation-time">{{ reservation.start_time }}-{{ reservation.end_time }}</div>
                <div class="reservation-customer">{{ reservation.customer_name }}</div>
                <div class="reservation-script">{{ reservation.script_name }}</div>
                <div class="reservation-host">{{ reservation.host_name || '无主持人' }}</div>
                <div class="reservation-players">{{ reservation.player_count }}人</div>
                <el-tag 
                  v-if="reservation.reservation_type === 'private'" 
                  type="danger" 
                  size="small"
                  effect="dark"
                  class="private-tag"
                >
                  包场锁定
                </el-tag>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <ReservationDialog
      v-model:visible="dialogVisible"
      :reservation="currentReservation"
      :is-edit="isEditMode"
      @saved="handleDialogSaved"
    />

    <el-dialog
      v-model="historyDialogVisible"
      title="预约历史记录"
      width="600px"
    >
      <el-timeline v-if="history.length > 0">
        <el-timeline-item
          v-for="(item, index) in history"
          :key="item.id"
          :timestamp="item.created_at"
          placement="top"
        >
          <el-card>
            <div class="history-action">
              <el-tag :type="getHistoryTagType(item.action)">
                {{ getHistoryActionLabel(item.action) }}
              </el-tag>
              <span class="history-actor">操作人: {{ item.actor }}</span>
            </div>
            <div v-if="item.old_value" class="history-diff">
              <div class="history-label">变更前:</div>
              <pre>{{ formatHistoryValue(item.old_value) }}</pre>
            </div>
            <div v-if="item.new_value" class="history-diff">
              <div class="history-label">变更后:</div>
              <pre>{{ formatHistoryValue(item.new_value) }}</pre>
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="暂无历史记录" />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useSchedulerStore } from '../stores/scheduler'
import { reservationsApi } from '../api'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import ReservationDialog from '../components/ReservationDialog.vue'

const store = useSchedulerStore()
const selectedDate = ref(store.selectedDate)
const dialogVisible = ref(false)
const historyDialogVisible = ref(false)
const currentReservation = ref(null)
const isEditMode = ref(false)
const history = ref([])

const timeSlots = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]

const totalReservations = computed(() => 
  store.reservations.filter(r => r.status !== 'cancelled').length
)

const privateCount = computed(() => 
  store.reservations.filter(r => r.reservation_type === 'private' && r.status !== 'cancelled').length
)

const sharedCount = computed(() => 
  store.reservations.filter(r => r.reservation_type === 'shared' && r.status !== 'cancelled').length
)

const dailyRevenue = computed(() => 
  store.reservations
    .filter(r => r.status !== 'cancelled')
    .reduce((sum, r) => sum + r.total_amount, 0)
)

function getReservationsForTable(tableId) {
  return store.reservations.filter(r => r.table_id === tableId)
}

function isTableLocked(tableId, hour) {
  const reservations = getReservationsForTable(tableId)
  return reservations.some(r => {
    if (r.status === 'cancelled') return false
    const startHour = parseInt(r.start_time.split(':')[0])
    const endHour = parseInt(r.end_time.split(':')[0])
    return hour >= startHour && hour < endHour
  })
}

function getReservationClass(reservation) {
  const classes = []
  if (reservation.status === 'cancelled') {
    classes.push('cancelled')
  } else if (reservation.reservation_type === 'private') {
    classes.push('private')
  } else {
    classes.push('shared')
  }
  return classes
}

function getReservationStyle(reservation) {
  const startHour = parseInt(reservation.start_time.split(':')[0])
  const endHour = parseInt(reservation.end_time.split(':')[0])
  const endMin = parseInt(reservation.end_time.split(':')[1])
  
  const leftOffset = (startHour - 10) * 80
  const duration = (endHour - startHour) + (endMin / 60)
  const width = duration * 80
  
  return {
    left: `${leftOffset}px`,
    width: `${width}px`
  }
}

function handleDateChange() {
  store.selectedDate = selectedDate.value
  store.loadReservations()
  store.loadWaitlist()
}

function handleRefresh() {
  store.loadAll()
}

function handleSlotClick(table, hour) {
  currentReservation.value = {
    table_id: table.id,
    date: selectedDate.value,
    start_time: `${hour.toString().padStart(2, '0')}:00`,
    reservation_type: 'shared'
  }
  isEditMode.value = false
  dialogVisible.value = true
}

async function handleReservationClick(reservation) {
  const action = await ElMessageBox.confirm(
    `${reservation.customer_name} - ${reservation.script_name}\n${reservation.start_time}-${reservation.end_time}`,
    '预约详情',
    {
      confirmButtonText: '编辑',
      cancelButtonText: '更多操作',
      distinguishCancelAndClose: true,
      type: 'info'
    }
  ).catch(() => 'more')

  if (action === 'confirm') {
    currentReservation.value = { ...reservation }
    isEditMode.value = true
    dialogVisible.value = true
  } else if (action === 'more') {
    showMoreActions(reservation)
  }
}

async function showMoreActions(reservation) {
  const action = await ElMessageBox.confirm(
    '请选择操作',
    '更多操作',
    {
      showCancelButton: false,
      confirmButtonText: '查看历史',
      type: 'info',
      distinguishCancelAndClose: true,
      customClass: 'more-actions-dialog'
    }
  ).catch(async () => {
    if (reservation.status !== 'cancelled') {
      await ElMessageBox.confirm(
        '确定要取消该预约吗？',
        '取消预约',
        {
          confirmButtonText: '确认取消',
          cancelButtonText: '返回',
          type: 'warning'
        }
      ).then(async () => {
        await store.cancelReservation(reservation.id)
      }).catch(() => {})
    }
  })

  if (action === 'confirm') {
    await loadHistory(reservation.id)
    historyDialogVisible.value = true
  }
}

async function loadHistory(reservationId) {
  const res = await reservationsApi.getHistory(reservationId)
  if (res.data.success) {
    history.value = res.data.data
  }
}

function handleNewReservation() {
  currentReservation.value = {
    date: selectedDate.value,
    reservation_type: 'shared'
  }
  isEditMode.value = false
  dialogVisible.value = true
}

function handleDialogSaved() {
  dialogVisible.value = false
}

async function handleExport() {
  try {
    const res = await reservationsApi.exportDaily(selectedDate.value)
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `schedule_${selectedDate.value}.xlsx`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error('导出失败')
  }
}

function getHistoryTagType(action) {
  const types = {
    create: 'success',
    update: 'primary',
    cancel: 'danger'
  }
  return types[action] || 'info'
}

function getHistoryActionLabel(action) {
  const labels = {
    create: '创建预约',
    update: '修改预约',
    cancel: '取消预约'
  }
  return labels[action] || action
}

function formatHistoryValue(value) {
  try {
    const obj = JSON.parse(value)
    const keys = ['customer_name', 'table_name', 'script_name', 'host_name', 
                  'date', 'start_time', 'end_time', 'player_count', 
                  'total_amount', 'status', 'notes']
    const filtered = {}
    keys.forEach(k => {
      if (obj[k] !== undefined && obj[k] !== null) {
        filtered[k] = obj[k]
      }
    })
    return JSON.stringify(filtered, null, 2)
  } catch {
    return value
  }
}

watch(() => store.selectedDate, (newVal) => {
  selectedDate.value = newVal
})

onMounted(() => {
  store.loadAll()
})
</script>

<style scoped>
.schedule-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toolbar-left, .toolbar-right {
  display: flex;
  gap: 12px;
}

.stats-row {
  margin-bottom: 0;
}

.stat-card {
  border-radius: 12px;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.legend {
  display: flex;
  gap: 8px;
}

.schedule-grid {
  display: flex;
  flex-direction: column;
}

.time-header {
  display: flex;
  margin-left: 120px;
  border-bottom: 2px solid #e4e7ed;
  padding-bottom: 8px;
}

.time-slot {
  width: 80px;
  text-align: center;
  font-size: 12px;
  color: #909399;
}

.table-rows {
  display: flex;
  flex-direction: column;
}

.table-row {
  display: flex;
  border-bottom: 1px solid #ebeef5;
  padding: 8px 0;
}

.table-label {
  width: 120px;
  padding-right: 12px;
  flex-shrink: 0;
}

.table-name {
  font-weight: 600;
  color: #303133;
}

.table-capacity {
  font-size: 12px;
  color: #909399;
}

.table-slots {
  position: relative;
  flex: 1;
  display: flex;
  min-height: 60px;
}

.table-slots .time-slot {
  height: 60px;
  border-right: 1px dashed #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
}

.table-slots .time-slot:hover:not(.locked) {
  background: #f5f7fa;
}

.table-slots .time-slot.locked {
  cursor: not-allowed;
  background: transparent;
}

.reservation-block {
  position: absolute;
  top: 8px;
  height: 50px;
  border-radius: 6px;
  padding: 4px 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
  z-index: 10;
}

.reservation-block:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.reservation-block.private {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
  color: white;
}

.reservation-block.shared {
  background: linear-gradient(135deg, #52c41a 0%, #45a849 100%);
  color: white;
}

.reservation-block.cancelled {
  background: #f5f7fa;
  color: #c0c4cc;
  text-decoration: line-through;
  opacity: 0.6;
}

.reservation-time {
  font-size: 11px;
  font-weight: 600;
}

.reservation-customer {
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reservation-script {
  font-size: 10px;
  opacity: 0.9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reservation-host {
  font-size: 10px;
  opacity: 0.8;
}

.reservation-players {
  font-size: 10px;
  opacity: 0.8;
}

.private-tag {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 10px;
}

.history-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.history-actor {
  font-size: 12px;
  color: #909399;
}

.history-diff {
  margin-bottom: 8px;
}

.history-label {
  font-size: 12px;
  color: #606266;
  margin-bottom: 4px;
}

.history-diff pre {
  background: #f5f7fa;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
