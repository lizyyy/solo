<template>
  <div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">到期提醒</div>
        <div class="flex gap-8">
          <button class="btn btn-success" @click="exportReminders">导出Excel</button>
          <button class="btn btn-primary" @click="generateReminders">生成今日提醒</button>
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-item">
          <label>提醒类型:</label>
          <select v-model="filters.reminderType" @change="loadReminders">
            <option value="">全部</option>
            <option v-for="(text, value) in ReminderTypeText" :key="value" :value="value">
              {{ text }}
            </option>
          </select>
        </div>
        <div class="filter-item">
          <label>处理状态:</label>
          <select v-model="filters.processStatus" @change="loadReminders">
            <option value="">全部</option>
            <option v-for="(text, value) in ProcessStatusText" :key="value" :value="value">
              {{ text }}
            </option>
          </select>
        </div>
        <div class="filter-item">
          <label>提醒日期:</label>
          <input type="date" v-model="filters.reminderDate" @change="loadReminders" />
        </div>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <span>加载中...</span>
      </div>
      <div v-else-if="reminders.length === 0" class="empty-state">
        <div class="icon">🔔</div>
        <p>暂无提醒数据</p>
      </div>
      <div v-else class="table-container">
        <table>
          <thead>
          <tr>
            <th><input type="checkbox" v-model="selectAll" @change="toggleSelectAll" /></th>
            <th>票据号</th>
            <th>承兑人</th>
            <th>票面金额</th>
            <th>到期日</th>
            <th>提醒类型</th>
            <th>距到期</th>
            <th>票据状态</th>
            <th>托收中</th>
            <th>处理状态</th>
            <th>操作</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="item in reminders" :key="item.id">
            <td><input type="checkbox" :value="item.id" v-model="selectedIds" /></td>
            <td>{{ item.billNo }}</td>
            <td>{{ item.acceptor }}</td>
            <td class="amount">¥{{ formatAmount(item.amount) }}</td>
            <td>{{ item.matureDate }}</td>
            <td>
              <span :class="getReminderBadgeClass(item.reminderType)">
                {{ getReminderTypeText(item.reminderType) }}
              </span>
            </td>
            <td :class="item.daysToMature < 0 ? 'text-danger' : ''">
              {{ item.daysToMature < 0 ? '逾期' + Math.abs(item.daysToMature) + '天' : item.daysToMature + '天' }}
            </td>
            <td>
              <span :class="getBillStatusBadgeClass(item.billStatus)">
                {{ getBillStatusText(item.billStatus) }}
              </span>
            </td>
            <td>
              <span :class="item.hasActiveCollection ? 'badge badge-warning' : 'badge badge-info'">
                {{ item.hasActiveCollection ? '是' : '否' }}
              </span>
            </td>
            <td>
              <span :class="getProcessStatusBadgeClass(item.processStatus)">
                {{ getProcessStatusText(item.processStatus) }}
              </span>
            </td>
            <td>
              <button 
                v-if="item.processStatus === 'pending'" 
                class="btn btn-sm btn-success" 
                @click="confirmReminder(item)"
              >
                确认处理
              </button>
            </td>
          </tr>
          </tbody>
        </table>
      </div>

      <div v-if="selectedIds.length > 0" class="mt-16">
        <button class="btn btn-success" @click="batchConfirm">
          批量确认 ({{ selectedIds.length }})
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import reminderService from '../services/ReminderService.js'
import exportService from '../services/ExportService.js'
import { 
  BillStatusText, 
  ProcessStatusText, 
  ReminderTypeText,
  ProcessStatus 
} from '../models/types.js'

const reminders = ref([])
const loading = ref(false)
const selectedIds = ref([])

const filters = reactive({
  reminderType: '',
  processStatus: '',
  reminderDate: new Date().toISOString().split('T')[0]
})

const selectAll = computed({
  get: () => reminders.value.length > 0 && selectedIds.value.length === reminders.value.length,
  set: (val) => {
    if (val) {
      selectedIds.value = reminders.value.map(r => r.id)
    } else {
      selectedIds.value = []
    }
  }
})

const formatAmount = (amount) => {
  return Number(amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const getReminderBadgeClass = (type) => {
  const map = {
    mature_7d: 'badge badge-info',
    mature_3d: 'badge badge-warning',
    mature_1d: 'badge badge-danger',
    mature_today: 'badge badge-danger',
    overdue: 'badge badge-danger'
  }
  return map[type] || 'badge'
}

const getReminderTypeText = (type) => ReminderTypeText[type] || type

const getBillStatusBadgeClass = (status) => {
  if (['collected', 'discounted'].includes(status)) return 'badge badge-success'
  if (['expired', 'void'].includes(status)) return 'badge badge-danger'
  if (status === 'collecting') return 'badge badge-warning'
  return 'badge badge-primary'
}

const getBillStatusText = (status) => BillStatusText[status] || status

const getProcessStatusBadgeClass = (status) => {
  if (status === 'confirmed') return 'badge badge-success'
  if (status === 'returned') return 'badge badge-danger'
  if (status === 'temp') return 'badge badge-info'
  return 'badge badge-warning'
}

const getProcessStatusText = (status) => ProcessStatusText[status] || status

const loadReminders = async () => {
  loading.value = true
  try {
    const filterParams = {}
    if (filters.reminderType) filterParams.reminderType = filters.reminderType
    if (filters.processStatus) filterParams.processStatus = filters.processStatus
    if (filters.reminderDate) filterParams.reminderDate = filters.reminderDate
    
    reminders.value = await reminderService.getAllReminders(filterParams)
  } catch (error) {
    console.error('加载提醒列表失败:', error)
  } finally {
    loading.value = false
  }
}

const generateReminders = async () => {
  try {
    const result = await reminderService.generateReminders()
    alert(`生成了 ${result.totalGenerated} 条提醒，跳过 ${result.totalSkipped} 条`)
    loadReminders()
  } catch (error) {
    console.error('生成提醒失败:', error)
    alert('生成提醒失败')
  }
}

const exportReminders = async () => {
  try {
    await exportService.exportReminders(reminders.value)
  } catch (error) {
    console.error('导出失败:', error)
    alert('导出失败')
  }
}

const confirmReminder = async (item) => {
  try {
    await reminderService.updateProcessStatus(item.id, ProcessStatus.CONFIRMED)
    alert('确认成功')
    loadReminders()
  } catch (error) {
    console.error('确认失败:', error)
    alert('确认失败')
  }
}

const batchConfirm = async () => {
  if (selectedIds.value.length === 0) return
  try {
    const results = await reminderService.batchConfirmReminders(selectedIds.value)
    const successCount = results.filter(r => r.success).length
    alert(`批量确认完成：成功 ${successCount} 条，失败 ${results.length - successCount} 条`)
    selectedIds.value = []
    loadReminders()
  } catch (error) {
    console.error('批量确认失败:', error)
    alert('批量确认失败')
  }
}

onMounted(() => {
  loadReminders()
})
</script>
