<template>
  <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
      <div class="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-800">导入红线图备注</h3>
        <button @click="handleClose" class="text-gray-400 hover:text-gray-600">✕</button>
      </div>

      <div class="p-4 overflow-y-auto flex-1 space-y-4">
        <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <p class="text-4xl mb-2">📁</p>
          <p class="text-gray-600 mb-2">点击或拖拽文件到此处</p>
          <p class="text-sm text-gray-400">支持 CSV、Excel 格式</p>
          <button
            @click="simulateImport"
            class="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
          >
            模拟导入测试数据（含历史重复 + 本次重复 + 新记录）
          </button>
        </div>

        <div v-if="importResult" class="space-y-4">
          <div class="grid grid-cols-4 gap-3 text-center">
            <div class="bg-gray-50 rounded p-3">
              <div class="text-2xl font-bold text-gray-800">{{ importResult.items.length }}</div>
              <div class="text-xs text-gray-500">本批次总数</div>
            </div>
            <div class="bg-green-50 rounded p-3">
              <div class="text-2xl font-bold text-green-600">{{ importResult.newCount }}</div>
              <div class="text-xs text-gray-500">✅ 新记录</div>
            </div>
            <div class="bg-yellow-50 rounded p-3">
              <div class="text-2xl font-bold text-yellow-600">{{ importResult.duplicateCurrentCount }}</div>
              <div class="text-xs text-gray-500">⚠️ 本次重复</div>
            </div>
            <div class="bg-orange-50 rounded p-3">
              <div class="text-2xl font-bold text-orange-600">{{ importResult.duplicateHistoryCount }}</div>
              <div class="text-xs text-gray-500">📜 历史重复</div>
            </div>
          </div>

          <div class="space-y-2">
            <h4 class="text-sm font-medium text-gray-700">导入明细</h4>
            <div class="border border-gray-200 rounded-lg overflow-hidden">
              <table class="w-full text-sm">
                <thead class="bg-gray-50 text-gray-600">
                  <tr>
                    <th class="px-3 py-2 text-left">行号</th>
                    <th class="px-3 py-2 text-left">小区名称</th>
                    <th class="px-3 py-2 text-left">学校</th>
                    <th class="px-3 py-2 text-left">结果</th>
                    <th class="px-3 py-2 text-left">关联记录</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr
                    v-for="item in importResult.items"
                    :key="item.index"
                    :class="getRowClass(item.status)"
                  >
                    <td class="px-3 py-2 text-gray-600">{{ item.index + 1 }}</td>
                    <td class="px-3 py-2 text-gray-800">{{ item.communityName }}</td>
                    <td class="px-3 py-2 text-gray-600">{{ item.schoolName }}</td>
                    <td class="px-3 py-2">
                      <span :class="getStatusBadgeClass(item.status)">
                        {{ getStatusText(item.status) }}
                      </span>
                    </td>
                    <td class="px-3 py-2">
                      <button
                        v-if="item.duplicateRecordId"
                        @click="jumpToRecord(item.duplicateRecordId)"
                        class="text-blue-600 hover:text-blue-800 underline text-xs"
                      >
                        查看 {{ item.duplicateRecordName }}
                      </button>
                      <button
                        v-else-if="item.recordId"
                        @click="jumpToRecord(item.recordId)"
                        class="text-green-600 hover:text-green-800 underline text-xs"
                      >
                        打开新记录
                      </button>
                      <span v-else class="text-gray-400 text-xs">-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 space-y-1">
            <p><span class="font-medium">✅ 新记录：</span>系统中不存在相同小区+学校+内容的记录，已成功导入</p>
            <p><span class="font-medium">⚠️ 本次重复：</span>同一次导入文件中出现的重复行，只保留第一条</p>
            <p><span class="font-medium">📜 历史重复：</span>与之前已导入的记录完全一致，已跳过不会导致数量翻倍</p>
          </div>
        </div>
      </div>

      <div class="p-4 border-t border-gray-200 flex justify-end gap-2">
        <button
          @click="handleExportCSV"
          v-if="importResult"
          class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
        >
          导出本次导入结果(CSV)
        </button>
        <button
          @click="handleClose"
          class="px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
        >
          完成
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useStore, type ImportResult, type ImportResultItem } from '../store'

defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { importRedLineNotes, setSelectedRecord, exportRecordsToCSV } = useStore()

const importResult = ref<ImportResult | null>(null)

function simulateImport() {
  const testData = [
    {
      communityName: '阳光花园',
      schoolName: '第一实验小学',
      distanceToSchool: 320,
      noteContent: '早晚高峰接送车辆较多，占用非机动车道',
      congestionLevel: 'high' as const
    },
    {
      communityName: '阳光花园',
      schoolName: '第一实验小学',
      distanceToSchool: 320,
      noteContent: '早晚高峰接送车辆较多，占用非机动车道',
      congestionLevel: 'high' as const
    },
    {
      communityName: '阳光小区',
      schoolName: '第一实验小学',
      distanceToSchool: 320,
      noteContent: '早晚高峰接送车辆较多，占用非机动车道',
      congestionLevel: 'high' as const
    },
    {
      communityName: '新建小区',
      schoolName: '第二中学',
      distanceToSchool: 450,
      noteContent: '早高峰送学车辆与上班车流重叠',
      congestionLevel: 'medium' as const
    }
  ]

  importResult.value = importRedLineNotes(testData)
}

function getStatusText(status: ImportResultItem['status']) {
  const map: Record<ImportResultItem['status'], string> = {
    new: '新记录',
    duplicate_current: '本次重复',
    duplicate_history: '历史重复'
  }
  return map[status]
}

function getStatusBadgeClass(status: ImportResultItem['status']) {
  const map: Record<ImportResultItem['status'], string> = {
    new: 'px-2 py-0.5 rounded text-xs bg-green-100 text-green-700 border border-green-200',
    duplicate_current: 'px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700 border border-yellow-200',
    duplicate_history: 'px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-700 border border-orange-200'
  }
  return map[status]
}

function getRowClass(status: ImportResultItem['status']) {
  const map: Record<ImportResultItem['status'], string> = {
    new: 'bg-green-50/30',
    duplicate_current: 'bg-yellow-50/30',
    duplicate_history: 'bg-orange-50/30'
  }
  return map[status]
}

function jumpToRecord(id: string) {
  setSelectedRecord(id)
  emit('close')
}

function handleExportCSV() {
  if (!importResult.value) return
  const headers = ['行号', '小区名称', '学校名称', '导入结果', '关联记录ID']
  const rows = importResult.value.items.map(item => [
    item.index + 1,
    item.communityName,
    item.schoolName,
    getStatusText(item.status),
    item.recordId || item.duplicateRecordId || '-'
  ])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `导入结果_${importResult.value.batchId}.csv`
  a.click()
  URL.revokeObjectURL(url)

  const fullCsv = exportRecordsToCSV()
  const fullBlob = new Blob(['\ufeff' + fullCsv], { type: 'text/csv;charset=utf-8;' })
  const fullUrl = URL.createObjectURL(fullBlob)
  const b = document.createElement('a')
  b.href = fullUrl
  b.download = `学校周边接送拥堵_全部记录.csv`
  b.click()
  URL.revokeObjectURL(fullUrl)
}

function handleClose() {
  importResult.value = null
  emit('close')
}
</script>
