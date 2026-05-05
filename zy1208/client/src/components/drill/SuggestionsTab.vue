<template>
  <div class="suggestions-tab">
    <el-alert
      v-if="!hasSuggestions"
      title="暂无优化建议"
      type="info"
      show-icon
    >
      <template #default>
        <p>请先运行性能分析</p>
      </template>
    </el-alert>

    <div v-else class="suggestions-content">
      <el-tabs v-model="activeTab" type="border-card">
        <el-tab-pane label="SQL 优化建议" name="sql">
          <div class="suggestion-list">
            <el-empty v-if="!analysis?.sqlSuggestions?.length" description="暂无 SQL 优化建议" />
            
            <div v-else class="suggestion-items">
              <el-card 
                v-for="(suggestion, index) in analysis.sqlSuggestions" 
                :key="index"
                class="suggestion-card"
              >
                <template #header>
                  <div class="card-header">
                    <div class="title-section">
                      <el-icon class="icon-sql" :size="18"><Document /></el-icon>
                      <span class="title">{{ suggestion.title || 'SQL 优化' }}</span>
                    </div>
                    <el-tag type="primary">SQL</el-tag>
                  </div>
                </template>
                
                <div class="suggestion-content">
                  <div class="problem-section">
                    <div class="section-label">
                      <el-icon><Warning /></el-icon>
                      <span>问题</span>
                    </div>
                    <p class="problem-text">{{ suggestion.problem || '未描述问题' }}</p>
                  </div>
                  
                  <div class="sql-section" v-if="suggestion.originalSql">
                    <div class="section-label">
                      <el-icon><Document /></el-icon>
                      <span>原 SQL</span>
                    </div>
                    <pre class="sql-code">{{ suggestion.originalSql }}</pre>
                  </div>
                  
                  <div class="sql-section" v-if="suggestion.optimizedSql">
                    <div class="section-label">
                      <el-icon><CircleCheck /></el-icon>
                      <span>优化后 SQL</span>
                    </div>
                    <pre class="sql-code optimized">{{ suggestion.optimizedSql }}</pre>
                  </div>
                  
                  <div class="explanation-section" v-if="suggestion.explanation">
                    <div class="section-label">
                      <el-icon><Tips /></el-icon>
                      <span>说明</span>
                    </div>
                    <p class="explanation-text">{{ suggestion.explanation }}</p>
                  </div>
                </div>
              </el-card>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="索引优化建议" name="index">
          <div class="suggestion-list">
            <el-empty v-if="!analysis?.indexSuggestions?.length" description="暂无索引优化建议" />
            
            <div v-else class="suggestion-items">
              <el-card 
                v-for="(suggestion, index) in analysis.indexSuggestions" 
                :key="index"
                class="suggestion-card"
              >
                <template #header>
                  <div class="card-header">
                    <div class="title-section">
                      <el-icon 
                        :class="suggestion.action === 'drop' ? 'icon-drop' : 'icon-create'" 
                        :size="18"
                      >
                        <component :is="suggestion.action === 'drop' ? 'Delete' : 'Plus'" />
                      </el-icon>
                      <span class="title">
                        {{ getActionText(suggestion.action) }}索引 - {{ suggestion.tableName || '未知表' }}
                      </span>
                    </div>
                    <el-tag :type="getActionType(suggestion.action)">
                      {{ getActionText(suggestion.action) }}
                    </el-tag>
                  </div>
                </template>
                
                <div class="suggestion-content">
                  <el-descriptions :column="2" border>
                    <el-descriptions-item label="表名">
                      {{ suggestion.tableName || 'N/A' }}
                    </el-descriptions-item>
                    <el-descriptions-item label="索引名">
                      {{ suggestion.indexName || 'N/A' }}
                    </el-descriptions-item>
                  </el-descriptions>
                  
                  <div class="problem-section" style="margin-top: 16px;">
                    <div class="section-label">
                      <el-icon><Warning /></el-icon>
                      <span>问题</span>
                    </div>
                    <p class="problem-text">{{ suggestion.problem || '未描述问题' }}</p>
                  </div>
                  
                  <div class="sql-section" v-if="suggestion.sql">
                    <div class="section-label">
                      <el-icon><Document /></el-icon>
                      <span>建议 SQL</span>
                    </div>
                    <pre class="sql-code">{{ suggestion.sql }}</pre>
                  </div>
                </div>
              </el-card>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="连接池建议" name="pool">
          <div class="suggestion-list">
            <el-empty v-if="!hasPoolSuggestions" description="暂无连接池优化建议" />
            
            <el-card v-else class="pool-card">
              <template #header>
                <div class="card-header">
                  <div class="title-section">
                    <el-icon class="icon-pool" :size="18"><Connection /></el-icon>
                    <span class="title">连接池配置建议</span>
                  </div>
                </div>
              </template>
              
              <div class="pool-content">
                <el-alert
                  v-if="analysis.connectionPool?.connectionIssues?.length > 0"
                  title="检测到连接池问题"
                  type="warning"
                  show-icon
                  style="margin-bottom: 20px;"
                >
                  <template #default>
                    <ul>
                      <li v-for="(issue, index) in analysis.connectionPool.connectionIssues" :key="index">
                        {{ issue }}
                      </li>
                    </ul>
                  </template>
                </el-alert>
                
                <el-descriptions :column="2" border>
                  <el-descriptions-item label="当前最大连接数">
                    <span class="current-value">{{ analysis.connectionPool?.currentMaxConnections || 'N/A' }}</span>
                    <el-tag 
                      v-if="analysis.connectionPool?.suggestedMaxConnections" 
                      type="success"
                      style="margin-left: 8px;"
                    >
                      建议: {{ analysis.connectionPool.suggestedMaxConnections }}
                    </el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="当前空闲超时">
                    <span class="current-value">{{ analysis.connectionPool?.currentIdleTimeout || 'N/A' }}</span>
                    <el-tag 
                      v-if="analysis.connectionPool?.suggestedIdleTimeout" 
                      type="success"
                      style="margin-left: 8px;"
                    >
                      建议: {{ analysis.connectionPool.suggestedIdleTimeout }}
                    </el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="当前最小空闲连接">
                    <span class="current-value">{{ analysis.connectionPool?.currentMinIdle || 'N/A' }}</span>
                    <el-tag 
                      v-if="analysis.connectionPool?.suggestedMinIdle" 
                      type="success"
                      style="margin-left: 8px;"
                    >
                      建议: {{ analysis.connectionPool.suggestedMinIdle }}
                    </el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="说明" :span="2">
                    {{ analysis.connectionPool?.maxConnectionsExplanation || analysis.connectionPool?.idleTimeoutExplanation || '根据当前连接池使用情况分析' }}
                  </el-descriptions-item>
                </el-descriptions>
              </div>
            </el-card>
          </div>
        </el-tab-pane>

        <el-tab-pane label="读写路由建议" name="routing">
          <div class="suggestion-list">
            <el-empty v-if="!hasRoutingSuggestions" description="暂无读写路由优化建议" />
            
            <el-card v-else class="routing-card">
              <template #header>
                <div class="card-header">
                  <div class="title-section">
                    <el-icon class="icon-routing" :size="18"><Share /></el-icon>
                    <span class="title">读写分离路由建议</span>
                  </div>
                </div>
              </template>
              
              <div class="routing-content">
                <el-descriptions :column="2" border style="margin-bottom: 20px;">
                  <el-descriptions-item label="读查询数量">
                    {{ analysis.readWriteRouting?.readQueries || 0 }}
                  </el-descriptions-item>
                  <el-descriptions-item label="写查询数量">
                    {{ analysis.readWriteRouting?.writeQueries || 0 }}
                  </el-descriptions-item>
                  <el-descriptions-item label="读写比例" :span="2">
                    {{ analysis.readWriteRouting?.readWriteRatio || 'N/A' }}
                  </el-descriptions-item>
                </el-descriptions>
                
                <div class="issues-section" v-if="analysis.readWriteRouting?.issues?.length > 0">
                  <h4>检测到的问题：</h4>
                  <ul>
                    <li v-for="(issue, index) in analysis.readWriteRouting.issues" :key="index">
                      {{ issue }}
                    </li>
                  </ul>
                </div>
                
                <div class="suggestions-section" v-if="analysis.readWriteRouting?.suggestions?.length > 0">
                  <h4>优化建议：</h4>
                  <ul>
                    <li v-for="(suggestion, index) in analysis.readWriteRouting.suggestions" :key="index">
                      {{ suggestion }}
                    </li>
                  </ul>
                </div>
              </div>
            </el-card>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { analysisApi } from '@/api'

