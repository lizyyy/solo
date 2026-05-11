<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
      <!-- 头部 -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200">
        <h2 class="text-xl font-semibold text-gray-800 flex items-center">
          <Wallet class="w-6 h-6 mr-2 text-green-600" />
          调整预算
        </h2>
        <button
          @click="$emit('close')"
          class="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <X class="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <!-- 内容 -->
      <div class="p-6">
        <!-- 当前状态 -->
        <div class="mb-6 p-4 bg-gray-50 rounded-lg">
          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">当前预算总额</span>
              <span class="font-medium text-gray-800">¥{{ bookStore.budget.total.toLocaleString() }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">已使用</span>
              <span class="font-medium text-red-600">¥{{ bookStore.budget.used.toLocaleString() }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600">剩余可用</span>
              <span class="font-medium text-green-600">¥{{ bookStore.availableBudget.toLocaleString() }}</span>
            </div>
          </div>
        </div>

        <!-- 新预算输入 -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            新预算总额 (¥) <span class="text-red-500">*</span>
          </label>
          <input
            v-model.number="newBudget"
            type="number"
            min="0"
            placeholder="请输入新的预算总额"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <p v-if="error" class="mt-2 text-sm text-red-600 flex items-center">
            <AlertCircle class="w-4 h-4 mr-1" />
            {{ error }}
          </p>
          <p class="mt-2 text-xs text-gray-500">
            注意: 新预算不能小于已使用金额 (¥{{ bookStore.budget.used.toLocaleString() }})
          </p>
        </div>

        <!-- 预算预警 -->
        <div
          v-if="newBudget && newBudget < bookStore.budget.total"
          class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
        >
          <p class="text-sm text-yellow-700 flex items-start">
            <AlertTriangle class="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
            <span>您正在减少预算总额，请确保已批准的图书不会受到影响。已使用的预算金额不会改变。</span>
          </p>
        </div>
      </div>

      <!-- 底部 -->
      <div class="p-6 border-t border-gray-200 flex justify-end space-x-3">
        <button
          @click="$emit('close')"
          class="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
        >
          取消
        </button>
        <button
          @click="handleSubmit"
          :disabled="!newBudget || newBudget < bookStore.budget.used"
          class="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          确认调整
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useBookStore } from '../stores/bookStore'
import { Wallet, X, AlertCircle, AlertTriangle } from 'lucide-vue-next'

defineEmits(['close'])

const bookStore = useBookStore()

const newBudget = ref(bookStore.budget.total)
const error = ref('')

watch(newBudget, (value) => {
  if (value && value < bookStore.budget.used) {
    error.value = `新预算不能小于已使用金额 (¥${bookStore.budget.used.toLocaleString()})`
  } else {
    error.value = ''
  }
})

const handleSubmit = () => {
  const result = bookStore.updateBudget(newBudget.value)
  
  if (result.success) {
    window.$message?.success('预算调整成功') || alert('预算调整成功')
    window.location.reload()
  } else {
    error.value = result.error
  }
}
</script>
