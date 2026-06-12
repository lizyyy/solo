<template>
  <div class="space-y-4">
    <div v-if="record.gridInspector">
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div class="bg-gray-50 p-3 rounded-lg">
          <div class="text-xs text-gray-500">巡查员</div>
          <div class="text-sm font-medium">{{ record.gridInspector.inspectorName }}</div>
        </div>
        <div class="bg-gray-50 p-3 rounded-lg">
          <div class="text-xs text-gray-500">巡查时间</div>
          <div class="text-sm font-medium">{{ record.gridInspector.inspectionTime }}</div>
        </div>
        <div class="bg-gray-50 p-3 rounded-lg">
          <div class="text-xs text-gray-500">高峰时段</div>
          <div class="text-sm font-medium">{{ record.gridInspector.peakTime }}</div>
        </div>
        <div class="bg-gray-50 p-3 rounded-lg">
          <div class="text-xs text-gray-500">车辆/行人数量</div>
          <div class="text-sm font-medium">{{ record.gridInspector.vehicleCount }}辆 / {{ record.gridInspector.pedestrianCount }}人</div>
        </div>
      </div>

      <div class="mb-4">
        <h6 class="text-sm font-medium text-gray-700 mb-2">现场描述</h6>
        <p class="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{{ record.gridInspector.description }}</p>
      </div>

      <div class="mb-4">
        <h6 class="text-sm font-medium text-gray-700 mb-2">发现问题</h6>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="issue in record.gridInspector.issues"
            :key="issue"
            class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs"
          >
            {{ issue }}
          </span>
        </div>
      </div>

      <div class="mb-4">
        <h6 class="text-sm font-medium text-gray-700 mb-2">整改建议</h6>
        <p class="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{{ record.gridInspector.suggestions }}</p>
      </div>

      <div v-if="record.gridInspector.reviewedByManager" class="bg-green-50 border border-green-200 rounded-lg p-3">
        <div class="text-xs text-green-600 mb-1">已由项目经理审核</div>
        <div class="text-sm text-green-800">{{ record.gridInspector.managerNotes }}</div>
        <div class="text-xs text-green-600 mt-1">审核时间：{{ record.gridInspector.reviewTime }}</div>
      </div>

      <div v-if="isManager && !record.gridInspector.reviewedByManager">
        <div class="border-t pt-4 mt-4">
          <h6 class="text-sm font-medium text-gray-700 mb-2">项目经理审核</h6>
          <textarea
            v-model="managerNotes"
            rows="2"
            placeholder="请输入审核意见..."
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-3"
          />
          <div class="flex gap-2">
            <button
              @click="handleReview(true)"
              class="px-4 py-2 bg-green-500 text-white rounded-md text-sm hover:bg-green-600"
            >
              通过
            </button>
            <button
              @click="handleReview(false)"
              class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300"
            >
              驳回
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-else>
      <div class="text-center py-8 text-gray-400">
        <p class="text-3xl mb-2">📝</p>
        <p class="mb-4">暂无网格员巡查记录</p>
        <button
          @click="showAddForm = !showAddForm"
          class="px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
        >
          添加巡查记录
        </button>
      </div>

      <div v-if="showAddForm" class="mt-4 space-y-3 border-t pt-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">巡查员</label>
          <input v-model="newInspector.inspectorName" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">现场描述</label>
          <textarea v-model="newInspector.description" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">高峰时段</label>
            <input v-model="newInspector.peakTime" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">车辆数量</label>
            <input v-model.number="newInspector.vehicleCount" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">行人数量</label>
            <input v-model.number="newInspector.pedestrianCount" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">发现问题（逗号分隔）</label>
            <input v-model="issuesText" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="如：违停,占道经营" />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">整改建议</label>
          <textarea v-model="newInspector.suggestions" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        </div>
        <button
          @click="handleAddInspector"
          class="px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
        >
          保存巡查记录
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { useStore } from '../store'
import type { CongestionRecord } from '../types'

const props = defineProps<{
  record: CongestionRecord
}>()

const { addGridInspectorRecord, reviewGridInspector, state } = useStore()

const isManager = computed(() => state.currentUser === 'manager')
const showAddForm = ref(false)
const managerNotes = ref('')
const issuesText = ref('')

const newInspector = reactive({
  inspectorName: '网格员-小张',
  description: '',
  peakTime: '',
  vehicleCount: 0,
  pedestrianCount: 0,
  issues: [] as string[],
  suggestions: ''
})

watch(issuesText, (val) => {
  newInspector.issues = val.split(',').map(s => s.trim()).filter(s => s)
})

function handleAddInspector() {
  addGridInspectorRecord(props.record.id, { ...newInspector })
  showAddForm.value = false
}

function handleReview(approved: boolean) {
  reviewGridInspector(props.record.id, managerNotes.value, approved)
  managerNotes.value = ''
}
</script>
