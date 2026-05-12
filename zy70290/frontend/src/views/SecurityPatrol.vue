<template>
  <div>
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">安保巡逻建议</h2>
        <button class="btn btn-primary" @click="generateRecommendation" :disabled="isGenerating">
          {{ isGenerating ? '生成中...' : '生成巡逻建议' }}
        </button>
      </div>
      
      <div v-if="lastResult">
        <div class="mb-4">
          <strong>状态:</strong>
          <span 
            class="status-badge"
            :class="lastResult.success ? 'status-success' : 'status-danger'"
            style="margin-left: 8px;"
          >
            {{ lastResult.success ? '成功' : '失败' }}
          </span>
        </div>
        
        <div v-if="lastResult.message" class="mb-4">
          <strong>消息:</strong> {{ lastResult.message }}
        </div>
        
        <div v-if="lastResult.suggestions && lastResult.suggestions.length > 0">
          <h3 class="text-bold mb-2">处理建议</h3>
          <ul class="suggestion-list">
            <li 
              v-for="(suggestion, index) in lastResult.suggestions" 
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
    
    <div v-if="recommendation">
      <div v-if="recommendation.overallAssessment" class="card">
        <div class="card-header">
          <h2 class="card-title">整体安保评估</h2>
        </div>
        
        <div class="grid grid-2">
          <div class="stat-card" :class="getRiskLevelClass(recommendation.overallAssessment.level)">
            <div class="label">风险等级</div>
            <div class="value">{{ getRiskLevelLabel(recommendation.overallAssessment.level) }}</div>
            <div class="text-sm mt-4">{{ recommendation.overallAssessment.description }}</div>
          </div>
          <div class="stat-card danger" v-if="recommendation.alerts && recommendation.alerts.length > 0">
            <div class="label">安全警报</div>
            <div class="value">{{ recommendation.alerts.length }}</div>
            <div class="text-sm mt-4">需要立即关注</div>
          </div>
        </div>
        
        <div class="mt-4">
          <strong>建议行动:</strong> {{ recommendation.overallAssessment.action }}
        </div>
      </div>
      
      <div v-if="recommendation.alerts && recommendation.alerts.length > 0" class="card">
        <div class="card-header">
          <h2 class="card-title">安全警报</h2>
        </div>
        
        <div 
          v-for="alert in recommendation.alerts" 
          :key="alert.type + alert.exhibition"
          class="alert-item"
          :class="alert.level"
        >
          <div class="alert-icon">🚨</div>
          <div class="alert-content">
            <div class="alert-title">{{ alert.message }}</div>
            <div class="alert-desc">
              热度: {{ (alert.heatScore * 100).toFixed(0) }}% | 
              观众数: {{ alert.visitorCount }}
            </div>
          </div>
        </div>
      </div>
      
      <div class="grid grid-2">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">展区巡逻方案</h2>
          </div>
          
          <div v-if="recommendation.exhibitionPatrols && recommendation.exhibitionPatrols.length > 0">
            <table class="table">
              <thead>
                <tr>
                  <th>展区</th>
                  <th>热度等级</th>
                  <th>巡逻频率</th>
                  <th>需要关注</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="patrol in recommendation.exhibitionPatrols" :key="patrol.exhibitionId">
                  <td>
                    <strong>{{ patrol.exhibitionName }}</strong>
                    <div class="text-xs text-muted">观众数: {{ patrol.visitorCount }}</div>
                  </td>
                  <td>
                    <span 
                      class="status-badge"
                      :class="getHeatLevelClass(patrol.heatLevel)"
                    >
                      {{ getHeatLevelLabel(patrol.heatLevel) }}
                    </span>
                  </td>
                  <td>{{ patrol.strategy.frequency }}</td>
                  <td>
                    <span v-if="patrol.needsExtraAttention" class="status-badge status-danger">
                      需关注
                    </span>
                    <span v-else class="text-xs text-muted">正常</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">巡逻时间安排</h2>
          </div>
          
          <div v-if="recommendation.patrolSchedule && recommendation.patrolSchedule.length > 0">
            <div 
              v-for="schedule in recommendation.patrolSchedule" 
              :key="schedule.time"
              class="mb-4 pb-4 border-b border-gray-200"
            >
              <div class="flex items-center justify-between mb-2">
                <strong>{{ schedule.time }}</strong>
                <span class="text-sm text-muted">{{ schedule.label }}</span>
              </div>
              <div v-if="schedule.primaryPatrols && schedule.primaryPatrols.length > 0">
                <div class="text-sm text-muted mb-1">重点巡逻:</div>
                <div class="flex flex-wrap gap-2">
                  <span 
                    v-for="(area, index) in schedule.primaryPatrols" 
                    :key="index"
                    class="status-badge status-danger"
                  >
                    {{ area }}
                  </span>
                </div>
              </div>
              <div v-if="schedule.secondaryPatrols && schedule.secondaryPatrols.length > 0" class="mt-2">
                <div class="text-sm text-muted mb-1">常规巡逻:</div>
                <div class="flex flex-wrap gap-2">
                  <span 
                    v-for="(area, index) in schedule.secondaryPatrols" 
                    :key="index"
                    class="status-badge status-info"
                  >
                    {{ area }}
                  </span>
                </div>
              </div>
              <div class="text-xs text-muted mt-2">{{ schedule.notes }}</div>
            </div>
          </div>
        </div>
      </div>
      
      <div v-if="recommendation.displaySuggestions && recommendation.displaySuggestions.length > 0" class="card">
        <div class="card-header">
          <h2 class="card-title">展墙说明优化建议</h2>
        </div>
        
        <ul class="suggestion-list">
          <li 
            v-for="(suggestion, index) in recommendation.displaySuggestions" 
            :key="index"
            class="suggestion-item"
            :class="{
              'warning': suggestion.priority === 'medium',
              'danger': suggestion.priority === 'high'
            }"
          >
            <strong>{{ suggestion.exhibition }}:</strong> {{ suggestion.suggestion }}
          </li>
        </ul>
      </div>
    </div>
    
    <div v-else class="card">
      <div class="empty-state">
        <div class="empty-state-icon">👮</div>
        <div class="empty-state-text">暂无安保巡逻建议</div>
        <div class="text-sm text-muted mt-2">请先生成热区数据，然后生成巡逻建议</div>
        <button class="btn btn-primary mt-4" @click="generateRecommendation">生成巡逻建议</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';

