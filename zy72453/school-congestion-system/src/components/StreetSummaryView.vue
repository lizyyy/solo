<template>
  <div class="space-y-4">
    <div v-if="record.summary">
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <h5 class="font-medium text-blue-800 mb-2">{{ record.summary.title }}</h5>
        <div class="flex items-center gap-2 text-sm">
          <span :class="['px-2 py-0.5 rounded text-xs font-medium', getStatusClass(record.summary.status)]">
            {{ getStatusText(record.summary.status) }}
          </span>
          <span class="text-blue-600">更新人：{{ record.summary.updatedBy }}</span>
          <span class="text-blue-600">更新时间：{{ record.summary.updatedAt }}</span>
        </div>
      </div>

      <div class="space-y-4">
        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
          <h6 class="text-sm font-medium text-green-800 mb-2">✅ 为什么被留下</h6>
          <p class="text-sm text-green-700">{{ record.summary.reasonKept }}</p>
        </div>

        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h6 class="text-sm font-medium text-yellow-800 mb-2">📋 还缺什么材料</h6>
          <ul class="text-sm text-yellow-700 space-y-1">
            <li v-for="(item, index) in record.summary.missingMaterials" :key="index" class="flex items-start gap-2">
              <span>•</span>
              <span>{{ item }}</span>
            </li>
          </ul>
        </div>

        <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h6 class="text-sm font-medium text-purple-800 mb-2">👥 下一步该找谁</h6>
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <span class="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center text-purple-700">
                {{ record.summary.nextStep === 'inspector' ? '🔍' : record.summary.nextStep === 'manager' ? '📋' : '🏛️' }}
              </span>
              <div>
                <div class="text-sm font-medium text-purple-800">{{ record.summary.nextStepPerson }}</div>
                <div class="text-xs text-purple-600">{{ getNextStepRole(record.summary.nextStep) }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="text-xs text-gray-500">
          <span class="font-medium">审核历史：</span>
          {{ record.summary.reviewHistory.join(' → ') }}
        </div>
      </div>
    </div>

    <div v-else>
      <div class="text-center py-8 text-gray-400">
        <p class="text-3xl mb-2">📄</p>
        <p class="mb-4">暂无街道会看摘要</p>
      </div>
    </div>

    <div v-if="isManager" class="border-t pt-4 mt-4">
      <h6 class="text-sm font-medium text-gray-700 mb-3">{{ record.summary ? '更新摘要' : '生成街道摘要' }}</h6>
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">标题</label>
          <input
            v-model="form.title"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="如：阳光花园周边接送拥堵问题"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">为什么被留下</label>
          <textarea
            v-model="form.reasonKept"
            rows="2"
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="说明该条记录被纳入整改计划的原因..."
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">还缺什么材料（用逗号分隔）</label>
          <input
            v-model="missingMaterialsText"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="如：交通流量报告, 道路承载力评估"
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">下一步找谁</label>
            <select
              v-model="form.nextStep"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="inspector">市政巡检员</option>
              <option value="manager">城更项目经理-阿宁</option>
              <option value="street">街道办事处</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">状态</label>
            <select
              v-model="form.status"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="pending">待处理</option>
              <option value="in_progress">处理中</option>
              <option value="resolved">已解决</option>
            </select>
          </div>
        </div>
        <button
          @click="handleSaveSummary"
          class="px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
        >
          {{ record.summary ? '更新摘要' : '生成摘要' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { useStore } from '../store'
import type { CongestionRecord } from '../types'

const props = defineProps<{
  record: CongestionRecord
}>()

const { updateSummary, state } = useStore()

const isManager = state.currentUser === 'manager'
const missingMaterialsText = ref('')

const form = reactive({
  title: '',
  reasonKept: '',
  missingMaterials: [] as string[],
  nextStep: 'inspector' as const,
  nextStepPerson: '市政巡检员',
  status: 'pending' as const
})

watch(() => props.record.summary, (summary) => {
  if (summary) {
    form.title = summary.title
    form.reasonKept = summary.reasonKept
    form.missingMaterials = [...summary.missingMaterials]
    missingMaterialsText.value = summary.missingMaterials.join(', ')
    form.nextStep = summary.nextStep
    form.nextStepPerson = summary.nextStepPerson
    form.status = summary.status
  }
}, { immediate: true })

watch(missingMaterialsText, (val) => {
  form.missingMaterials = val.split(',').map(s => s.trim()).filter(s => s)
})

function getStatusClass(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    in_progress: 'bg-blue-100 text-blue-700',
    resolved: 'bg-green-100 text-green-700'
  }
  return map[status] || 'bg-gray-100 text-gray-700'
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    pending: '待处理',
    in_progress: '处理中',
    resolved: '已解决'
  }
  return map[status] || status
}

function getNextStepRole(step: string) {
  const map: Record<string, string> = {
    inspector: '市政巡检员 - 现场复核',
    manager: '城更项目经理 - 统筹协调',
    street: '街道办事处 - 决策落实'
  }
  return map[step] || step
}

function handleSaveSummary() {
  const nextStepPersonMap: Record<string, string> = {
    inspector: '市政巡检员',
    manager: '城更项目经理-阿宁',
    street: '街道办事处'
  }
  updateSummary(props.record.id, {
    ...form,
    nextStepPerson: nextStepPersonMap[form.nextStep]
  })
}
</script>
