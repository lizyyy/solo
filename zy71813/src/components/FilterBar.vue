<template>
  <div class="card p-4 mb-6">
    <div class="flex flex-wrap gap-4 items-center">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-gray-600">状态：</span>
        <div class="flex gap-1">
          <button
            v-for="(label, key) in STATUS_LABELS"
            :key="key"
            @click="toggleStatus(key)"
            :class="[
              'px-3 py-1 text-sm rounded-full border transition-colors',
              isStatusSelected(key)
                ? STATUS_COLORS[key]
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
            ]"
          >
            {{ label }}
          </button>
        </div>
      </div>
      
      <div class="flex items-center gap-2">
        <label class="text-sm font-medium text-gray-600">账期：</label>
        <select v-model="selectedPeriod" @change="applyPeriod" class="input text-sm py-1">
          <option value="">全部</option>
          <option value="2024-05">2024年5月</option>
          <option value="2024-04">2024年4月</option>
          <option value="2024-03">2024年3月</option>
        </select>
      </div>
      
      <div class="flex items-center gap-2">
        <label class="text-sm font-medium text-gray-600">门店：</label>
        <input
          v-model="searchStore"
          @input="applyStoreFilter"
          type="text"
          placeholder="输入门店编号"
          class="input text-sm py-1 w-32"
        />
      </div>
      
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          :checked="onlyUnresolved"
          @change="applyUnresolvedFilter"
          class="w-4 h-4 text-primary-600 rounded"
        />
        <span class="text-sm font-medium text-gray-600">仅看有告警</span>
      </label>

      <button
        @click="resetFilters"
        class="btn-secondary text-sm py-1 ml-auto"
      >
        重置筛选
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useShortageStore } from '../composables/useShortageStore';
import { STATUS_LABELS, STATUS_COLORS } from '../constants/labels';
import type { RecordStatus } from '../types';

const { setFilters, filters } = useShortageStore();

const selectedPeriod = ref(filters.value.period || '');
const searchStore = ref(filters.value.storeId || '');
const onlyUnresolved = ref(filters.value.hasUnresolvedChanges || false);

function isStatusSelected(status: string): boolean {
  return filters.value.status?.includes(status as RecordStatus) ?? false;
}

function toggleStatus(status: string) {
  const current = filters.value.status || [];
  const newStatus = current.includes(status as RecordStatus)
    ? current.filter(s => s !== status)
    : [...current, status as RecordStatus];
  setFilters({ status: newStatus.length > 0 ? newStatus : undefined });
}

function applyPeriod() {
  setFilters({ period: selectedPeriod.value || undefined });
}

function applyStoreFilter() {
  setFilters({ storeId: searchStore.value || undefined });
}

function applyUnresolvedFilter(e: Event) {
  const target = e.target as HTMLInputElement;
  setFilters({ hasUnresolvedChanges: target.checked || undefined });
}

function resetFilters() {
  selectedPeriod.value = '';
  searchStore.value = '';
  onlyUnresolved.value = false;
  setFilters({
    status: undefined,
    period: undefined,
    storeId: undefined,
    hasUnresolvedChanges: undefined
  });
}
</script>