const route = useRoute()

const analysis = ref(null)
const activeTab = ref('sql')

const hasSuggestions = computed(() => {
  if (!analysis.value) return false
  return (
    analysis.value.sqlSuggestions?.length > 0 ||
    analysis.value.indexSuggestions?.length > 0 ||
    analysis.value.connectionPool ||
    analysis.value.readWriteRouting
  )
})

const hasPoolSuggestions = computed(() => {
  return analysis.value?.connectionPool && (
    analysis.value.connectionPool.connectionIssues?.length > 0 ||
    analysis.value.connectionPool.suggestedMaxConnections
  )
})

const hasRoutingSuggestions = computed(() => {
  return analysis.value?.readWriteRouting && (
    analysis.value.readWriteRouting.issues?.length > 0 ||
    analysis.value.readWriteRouting.suggestions?.length > 0
  )
})

const getActionText = (action) => {
  const map = {
    create: '创建',
    drop: '删除',
    modify: '修改'
  }
  return map[action] || action
}

const getActionType = (action) => {
  const map = {
    create: 'success',
    drop: 'danger',
    modify: 'warning'
  }
  return map[action] || 'primary'
}

const fetchAnalysis = async () => {
  try {
    const drillId = route.params.id
    const response = await analysisApi.get(drillId)
    analysis.value = response.data
  } catch (error) {
    console.log('暂无分析结果')
  }
}

