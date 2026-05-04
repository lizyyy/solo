<script setup lang="ts">
import type { TestRound } from '@/types'

interface TestRoundWithStatus extends TestRound {
  analysisStatus?: string
  reviewStatus?: string
}

const props = defineProps<{
  testRounds: TestRoundWithStatus[]
  selectedId: string | null
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'delete', id: string): void
}>()

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN')
}

function getStatusClass(status?: string): string {
  switch (status) {
    case 'normal':
    case 'approved':
      return 'badge-success'
    case 'warning':
    case 'approved_with_notes':
      return 'badge-warning'
    case 'critical':
    case 'rejected':
      return 'badge-error'
    default:
      return 'badge-info'
  }
}

function getStatusText(status?: string): string {
  const map: Record<string, string> = {
    normal: '正常',
    warning: '警告',
    critical: '严重',
    pending: '待处理',
    approved: '已通过',
    approved_with_notes: '有条件通过',
    rejected: '已驳回'
  }
  return map[status || ''] || '未知'
}
</script>

<template>
  <div v-if="testRounds.length === 0" class="alert alert-info">
    暂无测试数据，请先在"数据导入"页面导入数据
  </div>
  
  <table v-else class="data-table">
    <thead>
      <tr>
        <th>选择</th>
        <th>测试编号</th>
        <th>测试名称</th>
        <th>模型名称</th>
        <th>测试日期</th>
        <th>数据点数</th>
        <th>分析状态</th>
        <th>复核状态</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      <tr 
        v-for="testRound in testRounds" 
        :key="testRound.id"
        :class="{ selected: selectedId === testRound.id }"
        @click="emit('select', testRound.id)"
        style="cursor: pointer;"
      >
        <td>
          <input 
            type="radio" 
            :checked="selectedId === testRound.id"
            @click.stop
            @change="emit('select', testRound.id)"
          />
        </td>
        <td><strong>{{ testRound.testNumber }}</strong></td>
        <td>{{ testRound.testName }}</td>
        <td>{{ testRound.modelName }}</td>
        <td>{{ formatDate(testRound.testDate) }}</td>
        <td>
          风速: {{ testRound.windSpeedProfile.length }}<br/>
          六分力: {{ testRound.forceData.length }}
        </td>
        <td>
          <span class="badge" :class="getStatusClass(testRound.analysisStatus)">
            {{ getStatusText(testRound.analysisStatus) }}
          </span>
        </td>
        <td>
          <span class="badge" :class="getStatusClass(testRound.reviewStatus)">
            {{ getStatusText(testRound.reviewStatus) }}
          </span>
        </td>
        <td>
          <button 
            class="btn btn-error" 
            style="padding: 0.25rem 0.5rem; font-size: 0.75rem;"
            @click.stop="emit('delete', testRound.id)"
          >
            删除
          </button>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
tr.selected {
  background-color: rgba(25, 118, 210, 0.05);
}
</style>
