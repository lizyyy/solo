<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Search, Filter, AlertCircle, CheckCircle, XCircle, Download, RefreshCw } from 'lucide-vue-next';
import type { TimelineEvent, EventType, EventStatus } from '@/types/timeline';
import { EVENT_TYPE_LABELS, EVENT_STATUS_LABELS } from '@/types/timeline';
import TimelineEventComponent from './TimelineEvent.vue';
import VideoPlayer from './VideoPlayer.vue';
import { useTimelineStore } from '@/stores/timeline';
import { storeToRefs } from 'pinia';
import { exportToJSON, exportToCSV } from '@/utils/export';
import { formatTimestamp } from '@/utils/time';

interface Props {
  events?: TimelineEvent[];
  isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  events: undefined,
  isLoading: undefined
});

const emit = defineEmits<{
  (e: 'export', format: 'json' | 'csv' | 'report'): void;
}>();

const timelineStore = useTimelineStore();
const { filteredEvents, selectedEventId, timeRange } = storeToRefs(timelineStore);

const localIsLoading = computed(() => props.isLoading !== undefined ? props.isLoading : timelineStore.isLoading);

watch(() => props.events, (newEvents) => {
  if (newEvents !== undefined && newEvents !== null) {
    timelineStore.setEvents(newEvents);
  }
}, { immediate: true });

const showTypeFilter = ref(false);
const showStatusFilter = ref(false);
const searchQuery = ref('');

const sortedEvents = computed(() => {
  return [...filteredEvents.value].sort((a, b) => a.timestamp - b.timestamp);
});

const stats = computed(() => {
  const events = filteredEvents.value;
  return {
    total: events.length,
    pending: events.filter(e => e.status === 'pending').length,
    abnormal: events.filter(e => e.abnormalMark).length,
    confirmed: events.filter(e => e.status === 'confirmed').length
  };
});

function handleEventSelect(event: TimelineEvent) {
  timelineStore.selectEvent(event.id);
}

function handleEventConfirm(event: TimelineEvent) {
  timelineStore.confirmEvent(event.id);
}

function handleEventReject(event: TimelineEvent) {
  timelineStore.rejectEvent(event.id);
}

function handleTypeToggle(type: EventType) {
  timelineStore.toggleTypeFilter(type);
}

function handleStatusToggle(status: EventStatus) {
  timelineStore.toggleStatusFilter(status);
}

function handleSearch() {
  timelineStore.setFilter({ keyword: searchQuery.value || undefined });
}

function handleExportJSON() {
  emit('export', 'json');
}

function handleExportCSV() {
  emit('export', 'csv');
}

function handleExportReport() {
  emit('export', 'report');
}

