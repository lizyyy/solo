<template>
  <div>
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">业务流程状态</h2>
      </div>
      <div class="pipeline">
        <div 
          v-for="(step, index) in pipelineStatus" 
          :key="step.stage"
          class="pipeline-step"
          :class="{
            'completed': step.status === 'completed',
            'active': currentStageIndex === index && step.status !== 'completed',
            'blocked': currentStageIndex === index && businessStatus.currentBlock
          }"
        >
          <div class="pipeline-indicator">
            {{ index + 1 }}
          </div>
          <div class="pipeline-label">{{ step.name }}</div>
        </div>
      </div>
      
      <div v-if="businessStatus.currentStage" class="mt-4">
        <div class="flex items-center gap-2 mb-4">
          <strong>当前阶段:</strong>
          <span class="status-badge status-info">{{ businessStatus.currentStageDescription }}</span>
        </div>
        
        <div v-if="businessStatus.currentBlock" class="alert-item medium">
          <div class="alert-icon">⚠️</div>
          <div class="alert-content">
            <div class="alert-title">存在卡点</div>
            <div class="alert-desc">卡点标识: {{ businessStatus.currentBlock }}</div>
          </div>
        </div>
        
        <div v-if="businessStatus.currentSuggestions && businessStatus.currentSuggestions.length > 0">
          <h3 class="text-bold mb-4">处理建议</h3>
          <ul class="suggestion-list">
            <li 
              v-for="(suggestion, index) in businessStatus.currentSuggestions" 
              :key="index"
              class="suggestion-item"
              :class="{
                'warning': suggestion.includes('警告') || suggestion.includes('问题'),
                'danger': suggestion.includes('极热区') || suggestion.includes('警报')
              }"
            >
              {{ suggestion }}
            </li>
          </ul>
        </div>
      </div>
    </div>
    
    <div class="grid grid-4">
      <div class="stat-card">
        <div class="label">总停留点</div>
        <div class="value">{{ summary.stopPoints.total }}</div>
        <div class="text-xs text-muted mt-4">
          有效: {{ summary.stopPoints.valid }} | 无效: {{ summary.stopPoints.invalid }}
        </div>
      </div>
      
      <div class="stat-card">
        <div class="label">展区数量</div>
        <div class="value">{{ summary.exhibitions.total }}</div>
      </div>
      
      <div class="stat-card" :class="summary.problems.bySeverity.error > 0 ? 'danger' : ''">
        <div class="label">未处理问题</div>
        <div class="value">{{ summary.problems.open }}</div>
        <div class="text-xs text-muted mt-4">
          错误: {{ summary.problems.bySeverity.error }} | 警告: {{ summary.problems.bySeverity.warning }}
        </div>
      </div>
      
      <div class="stat-card" :class="summary.security.latest?.alertCount > 0 ? 'critical' : ''">
        <div class="label">热区计算次数</div>
        <div class="value">{{ summary.heatmaps.total }}</div>
        <div v-if="summary.security.latest" class="text-xs text-muted mt-4">
          安全警报: {{ summary.security.latest.alertCount }}
        </div>
      </div>
    </div>
    
    <div class="grid grid-2">
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">最近问题</h2>
          <button class="btn btn-sm btn-outline" @click="$router.push('/problems')">查看全部</button>
        </div>
        
        <div v-if="summary.problems.recent && summary.problems.recent.length > 0">
          <table class="table">
            <thead>
              <tr>
                <th>严重程度</th>
                <th>类型</th>
                <th>消息</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="problem in summary.problems.recent" :key="problem.id">
                <td>
                  <span 
                    class="status-badge"
                    :class="getProblemStatusClass(problem.severity)"
                  >
                    {{ getSeverityLabel(problem.severity) }}
                  </span>
                </td>
                <td>{{ problem.type }}</td>
                <td>{{ problem.message }}</td>
                <td class="text-xs text-muted">{{ formatTime(problem.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty-state">
          <div class="empty-state-icon">✅</div>
          <div class="empty-state-text">暂无未处理问题</div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">业务状态历史</h2>
        </div>
        
        <div v-if="statusHistory && statusHistory.length > 0" class="timeline">
          <div 
            v-for="(item, index) in statusHistory.slice(0, 8)" 
            :key="item.id"
            class="timeline-item"
          >
            <div 
              class="timeline-dot"
              :class="getTimelineDotClass(item)"
            ></div>
            <div class="timeline-time">{{ formatTime(item.timestamp) }}</div>
            <div class="timeline-content">
              <strong>{{ item.description }}</strong>
              <div v-if="item.block" class="text-xs text-muted">
                卡点: {{ item.block }}
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-text">暂无历史记录</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';

export default {
  name: 'Dashboard',
  setup() {
    const summary = ref({
      stopPoints: { total: 0, valid: 0, invalid: 0 },
      exhibitions: { total: 0, list: [] },
      heatmaps: { total: 0, latest: null },
      security: { total: 0, latest: null },
      problems: { total: 0, open: 0, bySeverity: { error: 0, warning: 0, info: 0 }, recent: [] },
      businessStatus: { currentStage: 'idle', currentStageDescription: '', currentBlock: null, currentSuggestions: [] }
    });
    
    const pipelineStatus = ref([]);
    const businessStatus = ref({});
    const statusHistory = ref([]);
    
    const currentStageIndex = computed(() => {
      const stages = ['idle', 'data_import', 'exhibition_grouping', 'heatmap_calculation', 'security_recommendation', 'completed'];
      return stages.indexOf(businessStatus.value.currentStage);
    });
    
    async function loadDashboard() {
      try {
        const response = await fetch('/api/status/dashboard/summary');
        const data = await response.json();
        if (data.success) {
          summary.value = data.data;
          businessStatus.value = data.data.businessStatus;
        }
      } catch (e) {
        console.error('加载仪表盘数据失败:', e);
      }
    }
    
    async function loadPipelineStatus() {
      try {
        const response = await fetch('/api/status/pipeline/status');
        const data = await response.json();
        if (data.success) {
          pipelineStatus.value = data.data.pipelineStatus;
        }
      } catch (e) {
        console.error('加载流程状态失败:', e);
      }
    }
    
    async function loadStatusHistory() {
      try {
        const response = await fetch('/api/status/history?limit=20');
        const data = await response.json();
        if (data.success) {
          statusHistory.value = data.data;
        }
      } catch (e) {
        console.error('加载状态历史失败:', e);
      }
    }
    
    function getProblemStatusClass(severity) {
      const map = {
        error: 'status-danger',
        warning: 'status-warning',
        info: 'status-info'
      };
      return map[severity] || 'status-info';
    }
    
    function getSeverityLabel(severity) {
      const map = {
        error: '错误',
        warning: '警告',
        info: '信息'
      };
      return map[severity] || severity;
    }
    
    function getTimelineDotClass(item) {
      if (item.block) return 'warning';
      if (item.suggestions && item.suggestions.some(s => s.includes('警告') || s.includes('问题'))) {
        return 'danger';
      }
      return 'success';
    }
    
    function formatTime(timestamp) {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    onMounted(() => {
      loadDashboard();
      loadPipelineStatus();
      loadStatusHistory();
      
      const interval = setInterval(() => {
        loadDashboard();
        loadPipelineStatus();
        loadStatusHistory();
      }, 10000);
      
      return () => clearInterval(interval);
    });
    
    return {
      summary,
      pipelineStatus,
      businessStatus,
      statusHistory,
      currentStageIndex,
      getProblemStatusClass,
      getSeverityLabel,
      getTimelineDotClass,
      formatTime
    };
  }
};
</script>
