<template>
  <div class="report-tab">
    <el-alert
      v-if="!analysis"
      title="暂无报告数据"
      type="warning"
      show-icon
    >
      <template #default>
        <p>请先运行性能分析</p>
      </template>
    </el-alert>

    <div v-else class="report-content">
      <el-card class="export-card">
        <template #header>
          <div class="card-header">
            <span>导出报告</span>
          </div>
        </template>
        
        <div class="export-buttons">
          <el-button type="primary" size="large" @click="exportMarkdown" :loading="exporting">
            <el-icon><Download /></el-icon>
            导出 Markdown 报告
          </el-button>
          <el-button type="success" size="large" @click="exportJson" :loading="exporting">
            <el-icon><Download /></el-icon>
            导出 JSON 报告
          </el-button>
        </div>
      </el-card>

      <el-card class="preview-card">
        <template #header>
          <div class="card-header">
            <span>报告预览</span>
            <el-tag type="info">完整报告请导出查看</el-tag>
          </div>
        </template>
        
        <div class="report-preview" v-html="reportHtml"></div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { analysisApi, reportApi } from '@/api'
import { ElMessage } from 'element-plus'
import { marked } from 'marked'

const route = useRoute()

const analysis = ref(null)
const exporting = ref(false)

const reportHtml = computed(() => {
  if (!analysis.value) return ''
  
  let html = `
    <h2>数据库性能调优分析报告</h2>
    
    <h3>一、总体评分</h3>
    <div class="score-display">
      <span class="score-value">${analysis.value.overall_score || analysis.value.overallScore || 0}</span>
      <span class="score-label">/ 100</span>
    </div>
  `
  
  const bottlenecks = analysis.value.bottlenecks || []
  if (bottlenecks.length > 0) {
    const severityCount = {
      critical: bottlenecks.filter(b => b.severity === 'critical').length,
      high: bottlenecks.filter(b => b.severity === 'high').length,
      medium: bottlenecks.filter(b => b.severity === 'medium').length,
      low: bottlenecks.filter(b => b.severity === 'low').length
    }
    
    html += `
      <h3>二、瓶颈问题统计</h3>
      <table class="stats-table">
        <tr>
          <th>严重程度</th>
          <th>数量</th>
        </tr>
        <tr class="critical">
          <td>🔴 严重</td>
          <td>${severityCount.critical}</td>
        </tr>
        <tr class="high">
          <td>🟠 高</td>
          <td>${severityCount.high}</td>
        </tr>
        <tr class="medium">
          <td>🟡 中</td>
          <td>${severityCount.medium}</td>
        </tr>
        <tr class="low">
          <td>🟢 低</td>
          <td>${severityCount.low}</td>
        </tr>
      </table>
      
      <h3>三、主要瓶颈问题</h3>
    `
    
    const topBottlenecks = [...bottlenecks]
      .sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
        return (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3)
      })
      .slice(0, 5)
    
    for (const [index, item] of topBottlenecks.entries()) {
      const severityEmoji = item.severity === 'critical' ? '🔴' :
                             item.severity === 'high' ? '🟠' :
                             item.severity === 'medium' ? '🟡' : '🟢'
      
      html += `
        <div class="bottleneck-item">
          <h4>${index + 1}. ${severityEmoji} ${item.category || '问题'}</h4>
          <p><strong>问题描述:</strong> ${item.description || '未提供详细描述'}</p>
          <p><strong>建议:</strong> ${item.suggestion || '需要进一步分析'}</p>
        </div>
      `
    }
  }
  
  const sqlSuggestions = analysis.value.sqlSuggestions || []
  if (sqlSuggestions.length > 0) {
    html += `
      <h3>四、SQL 优化建议</h3>
      <p>共 ${sqlSuggestions.length} 条 SQL 优化建议，请导出完整报告查看详情。</p>
    `
  }
  
  const indexSuggestions = analysis.value.indexSuggestions || []
  if (indexSuggestions.length > 0) {
    html += `
      <h3>五、索引优化建议</h3>
      <p>共 ${indexSuggestions.length} 条索引优化建议，请导出完整报告查看详情。</p>
    `
  }
  
  const connectionPool = analysis.value.connectionPool
  if (connectionPool && (connectionPool.connectionIssues?.length > 0 || connectionPool.suggestedMaxConnections)) {
    html += `
      <h3>六、连接池建议</h3>
    `
    if (connectionPool.currentMaxConnections) {
      html += `<p>当前最大连接数: <strong>${connectionPool.currentMaxConnections}</strong></p>`
    }
    if (connectionPool.suggestedMaxConnections) {
      html += `<p>建议最大连接数: <strong>${connectionPool.suggestedMaxConnections}</strong></p>`
    }
    if (connectionPool.connectionIssues?.length > 0) {
      html += `<p>检测到 <strong>${connectionPool.connectionIssues.length}</strong> 个连接池问题</p>`
    }
  }
  
  const readWriteRouting = analysis.value.readWriteRouting
  if (readWriteRouting && (readWriteRouting.issues?.length > 0 || readWriteRouting.suggestions?.length > 0)) {
    html += `
      <h3>七、读写分离建议</h3>
    `
    if (readWriteRouting.readQueries !== undefined) {
      html += `<p>读查询: <strong>${readWriteRouting.readQueries}</strong>, 写查询: <strong>${readWriteRouting.writeQueries}</strong></p>`
    }
    if (readWriteRouting.issues?.length > 0) {
      html += `<p>检测到 <strong>${readWriteRouting.issues.length}</strong> 个路由问题</p>`
    }
  }
  
  const shardingRisks = analysis.value.shardingRisks || []
  if (shardingRisks.length > 0) {
    html += `
      <h3>八、分片风险</h3>
      <p>共检测到 ${shardingRisks.length} 个分片相关风险，请导出完整报告查看详情。</p>
    `
  }
  
  return html
})

