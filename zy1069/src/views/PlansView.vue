<template>
  <div class="max-w-6xl mx-auto p-4 sm:p-6">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">📋 用药计划</h1>
        <p class="text-gray-500 mt-1">为家庭成员安排用药计划，设置用药时间和周期</p>
      </div>
      <button 
        @click="showAddModal = true"
        class="btn btn-primary flex items-center gap-2"
      >
        <span>➕</span>
        <span>新建计划</span>
      </button>
    </div>
    
    <div class="card mb-6">
      <div class="card-body">
        <div class="flex flex-col sm:flex-row gap-4">
          <div class="flex-1">
            <select 
              v-model="filterMemberId"
              class="input"
            >
              <option value="">全部成员</option>
              <option v-for="member in members" :key="member.id" :value="member.id">
                {{ member.name }}
              </option>
            </select>
          </div>
          <div class="flex gap-2">
            <select 
              v-model="filterStatus"
              class="input"
            >
              <option value="">全部状态</option>
              <option value="active">进行中</option>
              <option value="upcoming">即将开始</option>
              <option value="ended">已结束</option>
            </select>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="filteredPlans.length === 0" class="card p-8 text-center">
      <div class="text-5xl mb-4">📋</div>
      <h3 class="text-lg font-medium text-gray-700 mb-2">暂无用药计划</h3>
      <p class="text-gray-500 mb-4">点击上方按钮创建您的第一个用药计划</p>
      <button 
        @click="showAddModal = true"
        class="btn btn-primary"
      >
        新建计划
      </button>
    </div>
    
    <div v-else class="space-y-4">
      <div 
        v-for="plan in filteredPlans" 
        :key="plan.id"
        class="card hover:shadow-md transition-shadow"
      >
        <div class="card-header flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <h3 class="font-semibold text-lg text-gray-800">
                {{ getMemberName(plan.familyMemberId) }} - {{ getMedicineName(plan.medicineId) }}
              </h3>
              <span 
                :class="['badge', getStatusBadgeClass(plan)]"
              >
                {{ getStatusLabel(plan) }}
              </span>
            </div>
            <p class="text-sm text-gray-500 mt-1">
              周期：{{ plan.startDate }} 至 {{ plan.endDate }}
            </p>
          </div>
          <div class="flex gap-2">
            <button 
              @click="editPlan(plan)"
              class="text-gray-400 hover:text-primary-500 transition-colors"
              title="编辑"
            >
              ✏️
            </button>
            <button 
              @click="confirmDelete(plan)"
              class="text-gray-400 hover:text-danger-500 transition-colors"
              title="删除"
            >
              🗑️
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="text-xs font-medium text-gray-500">剂量</label>
              <p class="text-sm text-gray-700 mt-1">{{ plan.dosage || '请遵医嘱' }}</p>
            </div>
            <div>
              <label class="text-xs font-medium text-gray-500">用药频率</label>
              <p class="text-sm text-gray-700 mt-1">每日 {{ plan.frequencyPerDay }} 次</p>
            </div>
            <div>
              <label class="text-xs font-medium text-gray-500">饭前/饭后</label>
              <p class="text-sm text-gray-700 mt-1">{{ mealTimingLabel(plan.mealTiming) }}</p>
            </div>
          </div>
          
          <div class="mt-4">
            <label class="text-xs font-medium text-gray-500">用药时间</label>
            <div class="mt-2 flex flex-wrap gap-2">
              <span 
                v-for="dose in plan.doses" 
                :key="dose.id"
                class="badge badge-primary"
              >
                {{ dose.time }}
              </span>
            </div>
          </div>
          
          <div v-if="plan.notes" class="mt-4 pt-4 border-t border-gray-100">
            <label class="text-xs font-medium text-gray-500">备注</label>
            <p class="text-sm text-gray-600 mt-1">{{ plan.notes }}</p>
          </div>
        </div>
      </div>
    </div>
    
    <div 
      v-if="showAddModal || showEditModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      @click.self="closeModal"
    >
      <div class="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div class="card-header flex justify-between items-center">
          <h2 class="text-xl font-semibold">
            {{ showAddModal ? '新建用药计划' : '编辑用药计划' }}
          </h2>
          <button 
            @click="closeModal"
            class="text-gray-400 hover:text-gray-600 text-xl"
          >
            ✕
          </button>
        </div>
        <form @submit.prevent="savePlan" class="card-body space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="label">家庭成员 *</label>
              <select 
                v-model="form.familyMemberId"
                class="input"
                required
              >
                <option value="">请选择</option>
                <option v-for="member in members" :key="member.id" :value="member.id">
                  {{ member.name }} ({{ member.age }}岁)
                </option>
              </select>
            </div>
            <div>
              <label class="label">药品 *</label>
              <select 
                v-model="form.medicineId"
                class="input"
                required
              >
                <option value="">请选择</option>
                <option v-for="medicine in medicines" :key="medicine.id" :value="medicine.id">
                  {{ medicine.name }}
                </option>
              </select>
            </div>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="label">开始日期 *</label>
              <input 
                v-model="form.startDate"
                type="date"
                class="input"
                required
              />
            </div>
            <div>
              <label class="label">结束日期 *</label>
              <input 
                v-model="form.endDate"
                type="date"
                class="input"
                required
              />
            </div>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="label">每日次数 *</label>
              <select 
                v-model.number="form.frequencyPerDay"
                class="input"
                @change="updateDoses"
                required
              >
                <option :value="1">1次</option>
                <option :value="2">2次</option>
                <option :value="3">3次</option>
                <option :value="4">4次</option>
              </select>
            </div>
            <div>
              <label class="label">饭前/饭后</label>
              <select 
                v-model="form.mealTiming"
                class="input"
              >
                <option value="any">不限</option>
                <option value="before">饭前</option>
                <option value="after">饭后</option>
              </select>
            </div>
            <div>
              <label class="label">剂量</label>
              <input 
                v-model="form.dosage"
                type="text"
                class="input"
                placeholder="如：1片、1粒、10ml"
              />
            </div>
          </div>
          
          <div>
            <label class="label">用药时间</label>
            <div class="flex flex-wrap gap-3">
              <div 
                v-for="(dose, index) in form.doses" 
                :key="index"
                class="flex items-center gap-2"
              >
                <span class="text-sm text-gray-500">第 {{ index + 1 }} 次：</span>
                <input 
                  v-model="dose.time"
                  type="time"
                  class="input w-28"
                  required
                />
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-2">
              默认时间：1次=08:00，2次=08:00/20:00，3次=08:00/14:00/20:00，4次=06:00/12:00/18:00/24:00
            </p>
          </div>
          
          <div>
            <label class="label">备注</label>
            <textarea 
              v-model="form.notes"
              class="input min-h-[80px]"
              placeholder="其他需要注意的信息..."
            ></textarea>
          </div>
          
          <div class="flex gap-3 pt-4">
            <button 
              type="button"
              @click="closeModal"
              class="btn btn-secondary flex-1"
            >
              取消
            </button>
            <button 
              type="submit"
              class="btn btn-primary flex-1"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
    
    <div 
      v-if="showDeleteConfirm"
      class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      @click.self="showDeleteConfirm = false"
    >
      <div class="bg-white rounded-lg max-w-sm w-full">
        <div class="card-header">
          <h2 class="text-lg font-semibold">确认删除</h2>
        </div>
        <div class="card-body">
          <p class="text-gray-600">
            确定要删除这个用药计划吗？此操作不可撤销。
          </p>
          <div class="flex gap-3 mt-6">
            <button 
              @click="showDeleteConfirm = false"
              class="btn btn-secondary flex-1"
            >
              取消
            </button>
            <button 
              @click="deletePlan"
              class="btn btn-danger flex-1"
            >
              确认删除
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { 
  getMedicationPlans, 
  addMedicationPlan, 
  updateMedicationPlan, 
  deleteMedicationPlan,
  getFamilyMembers,
  getMedicines
} from '@/utils/storage'
import { createMedicationPlan, createDose } from '@/utils/models'
import { MEAL_TIMING, MEAL_TIMING_LABELS } from '@/utils/constants'
import { isDateInRange, getTodayString } from '@/utils/dateUtils'

