<template>
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">小区名称</label>
        <input
          v-model="form.communityName"
          type="text"
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">学校名称</label>
        <input
          v-model="form.schoolName"
          type="text"
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">距离学校(米)</label>
        <input
          v-model.number="form.distanceToSchool"
          type="number"
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">拥堵等级</label>
        <select
          v-model="form.congestionLevel"
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
        class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>

    <div class="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
      <div class="grid grid-cols-2 gap-2">
        <div>导入时间：{{ record.redLineNote.importTime }}</div>
        <div>导入人：{{ record.redLineNote.importedBy }}</div>
      </div>
    </div>

    <div v-if="isManager">
      <label class="block text-sm font-medium text-gray-700 mb-1">修改原因</label>
      <input
        v-model="changeReason"
        type="text"
        placeholder="请输入修改原因..."
        class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-3"
      />
      <button
        @click="handleSave"
        class="px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition-colors"
      >
        保存修改
      </button>
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

const { updateRedLineNote, state } = useStore()

const isManager = state.currentUser === 'manager'
const changeReason = ref('')

const form = reactive({
  communityName: props.record.redLineNote.communityName,
  schoolName: props.record.redLineNote.schoolName,
  distanceToSchool: props.record.redLineNote.distanceToSchool,
  congestionLevel: props.record.redLineNote.congestionLevel,
  noteContent: props.record.redLineNote.noteContent
})

watch(() => props.record, (newRecord) => {
  form.communityName = newRecord.redLineNote.communityName
  form.schoolName = newRecord.redLineNote.schoolName
  form.distanceToSchool = newRecord.redLineNote.distanceToSchool
  form.congestionLevel = newRecord.redLineNote.congestionLevel
  form.noteContent = newRecord.redLineNote.noteContent
}, { deep: true })

function handleSave() {
  updateRedLineNote(props.record.id, { ...form }, changeReason.value || '修改信息')
  changeReason.value = ''
}
</script>
