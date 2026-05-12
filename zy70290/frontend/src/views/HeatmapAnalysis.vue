<template>
  <div>
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">热区分析</h2>
        <button class="btn btn-primary" @click="calculateHeatmap" :disabled="isCalculating">
          {{ isCalculating ? '计算中...' : '计算热区' }}
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
          <h3 class="text-bold mb-2">分析建议</h3>
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
    
    <div v-if="heatmap" class="grid grid-2">
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">热区分布</h2>
        </div>
        
        <div class="heatmap-container" ref="heatmapContainer">
          <canvas ref="heatmapCanvas" class="heatmap-canvas"></canvas>
          <div 
            v-for="exhibition in exhibitions" 
            :key="exhibition.id"
            class="exhibition-box"
            :style="getExhibitionStyle(exhibition)"
          >
            {{ exhibition.name }}
          </div>
        </div>
        
        <div class="mt-4 flex gap-4 flex-wrap">
          <div class="flex items-center gap-2">
            <div style="width: 20px; height: 20px; background: #1e88e5; border-radius: 4px;"></div>
            <span class="text-sm">冷区</span>
          </div>
          <div class="flex items-center gap-2">
            <div style="width: 20px; height: 20px; background: #ff9800; border-radius: 4px;"></div>
            <span class="text-sm">温区</span>
          </div>
          <div class="flex items-center gap-2">
            <div style="width: 20px; height: 20px; background: #f44336; border-radius: 4px;"></div>
            <span class="text-sm">热区</span>
          </div>
          <div class="flex items-center gap-2">
            <div style="width: 20px; height: 20px; background: #9c27b0; border-radius: 4px;"></div>
            <span class="text-sm">极热区</span>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">展区热度分析</h2>
        </div>
        
        <div v-if="heatmap.exhibitionHeat && heatmap.exhibitionHeat.length > 0">
          <table class="table">
            <thead>
              <tr>
                <th>展区</th>
                <th>热度等级</th>
                <th>热度值</th>
                <th>观众数</th>
                <th>平均停留</th>
                <th>与预期对比</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="exHeat in heatmap.exhibitionHeat" :key="exHeat.exhibitionId">
                <td>
                  <strong>{{ exHeat.exhibitionName }}</strong>
                  <div class="text-xs text-muted">优先级: {{ getPriorityLabel(exHeat.priority) }}</div>
                </td>
                <td>
                  <span 
                    class="status-badge"
                    :class="getHeatLevelClass(exHeat.heatLevel)"
                  >
                    {{ getHeatLevelLabel(exHeat.heatLevel) }}
                  </span>
                </td>
                <td>{{ (exHeat.heatScore * 100).toFixed(0) }}%</td>
                <td>{{ exHeat.visitorCount }}</td>
                <td>{{ exHeat.avgDuration.toFixed(0) }}秒</td>
                <td>
                  <span 
                    v-if="exHeat.deviatedFromExpected"
                    class="status-badge status-warning"
                  >
                    {{ (exHeat.durationRatio * 100).toFixed(0) }}%
                  </span>
                  <span v-else class="text-sm text-muted">
                    {{ (exHeat.durationRatio * 100).toFixed(0) }}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty-state">
          <div class="empty-state-icon">📊</div>
          <div class="empty-state-text">暂无热区数据</div>
        </div>
      </div>
    </div>
    
    <div v-if="heatmap && heatmap.overallStats" class="card">
      <div class="card-header">
        <h2 class="card-title">整体统计</h2>
        <div class="text-sm text-muted">
          生成时间: {{ formatTime(heatmap.timestamp) }}
        </div>
      </div>
      
      <div class="grid grid-4">
        <div class="stat-card">
          <div class="label">平均热度</div>
          <div class="value">{{ (heatmap.overallStats.avgHeatScore * 100).toFixed(0) }}%</div>
        </div>
        <div class="stat-card critical" v-if="heatmap.overallStats.criticalCount > 0">
          <div class="label">极热展区</div>
          <div class="value">{{ heatmap.overallStats.criticalCount }}</div>
        </div>
        <div class="stat-card danger" v-else>
          <div class="label">热展区</div>
          <div class="value">{{ heatmap.overallStats.hotCount }}</div>
        </div>
        <div class="stat-card warning">
          <div class="label">温展区</div>
          <div class="value">{{ heatmap.overallStats.warmCount }}</div>
        </div>
        <div class="stat-card">
          <div class="label">冷展区</div>
          <div class="value">{{ heatmap.overallStats.coldCount }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch, nextTick } from 'vue';