const plans = ref([])
const members = ref([])
const medicines = ref([])
const filterMemberId = ref('')
const filterStatus = ref('')
const showAddModal = ref(false)
const showEditModal = ref(false)
const showDeleteConfirm = ref(false)
const planToDelete = ref(null)
const editingPlanId = ref(null)

const defaultDosesByFrequency = {
  1: [{ time: '08:00' }],
  2: [{ time: '08:00' }, { time: '20:00' }],
  3: [{ time: '08:00' }, { time: '14:00' }, { time: '20:00' }],
  4: [{ time: '06:00' }, { time: '12:00' }, { time: '18:00' }, { time: '24:00' }]
}

const defaultForm = () => ({
  familyMemberId: '',
  medicineId: '',
  startDate: getTodayString(),
  endDate: getTodayString(),
  frequencyPerDay: 1,
  doses: [createDose({ time: '08:00' })],
  mealTiming: 'any',
  dosage: '',
  notes: ''
})

const form = ref(defaultForm())

const filteredPlans = computed(() => {
  let result = [...plans.value]
  
  if (filterMemberId.value) {
    result = result.filter(p => p.familyMemberId === filterMemberId.value)
  }
  
  if (filterStatus.value) {
    const today = getTodayString()
    result = result.filter(p => {
      if (filterStatus.value === 'active') {
        return isDateInRange(today, p.startDate, p.endDate)
      }
      if (filterStatus.value === 'upcoming') {
        return today < p.startDate
      }
      if (filterStatus.value === 'ended') {
        return today > p.endDate
      }
      return true
    })
  }
  
  return result.sort((a, b) => {
    return new Date(b.startDate) - new Date(a.startDate)
  })
})

