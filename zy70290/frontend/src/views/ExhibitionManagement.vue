<template>
  <div>
    <div class="grid grid-2">
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">展区列表</h2>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-outline" @click="initDefaults">初始化默认展区</button>
            <button class="btn btn-sm btn-primary" @click="showAddModal = true">添加展区</button>
          </div>
        </div>
        
        <div v-if="exhibitions.length > 0">
          <table class="table">
            <thead>
              <tr>
                <th>名称</th>
                <th>优先级</th>
                <th>预期停留</th>
                <th>位置</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="exhibition in exhibitions" :key="exhibition.id">
                <td>
                  <strong>{{ exhibition.name }}</strong>
                  <div v-if="exhibition.description" class="text-xs text-muted">{{ exhibition.description }}</div>
                </td>
                <td>
                  <span 
                    class="status-badge"
                    :class="getPriorityClass(exhibition.priority)"
                  >
                    {{ getPriorityLabel(exhibition.priority) }}
                  </span>
                </td>
                <td>{{ exhibition.expectedDuration }}秒</td>
                <td class="text-xs text-muted">
                  {{ exhibition.boundingBox.x }}, {{ exhibition.boundingBox.y }}<br/>
                  {{ exhibition.boundingBox.width }}x{{ exhibition.boundingBox.height }}
                </td>
                <td>
                  <div class="flex gap-2">
                    <button class="btn btn-sm btn-outline" @click="editExhibition(exhibition)">编辑</button>
                    <button class="btn btn-sm btn-danger" @click="deleteExhibition(exhibition.id)">删除</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty-state">
          <div class="empty-state-icon">🖼️</div>
          <div class="empty-state-text">暂无展区配置</div>
          <button class="btn btn-primary mt-4" @click="initDefaults">初始化默认展区</button>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">展厅布局预览</h2>
        </div>
        
        <div class="heatmap-container">
          <div 
            v-for="exhibition in exhibitions" 
            :key="exhibition.id"
            class="exhibition-box"
            :style="getExhibitionStyle(exhibition)"
            :title="exhibition.name + ': ' + exhibition.description"
          >
            {{ exhibition.name }}
          </div>
        </div>
        
        <div class="mt-4 text-sm text-muted">
          <p>坐标系说明：</p>
          <ul style="margin-left: 20px; margin-top: 8px;">
            <li>X轴范围: 0-1000</li>
            <li>Y轴范围: 0-800</li>
            <li>展区位置使用边界框 (x, y, width, height) 定义</li>
          </ul>
        </div>
      </div>
    </div>
    
    <div v-if="showAddModal || showEditModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-bold mb-4">{{ showEditModal ? '编辑展区' : '添加展区' }}</h3>
        
        <div class="form-group">
          <label class="form-label">展区名称</label>
          <input v-model="form.name" type="text" class="form-input" placeholder="如：古代书画展区" />
        </div>
        
        <div class="form-group">
          <label class="form-label">描述</label>
          <textarea v-model="form.description" class="form-input textarea" placeholder="展区描述"></textarea>
        </div>
        
        <div class="form-group">
          <label class="form-label">优先级</label>
          <select v-model="form.priority" class="form-select">
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">预期停留时间（秒）</label>
          <input v-model.number="form.expectedDuration" type="number" class="form-input" min="1" />
        </div>
        
        <h4 class="text-bold mb-2">边界框</h4>
        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label">X (0-1000)</label>
            <input v-model.number="form.boundingBox.x" type="number" class="form-input" min="0" max="1000" />
          </div>
          <div class="form-group">
            <label class="form-label">Y (0-800)</label>
            <input v-model.number="form.boundingBox.y" type="number" class="form-input" min="0" max="800" />
          </div>
          <div class="form-group">
            <label class="form-label">宽度</label>
            <input v-model.number="form.boundingBox.width" type="number" class="form-input" min="1" />
          </div>
          <div class="form-group">
            <label class="form-label">高度</label>
            <input v-model.number="form.boundingBox.height" type="number" class="form-input" min="1" />
          </div>
        </div>
        
        <div class="flex gap-2 mt-6">
          <button class="btn btn-primary" @click="saveExhibition">保存</button>
          <button class="btn btn-outline" @click="closeModal">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';