async function handleRefresh() {
  await timelineStore.loadEvents();
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="bg-white border-b border-gray-200 p-4">
      <VideoPlayer
        v-if="filteredEvents.length > 0"
        :events="filteredEvents"
        :currentTime="timelineStore.currentTime"
        :startTime="timeRange.start"
        :endTime="timeRange.end"
        @time-change="(t) => timelineStore.currentTime = t"
        @seek="handleEventSelect"
      />

      <div class="mt-4">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="搜索事件..."
                class="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent w-64"
                @keyup.enter="handleSearch"
              />
            </div>

            <div class="relative">
              <button
                class="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                @click="showTypeFilter = !showTypeFilter"
              >
                <Filter class="w-4 h-4 text-gray-500" />
                <span>类型筛选</span>
                <span v-if="timelineStore.filter.types.length > 0" class="bg-primary-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {{ timelineStore.filter.types.length }}
                </span>
              </button>

              <div
                v-if="showTypeFilter"
                class="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-40"
              >
                <label
                  v-for="(label, type) in EVENT_TYPE_LABELS"
                  :key="type"
                  class="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    :checked="timelineStore.filter.types.includes(type as EventType)"
                    @change="handleTypeToggle(type as EventType)"
                    class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span class="text-sm">{{ label }}</span>
                </label>
              </div>
            </div>

            <div class="relative">
              <button
                class="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                @click="showStatusFilter = !showStatusFilter"
              >
                <AlertCircle class="w-4 h-4 text-gray-500" />
                <span>状态筛选</span>
                <span v-if="timelineStore.filter.statuses.length > 0" class="bg-primary-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {{ timelineStore.filter.statuses.length }}
                </span>
              </button>

              <div
                v-if="showStatusFilter"
                class="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-40"
              >
                <label
                  v-for="(label, status) in EVENT_STATUS_LABELS"
                  :key="status"
                  class="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    :checked="timelineStore.filter.statuses.includes(status as EventStatus)"
                    @change="handleStatusToggle(status as EventStatus)"
                    class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span class="text-sm">{{ label }}</span>
                </label>
                <div class="border-t border-gray-100 my-1" />
                <label class="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    v-model="timelineStore.filter.onlyAbnormal"
                    class="rounded border-gray-300 text-warning focus:ring-warning"
                  />
                  <span class="text-sm text-warning">仅显示异常</span>
                </label>
              </div>
            </div>

            <button
              class="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              @click="handleRefresh"
              :disabled="localIsLoading"
            >
              <RefreshCw :class="['w-4 h-4', { 'animate-spin': localIsLoading }]" />
              <span>刷新</span>
            </button>
          </div>

          <div class="flex items-center gap-2">
            <button
              class="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-primary-600 transition-colors"
              @click="handleExportJSON"
            >
              <Download class="w-4 h-4" />
              <span>导出JSON</span>
            </button>
            <button
              class="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-primary-600 transition-colors"
              @click="handleExportCSV"
            >
              <Download class="w-4 h-4" />
              <span>导出CSV</span>
            </button>
            <button
              class="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-primary-600 transition-colors"
              @click="handleExportReport"
            >
              <Download class="w-4 h-4" />
              <span>导出报告</span>
            </button>
          </div>
        </div>

        <div class="flex items-center gap-6 text-sm">
          <div class="flex items-center gap-1.5">
            <span class="text-gray-500">总计</span>
            <span class="font-semibold text-gray-900">{{ stats.total }}</span>
            <span class="text-gray-400">条</span>
          </div>
          <div class="flex items-center gap-1.5">
            <AlertCircle class="w-4 h-4 text-warning" />
            <span class="text-warning font-medium">{{ stats.pending }}</span>
            <span class="text-gray-400">待确认</span>
          </div>
          <div class="flex items-center gap-1.5">
            <XCircle class="w-4 h-4 text-danger" />
            <span class="text-danger font-medium">{{ stats.abnormal }}</span>
            <span class="text-gray-400">异常</span>
          </div>
          <div class="flex items-center gap-1.5">
            <CheckCircle class="w-4 h-4 text-success" />
            <span class="text-success font-medium">{{ stats.confirmed }}</span>
            <span class="text-gray-400">已确认</span>
          </div>
          <div v-if="timeRange.start !== timeRange.end" class="text-gray-400">
            {{ formatTimestamp(timeRange.start, 'MM-DD HH:mm') }} - {{ formatTimestamp(timeRange.end, 'MM-DD HH:mm') }}
          </div>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4 bg-gray-50">
      <div v-if="localIsLoading" class="flex items-center justify-center py-20">
        <div class="text-center">
          <RefreshCw class="w-8 h-8 text-primary-500 animate-spin mx-auto mb-2" />
          <p class="text-gray-500">加载中...</p>
        </div>
      </div>

      <div v-else-if="sortedEvents.length === 0" class="flex items-center justify-center py-20">
        <div class="text-center">
          <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Search class="w-8 h-8 text-gray-400" />
          </div>
          <p class="text-gray-500 mb-2">暂无匹配的事件记录</p>
          <p class="text-gray-400 text-sm">请调整筛选条件或导入数据</p>
        </div>
      </div>

      <div v-else class="max-w-3xl mx-auto">
        <TimelineEventComponent
          v-for="event in sortedEvents"
          :key="event.id"
          :event="event"
          :is-selected="event.id === selectedEventId"
          @select="handleEventSelect(event)"
          @confirm="handleEventConfirm(event)"
          @reject="handleEventReject(event)"
        />
      </div>
    </div>
  </div>
</template>
