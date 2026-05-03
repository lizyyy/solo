<template>
  <div class="max-w-6xl mx-auto p-4 sm:p-6">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">📅 今日用药</h1>
        <p class="text-gray-500 mt-1">{{ todayStr }} ({{ weekday }})</p>
      </div>
      <div class="flex gap-2">
        <button 
          @click="loadData"
          class="btn btn-outline flex items-center gap-2"
        >
          <span>🔄</span>
          <span class="hidden sm:inline">刷新</span>
        </button>
      </div>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="card p-4 flex items-center gap-4">
        <div class="text-3xl">💊</div>
        <div>
          <div class="text-2xl font-bold text-gray-800">{{ todayDoses.total }}</div>
          <div class="text-sm text-gray-500">今日总剂量</div>
        </div>
      </div>
      <div class="card p-4 flex items-center gap-4">
        <div class="text-3xl">✅</div>
        <div>
          <div class="text-2xl font-bold text-success-600">{{ todayDoses.taken }}</div>
          <div class="text-sm text-gray-500">已服用</div>
        </div>
      </div>
      <div class="card p-4 flex items-center gap-4">
        <div class="text-3xl">⏳</div>
        <div>
          <div class="text-2xl font-bold text-warning-600">{{ todayDoses.pending }}</div>
          <div class="text-sm text-gray-500">待服用</div>
        </div>
      </div>
    </div>
    
    <div v-if="memberDoses.length === 0" class="card p-8 text-center">
      <div class="text-5xl mb-4">🎉</div>
      <h3 class="text-lg font-medium text-gray-700 mb-2">今日暂无用药计划</h3>
      <p class="text-gray-500 mb-4">所有成员今天都不需要服药</p>
      <router-link to="/plans" class="btn btn-primary">
        管理用药计划
      </router-link>
    </div>
    
    <div v-else class="space-y-6">
      <div 
        v-for="memberGroup in memberDoses" 
        :key="memberGroup.memberId"
        class="card"
      >
        <div class="card-header bg-gray-50">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="text-2xl">{{ getMemberIcon(memberGroup.memberAge) }}</div>
              <div>
                <h3 class="font-semibold text-lg text-gray-800">{{ memberGroup.memberName }}</h3>
                <p class="text-sm text-gray-500">{{ memberGroup.memberAge }}岁</p>
              </div>
            </div>
            <div class="flex gap-2">
              <span class="badge badge-success">
                {{ memberGroup.doses.filter(d => d.status === 'taken').length }} 已服
              </span>
              <span class="badge badge-warning">
                {{ memberGroup.doses.filter(d => d.status === 'pending').length }} 待服
              </span>
            </div>
          </div>
        </div>
        <div class="card-body">
          <div class="space-y-3">
            <div 
              v-for="dose in memberGroup.doses" 
              :key="dose.doseId"
              class="flex items-center justify-between p-4 rounded-lg transition-colors"
              :class="{
                'bg-success-50 border border-success-200': dose.status === 'taken',
                'bg-gray-50': dose.status === 'pending',
                'bg-danger-50 border border-danger-200': dose.status === 'missed',
                'bg-gray-100': dose.status === 'skipped'
              }"
            >
              <div class="flex items-center gap-4">
                <button 
                  @click="toggleDoseStatus(dose)"
                  class="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  :class="{
                    'bg-success-500 text-white hover:bg-success-600': dose.status === 'taken',
                    'border-2 border-gray-300 hover:border-primary-400': dose.status === 'pending',
                    'bg-danger-200 text-danger-700': dose.status === 'missed',
                    'bg-gray-300 text-gray-600': dose.status === 'skipped'
                  }"
                >
                  <span v-if="dose.status === 'taken'">✓</span>
                  <span v-else-if="dose.status === 'missed'">✕</span>
                  <span v-else-if="dose.status === 'skipped'">–</span>
                </button>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-gray-800">{{ dose.medicineName }}</span>
                    <span class="text-sm text-gray-500">({{ dose.dosage || '请遵医嘱' }})</span>
                  </div>
                  <div class="flex items-center gap-3 mt-1">
                    <span class="text-sm text-gray-500">
                      ⏰ {{ dose.time }}
                    </span>
                    <span class="text-sm text-gray-500">
                      {{ mealTimingLabel(dose.mealTiming) }}
                    </span>
                    <span 
                      v-if="dose.notes"
                      class="text-sm text-gray-400"
                    >
                      💬 {{ dose.notes }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="flex gap-2">
                <select 
                  v-model="dose.status"
                  @change="updateDoseStatus(dose)"
                  class="text-sm border rounded px-2 py-1"
                >
                  <option value="pending">待服用</option>
                  <option value="taken">已服用</option>
                  <option value="skipped">已跳过</option>
                  <option value="missed">漏服</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="checkResult && checkResult.statistics.total > 0" class="card mt-6">
      <div class="card-header flex items-center justify-between">
        <h3 class="font-semibold text-lg text-gray-800 flex items-center gap-2">
          <span>⚠️</span>
          <span>用药风险提醒</span>
        </h3>
        <router-link to="/check" class="text-primary-600 hover:text-primary-700 text-sm">
          查看详情 →
        </router-link>
      </div>
      <div class="card-body">
        <div class="flex flex-wrap gap-4">
          <div v-if="checkResult.statistics.high > 0" class="flex items-center gap-2">
            <span class="text-danger-600 font-semibold">{{ checkResult.statistics.high }}</span>
            <span class="text-sm text-gray-600">项高风险</span>
          </div>
          <div v-if="checkResult.statistics.medium > 0" class="flex items-center gap-2">
            <span class="text-warning-600 font-semibold">{{ checkResult.statistics.medium }}</span>
            <span class="text-sm text-gray-600">项中风险</span>
          </div>
          <div v-if="checkResult.statistics.low > 0" class="flex items-center gap-2">
            <span class="text-success-600 font-semibold">{{ checkResult.statistics.low }}</span>
            <span class="text-sm text-gray-600">项低风险</span>
          </div>
        </div>
        <div class="mt-4 space-y-2 max-h-[200px] overflow-y-auto">
          <div 
            v-for="risk in checkResult.risks.slice(0, 3)" 
            :key="risk.id"
            class="text-sm p-3 rounded-lg"
            :class="{
              'bg-danger-50': risk.level === 'high',
              'bg-warning-50': risk.level === 'medium',
              'bg-success-50': risk.level === 'low'
            }"
          >
            <div class="font-medium mb-1"
              :class="{
                'text-danger-800': risk.level === 'high',
                'text-warning-800': risk.level === 'medium',
                'text-success-800': risk.level === 'low'
              }"
            >
              {{ risk.title }}
            </div>
            <p 
              class="text-gray-600 line-clamp-2"
              :class="{
                'text-danger-600': risk.level === 'high',
                'text-warning-600': risk.level === 'medium'
              }"
            >
              {{ risk.description }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { 
  getMedicationPlans, 
  getFamilyMembers, 
  getMedicines,
  updateMedicationPlan
} from '@/utils/storage'
import { isDateInRange, getTodayString, getWeekday } from '@/utils/dateUtils'
import { MEAL_TIMING_LABELS } from '@/utils/constants'
import { runAllChecks } from '@/utils/rulesEngine'

const todayStr = ref(getTodayString())
const weekday = ref(getWeekday(todayStr.value))
const memberDoses = ref([])
const checkResult = ref(null)

const todayDoses = computed(() => {
  const allDoses = memberDoses.value.flatMap(m => m.doses)
  return {
    total: allDoses.length,
    taken: allDoses.filter(d => d.status === 'taken').length,
    pending: allDoses.filter(d => d.status === 'pending').length,
    missed: allDoses.filter(d => d.status === 'missed').length,
    skipped: allDoses.filter(d => d.status === 'skipped').length
  }
})

function mealTimingLabel(timing) {
  return MEAL_TIMING_LABELS[timing] || '不限'
}

function getMemberIcon(age) {
  if (age <= 3) return '👶'
  if (age <= 12) return '👦'
  if (age <= 17) return '🧑'
  if (age >= 65) return '👴'
  return '👨'
}

function loadData() {
  todayStr.value = getTodayString()
  weekday.value = getWeekday(todayStr.value)
  
  const plans = getMedicationPlans()
  const members = getFamilyMembers()
  const medicines = getMedicines()
  
  const activePlans = plans.filter(plan => 
    isDateInRange(todayStr.value, plan.startDate, plan.endDate)
  )
  
  const memberMap = {}
  activePlans.forEach(plan => {
    const member = members.find(m => m.id === plan.familyMemberId)
    const medicine = medicines.find(m => m.id === plan.medicineId)
    
    if (!member || !medicine) return
    
    if (!memberMap[member.id]) {
      memberMap[member.id] = {
        memberId: member.id,
        memberName: member.name,
        memberAge: member.age,
        doses: []
      }
    }
    
    plan.doses.forEach(dose => {
      memberMap[member.id].doses.push({
        planId: plan.id,
        doseId: dose.id,
        medicineId: medicine.id,
        medicineName: medicine.name,
        time: dose.time,
        status: dose.status || 'pending',
        dosage: plan.dosage,
        mealTiming: plan.mealTiming,
        notes: plan.notes
      })
    })
  })
  
  memberDoses.value = Object.values(memberMap).map(group => {
    group.doses.sort((a, b) => a.time.localeCompare(b.time))
    return group
  })
  
  checkResult.value = runAllChecks()
}

function toggleDoseStatus(dose) {
  if (dose.status === 'taken') {
    dose.status = 'pending'
  } else if (dose.status === 'pending') {
    dose.status = 'taken'
  } else {
    dose.status = 'pending'
  }
  updateDoseStatus(dose)
}

function updateDoseStatus(dose) {
  const plans = getMedicationPlans()
  const plan = plans.find(p => p.id === dose.planId)
  
  if (plan) {
    const doseIndex = plan.doses.findIndex(d => d.id === dose.doseId)
    if (doseIndex > -1) {
      plan.doses[doseIndex].status = dose.status
      updateMedicationPlan(plan.id, { doses: plan.doses })
    }
  }
}

onMounted(() => {
  loadData()
})
</script>