export default {
  name: 'ExhibitionManagement',
  setup() {
    const exhibitions = ref([]);
    const showAddModal = ref(false);
    const showEditModal = ref(false);
    const editingId = ref(null);
    
    const form = ref({
      name: '',
      description: '',
      priority: 'medium',
      expectedDuration: 120,
      boundingBox: {
        x: 0,
        y: 0,
        width: 200,
        height: 200
      }
    });
    
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
    
    async function initDefaults() {
      try {
        const response = await fetch('/api/exhibitions/init-defaults', { method: 'POST' });
        const data = await response.json();
        if (data.success) {
          exhibitions.value = data.data;
        }
      } catch (e) {
        console.error('初始化默认展区失败:', e);
      }
    }
    
    function editExhibition(exhibition) {
      editingId.value = exhibition.id;
      form.value = {
        name: exhibition.name,
        description: exhibition.description,
        priority: exhibition.priority,
        expectedDuration: exhibition.expectedDuration,
        boundingBox: { ...exhibition.boundingBox }
      };
      showEditModal.value = true;
    }
    
    async function saveExhibition() {
      try {
        let response;
        if (showEditModal.value) {
          response = await fetch(`/api/exhibitions/${editingId.value}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form.value)
          });
        } else {
          response = await fetch('/api/exhibitions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form.value)
          });
        }
        
        const data = await response.json();
        if (data.success) {
          await loadExhibitions();
          closeModal();
        } else {
          alert(data.message || '保存失败');
        }
      } catch (e) {
        alert('保存失败: ' + e.message);
      }
    }
    
    async function deleteExhibition(id) {
      if (!confirm('确定要删除这个展区吗？')) return;
      
      try {
        const response = await fetch(`/api/exhibitions/${id}`, { method: 'DELETE' });
        const data = await response.json();
        if (data.success) {
          await loadExhibitions();
        } else {
          alert(data.message || '删除失败');
        }
      } catch (e) {
        alert('删除失败: ' + e.message);
      }
    }
    
    function closeModal() {
      showAddModal.value = false;
      showEditModal.value = false;
      editingId.value = null;
      resetForm();
    }
    
    function resetForm() {
      form.value = {
        name: '',
        description: '',
        priority: 'medium',
        expectedDuration: 120,
        boundingBox: {
          x: 0,
          y: 0,
          width: 200,
          height: 200
        }
      };
    }
    
    function getExhibitionStyle(exhibition) {
      const box = exhibition.boundingBox;
      const colorMap = {
        high: 'rgba(244, 67, 54, 0.7)',
        medium: 'rgba(255, 152, 0, 0.7)',
        low: 'rgba(76, 175, 80, 0.7)'
      };
      
      return {
        left: `${(box.x / 1000) * 100}%`,
        top: `${(box.y / 800) * 100}%`,
        width: `${(box.width / 1000) * 100}%`,
        height: `${(box.height / 800) * 100}%`,
        backgroundColor: colorMap[exhibition.priority] || colorMap.medium
      };
    }
    
    function getPriorityClass(priority) {
      const map = {
        high: 'status-danger',
        medium: 'status-warning',
        low: 'status-success'
      };
      return map[priority] || 'status-info';
    }
    
    function getPriorityLabel(priority) {
      const map = {
        high: '高',
        medium: '中',
        low: '低'
      };
      return map[priority] || priority;
    }
    
    onMounted(() => {
      loadExhibitions();
    });
    
    return {
      exhibitions,
      showAddModal,
      showEditModal,
      form,
      loadExhibitions,
      initDefaults,
      editExhibition,
      saveExhibition,
      deleteExhibition,
      closeModal,
      getExhibitionStyle,
      getPriorityClass,
      getPriorityLabel
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
.max-w-md {
  max-width: 28rem;
}
.max-h-\[90vh\] {
  max-height: 90vh;
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
