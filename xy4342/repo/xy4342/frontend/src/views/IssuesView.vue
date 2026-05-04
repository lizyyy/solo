<template>
  <div class="issues-view">
    <div class="page-header">
      <h2>🔍 问题列表</h2>
      <p>查看和处理连续性检查发现的问题，支持按状态、类别、严重程度过滤</p>
    </div>

    <div class="filter-bar">
      <div class="filter-group">
        <label>状态</label>
        <select v-model="filters.status" class="filter-select">
          <option value="">全部</option>
          <option value="open">待处理</option>
          <option value="confirmed">已确认</option>
          <option value="dismissed">已忽略</option>
          <option value="fixed">已修复</option>
        </select>
      </div>
      <div class="filter-group">
        <label>类别</label>
        <select v-model="filters.category" class="filter-select">
          <option value="">全部</option>
          <option value="costume">服装不一致</option>
          <option value="prop">道具不一致</option>
          <option value="timeline">时间线问题</option>
          <option value="address">称呼不一致</option>
          <option value="similarity">文本相似</option>
          <option value="other">其他</option>
        </select>
      </div>
      <div class="filter-group">
        <label>严重程度</label>
        <select v-model="filters.severity" class="filter-select">
          <option value="">全部</option>
          <option value="critical">严重</option>
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>
      </div>
      <button @click="loadIssues" class="btn btn-primary">
        🔄 刷新
      </button>
    </div>

    <div v-if="selectedIssues.length > 0" class="batch-actions">
      <span>已选择 {{ selectedIssues.length }} 个问题</span>
      <button 
        @click="batchUpdateStatus('confirmed')"
        class="btn btn-primary btn-small"
      >
        标记已确认
      </button>
      <button 
        @click="batchUpdateStatus('dismissed')"
        class="btn btn-secondary btn-small"
      >
        标记已忽略
      </button>
      <button 
        @click="batchUpdateStatus('fixed')"
        class="btn btn-success btn-small"
      >
        标记已修复
      </button>
      <button 
        @click="clearSelection"
        class="btn btn-secondary btn-small"
      >
        取消选择
      </button>
    </div>

    <div class="issues-list">
      <div 
        v-for="issue in issues" 
        :key="issue.id"
        class="issue-card"
        :class="{ 'issue-selected': selectedIssues.includes(issue.id) }"
      >
        <div class="issue-header">
          <div class="issue-checkbox">
            <input 
              type="checkbox" 
              :checked="selectedIssues.includes(issue.id)"
              @change="toggleIssueSelection(issue.id)"
            />
          </div>
          <div class="issue-title">
            <span class="issue-id">#{{ issue.id }}</span>
            {{ issue.title }}
          </div>
          <div class="issue-badges">
            <span class="badge" :class="`badge-category-${issue.category}`">
              {{ getCategoryLabel(issue.category) }}
            </span>
            <span class="badge" :class="`badge-severity-${issue.severity}`">
              {{ getSeverityLabel(issue.severity) }}
            </span>
            <span class="badge" :class="`badge-status-${issue.status}`">
              {{ getStatusLabel(issue.status) }}
            </span>
          </div>
        </div>

        <div class="issue-body" v-if="expandedIssue === issue.id">
          <div class="issue-details">
            <div v-if="issue.description" class="detail-section">
              <h4>📝 描述</h4>
              <p class="detail-text">{{ issue.description }}</p>
            </div>
            <div v-if="issue.affected_panels" class="detail-section">
              <h4>📍 影响格数</h4>
              <p>{{ issue.affected_panels }}</p>
            </div>
            <div class="detail-section">
              <h4>🔬 置信度</h4>
              <div class="confidence-bar">
                <div class="confidence-fill" :style="{ width: `${issue.confidence}%` }"></div>
                <span class="confidence-text">{{ issue.confidence }}%</span>
              </div>
            </div>
          </div>

          <div class="issue-actions">
            <div class="status-actions">
              <button 
                @click="updateStatus(issue.id, 'confirmed')"
                class="btn btn-primary btn-small"
              >
                ✓ 确认问题
              </button>
              <button 
                @click="updateStatus(issue.id, 'dismissed')"
                class="btn btn-secondary btn-small"
              >
                ✗ 忽略
              </button>
              <button 
                @click="updateStatus(issue.id, 'fixed')"
                class="btn btn-success btn-small"
              >
                ✓ 已修复
              </button>
            </div>
          </div>

          <div class="review-section">
            <h4>💬 复核记录</h4>
            <div v-if="getReviews(issue.id).length > 0" class="reviews-list">
              <div 
                v-for="review in getReviews(issue.id)" 
                :key="review.id"
                class="review-item"
              >
                <div class="review-header">
                  <span class="reviewer">{{ review.reviewer }}</span>
                  <span class="review-time">{{ formatTime(review.created_at) }}</span>
                </div>
                <div v-if="review.decision" class="review-decision">
                  决定: {{ review.decision }}
                </div>
                <div v-if="review.comment" class="review-comment">
                  {{ review.comment }}
                </div>
              </div>
            </div>
            <div v-else class="no-reviews">
              暂无复核记录
            </div>

            <div class="add-review">
              <div class="form-group">
                <label>复核决定</label>
                <select v-model="newReview.decision" class="form-input">
                  <option value="">请选择</option>
                  <option value="确认是问题">确认是问题</option>
                  <option value="标记为误报">标记为误报</option>
                  <option value="需要进一步确认">需要进一步确认</option>
                </select>
              </div>
              <div class="form-group">
                <label>复核意见</label>
                <textarea 
                  v-model="newReview.comment"
                  placeholder="输入复核意见..."
                  class="form-textarea"
                ></textarea>
              </div>
              <button 
                @click="addReview(issue.id)"
                :disabled="!newReview.comment && !newReview.decision"
                class="btn btn-primary"
              >
                提交复核
              </button>
            </div>
          </div>
        </div>

        <div class="issue-footer">
          <button 
            @click="toggleExpand(issue.id)"
            class="expand-btn"
          >
            {{ expandedIssue === issue.id ? '收起详情 ▲' : '展开详情 ▼' }}
          </button>
          <div class="issue-meta">
            <span>规则: {{ issue.rule_name || 'N/A' }}</span>
            <span>创建时间: {{ formatTime(issue.created_at) }}</span>
          </div>
        </div>
      </div>

      <div v-if="issues.length === 0 && !loading" class="empty-state">
        <div class="empty-icon">✅</div>
        <h3>暂无问题</h3>
        <p>所有数据通过连续性检查，或请先导入数据并运行检查</p>
      </div>

      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>加载中...</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, computed } from 'vue'
