<template>
  <div class="space-y-4">
    <div v-if="recentRedlineHistory.length > 0" class="bg-purple-50 border border-purple-200 rounded-lg p-4">
      <h6 class="text-sm font-medium text-purple-800 mb-3 flex items-center gap-2">
        <span>📝</span>
        红线图备注最近修改（共 {{ redlineHistoryAll.length }} 条）
      </h6>
      <div class="space-y-3">
        <div
          v-for="h in recentRedlineHistory"
          :key="h.id"
          class="bg-white rounded border border-purple-100 p-3"
        >
          <div class="flex items-center justify-between mb-2 text-xs text-purple-600">
            <span><span class="font-medium">{{ h.changedBy }}</span> · {{ h.changeReason }}</span>
            <span>{{ h.changedAt }}</span>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="bg-red-50 border border-red-200 rounded p-2">
              <div class="text-xs text-red-600 mb-1 font-medium">改前 · {{ getFieldLabel(h.fieldName) }}</div>
              <div class="text-sm text-red-800 break-words">{{ h.oldValue || '(空)' }}</div>
            </div>
            <div class="bg-green-50 border border-green-200 rounded p-2">
              <div class="text-xs text-green-600 mb-1 font-medium">改后 · {{ getFieldLabel(h.fieldName) }}</div>
              <div class="text-sm text-green-800 break-words">{{ h.newValue || '(空)' }}</div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="redlineHistoryAll.length > recentRedlineHistory.length" class="mt-2 text-xs text-purple-500">
        还有 {{ redlineHistoryAll.length - recentRedlineHistory.length }} 条修改，请查看「历史版本」标签页
      </div>
    </div>

    <div class="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 border border-gray-200">
      <div class="grid grid-cols-2 gap-2 mb-2">
        <div>📌 记录ID：<code class="bg-white px-1.5 py-0.5 rounded border border-gray-200 text-xs">{{ record.id }}</code></div>
        <div>导入批次ID：<code class="bg-white px-1.5 py-0.5 rounded border border-gray-200 text-xs">{{ record.redLineNote.importBatchId }}</code></div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>导入时间：{{ record.redLineNote.importTime }}</div>
        <div>导入人：{{ record.redLineNote.importedBy }}</div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">小区名称</label>
        <input
          v-model="form.communityName"
          type="text"
          :disabled="!isManager"
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">学校名称</label>
        <input
          v-model="form.schoolName"
          type="text"
          :disabled="!isManager"
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">距离学校(米)</label>
        <input
          v-model.number="form.distanceToSchool"
          type="number"
          :disabled="!isManager"
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">拥堵等级</label>
        <select
          v-model="form.congestionLevel"
          :disabled="!isManager"
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
        >
          <option value="low">轻度</option>
          <option value="medium">中度</option>
          <option value="high">高度</option>
          <option value="severe">严重</option>
        </select>
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">备注内容</label>
      <textarea
        v-model="form.noteContent"
        rows="3"
        :disabled="!isManager"
        class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
      />
    </div>

    <div v-if="isManager" class="space-y-3 border-t pt-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          <span class="text-red-500">*</span> 修改原因（修改后会记录到历史版本中）
        </label>
        <input
          v-model="changeReason"
          type="text"
          placeholder="如：补充现场观察细节 / 调整拥堵等级 / 修正小区名称"
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <button
        @click="handleSave"
        :disabled="!changeReason.trim()"
        class="px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        保存修改（将记录改前/改后/原因）
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useStore } from '../store'
import type { CongestionRecord, HistoryVersion } from '../types'

const props = defineProps<{
  record: CongestionRecord
}>()

const { updateRedLineNote, state } = useStore()

const isManager = computed(() => state.currentUser === 'manager')
const changeReason = ref('')

const form = reactive({
  communityName: props.record.redLineNote.communityName,
  schoolName: props.record.redLineNote.schoolName,
  distanceToSchool: props.record.redLineNote.distanceToSchool,
  congestionLevel: props.record.redLineNote.congestionLevel,
  noteContent: props.record.redLineNote.noteContent
})

const redlineHistoryAll = computed<HistoryVersion[]>(() =>
  props.record.historyVersions.filter(h => h.recordType === 'redLineNote')
)

const recentRedlineHistory = computed<HistoryVersion[]>(() =>
  [...redlineHistoryAll.value].reverse().slice(0, 3)
)

watch(() => props.record, (newRecord) => {
  form.communityName = newRecord.redLineNote.communityName
  form.schoolName = newRecord.redLineNote.schoolName
  form.distanceToSchool = newRecord.redLineNote.distanceToSchool
  form.congestionLevel = newRecord.redLineNote.congestionLevel
  form.noteContent = newRecord.redLineNote.noteContent
  changeReason.value = ''
}, { deep: true })

function getFieldLabel(field: string): string {
  const map: Record<string, string> = {
    communityName: '小区名称',
    schoolName: '学校名称',
    noteContent: '备注内容',
    congestionLevel: '拥堵等级',
    distanceToSchool: '距离学校',
    importedBy: '导入人'
  }
  return map[field] || field
}

function handleSave() {
  if (!changeReason.value.trim()) return
  updateRedLineNote(props.record.id, { ...form }, changeReason.value.trim())
  changeReason.value = ''
}
</script>