const fetchAnalysis = async () => {
  try {
    const drillId = route.params.id
    const response = await analysisApi.get(drillId)
    analysis.value = response.data
  } catch (error) {
    console.log('暂无分析结果')
  }
}

const exportMarkdown = async () => {
  exporting.value = true
  try {
    const drillId = route.params.id
    const response = await reportApi.getMarkdown(drillId)
    
    const blob = new Blob([response.data], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analysis-report-${drillId}.md`
    a.click()
    URL.revokeObjectURL(url)
    
    ElMessage.success('Markdown 报告导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败，请重试')
  } finally {
    exporting.value = false
  }
}

const exportJson = async () => {
  exporting.value = true
  try {
    const drillId = route.params.id
    const response = await reportApi.getJson(drillId)
    
    const blob = new Blob([response.data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analysis-report-${drillId}.json`
    a.click()
    URL.revokeObjectURL(url)
    
    ElMessage.success('JSON 报告导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败，请重试')
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  fetchAnalysis()
})
</script>

<style scoped>
.report-tab {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.report-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.export-card, .preview-card {
  border-radius: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.export-buttons {
  display: flex;
  gap: 16px;
}

.report-preview {
  line-height: 1.8;
  color: #303133;
}

.report-preview h2 {
  font-size: 22px;
  color: #303133;
  border-bottom: 2px solid #409eff;
  padding-bottom: 10px;
  margin-bottom: 20px;
}

.report-preview h3 {
  font-size: 18px;
  color: #409eff;
  margin-top: 30px;
  margin-bottom: 15px;
}

.report-preview h4 {
  font-size: 15px;
  color: #303133;
  margin-bottom: 10px;
}

.score-display {
  text-align: center;
  padding: 30px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  margin: 20px 0;
}

.score-value {
  font-size: 64px;
  font-weight: 700;
  color: #fff;
}

.score-label {
  font-size: 24px;
  color: rgba(255, 255, 255, 0.8);
}

.stats-table {
  width: 100%;
  border-collapse: collapse;
  margin: 15px 0;
}

.stats-table th,
.stats-table td {
  border: 1px solid #ebeef5;
  padding: 12px 16px;
  text-align: left;
}

.stats-table th {
  background: #f5f7fa;
  font-weight: 600;
}

.stats-table tr.critical td {
  background: #fef0f0;
  color: #f56c6c;
}

.stats-table tr.high td {
  background: #fdf6ec;
  color: #e6a23c;
}

.stats-table tr.medium td {
  background: #fdf6ec;
  color: #e6a23c;
}

.stats-table tr.low td {
  background: #f4f4f5;
  color: #909399;
}

.bottleneck-item {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  border-left: 4px solid #409eff;
}

.bottleneck-item p {
  margin: 8px 0;
}
</style>
