<template>
  <div>
    <div class="card" style="margin-bottom: 24px;">
      <div class="card-header">
        <h3 class="card-title">报告配置</h3>
      </div>
      <div class="card-body">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px;">
          <div class="form-group">
            <label class="form-label">报告范围</label>
            <select class="form-control form-select" v-model="reportOptions.timeRange">
              <option value="today">今天</option>
              <option value="week">本周</option>
              <option value="month" selected>本月</option>
              <option value="all">全部</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">包含内容</label>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" v-model="reportOptions.includeDevices" checked />
                <span>设备列表</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" v-model="reportOptions.includeAnomalies" checked />
                <span>异常汇总</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" v-model="reportOptions.includePairing" checked />
                <span>配对事件</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" v-model="reportOptions.includeZones" checked />
                <span>区域分析</span>
              </label>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">过滤条件</label>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" v-model="reportOptions.onlyHighRisk" />
                <span>仅高风险设备</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" v-model="reportOptions.onlyOpenAnomalies" />
                <span>仅待处理异常</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" v-model="reportOptions.includeStatistics" checked />
                <span>包含统计图表</span>
              </label>
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 12px; align-items: center;">
          <button class="btn btn-primary" :disabled="generating" @click="generatePreview">
            <span v-html="IconRefresh"></span> {{ generating ? '生成中...' : '预览报告' }}
          </button>
          <button class="btn btn-success" :disabled="!reportContent" @click="downloadReport('markdown')">
            <span v-html="IconDownload"></span> 下载 Markdown
          </button>
          <button class="btn btn-success" :disabled="!reportContent" @click="downloadReport('html')">
            <span v-html="IconDownload"></span> 下载 HTML
          </button>
          <button class="btn btn-success" :disabled="!reportContent" @click="downloadReport('csv')">
            <span v-html="IconDownload"></span> 下载 CSV
          </button>
        </div>
      </div>
    </div>

    <div v-if="generating" class="card">
      <div class="card-body" style="text-align: center; padding: 40px;">
        <div class="spinner" style="margin: 0 auto 16px;"></div>
        <p style="color: var(--color-gray-600);">正在生成报告，请稍候...</p>
      </div>
    </div>

    <div v-else-if="reportContent" class="card">
      <div class="card-header">
        <h3 class="card-title">报告预览</h3>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-sm btn-secondary" @click="toggleView">
            {{ viewMode === 'markdown' ? '切换到 HTML 视图' : '切换到 Markdown 源码' }}
          </button>
        </div>
      </div>
      <div class="card-body" style="padding: 24px;">
        <div v-if="viewMode === 'html'" class="report-preview" v-html="renderedHtml"></div>
        <pre v-else class="report-markdown">{{ reportContent.markdown || reportContent }}</pre>
      </div>
    </div>

    <div v-else class="card">
      <div class="card-body">
        <div class="empty-state">
          <p class="empty-state-title">暂无报告</p>
          <p class="empty-state-desc">点击"预览报告"按钮生成报告预览</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { useApi } from '@/utils/api'
import { 
  RefreshIcon,
  DownloadIcon
} from '@/components/icons'