export default {
  name: 'HeatmapAnalysis',
  setup() {
    const isCalculating = ref(false);
    const lastResult = ref(null);
    const heatmap = ref(null);
    const exhibitions = ref([]);
    const heatmapCanvas = ref(null);
    const heatmapContainer = ref(null);
    
    async function calculateHeatmap() {
      isCalculating.value = true;
      
      try {
        const response = await fetch('/api/heatmap/calculate', { method: 'POST' });
        const data = await response.json();
        lastResult.value = data;
        
        if (data.success) {
          await loadHeatmap();
        }
      } catch (e) {
        alert('热区计算失败: ' + e.message);
      } finally {
        isCalculating.value = false;
      }
    }
    
    async function loadHeatmap() {
      try {
        const response = await fetch('/api/heatmap/latest');
        const data = await response.json();
        if (data.success) {
          heatmap.value = data.data;
          await nextTick();
          drawHeatmap();
        }
      } catch (e) {
        console.error('加载热区数据失败:', e);
      }
    }
    
    async function loadExhibitions() {
      try {
        const response = await fetch('/api/exhibitions');
        const data = await response.json();
        if (data.success) {
          exhibitions.value = data.data;
        }
      } catch (e) {
        console.error('加载展区失败:', e);
      }
    }
    
    function drawHeatmap() {
      if (!heatmapCanvas.value || !heatmap.value) return;
      
      const canvas = heatmapCanvas.value;
      const container = heatmapContainer.value;
      
      canvas.width = container.offsetWidth;
      canvas.height = container.offsetHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const scaleX = canvas.width / 1000;
      const scaleY = canvas.height / 800;
      const cellWidth = 20 * scaleX;
      const cellHeight = 20 * scaleY;
      
      const colorMap = {
        cold: 'rgba(30, 136, 229, ',
        warm: 'rgba(255, 152, 0, ',
        hot: 'rgba(244, 67, 54, ',
        critical: 'rgba(156, 39, 176, '
      };
      
      for (const cell of heatmap.value.gridHeat) {
        const x = cell.x * scaleX;
        const y = cell.y * scaleY;
        const alpha = 0.3 + cell.heatScore * 0.7;
        
        const colorBase = colorMap[cell.heatLevel] || colorMap.cold;
        ctx.fillStyle = colorBase + alpha + ')';
        ctx.fillRect(x, y, cellWidth, cellHeight);
      }
    }
    
    function getExhibitionStyle(exhibition) {
      const box = exhibition.boundingBox;
      
      return {
        left: `${(box.x / 1000) * 100}%`,
        top: `${(box.y / 800) * 100}%`,
        width: `${(box.width / 1000) * 100}%`,
        height: `${(box.height / 800) * 100}%`,
        borderColor: 'rgba(255, 255, 255, 0.9)',
        backgroundColor: 'rgba(0, 0, 0, 0.1)'
      };
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
    
    function getPriorityLabel(priority) {
      const map = {
        high: '高',
        medium: '中',
        low: '低'
      };
      return map[priority] || priority;
    }
    
    function formatTime(timestamp) {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      return date.toLocaleString('zh-CN');
    }
    
    onMounted(() => {
      loadExhibitions();
      loadHeatmap();
      
      window.addEventListener('resize', drawHeatmap);
    });
    
    return {
      isCalculating,
      lastResult,
      heatmap,
      exhibitions,
      heatmapCanvas,
      heatmapContainer,
      calculateHeatmap,
      getExhibitionStyle,
      getHeatLevelClass,
      getHeatLevelLabel,
      getPriorityLabel,
      formatTime
    };
  }
};
</script>