import api from '@/api'

const loading = ref(false)
const issues = ref([])
const expandedIssue = ref(null)
const selectedIssues = ref([])
const issuesReviews = reactive({})

const filters = reactive({
  status: '',
  category: '',
  severity: ''
})

const newReview = reactive({
  decision: '',
  comment: ''
})

const loadIssues = async () => {
  loading.value = true
  try {
    const params = {}
    if (filters.status) params.status = filters.status
    if (filters.category) params.category = filters.category
    if (filters.severity) params.severity = filters.severity
    
    const response = await api.getIssues(params)
    issues.value = response.data
  } catch (e) {
    console.error('Failed to load issues:', e)
  } finally {
    loading.value = false
  }
}

const toggleExpand = (issueId) => {
  if (expandedIssue.value === issueId) {
    expandedIssue.value = null
  } else {
    expandedIssue.value = issueId
    loadReviews(issueId)
  }
}

const loadReviews = async (issueId) => {
  try {
    const response = await api.getIssueReviews(issueId)
    issuesReviews[issueId] = response.data
  } catch (e) {
    console.error('Failed to load reviews:', e)
  }
}

const getReviews = (issueId) => {
  return issuesReviews[issueId] || []
}

const toggleIssueSelection = (issueId) => {
  const idx = selectedIssues.value.indexOf(issueId)
  if (idx > -1) {
    selectedIssues.value.splice(idx, 1)
  } else {
    selectedIssues.value.push(issueId)
  }
}

const clearSelection = () => {
  selectedIssues.value = []
}

const updateStatus = async (issueId, status) => {
  try {
    await api.updateIssue(issueId, { status })
    const issue = issues.value.find(i => i.id === issueId)
    if (issue) issue.status = status
  } catch (e) {
    console.error('Failed to update status:', e)
  }
}

const batchUpdateStatus = async (status) => {
  if (selectedIssues.value.length === 0) return
  
  try {
    await api.batchUpdateIssues({
      issue_ids: selectedIssues.value,
      status
    })
    
    for (const issueId of selectedIssues.value) {
      const issue = issues.value.find(i => i.id === issueId)
      if (issue) issue.status = status
    }
    
    clearSelection()
  } catch (e) {
    console.error('Failed to batch update:', e)
  }
}

const addReview = async (issueId) => {
  try {
    const response = await api.addReview(issueId, {
      issue_id: issueId,
      reviewer: '主笔',
      decision: newReview.decision || undefined,
      comment: newReview.comment || undefined
    })
    
    if (!issuesReviews[issueId]) {
      issuesReviews[issueId] = []
    }
    issuesReviews[issueId].unshift(response.data)
    
    newReview.decision = ''
    newReview.comment = ''
  } catch (e) {
    console.error('Failed to add review:', e)
  }
}

const getCategoryLabel = (category) => {
  const labels = {
    costume: '服装',
    prop: '道具',
    timeline: '时间线',
    address: '称呼',
    similarity: '文本相似',
    other: '其他'
  }
  return labels[category] || category
}

const getSeverityLabel = (severity) => {
  const labels = {
    critical: '🔴 严重',
    high: '🟠 高',
    medium: '🟡 中',
    low: '🟢 低'
  }
  return labels[severity] || severity
}

const getStatusLabel = (status) => {
  const labels = {
    open: '待处理',
    confirmed: '已确认',
    dismissed: '已忽略',
    fixed: '已修复'
  }
  return labels[status] || status
}

