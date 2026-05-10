<script setup lang="ts">
import { computed } from 'vue';
import { useInspectorStore } from '../stores/inspectorStore';
import { DefectStatus, DefectType } from '../types';
import type { FilterOptions } from '../types';
import { Filter, X, RefreshCw } from 'lucide-vue-next';

const store = useInspectorStore();

const hasActiveFilters = computed(() => {
  const f = store.filterOptions;
  return f.buildingId || f.status || f.type;
});

const typeLabels: Record<DefectType, string> = {
  [DefectType.CRACK]: '裂纹',
  [DefectType.LOOSENESS]: '松动'
};

const statusLabels: Record<DefectStatus, string> = {
  [DefectStatus.PENDING]: '待处理',
  [DefectStatus.IN_PROGRESS]: '处理中',
  [DefectStatus.REINSPECTED]: '已复检',
  [DefectStatus.CLOSED]: '已关闭'
};

const handleFilterChange = (key: keyof FilterOptions, value: string | undefined) => {
  store.setFilter({ [key]: value === '' ? undefined : value } as any);
};

const handleReset = () => {
  store.clearFilter();
  console.log('[筛选] 已重置所有筛选条件');
};

const handleResetData = () => {
  if (confirm('确定要将所有数据重置为样例数据吗？这将清除您的所有修改。')) {
    store.resetToSampleData();
  }
};
</script>

<template>
  <div class="filter-panel">
    <div class="filter-header">
      <div class="filter-title">
        <Filter :size="18" />
        <span>筛选条件</span>
        <span v-if="hasActiveFilters" class="filter-badge">已激活</span>
      </div>
      <div class="filter-actions">
        <button class="action-btn" title="重置数据为样例" @click="handleResetData">
          <RefreshCw :size="14" />
        </button>
        <button v-if="hasActiveFilters" class="clear-btn" @click="handleReset">
          <X :size="14" />
          <span>清除</span>
        </button>
      </div>
    </div>
    
    <div class="filter-body">
      <div class="filter-group">
        <label>建筑</label>
        <select 
          :value="store.filterOptions.buildingId || ''"
          @change="(e) => handleFilterChange('buildingId', (e.target as HTMLSelectElement).value)"
        >
          <option value="">全部建筑</option>
          <option v-for="b in store.buildings" :key="b.id" :value="b.id">
            {{ b.name }}
          </option>
        </select>
      </div>
      
      <div class="filter-group">
        <label>状态</label>
        <select 
          :value="store.filterOptions.status || ''"
          @change="(e) => handleFilterChange('status', (e.target as HTMLSelectElement).value)"
        >
          <option value="">全部状态</option>
          <option v-for="(label, status) in statusLabels" :key="status" :value="status">
            {{ label }}
          </option>
        </select>
      </div>
      
      <div class="filter-group">
        <label>类型</label>
        <select 
          :value="store.filterOptions.type || ''"
          @change="(e) => handleFilterChange('type', (e.target as HTMLSelectElement).value)"
        >
          <option value="">全部类型</option>
          <option v-for="(label, type) in typeLabels" :key="type" :value="type">
            {{ label }}
          </option>
        </select>
      </div>
    </div>
    
    <div class="filter-stats">
      <div class="stat-item">
        <span class="stat-value">{{ store.filteredDefects.length }}</span>
        <span class="stat-label">筛选结果</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-value">{{ store.defectStats.total }}</span>
        <span class="stat-label">总缺陷</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-value pending">{{ store.defectStats.pending }}</span>
        <span class="stat-label">待处理</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-value in-progress">{{ store.defectStats.inProgress }}</span>
        <span class="stat-label">处理中</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-value reinspected">{{ store.defectStats.reinspected }}</span>
        <span class="stat-label">已复检</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filter-panel {
  background: var(--bg, #fff);
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 8px;
  overflow: hidden;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--code-bg, #f4f3ec);
  border-bottom: 1px solid var(--border, #e5e4e7);
}

.filter-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-h, #08060d);
}

.filter-badge {
  background: var(--accent, #aa3bff);
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.filter-actions {
  display: flex;
  gap: 8px;
}

.action-btn,
.clear-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 4px;
  background: var(--bg, #fff);
  color: var(--text, #6b6375);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover,
.clear-btn:hover {
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  border-color: var(--accent, #aa3bff);
  color: var(--accent, #aa3bff);
}

.filter-body {
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-group label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text, #6b6375);
}

.filter-group select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  font-size: 13px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  cursor: pointer;
}

.filter-group select:focus {
  outline: none;
  border-color: var(--accent, #aa3bff);
  box-shadow: 0 0 0 3px var(--accent-bg, rgba(170, 59, 255, 0.1));
}

.filter-stats {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid var(--border, #e5e4e7);
  background: var(--code-bg, #f4f3ec);
  gap: 16px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-h, #08060d);
}

.stat-value.pending {
  color: #e53935;
}

.stat-value.in-progress {
  color: #f57c00;
}

.stat-value.reinspected {
  color: #7cb342;
}

.stat-label {
  font-size: 11px;
  color: var(--text, #6b6375);
}

.stat-divider {
  width: 1px;
  height: 30px;
  background: var(--border, #e5e4e7);
}
</style>
