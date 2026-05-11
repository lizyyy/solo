<template>
  <div class="min-h-screen bg-gray-50">
    <!-- 头部 -->
    <header class="bg-primary-600 text-white shadow-lg">
      <div class="max-w-7xl mx-auto px-4 py-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <BookOpen class="w-8 h-8" />
            <h1 class="text-2xl font-bold">社区书屋荐购投票系统</h1>
          </div>
          <div class="flex items-center space-x-4">
            <button
              @click="showRulesPanel = true"
              class="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition"
            >
              <Shield class="w-5 h-5" />
              <span>规则确认</span>
            </button>
            <button
              @click="showIssuesPanel = true"
              class="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition relative"
            >
              <AlertTriangle class="w-5 h-5" />
              <span>问题列表</span>
              <span
                v-if="bookStore.activeIssues.length > 0"
                class="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center"
              >
                {{ bookStore.activeIssues.length }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- 主要内容区域 -->
    <main class="max-w-7xl mx-auto px-4 py-8">
      <!-- 统计卡片 -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-white rounded-xl shadow p-6">
          <div class="flex items-center space-x-4">
            <div class="bg-blue-100 p-3 rounded-lg">
              <Library class="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p class="text-gray-500 text-sm">总推荐图书</p>
              <p class="text-2xl font-bold text-gray-800">{{ bookStore.books.length }}</p>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-xl shadow p-6">
          <div class="flex items-center space-x-4">
            <div class="bg-green-100 p-3 rounded-lg">
              <CheckCircle class="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p class="text-gray-500 text-sm">已批准</p>
              <p class="text-2xl font-bold text-green-600">{{ bookStore.approvedBooks.length }}</p>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-xl shadow p-6">
          <div class="flex items-center space-x-4">
            <div class="bg-yellow-100 p-3 rounded-lg">
              <Clock class="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p class="text-gray-500 text-sm">待审核</p>
              <p class="text-2xl font-bold text-yellow-600">{{ bookStore.pendingBooks.length }}</p>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-xl shadow p-6">
          <div class="flex items-center space-x-4">
            <div class="bg-purple-100 p-3 rounded-lg">
              <ThumbsUp class="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p class="text-gray-500 text-sm">总投票数</p>
              <p class="text-2xl font-bold text-purple-600">{{ bookStore.totalVotes }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 预算进度条 -->
      <div class="bg-white rounded-xl shadow p-6 mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-800 flex items-center">
            <Wallet class="w-5 h-5 mr-2 text-gray-600" />
            预算使用情况
          </h2>
          <button
            @click="showBudgetModal = true"
            class="text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            调整预算
          </button>
        </div>
        <div class="space-y-2">
          <div class="flex justify-between text-sm">
            <span class="text-gray-600">已使用: ¥{{ bookStore.budget.used.toLocaleString() }}</span>
            <span class="text-gray-600">剩余: ¥{{ bookStore.availableBudget.toLocaleString() }}</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-4">
            <div
              class="h-4 rounded-full transition-all duration-500"
              :class="bookStore.budgetUsage.percentage > 90 ? 'bg-red-500' : bookStore.budgetUsage.percentage > 70 ? 'bg-yellow-500' : 'bg-green-500'"
              :style="{ width: `${bookStore.budgetUsage.percentage}%` }"
            ></div>
          </div>
          <p class="text-right text-sm text-gray-500">
            预算总额: ¥{{ bookStore.budget.total.toLocaleString() }} ({{ bookStore.budgetUsage.percentage }}% 已使用)
          </p>
        </div>
      </div>

      <!-- 主要操作区域 -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- 左侧：添加荐购表单 -->
        <div class="lg:col-span-1">
          <BookForm />
        </div>

        <!-- 右侧：荐购列表 -->
        <div class="lg:col-span-2">
          <BookList />
        </div>
      </div>
    </main>

    <!-- 规则确认面板 -->
    <RulesPanel v-if="showRulesPanel" @close="showRulesPanel = false" />
    
    <!-- 问题列表面板 -->
    <IssuesPanel v-if="showIssuesPanel" @close="showIssuesPanel = false" />
    
    <!-- 预算调整模态框 -->
    <BudgetModal v-if="showBudgetModal" @close="showBudgetModal = false" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useBookStore } from './stores/bookStore'
import {
  BookOpen,
  Shield,
  AlertTriangle,
  Library,
  CheckCircle,
  Clock,
  ThumbsUp,
  Wallet
} from 'lucide-vue-next'
import BookForm from './components/BookForm.vue'
import BookList from './components/BookList.vue'
import RulesPanel from './components/RulesPanel.vue'
import IssuesPanel from './components/IssuesPanel.vue'
import BudgetModal from './components/BudgetModal.vue'

const bookStore = useBookStore()

const showRulesPanel = ref(false)
const showIssuesPanel = ref(false)
const showBudgetModal = ref(false)

onMounted(() => {
  bookStore.initializeStore()
})
</script>
