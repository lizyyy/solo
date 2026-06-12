<template>
  <div class="min-h-screen bg-gray-100">
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-xl font-bold text-gray-800">🏫 学校周边接送拥堵管理系统</h1>
            <p class="text-sm text-gray-500 mt-1">红线图备注 · 网格员巡查 · 街道会看摘要</p>
          </div>
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                v-for="user in userRoles"
                :key="user.value"
                @click="setCurrentUser(user.value)"
                :class="[
                  'px-3 py-1.5 rounded-md text-sm transition-colors',
                  currentUser === user.value
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                ]"
              >
                {{ user.label }}
              </button>
            </div>
            <button
              @click="handleExportCSV"
              class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors flex items-center gap-2"
            >
              <span>📤</span>
              导出CSV
            </button>
            <button
              @click="showImportModal = true"
              class="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <span>📥</span>
              导入红线图备注
            </button>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 py-6">
      <StatsCard />

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <VisualizationView />
        <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <h3 class="text-lg font-semibold text-gray-800 mb-4">📋 三步处理流程</h3>
          <div class="space-y-4">
            <div
              v-for="(step, index) in flowSteps"
              :key="index"
              class="flex items-start gap-3"
            >
              <div :class="[
                'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0',
                index === 0 ? 'bg-blue-500' : index === 1 ? 'bg-purple-500' : 'bg-green-500'
              ]">
                {{ index + 1 }}
              </div>
              <div class="flex-1">
                <h4 class="font-medium text-gray-800">{{ step.title }}</h4>
                <p class="text-sm text-gray-500">{{ step.description }}</p>
                <div class="mt-2 text-xs text-gray-400">
                  角色：{{ step.role }}
                </div>
              </div>
            </div>
          </div>

          <div class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p class="text-xs text-yellow-700">
              ⚠️ 重要：同一小区有新旧两个名字时，别急着归正常，留给市政巡检员复核
            </p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6" style="height: 600px;">
        <RecordList />
        <RecordDetail />
      </div>
    </main>

    <ImportModal :show="showImportModal" @close="showImportModal = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStore } from './store'
import StatsCard from './components/StatsCard.vue'
import RecordList from './components/RecordList.vue'
import RecordDetail from './components/RecordDetail.vue'
import ImportModal from './components/ImportModal.vue'
import VisualizationView from './components/VisualizationView.vue'

const { state, setCurrentUser, exportRecordsToCSV } = useStore()

const showImportModal = ref(false)
const currentUser = computed(() => state.currentUser)

function handleExportCSV() {
  const csv = exportRecordsToCSV()
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `学校周边接送拥堵_全部记录_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const userRoles = [
  { value: 'manager' as const, label: '城更项目经理-阿宁' },
  { value: 'inspector' as const, label: '市政巡检员' }
]

const flowSteps = [
  {
    value: 'import',
    title: '红线图备注导入',
    description: '城更项目经理阿宁导入红线图备注，系统自动检测重复记录和小区名称冲突',
    role: '城更项目经理-阿宁'
  },
  {
    value: 'inspector_review',
    title: '网格员巡查表补看',
    description: '网格员现场核查并填写巡查记录，项目经理审核后进入下一步',
    role: '网格员 + 项目经理'
  },
  {
    value: 'summary_update',
    title: '街道会看摘要更新',
    description: '生成街道会看摘要，说明留下理由、缺失材料、下一步找谁',
    role: '城更项目经理-阿宁'
  }
]
</script>