function getMemberName(memberId) {
  const member = members.value.find(m => m.id === memberId)
  return member ? member.name : '未知'
}

function getMedicineName(medicineId) {
  const medicine = medicines.value.find(m => m.id === medicineId)
  return medicine ? medicine.name : '未知'
}

function mealTimingLabel(timing) {
  return MEAL_TIMING_LABELS[timing] || '不限'
}

function getStatusLabel(plan) {
  const today = getTodayString()
  if (today < plan.startDate) return '即将开始'
  if (today > plan.endDate) return '已结束'
  return '进行中'
}

function getStatusBadgeClass(plan) {
  const today = getTodayString()
  if (today < plan.startDate) return 'badge-primary'
  if (today > plan.endDate) return 'badge-gray'
  return 'badge-success'
}

function loadData() {
  plans.value = getMedicationPlans()
  members.value = getFamilyMembers()
  medicines.value = getMedicines()
}

function resetForm() {
  form.value = defaultForm()
  editingPlanId.value = null
}

function closeModal() {
  showAddModal.value = false
  showEditModal.value = false
  resetForm()
}

function updateDoses() {
  const frequency = form.value.frequencyPerDay || 1
  const defaultTimes = defaultDosesByFrequency[frequency] || defaultDosesByFrequency[1]
  form.value.doses = defaultTimes.map(t => createDose({ time: t.time }))
}

function editPlan(plan) {
  editingPlanId.value = plan.id
  form.value = { 
    ...plan,
    doses: plan.doses.map(d => createDose({ ...d }))
  }
  showEditModal.value = true
}

function confirmDelete(plan) {
  planToDelete.value = plan
  showDeleteConfirm.value = true
}

function deletePlan() {
  if (planToDelete.value) {
    deleteMedicationPlan(planToDelete.value.id)
    loadData()
  }
  showDeleteConfirm.value = false
  planToDelete.value = null
}

function savePlan() {
  if (showAddModal.value) {
    const newPlan = createMedicationPlan(form.value)
    addMedicationPlan(newPlan)
  } else if (showEditModal.value && editingPlanId.value) {
    updateMedicationPlan(editingPlanId.value, form.value)
  }
  
  loadData()
  closeModal()
}

onMounted(() => {
  loadData()
})
</script>
