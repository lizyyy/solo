<template>
  <div>
    <div class="grid grid-2">
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">导入停留点数据</h2>
        </div>
        
        <div class="form-group">
          <label class="form-label">数据格式说明</label>
          <div class="text-sm text-muted mb-4">
            <p>每条停留点数据需包含以下字段：</p>
            <ul style="margin-left: 20px; margin-top: 8px;">
              <li><strong>visitorId</strong>: 观众ID (字符串)</li>
              <li><strong>x</strong>: X坐标 (0-1000)</li>
              <li><strong>y</strong>: Y坐标 (0-800)</li>
              <li><strong>duration</strong>: 停留时长（秒）</li>
              <li><strong>timestamp</strong>: 时间戳 (ISO格式)</li>
            </ul>
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">直接输入JSON数据</label>
          <textarea 
            v-model="jsonInput" 
            class="form-input textarea"
            :rows="10"
            placeholder='[
  {
    "visitorId": "visitor_001",
    "x": 150,
    "y": 150,
    "duration": 180,
    "timestamp": "2024-01-15T10:30:00Z"
  }
]'
          ></textarea>
        </div>
        
        <div class="flex gap-2">
          <button class="btn btn-primary" @click="importJson">导入JSON</button>
          <button class="btn btn-outline" @click="loadSampleData">加载示例数据</button>
        </div>
        
        <div class="form-group mt-4">
          <label class="form-label">或上传JSON/CSV文件</label>
          <input 
            type="file" 
            accept=".json,.csv" 
            @change="handleFileUpload"
            class="form-input"
          />
        </div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">导入结果</h2>
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
          
          <div class="mb-4">
            <strong>消息:</strong> {{ lastResult.message }}
          </div>
          
          <div class="grid grid-3" v-if="lastResult.imported !== undefined">
            <div class="stat-card success">
              <div class="label">有效数据</div>
              <div class="value">{{ lastResult.imported }}</div>
            </div>
            <div class="stat-card danger">
              <div class="label">无效数据</div>
              <div class="value">{{ lastResult.invalid }}</div>
            </div>
            <div class="stat-card warning">
              <div class="label">警告数据</div>
              <div class="value">{{ lastResult.warnings }}</div>
            </div>
          </div>
          
          <div v-if="lastResult.suggestions && lastResult.suggestions.length > 0" class="mt-4">
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
        <div v-else class="empty-state">
          <div class="empty-state-icon">📥</div>
          <div class="empty-state-text">暂无导入记录</div>
        </div>
      </div>
    </div>
    
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">导入历史</h2>
        <button class="btn btn-sm btn-outline" @click="loadImportHistory">刷新</button>
      </div>
      
      <div v-if="importHistory.length > 0">
        <table class="table">
          <thead>
            <tr>
              <th>来源</th>
              <th>时间</th>
              <th>总数</th>
              <th>有效</th>
              <th>无效</th>
              <th>警告</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in importHistory" :key="record.id">
              <td>{{ record.source }}</td>
              <td class="text-xs text-muted">{{ formatTime(record.timestamp) }}</td>
              <td>{{ record.totalRecords }}</td>
              <td><span class="status-badge status-success">{{ record.validRecords }}</span></td>
              <td><span class="status-badge status-danger">{{ record.invalidRecords }}</span></td>
              <td><span class="status-badge status-warning">{{ record.warningRecords }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">暂无导入历史</div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';

export default {
  name: 'DataImport',
  setup() {
    const jsonInput = ref('');
    const lastResult = ref(null);
    const importHistory = ref([]);
    
    const sampleData = [
      { visitorId: 'visitor_001', x: 150, y: 150, duration: 180, timestamp: '2024-01-15T10:30:00Z' },
      { visitorId: 'visitor_002', x: 350, y: 150, duration: 240, timestamp: '2024-01-15T10:35:00Z' },
      { visitorId: 'visitor_003', x: 150, y: 150, duration: 120, timestamp: '2024-01-15T10:40:00Z' },
      { visitorId: 'visitor_004', x: 350, y: 150, duration: 300, timestamp: '2024-01-15T10:45:00Z' },
      { visitorId: 'visitor_005', x: 600, y: 150, duration: 150, timestamp: '2024-01-15T10:50:00Z' },
      { visitorId: 'visitor_006', x: 350, y: 350, duration: 420, timestamp: '2024-01-15T11:00:00Z' },
      { visitorId: 'visitor_007', x: 150, y: 350, duration: 90, timestamp: '2024-01-15T11:10:00Z' },
      { visitorId: 'visitor_008', x: 350, y: 350, duration: 360, timestamp: '2024-01-15T11:15:00Z' },
      { visitorId: 'visitor_009', x: 600, y: 150, duration: 200, timestamp: '2024-01-15T11:20:00Z' },
      { visitorId: 'visitor_010', x: 150, y: 150, duration: 160, timestamp: '2024-01-15T11:25:00Z' },
      { visitorId: 'visitor_011', x: 350, y: 150, duration: 280, timestamp: '2024-01-15T11:30:00Z' },
      { visitorId: 'visitor_012', x: 350, y: 350, duration: 480, timestamp: '2024-01-15T11:35:00Z' }
    ];
    
    async function importJson() {
      if (!jsonInput.value.trim()) {
        alert('请输入数据');
        return;
      }
      
      try {
        let data;
        try {
          data = JSON.parse(jsonInput.value);
        } catch (e) {
          alert('JSON格式错误: ' + e.message);
          return;
        }
        
        const response = await fetch('/api/upload/points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        const result = await response.json();
        lastResult.value = result;
        
        if (result.success) {
          jsonInput.value = '';
          await loadImportHistory();
        }
      } catch (e) {
        alert('导入失败: ' + e.message);
      }
    }
    
    function loadSampleData() {
      jsonInput.value = JSON.stringify(sampleData, null, 2);
    }
    
    async function handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const response = await fetch('/api/upload/file', {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        lastResult.value = result;
        await loadImportHistory();
      } catch (e) {
        alert('文件上传失败: ' + e.message);
      }
      
      event.target.value = '';
    }
    
    async function loadImportHistory() {
      try {
        const response = await fetch('/api/upload/history');
        const data = await response.json();
        if (data.success) {
          importHistory.value = data.data;
        }
      } catch (e) {
        console.error('加载导入历史失败:', e);
      }
    }
    
    function formatTime(timestamp) {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      return date.toLocaleString('zh-CN');
    }
    
    onMounted(() => {
      loadImportHistory();
    });
    
    return {
      jsonInput,
      lastResult,
      importHistory,
      importJson,
      loadSampleData,
      handleFileUpload,
      loadImportHistory,
      formatTime
    };
  }
};
</script>
