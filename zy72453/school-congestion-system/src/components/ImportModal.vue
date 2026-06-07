<template>
  <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
      <div class="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-800">导入红线图备注</h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600">✕</button>
      </div>

      <div class="p-4 space-y-4">
        <div class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <p class="text-4xl mb-2">📁</p>
          <p class="text-gray-600 mb-2">点击或拖拽文件到此处</p>
          <p class="text-sm text-gray-400">支持 CSV、Excel 格式</p>
          <button
            @click="simulateImport"
            class="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
          >
            模拟导入测试数据
          </button>
        </div>

        <div v-if="importResult" class="bg-gray-50 rounded-lg p-4">
          <div class="grid grid-cols-3 gap-4 text-center">
            <div>
              <div class="text-2xl font-bold text-gray-800">{{ importResult.total }}</div>
              <div class="text-xs text-gray-500">总记录</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-green-600">{{ importResult.newCount }}</div>
              <div class="text-xs text-gray-500">新增</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-yellow-600">{{ importResult.duplicateCount }}</div>
              <div class="text-xs text-gray-500">重复跳过</div>
            </div>
          </div>
          <div v-if="importResult.duplicateCount > 0" class="mt-3 text-xs text-yellow-600 bg-yellow-50 p-2 rounded">
            ⚠️ 检测到 {{ importResult.duplicateCount }} 条重复记录，已自动跳过，不会导致数量翻倍
          </div>
        </div>
      </div>

      <div class="p-4 border-t border-gray-200 flex justify-end gap-2">
        <button
          @click="$emit('close')"
          class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
        >
          关闭
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useStore } from '../store'

defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { importRedLineNotes } = useStore()

const importResult = ref<{ total: number; newCount: number; duplicateCount: number } | null>(null)

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

  const result = importRedLineNotes(testData)
  importResult.value = {
    total: testData.length,
    ...result
  }
}
</script>
