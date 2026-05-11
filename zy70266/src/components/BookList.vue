<template>
  <div class="bg-white rounded-xl shadow p-6">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-lg font-semibold text-gray-800 flex items-center">
        <List class="w-5 h-5 mr-2 text-primary-600" />
        荐购清单
      </h2>
      <div class="flex items-center space-x-2">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          @click="currentTab = tab.value"
          class="px-3 py-1.5 text-sm font-medium rounded-lg transition"
          :class="currentTab === tab.value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
        >
          {{ tab.label }} ({{ getTabCount(tab.value) }})
        </button>
      </div>
    </div>

    <!-- 年龄分层筛选 -->
    <div class="mb-4 flex items-center space-x-2">
      <span class="text-sm text-gray-600">年龄分层:</span>
      <button
        @click="selectedAgeGroup = ''"
        class="px-2 py-1 text-xs rounded transition"
        :class="selectedAgeGroup === '' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
      >
        全部
      </button>
      <button
        v-for="group in bookStore.ageGroups"
        :key="group"
        @click="selectedAgeGroup = group"
        class="px-2 py-1 text-xs rounded transition"
        :class="selectedAgeGroup === group ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
      >
        {{ group }} ({{ bookStore.booksByAgeGroup[group].length }})
      </button>
    </div>

    <!-- 图书列表 -->
    <div v-if="filteredBooks.length > 0" class="space-y-4">
      <div
        v-for="book in filteredBooks"
        :key="book.id"
        class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center space-x-2 mb-1">
              <h3 class="font-semibold text-gray-800">{{ book.title }}</h3>
              <span
                class="px-2 py-0.5 text-xs font-medium rounded-full"
                :class="getStatusClass(book.status)"
              >
                {{ getStatusText(book.status) }}
              </span>
              <span
                class="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600"
              >
                {{ book.ageGroup }}
              </span>
            </div>
            <p class="text-sm text-gray-600 mb-2">作者: {{ book.author }}</p>
            <div class="flex items-center space-x-4 text-sm text-gray-500">
              <span class="flex items-center">
                <DollarSign class="w-4 h-4 mr-1" />
                ¥{{ book.price.toLocaleString() }}
              </span>
              <span class="flex items-center">
                <User class="w-4 h-4 mr-1" />
                推荐人: {{ book.recommendedBy }}
              </span>
              <span v-if="book.isbn" class="flex items-center">
                <BookOpen class="w-4 h-4 mr-1" />
                ISBN: {{ book.isbn }}
              </span>
            </div>
            <div v-if="book.rejectReason" class="mt-2 text-sm text-red-600">
              拒绝原因: {{ book.rejectReason }}
            </div>
          </div>

          <!-- 投票和操作区域 -->
          <div class="ml-4 flex flex-col items-end">
            <!-- 投票数 -->
            <div class="flex items-center space-x-2 mb-2">
              <span class="text-2xl font-bold text-purple-600">{{ book.votes }}</span>
              <span class="text-sm text-gray-500">票</span>
            </div>

            <!-- 投票按钮 (仅待审核状态显示) -->
            <div v-if="book.status === 'pending'" class="flex items-center space-x-2">
              <input
                v-if="showVoteInput[book.id]"
                v-model="voterName[book.id]"
                type="text"
                placeholder="您的姓名"
                class="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                @keyup.enter="handleVote(book.id)"
              />
              <button
                v-if="showVoteInput[book.id]"
                @click="handleVote(book.id)"
                class="px-3 py-1 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded transition"
              >
                确认投票
              </button>
              <button
                v-else
                @click="showVoteInput[book.id] = true"
                class="flex items-center px-3 py-1 text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 rounded transition"
              >
                <ThumbsUp class="w-4 h-4 mr-1" />
                投票
              </button>
            </div>

            <!-- 操作按钮 (仅待审核状态显示) -->
            <div v-if="book.status === 'pending'" class="flex items-center space-x-2 mt-2">
              <button
                @click="handleApprove(book.id)"
                class="flex items-center px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition"
                :disabled="book.price > bookStore.availableBudget"
                :class="{ 'opacity-50 cursor-not-allowed': book.price > bookStore.availableBudget }"
              >
                <CheckCircle class="w-4 h-4 mr-1" />
                批准
              </button>
              <button
                @click="showRejectModal(book.id)"
                class="flex items-center px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded transition"
              >
                <XCircle class="w-4 h-4 mr-1" />
                拒绝
              </button>
              <button
                @click="showDeleteConfirm(book.id)"
                class="flex items-center px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition"
              >
                <Trash2 class="w-4 h-4 mr-1" />
                删除
              </button>
            </div>
          </div>
        </div>

        <!-- 投票人列表 -->
        <div v-if="book.voters.length > 0" class="mt-3 pt-3 border-t border-gray-100">
          <p class="text-xs text-gray-500 mb-1">投票人:</p>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="(voter, index) in book.voters"
              :key="index"
              class="px-2 py-0.5 text-xs bg-purple-50 text-purple-700 rounded"
            >
              {{ voter }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="text-center py-12">
      <BookX class="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <p class="text-gray-500">暂无荐购图书</p>
    </div>

    <!-- 拒绝模态框 -->
    <div v-if="rejectingBookId" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">拒绝图书荐购</h3>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          拒绝原因 <span class="text-red-500">*</span>
        </label>
        <textarea
          v-model="rejectReason"
          rows="3"
          placeholder="请输入拒绝原因"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        ></textarea>
        <div class="flex justify-end space-x-3 mt-4">
          <button
            @click="rejectingBookId = null"
            class="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
          >
            取消
          </button>
          <button
            @click="confirmReject"
            :disabled="!rejectReason.trim()"
            class="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            确认拒绝
          </button>
        </div>
      </div>
    </div>

    <!-- 删除确认模态框 -->
    <div v-if="deletingBookId" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">确认删除</h3>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          删除原因 <span class="text-red-500">*</span>
        </label>
        <textarea
          v-model="deleteReason"
          rows="3"
          placeholder="请输入删除原因"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        ></textarea>
        <div class="flex justify-end space-x-3 mt-4">
          <button
            @click="deletingBookId = null"
            class="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
          >
            取消
          </button>
          <button
            @click="confirmDelete"
            :disabled="!deleteReason.trim()"
            class="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>

    <!-- 操作结果提示 -->
    <div
      v-if="operationMessage"
      class="fixed bottom-4 right-4 z-50"
    >
      <div
        class="px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2"
        :class="operationSuccess ? 'bg-green-500 text-white' : 'bg-red-500 text-white'"
      >
        <component :is="operationSuccess ? CheckCircle : AlertCircle" class="w-5 h-5" />
        <span>{{ operationMessage }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { useBookStore } from '../stores/bookStore'
import {
  List,
  DollarSign,
  User,
  BookOpen,
  ThumbsUp,
  CheckCircle,
  XCircle,
  Trash2,
  BookX,
  AlertCircle
} from 'lucide-vue-next'

const bookStore = useBookStore()

const tabs = [
  { label: '全部', value: 'all' },
  { label: '待审核', value: 'pending' },
  { label: '已批准', value: 'approved' },
  { label: '已拒绝', value: 'rejected' }
]

const currentTab = ref('all')
const selectedAgeGroup = ref('')
const showVoteInput = reactive({})
const voterName = reactive({})

const rejectingBookId = ref(null)
const rejectReason = ref('')

const deletingBookId = ref(null)
const deleteReason = ref('')

const operationMessage = ref('')
const operationSuccess = ref(true)

const filteredBooks = computed(() => {
  let books = [...bookStore.books]

  if (currentTab.value !== 'all') {
    books = books.filter(book => book.status === currentTab.value)
  }

  if (selectedAgeGroup.value) {
    books = books.filter(book => book.ageGroup === selectedAgeGroup.value)
  }

  books.sort((a, b) => {
    if (a.status !== b.status) {
      const order = { pending: 0, approved: 1, rejected: 2 }
      return order[a.status] - order[b.status]
    }
    return b.votes - a.votes
  })

  return books
})

const getTabCount = (tab) => {
  if (tab === 'all') return bookStore.books.length
  return bookStore.books.filter(b => b.status === tab).length
}

const getStatusClass = (status) => {
  const classes = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700'
  }
  return classes[status] || 'bg-gray-100 text-gray-700'
}

const getStatusText = (status) => {
  const texts = {
    pending: '待审核',
    approved: '已批准',
    rejected: '已拒绝'
  }
  return texts[status] || status
}

const showMessage = (message, success = true) => {
  operationMessage.value = message
  operationSuccess.value = success
  setTimeout(() => {
    operationMessage.value = ''
  }, 3000)
}

const handleVote = (bookId) => {
  const name = voterName[bookId]?.trim()
  
  if (!name) {
    showMessage('请输入您的姓名', false)
    return
  }

  const result = bookStore.voteForBook(bookId, name)
  
  if (result.success) {
    showMessage(`投票成功！当前票数: ${result.votes}`)
    showVoteInput[bookId] = false
    voterName[bookId] = ''
  } else {
    showMessage(result.error, false)
  }
}

const handleApprove = (bookId) => {
  const result = bookStore.approveBook(bookId)
  
  if (result.success) {
    showMessage(`批准成功！剩余预算: ¥${result.remainingBudget.toLocaleString()}`)
  } else {
    showMessage(result.error, false)
  }
}

const showRejectModal = (bookId) => {
  rejectingBookId.value = bookId
  rejectReason.value = ''
}

const confirmReject = () => {
  const result = bookStore.rejectBook(rejectingBookId.value, rejectReason.value)
  
  if (result.success) {
    showMessage('已拒绝该荐购')
  } else {
    showMessage(result.error, false)
  }
  
  rejectingBookId.value = null
}

const showDeleteConfirm = (bookId) => {
  deletingBookId.value = bookId
  deleteReason.value = ''
}

const confirmDelete = () => {
  const result = bookStore.removeBook(deletingBookId.value, deleteReason.value)
  
  if (result.success) {
    showMessage('已删除该荐购')
  } else {
    showMessage(result.error, false)
  }
  
  deletingBookId.value = null
}
</script>
