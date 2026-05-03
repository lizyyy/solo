<template>
  <div class="max-w-6xl mx-auto p-4 sm:p-6">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">⚠️ 规则检查</h1>
        <p class="text-gray-500 mt-1">检查用药风险，包括成分重复、过敏禁忌、年龄不适、间隔过短、过期药品等</p>
      </div>
      <button 
        @click="runCheck"
        class="btn btn-primary flex items-center gap-2"
      >
        <span>🔍</span>
        <span>重新检查</span>
      </button>
    </div>
    
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="card p-4 text-center">
        <div class="text-3xl font-bold text-gray-800">{{ checkResult?.statistics?.total || 0 }}</div>
        <div class="text-sm text-gray-500 mt-1">总计风险</div>
      </div>
      <div class="card p-4 text-center bg-danger-50 border-danger-200">
        <div class="text-3xl font-bold text-danger-600">{{ checkResult?.statistics?.high || 0 }}</div>
        <div class="text-sm text-gray-500 mt-1">高风险</div>
      </div>
      <div class="card p-4 text-center bg-warning-50 border-warning-200">
        <div class="text-3xl font-bold text-warning-600">{{ checkResult?.statistics?.medium || 0 }}</div>
        <div class="text-sm text-gray-500 mt-1">中风险</div>
      </div>
      <div class="card p-4 text-center bg-success-50 border-success-200">
        <div class="text-3xl font-bold text-success-600">{{ checkResult?.statistics?.low || 0 }}</div>
        <div class="text-sm text-gray-500 mt-1">低风险</div>
      </div>
    </div>
    
    <div class="card mb-6">
      <div class="card-header">
        <h3 class="font-semibold text-gray-700">风险类型分布</h3>
      </div>
      <div class="card-body">
        <div v-if="checkResult?.statistics?.byCategory && Object.keys(checkResult.statistics.byCategory).length > 0" class="flex flex-wrap gap-4">
          <div 
            v-for="(count, category) in checkResult.statistics.byCategory" 
            :key="category"
            class="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg"
          >
            <span class="text-lg font-semibold text-primary-600">{{ count }}</span>
            <span class="text-sm text-gray-600">{{ categoryLabels[category] || category }}</span>
          </div>
        </div>
        <div v-else class="text-center text-gray-500 py-4">
          暂无风险数据
        </div>
      </div>
    </div>
    
    <div v-if="checkResult?.risks?.length === 0" class="card p-8 text-center">
      <div class="text-5xl mb-4">✅</div>
      <h3 class="text-lg font-medium text-gray-700 mb-2">没有发现用药风险</h3>
      <p class="text-gray-500">您的家庭用药情况看起来很安全</p>
    </div>
    
    <div v-else class="space-y-4">
      <div 
        v-for="risk in checkResult.risks" 
        :key="risk.id"
        class="card overflow-hidden"
        :class="{
          'border-l-4 border-l-danger-500': risk.level === 'high',
          'border-l-4 border-l-warning-500': risk.level === 'medium',
          'border-l-4 border-l-success-500': risk.level === 'low'
        }"
      >
        <div class="card-header bg-gray-50">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-start gap-3">
              <div 
                class="text-2xl mt-1"
                :class="{
                  'text-danger-500': risk.level === 'high',
                  'text-warning-500': risk.level === 'medium',
                  'text-success-500': risk.level === 'low'
                }"
              >
                {{ getRiskIcon(risk.level) }}
              </div>
              <div>
                <h3 class="font-semibold text-lg text-gray-800">{{ risk.title }}</h3>
                <div class="flex items-center gap-2 mt-1">
                  <span 
                    class="badge"
                    :class="{
                      'badge-danger': risk.level === 'high',
                      'badge-warning': risk.level === 'medium',
                      'badge-success': risk.level === 'low'
                    }"
                  >
                    {{ getRiskLevelLabel(risk.level) }}
                  </span>
                  <span class="badge badge-primary">
                    {{ categoryLabels[risk.category] || risk.category }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="card-body">
          <div class="prose max-w-none">
            <p class="text-gray-700 leading-relaxed">{{ risk.description }}</p>
          </div>
          
          <div v-if="risk.affectedMembers?.length > 0 || risk.affectedMedicines?.length > 0" class="mt-4 pt-4 border-t border-gray-100">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div v-if="risk.affectedMembers?.length > 0">
                <label class="text-xs font-medium text-gray-500 mb-2 block">涉及家庭成员</label>
                <div class="flex flex-wrap gap-2">
                  <span 
                    v-for="memberId in risk.affectedMembers" 
                    :key="memberId"
                    class="badge badge-primary"
                  >
                    {{ getMemberName(memberId) }}
                  </span>
                </div>
              </div>
              
              <div v-if="risk.affectedMedicines?.length > 0">
                <label class="text-xs font-medium text-gray-500 mb-2 block">涉及药品</label>
                <div class="flex flex-wrap gap-2">
                  <span 
                    v-for="medicineId in risk.affectedMedicines" 
                    :key="medicineId"
                    class="badge badge-warning"
                  >
                    {{ getMedicineName(medicineId) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="mt-4 pt-4 border-t border-gray-100">
            <label class="text-xs font-medium text-gray-500 mb-2 block">建议操作</label>
            <div class="flex flex-wrap gap-2">
              <router-link 
                v-if="risk.category === 'duplicate_ingredient' || risk.category === 'allergy' || risk.category === 'contraindication' || risk.category === 'age_inappropriate' || risk.category === 'interval_too_close'"
                to="/plans"
                class="btn btn-outline text-sm"
              >
                查看用药计划
              </router-link>
              <router-link 
                v-if="risk.category === 'expired' || risk.category === 'expiring_soon' || risk.category === 'out_of_stock' || risk.category === 'low_stock'"
                to="/medicines"
                class="btn btn-outline text-sm"
              >
                查看药品管理
              </router-link>
              <router-link 
                v-if="risk.affectedMembers?.length > 0 && (risk.category === 'allergy' || risk.category === 'contraindication')"
                to="/family"
                class="btn btn-outline text-sm"
              >
                查看家庭成员
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="card mt-8">
      <div class="card-header bg-gray-50">
        <h3 class="font-semibold text-gray-700">📋 检查规则说明</h3>
      </div>
      <div class="card-body">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 class="font-medium text-gray-800 mb-2">🔴 高风险检查</h4>
            <ul class="space-y-2 text-sm text-gray-600">
              <li class="flex items-start gap-2">
                <span class="text-danger-500">•</span>
                <span><strong>成分重复</strong>：同一成员同时使用含相同成分的多种药品</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-danger-500">•</span>
                <span><strong>过敏警告</strong>：成员过敏史与药品禁忌或成分匹配</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-danger-500">•</span>
                <span><strong>慢性病禁忌</strong>：成员慢性病与药品禁忌匹配</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-danger-500">•</span>
                <span><strong>药品过期</strong>：药品有效期已过</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-danger-500">•</span>
                <span><strong>库存耗尽</strong>：药品库存为0</span>
              </li>
            </ul>
          </div>
          <div>
            <h4 class="font-medium text-gray-800 mb-2">🟡 中风险检查</h4>
            <ul class="space-y-2 text-sm text-gray-600">
              <li class="flex items-start gap-2">
                <span class="text-warning-500">•</span>
                <span><strong>年龄不适宜</strong>：药品适用人群与成员年龄不符</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-warning-500">•</span>
                <span><strong>间隔过短</strong>：同一成员多种药品服药时间间隔不足</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-warning-500">•</span>
                <span><strong>即将过期</strong>：药品将在30天内过期</span>
              </li>
            </ul>
            <h4 class="font-medium text-gray-800 mb-2 mt-4">🟢 低风险检查</h4>
            <ul class="space-y-2 text-sm text-gray-600">
              <li class="flex items-start gap-2">
                <span class="text-success-500">•</span>
                <span><strong>库存不足</strong>：药品库存≤5份</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { runAllChecks, CATEGORY_LABELS } from '@/utils/rulesEngine'
import { RISK_LEVEL, RISK_LEVEL_LABELS } from '@/utils/constants'
import { getFamilyMembers, getMedicines } from '@/utils/storage'

const checkResult = ref(null)
const members = ref([])
const medicines = ref([])
const categoryLabels = CATEGORY_LABELS

function getRiskIcon(level) {
  if (level === RISK_LEVEL.HIGH) return '🚨'
  if (level === RISK_LEVEL.MEDIUM) return '⚠️'
  return 'ℹ️'
}

function getRiskLevelLabel(level) {
  return RISK_LEVEL_LABELS[level] || level
}

function getMemberName(memberId) {
  const member = members.value.find(m => m.id === memberId)
  return member ? member.name : '未知成员'
}

function getMedicineName(medicineId) {
  const medicine = medicines.value.find(m => m.id === medicineId)
  return medicine ? medicine.name : '未知药品'
}

function runCheck() {
  members.value = getFamilyMembers()
  medicines.value = getMedicines()
  checkResult.value = runAllChecks()
}

onMounted(() => {
  runCheck()
})
</script>
