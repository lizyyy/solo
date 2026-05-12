<template>
  <div>
    <div class="grid grid-4 mb-4">
      <div class="stat-card">
        <div class="label">总问题数</div>
        <div class="value">{{ stats.total || 0 }}</div>
      </div>
      <div class="stat-card warning">
        <div class="label">待处理</div>
        <div class="value">{{ stats.open || 0 }}</div>
      </div>
      <div class="stat-card danger">
        <div class="label">错误</div>
        <div class="value">{{ stats.bySeverity?.error || 0 }}</div>
      </div>
      <div class="stat-card warning">
        <div class="label">警告</div>
        <div class="value">{{ stats.bySeverity?.warning || 0 }}</div>
      </div>
    </div>
    
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">问题列表</h2>
        <div class="flex gap-2">
          <select v-model="filterStatus" class="form-select" style="width: auto;" @change="loadProblems">
            <option value="">全部状态</option>
            <option value="open">待处理</option>
            <option value="resolved">已解决</option>
            <option value="ignored">已忽略</option>
          </select>
          <select v-model="filterSeverity" class="form-select" style="width: auto;" @change="loadProblems">
            <option value="">全部严重程度</option>
            <option value="error">错误</option>
            <option value="warning">警告</option>
            <option value="info">信息</option>
          </select>
          <button class="btn btn-sm btn-outline" @click="loadProblems">刷新</button>
        </div>
      </div>
      
      <div v-if="problems.length > 0">
        <table class="table">
          <thead>
            <tr>
              <th>严重程度</th>
              <th>类型</th>
              <th>来源</th>
              <th>消息</th>
              <th>状态</th>
              <th>时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="problem in problems" :key="problem.id">
              <td>
                <span 
                  class="status-badge"
                  :class="getSeverityClass(problem.severity)"
                >
                  {{ getSeverityLabel(problem.severity) }}
                </span>
              </td>
              <td>{{ problem.type }}</td>
              <td class="text-sm text-muted">{{ problem.source }}</td>
              <td>
                {{ problem.message }}
                <button 
                  v-if="problem.rawData"
                  class="btn btn-sm btn-outline"
                  style="margin-left: 8px;"
                  @click="showRawData(problem)"
                >
                  查看原始数据
                </button>
              </td>
              <td>
                <span 
                  class="status-badge"
                  :class="getStatusClass(problem.status)"
                >
                  {{ getStatusLabel(problem.status) }}
                </span>
              </td>
              <td class="text-xs text-muted">{{ formatTime(problem.createdAt) }}</td>
              <td>
                <div class="flex gap-2" v-if="problem.status === 'open'">
                  <button class="btn btn-sm btn-success" @click="resolveProblem(problem.id)">解决</button>
                  <button class="btn btn-sm btn-outline" @click="ignoreProblem(problem.id)">忽略</button>
                </div>
                <span v-else class="text-xs text-muted">
                  {{ formatTime(problem.resolvedAt) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        
        <div v-if="pagination" class="flex items-center justify-between mt-4">
          <span class="text-sm text-muted">
            共 {{ pagination.total }} 条记录
          </span>
          <div class="flex gap-2">
            <button 
              class="btn btn-sm btn-outline"
              :disabled="offset === 0"
              @click="prevPage"
            >
              上一页
            </button>
            <button 
              class="btn btn-sm btn-outline"
              :disabled="!pagination.hasMore"
              @click="nextPage"
            >
              下一页
            </button>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-text">暂无问题记录</div>
        <div class="text-sm text-muted mt-2">所有脏数据和异常情况都会在这里显示</div>
      </div>
    </div>
    
    <div v-if="showRawDataModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold">原始数据</h3>
          <button class="btn btn-sm btn-outline" @click="closeRawDataModal">关闭</button>
        </div>
        <pre style="background: #f5f5f5; padding: 16px; border-radius: 4px; overflow-x: auto; font-size: 12px;">
{{ JSON.stringify(selectedProblem?.rawData, null, 2) }}
        </pre>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';

export default {
  name: 'ProblemList',
  setup() {
    const problems = ref([]);
    const stats = ref({});
    const pagination = ref(null);
    const filterStatus = ref('');
    const filterSeverity = ref('');
    const offset = ref(0);
    const limit = ref(20);
    
    const showRawDataModal = ref(false);
    const selectedProblem = ref(null);
    
    async function loadProblems() {
      try {
        let url = `/api/problems?limit=${limit.value}&offset=${offset.value}`;
        if (filterStatus.value) url += `&status=${filterStatus.value}`;
        if (filterSeverity.value) url += `&severity=${filterSeverity.value}`;
        
        const response = await fetch(url);
        const data = await response.json();
        if (data.success) {
          problems.value = data.data;
          pagination.value = data.pagination;
        }
      } catch (e) {
        console.error('加载问题列表失败:', e);
      }
    }
    
    async function loadStats() {
      try {
        const response = await fetch('/api/problems/stats/summary');
        const data = await response.json();
        if (data.success) {
          stats.value = data.data;
        }
      } catch (e) {
        console.error('加载问题统计失败:', e);
      }
    }
    
    async function resolveProblem(id) {
      const resolution = prompt('请输入解决说明（可选）：', '');
      if (resolution === null) return;
      
      try {
        const response = await fetch(`/api/problems/${id}/resolve`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolution: resolution || '已解决' })
        });
        
        const data = await response.json();
        if (data.success) {
          await loadProblems();
          await loadStats();
        }
      } catch (e) {
        alert('操作失败: ' + e.message);
      }
    }
    
    async function ignoreProblem(id) {
      const reason = prompt('请输入忽略原因（可选）：', '');
      if (reason === null) return;
      
      try {
        const response = await fetch(`/api/problems/${id}/ignore`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reason || '已忽略' })
        });
        
        const data = await response.json();
        if (data.success) {
          await loadProblems();
          await loadStats();
        }
      } catch (e) {
        alert('操作失败: ' + e.message);
      }
    }
    
    function showRawData(problem) {
      selectedProblem.value = problem;
      showRawDataModal.value = true;
    }
    
    function closeRawDataModal() {
      showRawDataModal.value = false;
      selectedProblem.value = null;
    }
    
    function prevPage() {
      if (offset.value > 0) {
        offset.value = Math.max(0, offset.value - limit.value);
        loadProblems();
      }
    }
    
    function nextPage() {
      if (pagination.value?.hasMore) {
        offset.value += limit.value;
        loadProblems();
      }
    }
    
    function getSeverityClass(severity) {
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
    
    function getStatusClass(status) {
      const map = {
        open: 'status-warning',
        resolved: 'status-success',
        ignored: 'status-info'
      };
      return map[status] || 'status-info';
    }
    
    function getStatusLabel(status) {
      const map = {
        open: '待处理',
        resolved: '已解决',
        ignored: '已忽略'
      };
      return map[status] || status;
    }
    
    function formatTime(timestamp) {
      if (!timestamp) return '-';
      const date = new Date(timestamp);
      return date.toLocaleString('zh-CN');
    }
    
    onMounted(() => {
      loadProblems();
      loadStats();
    });
    
    return {
      problems,
      stats,
      pagination,
      filterStatus,
      filterSeverity,
      offset,
      limit,
      showRawDataModal,
      selectedProblem,
      loadProblems,
      loadStats,
      resolveProblem,
      ignoreProblem,
      showRawData,
      closeRawDataModal,
      prevPage,
      nextPage,
      getSeverityClass,
      getSeverityLabel,
      getStatusClass,
      getStatusLabel,
      formatTime
    };
  }
};
</script>

<style scoped>
.fixed {
  position: fixed;
}
.inset-0 {
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}
.bg-black {
  background-color: #000;
}
.bg-opacity-50 {
  opacity: 0.5;
}
.z-50 {
  z-index: 50;
}
.w-full {
  width: 100%;
}
.max-w-2xl {
  max-width: 42rem;
}
.max-h-\[80vh\] {
  max-height: 80vh;
}
.overflow-y-auto {
  overflow-y: auto;
}
.text-lg {
  font-size: 1.125rem;
}
.font-bold {
  font-weight: 700;
}
</style>