const formatTime = (timeStr) => {
  if (!timeStr) return 'N/A'
  const date = new Date(timeStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(() => {
  loadIssues()
})
</script>

<style scoped>
.issues-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.page-header {
  margin-bottom: 0.5rem;
}

.page-header h2 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

.page-header p {
  margin: 0;
  color: #666;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  background: white;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  align-items: flex-end;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.filter-group label {
  font-size: 0.875rem;
  color: #555;
  font-weight: 500;
}

.filter-select {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.95rem;
  min-width: 120px;
  background: white;
}

.batch-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  background: #fff3cd;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: 1px solid #ffeaa7;
}

.batch-actions span {
  color: #856404;
  font-weight: 500;
}

.issues-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.issue-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  border-left: 4px solid #ddd;
  transition: all 0.2s ease;
}

.issue-card.issue-selected {
  border-left-color: #667eea;
  background: #f8f9ff;
}

.issue-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  cursor: pointer;
}

.issue-checkbox {
  flex-shrink: 0;
}

.issue-checkbox input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.issue-title {
  flex: 1;
  font-weight: 500;
  color: #333;
}

.issue-id {
  color: #888;
  margin-right: 0.5rem;
  font-size: 0.875rem;
}

.issue-badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.badge {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-category-costume { background: #fff3cd; color: #856404; }
.badge-category-prop { background: #d1ecf1; color: #0c5460; }
.badge-category-timeline { background: #f8d7da; color: #721c24; }
.badge-category-address { background: #d4edda; color: #155724; }
.badge-category-similarity { background: #e2e3f3; color: #495057; }
.badge-category-other { background: #e9ecef; color: #495057; }

.badge-severity-critical { background: #dc3545; color: white; }
.badge-severity-high { background: #fd7e14; color: white; }
.badge-severity-medium { background: #ffc107; color: #333; }
.badge-severity-low { background: #28a745; color: white; }

.badge-status-open { background: #007bff; color: white; }
.badge-status-confirmed { background: #28a745; color: white; }
.badge-status-dismissed { background: #6c757d; color: white; }
.badge-status-fixed { background: #20c997; color: white; }

.issue-body {
  padding: 0 1.5rem 1rem;
  border-top: 1px solid #eee;
}

.issue-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  padding: 1rem 0;
}

.detail-section h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.95rem;
  color: #555;
}

.detail-text {
  margin: 0;
  color: #333;
  line-height: 1.6;
  white-space: pre-wrap;
}

.confidence-bar {
  position: relative;
  height: 24px;
  background: #e9ecef;
  border-radius: 12px;
  overflow: hidden;
}

.confidence-fill {
  height: 100%;
  background: linear-gradient(90deg, #28a745, #667eea);
  transition: width 0.3s ease;
}

.confidence-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.875rem;
  font-weight: 600;
  color: #333;
  text-shadow: 0 1px 0 rgba(255,255,255,0.5);
}

.issue-actions {
  padding: 1rem 0;
  border-top: 1px solid #eee;
}

.status-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #218838;
}

.btn-small {
  padding: 0.375rem 0.75rem;
  font-size: 0.85rem;
}

.review-section {
  padding: 1rem 0 0;
  border-top: 1px solid #eee;
}

.review-section h4 {
  margin: 0 0 1rem 0;
  font-size: 0.95rem;
  color: #555;
}

.reviews-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.review-item {
  background: #f8f9fa;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border-left: 3px solid #667eea;
}

.review-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.25rem;
}

.reviewer {
  font-weight: 600;
  color: #333;
}

.review-time {
  font-size: 0.8rem;
  color: #888;
}

.review-decision {
  font-size: 0.9rem;
  color: #667eea;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.review-comment {
  color: #555;
  line-height: 1.5;
}

.no-reviews {
  text-align: center;
  color: #888;
  padding: 1rem;
  font-size: 0.9rem;
}

.add-review {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-group label {
  font-size: 0.85rem;
  color: #555;
  font-weight: 500;
}

.form-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.9rem;
}

.form-textarea {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.9rem;
  min-height: 80px;
  resize: vertical;
  font-family: inherit;
}

.issue-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1.5rem;
  background: #f8f9fa;
  border-top: 1px solid #eee;
}

.expand-btn {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  padding: 0.25rem 0.5rem;
}

.expand-btn:hover {
  text-decoration: underline;
}

.issue-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
  color: #888;
}

.empty-state, .loading-state {
  text-align: center;
  padding: 3rem 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

.empty-state p {
  margin: 0;
  color: #666;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #667eea;
  border-radius: 50%;
  margin: 0 auto 1rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .filter-bar {
    flex-direction: column;
    align-items: stretch;
  }
  
  .issue-header {
    flex-wrap: wrap;
  }
  
  .issue-badges {
    width: 100%;
    margin-top: 0.5rem;
  }
  
  .issue-footer {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
  
  .status-actions {
    flex-direction: column;
  }
}
</style>