onMounted(() => {
  fetchAnalysis()
})
</script>

<style scoped>
.suggestions-tab {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.suggestions-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.suggestion-list {
  padding: 10px;
}

.suggestion-items {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.suggestion-card, .pool-card, .routing-card {
  border-radius: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title {
  font-size: 15px;
  font-weight: 600;
}

.icon-sql {
  color: #409eff;
}

.icon-create {
  color: #67c23a;
}

.icon-drop {
  color: #f56c6c;
}

.icon-pool {
  color: #909399;
}

.icon-routing {
  color: #e6a23c;
}

.suggestion-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 8px;
}

.problem-text, .explanation-text {
  margin: 0;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 14px;
  line-height: 1.6;
}

.sql-code {
  margin: 0;
  padding: 16px;
  background: #1e1e1e;
  color: #d4d4d4;
  border-radius: 4px;
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', monospace;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.sql-code.optimized {
  border-left: 4px solid #67c23a;
}

.current-value {
  font-weight: 600;
  color: #303133;
}

.pool-content, .routing-content {
  padding: 10px 0;
}

.issues-section, .suggestions-section {
  padding: 12px;
  border-radius: 4px;
}

.issues-section {
  background: #fef0f0;
}

.suggestions-section {
  background: #f0f9eb;
  margin-top: 12px;
}

.issues-section h4, .suggestions-section h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
}

.issues-section h4 {
  color: #f56c6c;
}

.suggestions-section h4 {
  color: #67c23a;
}

.issues-section ul, .suggestions-section ul {
  margin: 0;
  padding-left: 20px;
}

.issues-section li, .suggestions-section li {
  margin: 4px 0;
  font-size: 13px;
}
</style>
