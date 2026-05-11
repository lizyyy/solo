<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
      <!-- 头部 -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200">
        <h2 class="text-xl font-semibold text-gray-800 flex items-center">
          <Shield class="w-6 h-6 mr-2 text-primary-600" />
          系统规则确认面板
        </h2>
        <button
          @click="$emit('close')"
          class="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <X class="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="flex-1 overflow-y-auto p-6">
        <div class="space-y-8">
          <!-- 荐购规则 -->
          <section>
            <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <BookOpen class="w-5 h-5 mr-2 text-blue-600" />
              1. 荐购清单规则
            </h3>
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <ul class="space-y-3 text-sm text-gray-700">
                <li class="flex items-start">
                  <CheckCircle class="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span><strong>必填字段:</strong> 图书名称、作者、价格、年龄分层、推荐人为必填项</span>
                </li>
                <li class="flex items-start">
                  <CheckCircle class="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span><strong>价格验证:</strong> 价格必须是大于0的数字</span>
                </li>
                <li class="flex items-start">
                  <CheckCircle class="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span><strong>年龄分层:</strong> 必须选择儿童/青少年/成人/老年之一</span>
                </li>
                <li class="flex items-start">
                  <CheckCircle class="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span><strong>重复检测:</strong> 相同书名+作者或相同ISBN会被阻止添加</span>
                </li>
              </ul>
            </div>

            <div class="mt-4">
              <h4 class="text-sm font-medium text-gray-700 mb-2">当前状态验证:</h4>
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-gray-50 rounded-lg p-3">
                  <p class="text-xs text-gray-500">总荐购数</p>
                  <p class="text-xl font-bold text-gray-800">{{ bookStore.books.length }}</p>
                </div>
                <div class="bg-gray-50 rounded-lg p-3">
                  <p class="text-xs text-gray-500">待审核</p>
                  <p class="text-xl font-bold text-yellow-600">{{ bookStore.pendingBooks.length }}</p>
                </div>
              </div>
            </div>
          </section>

          <!-- 投票规则 -->
          <section>
            <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <ThumbsUp class="w-5 h-5 mr-2 text-purple-600" />
              2. 居民投票规则
            </h3>
            <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <ul class="space-y-3 text-sm text-gray-700">
                <li class="flex items-start">
                  <CheckCircle class="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span><strong>实名投票:</strong> 投票时需输入居民姓名，一人一票</span>
                </li>
                <li class="flex items-start">
                  <CheckCircle class="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span><strong>重复投票限制:</strong> 同一居民不能对同一本书投票多次</span>
                </li>
                <li class="flex items-start">
                  <CheckCircle class="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span><strong>状态限制:</strong> 只能对"待审核"状态的图书投票</span>
                </li>
                <li class="flex items-start">
                  <CheckCircle class="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span><strong>投票透明:</strong> 投票人姓名公开显示，便于现场监督</span>
                </li>
              </ul>
            </div>

            <div class="mt-4">
              <h4 class="text-sm font-medium text-gray-700 mb-2">当前投票统计:</h4>
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-gray-50 rounded-lg p-3">
                  <p class="text-xs text-gray-500">总投票数</p>
                  <p class="text-xl font-bold text-purple-600">{{ bookStore.totalVotes }}</p>
                </div>
                <div class="bg-gray-50 rounded-lg p-3">
                  <p class="text-xs text-gray-500">参与居民数</p>
                  <p class="text-xl font-bold text-purple-600">{{ bookStore.residents.length }}</p>
                </div>
              </div>
            </div>
          </section>

          <!-- 预算规则 -->
          <section>
            <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <Wallet class="w-5 h-5 mr-2 text-green-600" />
              3. 预算占用规则
            </h3>
            <div class="bg-green-50 border border-green-200 rounded-lg p-4">
              <ul class="space-y-3 text-sm text-gray-700">
                <li class="flex items-start">
                  <CheckCircle class="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span><strong>实时占用:</strong> 批准图书时立即占用对应预算</span>
                </li>
                <li class="flex items-start">
                  <CheckCircle class="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span><strong>预算检查:</strong> 图书价格超过剩余预算时禁止批准</span>
                </li>
                <li class="flex items-start">
                  <CheckCircle class="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span><strong>预算释放:</strong> 删除已批准的图书会释放预算</span>
                </li>
                <li class="flex items-start">
                  <CheckCircle class="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span><strong>预算调整:</strong> 新预算不能小于已使用金额</span>
                </li>
              </ul>
            </div>

            <div class="mt-4">
              <h4 class="text-sm font-medium text-gray-700 mb-2">当前预算状态:</h4>
              <div class="space-y-3">
                <div class="w-full bg-gray-200 rounded-full h-3">
                  <div
                    class="h-3 rounded-full transition-all"
                    :class="budgetPercentage > 90 ? 'bg-red-500' : budgetPercentage > 70 ? 'bg-yellow-500' : 'bg-green-500'"
                    :style="{ width: `${budgetPercentage}%` }"
                  ></div>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600">已使用: ¥{{ bookStore.budget.used.toLocaleString() }}</span>
                  <span class="text-gray-600">剩余: ¥{{ bookStore.availableBudget.toLocaleString() }}</span>
                  <span class="text-gray-600">总额: ¥{{ bookStore.budget.total.toLocaleString() }}</span>
                </div>
                <p class="text-xs text-gray-500">使用率: {{ budgetPercentage }}%</p>
              </div>
            </div>
          </section>

          <!-- 年龄分层规则 -->
          <section>
            <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <Users class="w-5 h-5 mr-2 text-orange-600" />
              4. 年龄分层规则
            </h3>
            <div class="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <ul class="space-y-3 text-sm text-gray-700">
                <li class="flex items-start">
                  <CheckCircle class="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span><strong>四个分层:</strong> 儿童、青少年、成人、老年</span>
                </li>
                <li class="flex items-start">
                  <AlertCircle class="w-4 h-4 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span><strong>现场协商:</strong> 各分层的图书分布比例需要现场协商决定</span>
                </li>
                <li class="flex items-start">
                  <CheckCircle class="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span><strong>筛选功能:</strong> 支持按年龄分层筛选荐购清单</span>
                </li>
              </ul>
            </div>

            <div class="mt-4">
              <h4 class="text-sm font-medium text-gray-700 mb-2">当前年龄分层分布:</h4>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div
                  v-for="group in bookStore.ageGroups"
                  :key="group"
                  class="bg-gray-50 rounded-lg p-3"
                >
                  <p class="text-xs text-gray-500">{{ group }}</p>
                  <p class="text-lg font-bold text-orange-600">
                    {{ bookStore.booksByAgeGroup[group].length }}
                  </p>
                  <p class="text-xs text-gray-500">
                    占比 {{ getAgeGroupPercentage(group) }}%
                  </p>
                </div>
              </div>
            </div>
          </section>

          <!-- 数据持久化规则 -->
          <section>
            <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <Save class="w-5 h-5 mr-2 text-indigo-600" />
              5. 数据持久化规则
            </h3>
            <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <ul class="space-y-3 text-sm text-gray-700">
                <li class="flex items-start">
                  <CheckCircle class="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span><strong>自动保存:</strong> 所有操作自动保存到浏览器本地存储</span>
                </li>
                <li class="flex items-start">
                  <CheckCircle class="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span><strong>工作区恢复:</strong> 刷新页面后自动恢复当前工作状态</span>
                </li>
                <li class="flex items-start">
                  <CheckCircle class="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span><strong>操作历史:</strong> 记录最近100条操作历史</span>
                </li>
              </ul>
            </div>

            <div class="mt-4">
              <h4 class="text-sm font-medium text-gray-700 mb-2">最近操作历史:</h4>
              <div class="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                <div
                  v-if="bookStore.history.length > 0"
                  class="space-y-2"
                >
                  <div
                    v-for="entry in bookStore.history.slice(0, 10)"
                    :key="entry.id"
                    class="flex items-start text-xs"
                  >
                    <span class="text-gray-400 mr-2">{{ formatTime(entry.timestamp) }}</span>
                    <span class="text-gray-700">{{ entry.description }}</span>
                  </div>
                </div>
                <p v-else class="text-xs text-gray-500 text-center py-2">暂无操作记录</p>
              </div>
            </div>
          </section>

          <!-- 问题处理规则 -->
          <section>
            <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <AlertTriangle class="w-5 h-5 mr-2 text-red-600" />
              6. 问题处理规则
            </h3>
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
              <ul class="space-y-3 text-sm text-gray-700">
                <li class="flex items-start">
                  <CheckCircle class="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span><strong>不静默跳过:</strong> 所有异常操作都会进入问题列表</span>
                </li>
                <li class="flex items-start">
                  <CheckCircle class="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span><strong>保留来源:</strong> 问题记录包含详细信息和错误来源</span>
                </li>
                <li class="flex items-start">
                  <CheckCircle class="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span><strong>可追溯:</strong> 问题列表显示创建时间和处理状态</span>
                </li>
              </ul>
            </div>

            <div class="mt-4">
              <h4 class="text-sm font-medium text-gray-700 mb-2">当前问题统计:</h4>
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-gray-50 rounded-lg p-3">
                  <p class="text-xs text-gray-500">待处理问题</p>
                  <p class="text-xl font-bold text-red-600">{{ bookStore.activeIssues.length }}</p>
                </div>
                <div class="bg-gray-50 rounded-lg p-3">
                  <p class="text-xs text-gray-500">总问题数</p>
                  <p class="text-xl font-bold text-gray-800">{{ bookStore.issues.length }}</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <!-- 底部 -->
      <div class="p-6 border-t border-gray-200 flex justify-end">
        <button
          @click="$emit('close')"
          class="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition"
        >
          确认已了解规则
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useBookStore } from '../stores/bookStore'
import {
  Shield,
  X,
  BookOpen,
  CheckCircle,
  AlertCircle,
  ThumbsUp,
  Wallet,
  Users,
  Save,
  AlertTriangle
} from 'lucide-vue-next'

defineEmits(['close'])

const bookStore = useBookStore()

const budgetPercentage = computed(() => {
  if (bookStore.budget.total === 0) return 0
  return Math.round((bookStore.budget.used / bookStore.budget.total) * 100)
})

const getAgeGroupPercentage = (group) => {
  if (bookStore.books.length === 0) return 0
  return Math.round((bookStore.booksByAgeGroup[group].length / bookStore.books.length) * 100)
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
</script>
