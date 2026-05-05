<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-white rounded-xl shadow-sm border p-5">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">总申诉数</p>
            <p class="text-2xl font-bold text-gray-900 mt-1">{{ totalAppeals }}</p>
          </div>
          <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border p-5">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">潜在命中</p>
            <p class="text-2xl font-bold text-green-600 mt-1">{{ hitAppeals.length }}</p>
          </div>
          <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border p-5">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">重复申诉</p>
            <p class="text-2xl font-bold text-red-600 mt-1">{{ duplicateAppeals.length }}</p>
          </div>
          <div class="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>
      </div>
    </div>

    <div v-if="duplicateAppeals.length > 0" class="bg-red-50 border border-red-200 rounded-xl p-4">
      <h3 class="text-sm font-medium text-red-800 mb-3 flex items-center">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        检测到重复申诉 ({{ duplicateAppeals.length }} 项)
      </h3>
      <div class="space-y-2">
        <div
          v-for="(dup, index) in duplicateAppeals"
          :key="index"
          class="bg-white rounded-lg p-3 border border-red-100"
        >
          <div class="flex items-center justify-between">
            <div>
              <span class="font-medium text-gray-900">{{ dup.athleteName }}</span>
              <span class="text-gray-500 mx-2">·</span>
              <span class="text-gray-600">{{ dup.event }}</span>
            </div>
            <span class="tag tag-danger">
              {{ dup.type === 'duplicate_appeal' ? '已标记重复' : '潜在重复' }}
            </span>
          </div>
          <p class="text-sm text-gray-600 mt-1">{{ dup.description }}</p>
          <div v-if="dup.type === 'duplicate_appeal'" class="mt-2 text-xs text-gray-500">
            重复申诉: {{ dup.duplicateAppealId }} → 原始申诉: {{ dup.originalAppealId }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="hitAppeals.length > 0">
      <h3 class="text-lg font-medium text-gray-900 mb-4">潜在命中申诉</h3>
      <div class="space-y-4">
        <div
          v-for="(appeal, index) in hitAppeals"
          :key="appeal.appeal_id"
          class="bg-white border rounded-xl overflow-hidden"
        >
          <div class="px-4 py-3 bg-green-50 border-b flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <span class="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                {{ index + 1 }}
              </span>
              <div>
                <h4 class="font-medium text-gray-900">
                  {{ appeal.appeal_id }} - {{ appeal.athleteName }}
                </h4>
                <p class="text-sm text-gray-600">{{ appeal.event }} · {{ appeal.submitter }}</p>
              </div>
            </div>
            <div class="flex items-center space-x-2">
              <span class="tag tag-success">潜在命中</span>
              <span class="tag" :class="getReviewStatusClass(appeal.appeal_id)">
                {{ getReviewStatus(appeal.appeal_id) }}
              </span>
            </div>
          </div>

          <div class="p-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-3">
                <div>
                  <label class="text-sm font-medium text-gray-500">申诉内容</label>
                  <p class="mt-1 text-sm text-gray-900 bg-gray-50 rounded-lg p-3">
                    {{ appeal.complaint }}
                  </p>
                </div>

                <div>
                  <label class="text-sm font-medium text-gray-500">证据</label>
                  <p class="mt-1 text-sm text-gray-700">{{ appeal.evidence || '无' }}</p>
                </div>

                <div class="flex space-x-4 text-sm">
                  <div>
                    <span class="text-gray-500">时间码:</span>
                    <span class="font-medium text-gray-900 ml-1">
                      {{ appeal.timecodes?.start || '-' }} - {{ appeal.timecodes?.end || '-' }}
                    </span>
                  </div>
                  <div>
                    <span class="text-gray-500">提交时间:</span>
                    <span class="font-medium text-gray-900 ml-1">{{ appeal.submit_time || '-' }}</span>
                  </div>
                </div>
              </div>

              <div class="space-y-3">
                <div class="p-3 bg-green-50 rounded-lg border border-green-200">
                  <h5 class="text-sm font-medium text-green-800 mb-2">命中分析</h5>
                  <p class="text-sm text-green-700">{{ appeal.hitReason }}</p>
                </div>

                <div v-if="appeal.relatedIssues && appeal.relatedIssues.length > 0">
                  <label class="text-sm font-medium text-gray-500">相关问题</label>
                  <div class="mt-2 space-y-2">
                    <div
                      v-for="(issue, idx) in appeal.relatedIssues"
                      :key="idx"
                      class="p-2 bg-amber-50 rounded-lg text-sm"
                    >
                      <span class="font-medium text-amber-800">{{ issue.type }}</span>
                      <span class="text-amber-700 ml-2">{{ issue.description }}</span>
                    </div>
                  </div>
                </div>

                <div v-if="appeal.penaltyDetails && appeal.penaltyDetails.length > 0">
                  <label class="text-sm font-medium text-gray-500">扣分记录</label>
                  <div class="mt-2 grid grid-cols-3 gap-2">
                    <div
                      v-for="(penalty, idx) in appeal.penaltyDetails"
                      :key="idx"
                      class="p-2 bg-red-50 rounded text-center"
                    >
                      <span class="text-xs text-red-600">{{ penalty.judge_id }}</span>
                      <p class="text-sm font-medium text-red-800">-{{ penalty.penalty_score }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-4 pt-4 border-t">
              <h5 class="text-sm font-medium text-gray-900 mb-3">复核处理</h5>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">复核状态</label>
                  <select
                    v-model="getReviewForm(appeal.appeal_id).status"
                    class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="pending">待复核</option>
                    <option value="in_progress">复核中</option>
                    <option value="resolved">已解决</option>
                    <option value="rejected">已驳回</option>
                  </select>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">复核决定</label>
                  <select
                    v-model="getReviewForm(appeal.appeal_id).decision"
                    class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">未决定</option>
                    <option value="uphold">支持申诉</option>
                    <option value="partial">部分支持</option>
                    <option value="dismiss">驳回申诉</option>
                  </select>
                </div>

                <div class="md:col-span-2">
                  <label class="block text-sm font-medium text-gray-700 mb-1">复核备注</label>
                  <textarea
                    v-model="getReviewForm(appeal.appeal_id).notes"
                    rows="3"
                    class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="请输入复核备注..."
                  ></textarea>
                </div>

                <div class="md:col-span-2 flex justify-end">
                  <button
                    @click="saveReview(appeal.appeal_id)"
                    class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    保存复核记录
                  </button>
                </div>
              </div>

              <div v-if="getExistingReview(appeal.appeal_id)" class="mt-3 p-3 bg-gray-50 rounded-lg">
                <p class="text-xs text-gray-500 mb-1">已有复核记录</p>
                <p class="text-sm text-gray-700">{{ getExistingReview(appeal.appeal_id)?.notes }}</p>
                <div class="mt-1 flex space-x-3 text-xs text-gray-500">
                  <span>状态: {{ getReviewStatusText(getExistingReview(appeal.appeal_id)?.status) }}</span>
                  <span>时间: {{ formatDate(getExistingReview(appeal.appeal_id)?.timestamp) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="pendingAppeals.length > 0" class="mt-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">待复核申诉 (无明确关联问题)</h3>
      <div class="space-y-3">
        <div
          v-for="(appeal, index) in pendingAppeals"
          :key="appeal.appeal_id"
          class="bg-white border rounded-lg p-4"
        >
          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center space-x-2">
                <span class="font-medium text-gray-900">{{ appeal.appeal_id }}</span>
                <span class="text-gray-500">·</span>
                <span class="text-gray-700">{{ appeal.athleteName }}</span>
                <span class="text-gray-500">·</span>
                <span class="text-gray-700">{{ appeal.event }}</span>
              </div>
              <p class="text-sm text-gray-600 mt-1">{{ appeal.complaint?.substring(0, 100) }}{{ appeal.complaint?.length > 100 ? '...' : '' }}</p>
            </div>
            <span class="tag tag-warning">待核查</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="totalAppeals === 0" class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">暂无申诉记录</h3>
      <p class="mt-1 text-sm text-gray-500">当前数据中没有申诉记录</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'

const props = defineProps({
  analysisResults: Object,
  reviewService: Object
})

const emit = defineEmits(['updated'])

const reviewForms = reactive({})

function getReviewForm(appealId) {
  if (!reviewForms[appealId]) {
    reviewForms[appealId] = {
      status: 'pending',
      decision: '',
      notes: ''
    }
  }
  return reviewForms[appealId]
}

const totalAppeals = computed(() => 
  props.analysisResults?.appealAnalysis?.total || 0
)

const hitAppeals = computed(() => 
  props.analysisResults?.appealAnalysis?.hitAppeals || []
)

const pendingAppeals = computed(() => 
  props.analysisResults?.appealAnalysis?.pendingAppeals || []
)

const duplicateAppeals = computed(() => 
  props.analysisResults?.duplicateAppeals?.duplicates || []
)

function getReviewStatus(appealId) {
  const existing = getExistingReview(appealId)
  if (existing) {
    return getReviewStatusText(existing.status)
  }
  return reviewForms[appealId]?.status ? getReviewStatusText(reviewForms[appealId].status) : '未处理'
}

function getReviewStatusClass(appealId) {
  const existing = getExistingReview(appealId)
  const status = existing?.status || reviewForms[appealId]?.status
  
  const map = {
    'pending': 'tag-warning',
    'in_progress': 'tag-info',
    'resolved': 'tag-success',
    'rejected': 'tag-danger'
  }
  return map[status] || 'tag'
}

function getReviewStatusText(status) {
  const map = {
    'pending': '待复核',
    'in_progress': '复核中',
    'resolved': '已解决',
    'rejected': '已驳回'
  }
  return map[status] || '未处理'
}

function getExistingReview(appealId) {
  if (!props.reviewService) return null
  const review = props.reviewService.getAppealReview(appealId)
  if (review && review.reviews && review.reviews.length > 0) {
    return review.reviews[review.reviews.length - 1]
  }
  return null
}

function saveReview(appealId) {
  if (!props.reviewService) return
  
  const form = reviewForms[appealId]
  if (!form) return

  props.reviewService.addAppealReview(appealId, {
    status: form.status || 'pending',
    notes: form.notes || '',
    decision: form.decision || null,
    decisionReason: '',
    reviewer: '复核员'
  })

  emit('updated')
}

function formatDate(timestamp) {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString('zh-CN')
}
</script>
