<template>
  <div class="space-y-6">
    <div v-if="!issues || issues.length === 0" class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">数据质量良好</h3>
      <p class="mt-1 text-sm text-gray-500">未发现明显的裁判分数差异问题</p>
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="(issue, index) in issues"
        :key="index"
        class="border rounded-lg overflow-hidden"
        :class="severityBorderClass(issue.severity)"
      >
        <div
          class="px-4 py-3 flex items-center justify-between cursor-pointer"
          :class="severityBgClass(issue.severity)"
          @click="toggleIssue(index)"
        >
          <div class="flex items-center space-x-3">
            <span class="flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-medium"
              :class="severityIconClass(issue.severity)">
              {{ index + 1 }}
            </span>
            <div>
              <h4 class="font-medium text-gray-900">
                {{ issue.athleteName }} - {{ issue.event }}
              </h4>
              <p class="text-sm text-gray-600">{{ issue.description }}</p>
            </div>
          </div>
          <div class="flex items-center space-x-4">
            <span class="tag" :class="severityTagClass(issue.severity)">
              {{ getSeverityText(issue.severity) }}优先级
            </span>
            <svg
              class="w-5 h-5 text-gray-500 transition-transform"
              :class="{ 'rotate-180': expandedIssue === index }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <div v-show="expandedIssue === index" class="p-4 bg-white border-t">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h5 class="text-sm font-medium text-gray-900 mb-3">裁判打分明细</h5>
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">裁判</th>
                      <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">难度分</th>
                      <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">执行分</th>
                      <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">扣分</th>
                      <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">总分</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    <tr
                      v-for="(judgeScore, jdx) in issue.details.judges"
                      :key="jdx"
                      class="hover:bg-gray-50"
                    >
                      <td class="px-3 py-2 text-sm font-medium text-gray-900">
                        {{ judgeScore.judge }}
                      </td>
                      <td class="px-3 py-2 text-sm text-right"
                        :class="isOutlier(issue.details.judges, 'score', judgeScore.score) ? 'text-red-600 font-medium' : 'text-gray-900'">
                        {{ judgeScore.score?.toFixed(2) }}
                      </td>
                      <td class="px-3 py-2 text-sm text-right text-gray-900">
                        {{ judgeScore.execution?.toFixed(2) || '-' }}
                      </td>
                      <td class="px-3 py-2 text-sm text-right"
                        :class="judgeScore.penalty > 0 ? 'text-red-600' : 'text-gray-900'">
                        {{ judgeScore.penalty?.toFixed(2) || '0.00' }}
                      </td>
                      <td class="px-3 py-2 text-sm text-right font-medium text-gray-900">
                        {{ judgeScore.total?.toFixed(2) || '-' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h5 class="text-sm font-medium text-gray-900 mb-3">统计分析</h5>
              <div class="space-y-3">
                <div class="bg-gray-50 rounded-lg p-3">
                  <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-600">最高分</span>
                    <span class="text-sm font-medium text-green-600">{{ issue.details.max?.toFixed(2) }}</span>
                  </div>
                </div>
                <div class="bg-gray-50 rounded-lg p-3">
                  <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-600">最低分</span>
                    <span class="text-sm font-medium text-red-600">{{ issue.details.min?.toFixed(2) }}</span>
                  </div>
                </div>
                <div class="bg-gray-50 rounded-lg p-3">
                  <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-600">分差</span>
                    <span class="text-sm font-medium text-amber-600">{{ issue.details.diff || (issue.details.max - issue.details.min).toFixed(2) }}</span>
                  </div>
                </div>
                <div class="bg-gray-50 rounded-lg p-3">
                  <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-600">方差</span>
                    <span class="text-sm font-medium text-gray-900">{{ issue.details.variance }}</span>
                  </div>
                </div>
              </div>

              <div class="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div class="flex items-start">
                  <svg class="w-5 h-5 text-amber-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p class="text-sm font-medium text-amber-800">建议</p>
                    <p class="text-sm text-amber-700 mt-1">
                      该项目存在较大的裁判打分差异，建议查看视频回放，确认打标一致性。
                      差异较大的裁判分: 
                      <span v-if="issue.details.variance > 0.1" class="font-medium">方差大于0.1</span>
                      <span v-else>分差超过阈值</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="getRelatedAppeals(issue).length > 0" class="mt-4 pt-4 border-t">
            <h5 class="text-sm font-medium text-gray-900 mb-3">相关申诉</h5>
            <div class="space-y-2">
              <div
                v-for="appeal in getRelatedAppeals(issue)"
                :key="appeal.appeal_id"
                class="p-3 bg-red-50 rounded-lg border border-red-200"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <span class="text-sm font-medium text-red-800">{{ appeal.appeal_id }}</span>
                    <span class="text-xs text-red-600 ml-2">{{ appeal.submitter }}</span>
                  </div>
                  <span class="tag tag-danger">{{ appeal.status || '待处理' }}</span>
                </div>
                <p class="text-sm text-red-700 mt-1">{{ appeal.complaint }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  analysisResults: Object,
  alignedData: Object
})

const expandedIssue = ref(null)

const issues = computed(() => 
  props.analysisResults?.scoreDifferences?.issues || []
)

function toggleIssue(index) {
  expandedIssue.value = expandedIssue.value === index ? null : index
}

function severityBorderClass(severity) {
  const map = {
    'high': 'border-red-300',
    'medium': 'border-amber-300',
    'low': 'border-blue-300'
  }
  return map[severity] || 'border-gray-300'
}

function severityBgClass(severity) {
  const map = {
    'high': 'bg-red-50',
    'medium': 'bg-amber-50',
    'low': 'bg-blue-50'
  }
  return map[severity] || 'bg-gray-50'
}

function severityIconClass(severity) {
  const map = {
    'high': 'bg-red-500',
    'medium': 'bg-amber-500',
    'low': 'bg-blue-500'
  }
  return map[severity] || 'bg-gray-500'
}

function severityTagClass(severity) {
  const map = {
    'high': 'tag-danger',
    'medium': 'tag-warning',
    'low': 'tag-info'
  }
  return map[severity] || 'tag'
}

function getSeverityText(severity) {
  const map = {
    'high': '高',
    'medium': '中',
    'low': '低'
  }
  return map[severity] || '未知'
}

function isOutlier(items, key, value) {
  if (!items || items.length < 3) return false
  
  const values = items.map(i => i[key]).filter(v => v != null)
  if (values.length < 3) return false
  
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length
  const threshold = avg * 0.05
  
  return Math.abs(value - avg) > threshold
}

function getRelatedAppeals(issue) {
  const allAppeals = props.analysisResults?.appealAnalysis?.allAppeals || []
  return allAppeals.filter(a => 
    a.athleteId === issue.athleteId && a.event === issue.event
  )
}
</script>