export default {
  name: 'SecurityPatrol',
  setup() {
    const isGenerating = ref(false);
    const lastResult = ref(null);
    const recommendation = ref(null);
    
    async function generateRecommendation() {
      isGenerating.value = true;
      
      try {
        const response = await fetch('/api/security/generate', { method: 'POST' });
        const data = await response.json();
        lastResult.value = data;
        
        if (data.success) {
          await loadRecommendation();
        }
      } catch (e) {
        alert('生成巡逻建议失败: ' + e.message);
      } finally {
        isGenerating.value = false;
      }
    }
    
    async function loadRecommendation() {
      try {
        const response = await fetch('/api/security/latest');
        const data = await response.json();
        if (data.success) {
          recommendation.value = data.data;
        }
      } catch (e) {
        console.error('加载巡逻建议失败:', e);
      }
    }
    
    function getRiskLevelClass(level) {
      const map = {
        high_risk: 'danger',
        medium_risk: 'warning',
        low_risk: '',
        normal: 'success'
      };
      return map[level] || '';
    }
    
    function getRiskLevelLabel(level) {
      const map = {
        high_risk: '高风险',
        medium_risk: '中风险',
        low_risk: '低风险',
        normal: '正常'
      };
      return map[level] || level;
    }
    
    function getHeatLevelClass(level) {
      const map = {
        critical: 'status-critical',
        hot: 'status-danger',
        warm: 'status-warning',
        cold: 'status-info'
      };
      return map[level] || 'status-info';
    }
    
    function getHeatLevelLabel(level) {
      const map = {
        critical: '极热区',
        hot: '热区',
        warm: '温区',
        cold: '冷区'
      };
      return map[level] || level;
    }
    
    onMounted(() => {
      loadRecommendation();
    });
    
    return {
      isGenerating,
      lastResult,
      recommendation,
      generateRecommendation,
      getRiskLevelClass,
      getRiskLevelLabel,
      getHeatLevelClass,
      getHeatLevelLabel
    };
  }
};
</script>

<style scoped>
.border-b {
  border-bottom: 1px solid var(--border-color);
}
.flex-wrap {
  flex-wrap: wrap;
}
</style>
