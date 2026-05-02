<template>
  <div class="filter-bar">
    <div class="filter-group">
      <label>风险等级</label>
      <select :value="filters.severity" @change="$emit('filter', 'severity', $event.target.value || null)">
        <option value="">全部</option>
        <option value="critical">严重</option>
        <option value="warning">警告</option>
        <option value="info">信息</option>
      </select>
    </div>

    <div class="filter-group">
      <label>规则类型</label>
      <select :value="filters.type" @change="$emit('filter', 'type', $event.target.value || null)">
        <option value="">全部</option>
        <option value="alt">Alt 文本</option>
        <option value="heading">标题层级</option>
        <option value="toc">目录</option>
        <option value="manifest">Manifest</option>
        <option value="spine">Spine</option>
        <option value="image">图片</option>
      </select>
    </div>

    <div class="filter-group search-group">
      <label>搜索</label>
      <input
        type="text"
        :value="filters.searchText"
        @input="$emit('filter', 'searchText', $event.target.value)"
        placeholder="搜索问题描述..."
      />
    </div>

    <button v-if="hasActiveFilters" class="clear-btn" @click="$emit('clear')">
      清除筛选
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  filters: {
    type: Object,
    default: () => ({})
  }
})

defineEmits(['filter', 'clear'])

const hasActiveFilters = computed(() => {
  return props.filters.severity ||
    props.filters.type ||
    props.filters.searchText
})
</script>

<style scoped>
.filter-bar {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  flex-wrap: wrap;
  padding: 12px 16px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-group label {
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

.filter-group select,
.filter-group input {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
}

.filter-group input {
  width: 200px;
}

.search-group {
  flex: 1;
  min-width: 200px;
}

.clear-btn {
  padding: 6px 12px;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  color: #666;
}

.clear-btn:hover {
  background: #eee;
}
</style>
