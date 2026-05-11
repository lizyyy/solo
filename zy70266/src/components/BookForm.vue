<template>
  <div class="bg-white rounded-xl shadow p-6">
    <h2 class="text-lg font-semibold text-gray-800 mb-4 flex items-center">
      <PlusCircle class="w-5 h-5 mr-2 text-primary-600" />
      添加荐购图书
    </h2>

    <!-- 成功提示 -->
    <div
      v-if="successMessage"
      class="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm"
    >
      <div class="flex items-center">
        <CheckCircle class="w-4 h-4 mr-2" />
        {{ successMessage }}
      </div>
    </div>

    <!-- 错误提示 -->
    <div
      v-if="errors.length > 0"
      class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg"
    >
      <div class="flex items-center text-red-700 font-medium text-sm mb-2">
        <AlertCircle class="w-4 h-4 mr-2" />
        添加失败，请检查以下问题:
      </div>
      <ul class="text-red-600 text-sm space-y-1">
        <li v-for="(error, index) in errors" :key="index" class="flex items-start">
          <span class="mr-1">•</span>
          {{ error.message }}
        </li>
      </ul>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          图书名称 <span class="text-red-500">*</span>
        </label>
        <input
          v-model="formData.title"
          type="text"
          placeholder="请输入图书名称"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          作者 <span class="text-red-500">*</span>
        </label>
        <input
          v-model="formData.author"
          type="text"
          placeholder="请输入作者名称"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          价格 (¥) <span class="text-red-500">*</span>
        </label>
        <input
          v-model="formData.price"
          type="number"
          step="0.01"
          min="0"
          placeholder="请输入图书价格"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <p class="text-xs text-gray-500 mt-1">
          预算检查: 剩余预算 ¥{{ bookStore.availableBudget.toLocaleString() }}
        </p>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          年龄分层 <span class="text-red-500">*</span>
        </label>
        <select
          v-model="formData.ageGroup"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">请选择年龄分层</option>
          <option v-for="group in bookStore.ageGroups" :key="group" :value="group">
            {{ group }}
          </option>
        </select>
        <p class="text-xs text-gray-500 mt-1">
          各年龄层图书分布需要现场协商
        </p>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          推荐人 <span class="text-red-500">*</span>
        </label>
        <input
          v-model="formData.recommendedBy"
          type="text"
          placeholder="请输入推荐人姓名"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          ISBN (可选，用于重复检测)
        </label>
        <input
          v-model="formData.isbn"
          type="text"
          placeholder="请输入ISBN编号"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <button
        type="submit"
        class="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center"
      >
        <PlusCircle class="w-4 h-4 mr-2" />
        添加荐购
      </button>
    </form>

    <!-- 重复检测说明 -->
    <div class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
      <p class="text-xs text-yellow-700 flex items-start">
        <Info class="w-4 h-4 mr-1 flex-shrink-0 mt-0.5" />
        <span>系统会自动检测重复图书：相同书名+作者或相同ISBN会被阻止添加，需要现场协商处理。</span>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useBookStore } from '../stores/bookStore'
import { PlusCircle, CheckCircle, AlertCircle, Info } from 'lucide-vue-next'

const bookStore = useBookStore()

const formData = reactive({
  title: '',
  author: '',
  price: '',
  ageGroup: '',
  recommendedBy: '',
  isbn: ''
})

const errors = ref([])
const successMessage = ref('')

const handleSubmit = () => {
  errors.value = []
  successMessage.value = ''

  const result = bookStore.addBook(formData)

  if (result.success) {
    successMessage.value = `成功添加: ${formData.title}`
    
    Object.keys(formData).forEach(key => {
      formData[key] = ''
    })

    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } else {
    errors.value = result.errors
    
    bookStore.addIssue('add_book_error', `添加图书失败: ${formData.title || '未知书名'}`, {
      errors: result.errors
    })
  }
}
</script>