export default {
  name: 'Reports',
  setup() {
    const api = useApi()

    const reportOptions = ref({
      timeRange: 'month',
      includeDevices: true,
      includeAnomalies: true,
      includePairing: true,
      includeZones: true,
      onlyHighRisk: false,
      onlyOpenAnomalies: false,
      includeStatistics: true
    })

    const generating = ref(false)
    const reportContent = ref(null)
    const viewMode = ref('html')

    const IconRefresh = RefreshIcon()
    const IconDownload = DownloadIcon()

    const renderedHtml = computed(() => {
      if (!reportContent.value) return ''
      const md = reportContent.value.markdown || reportContent.value
      return markdownToHtml(md)
    })

    const markdownToHtml = (md) => {
      if (!md) return ''
      
      let html = md
        .replace(/^# (.*)$/gm, '<h1 style="font-size: 24px; font-weight: 700; color: var(--color-gray-900); margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid var(--color-primary);">$1</h1>')
        .replace(/^## (.*)$/gm, '<h2 style="font-size: 20px; font-weight: 600; color: var(--color-gray-900); margin-top: 24px; margin-bottom: 12px;">$1</h2>')
        .replace(/^### (.*)$/gm, '<h3 style="font-size: 16px; font-weight: 600; color: var(--color-gray-800); margin-top: 20px; margin-bottom: 10px;">$1</h3>')
        .replace(/^- (.*)$/gm, '<li style="margin-bottom: 4px;">$1</li>')
        .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 600;">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code style="background: var(--color-gray-100); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em;">$1</code>')
      
      html = html.split('\n').map(line => {
        if (line.startsWith('<li>')) return line
        if (line.trim() === '') return '<br>'
        if (line.startsWith('<h') || line.startsWith('<')) return line
        return `<p style="margin-bottom: 8px; line-height: 1.6;">${line}</p>`
      }).join('\n')
      
      if (html.includes('<li>')) {
        html = html.replace(/(<li.*?<\/li>\n?)+/g, '<ul style="margin: 12px 0; padding-left: 24px;">$&</ul>')
      }
      
      return html
    }

    const generatePreview = async () => {
      generating.value = true
      try {
        const params = {
          format: 'markdown',
          ...reportOptions.value
        }
        const result = await api.reports.preview(params)
        reportContent.value = result
        viewMode.value = 'html'
        showNotification('success', '生成成功', '报告预览已生成')
      } catch (error) {
        showNotification('error', '生成失败', error.message)
      } finally {
        generating.value = false
      }
    }

    const downloadReport = async (format) => {
      try {
        const params = {
          format,
          ...reportOptions.value
        }
        const result = await api.reports.get(params)
        
        let content = result.content || result
        let filename = result.filename || `ble-inspection-report-${new Date().toISOString().split('T')[0]}`
        let mimeType = 'text/plain'
        
        if (format === 'markdown') {
          filename += '.md'
          mimeType = 'text/markdown'
        } else if (format === 'html') {
          filename += '.html'
          mimeType = 'text/html'
        } else if (format === 'csv') {
          filename += '.csv'
          mimeType = 'text/csv'
        }
        
        const blob = new Blob([content], { type: mimeType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        showNotification('success', '下载成功', `已下载 ${filename}`)
      } catch (error) {
        showNotification('error', '下载失败', error.message)
      }
    }

    const toggleView = () => {
      viewMode.value = viewMode.value === 'html' ? 'markdown' : 'html'
    }

    const showNotification = (type, title, message) => {
      const event = new CustomEvent('notification', {
        detail: { type, title, message }
      })
      window.dispatchEvent(event)
    }

    return {
      reportOptions,
      generating,
      reportContent,
      viewMode,
      renderedHtml,
      IconRefresh,
      IconDownload,
      generatePreview,
      downloadReport,
      toggleView
    }
  }
}
</script>

<style scoped>
.report-preview {
  line-height: 1.8;
  color: var(--color-gray-800);
}

.report-preview h1 {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-gray-900);
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--color-primary);
}

.report-preview h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-gray-900);
  margin-top: 24px;
  margin-bottom: 12px;
}

.report-preview h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-gray-800);
  margin-top: 20px;
  margin-bottom: 10px;
}

.report-preview p {
  margin-bottom: 8px;
  line-height: 1.6;
}

.report-preview ul {
  margin: 12px 0;
  padding-left: 24px;
}

.report-preview li {
  margin-bottom: 4px;
}

.report-preview strong {
  font-weight: 600;
}

.report-preview code {
  background: var(--color-gray-100);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 0.9em;
}

.report-markdown {
  background: var(--color-gray-50);
  padding: 16px;
  border-radius: var(--radius-md);
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 600px;
  overflow-y: auto;
}
</style>
