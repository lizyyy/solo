<template>
  <div class="space-y-4">
    <div v-if="record.historyVersions.length > 0">
      <div class="relative">
        <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        <div class="space-y-6">
          <div
            v-for="version in record.historyVersions"
            :key="version.id"
            class="relative pl-10"
          >
            <div class="absolute left-2.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white"></div>

            <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <span class="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600">
                    {{ getRecordTypeText(version.recordType) }}
                  </span>
                  <span class="text-xs text-gray-500">{{ getFieldNameText(version.fieldName) }}</span>
                </div>
                <span class="text-xs text-gray-500">{{ version.changedAt }}</span>
              </div>

              <div class="text-sm text-gray-600 mb-2">
                <span class="font-medium">{{ version.changedBy }}</span>
                <span class="text-gray-500"> · {{ version.changeReason }}</span>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="bg-red-50 border border-red-200 rounded p-3">
                  <div class="text-xs text-red-600 mb-1 font-medium">修改前</div>
                  <div class="text-sm text-red-800">{{ version.oldValue || '(空)' }}</div>
                </div>
                <div class="bg-green-50 border border-green-200 rounded p-3">
                  <div class="text-xs text-green-600 mb-1 font-medium">修改后</div>
                  <div class="text-sm text-green-800">{{ version.newValue || '(空)' }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-8 text-gray-400">
      <p class="text-3xl mb-2">📜</p>
      <p>暂无历史修改记录</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CongestionRecord } from '../types'

defineProps<{
  record: CongestionRecord
}>()

function getRecordTypeText(type: string) {
  const map: Record<string, string> = {
    redLineNote: '红线图备注',
    gridInspector: '网格员巡查',
    summary: '街道摘要'
  }
  return map[type] || type
}

function getFieldNameText(field: string) {
  const map: Record<string, string> = {
    communityName: '小区名称',
    schoolName: '学校名称',
    noteContent: '备注内容',
    congestionLevel: '拥堵等级',
    distanceToSchool: '距离学校',
    reviewedByManager: '项目经理审核',
    reasonKept: '留下原因',
    missingMaterials: '缺失材料',
    nextStep: '下一步骤',
    status: '状态'
  }
  return map[field] || field
}
</script>
