<template>
  <div v-if="record" class="h-full flex flex-col bg-white border-l border-gray-200">
    <div class="flex items-center justify-between p-4 border-b border-gray-200">
      <h2 class="text-lg font-semibold">记录详情 - {{ record.id }}</h2>
      <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-6">
      <div v-if="record.latestAlert" class="p-4 bg-orange-50 border border-orange-200 rounded-lg">
        <div class="flex items-start gap-2">
          <span class="text-xl">⚠️</span>
          <div>
            <p class="font-medium text-orange-800">重要提醒</p>
            <p class="text-sm text-orange-700 mt-1">{{ record.latestAlert }}</p>
          </div>
        </div>
      </div>

      <div v-if="record.hasUnresolvedChanges" class="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div class="flex items-center justify-between">
          <div class="flex items-start gap-2">
            <span class="text-xl">🔴</span>
            <div>
              <p class="font-medium text-red-800">存在未确认的结论变更</p>
              <p class="text-sm text-red-700 mt-1">请在版本历史中查看具体变更内容</p>
            </div>
          </div>
          <button @click="handleResolveAlert" class="btn-secondary text-sm py-1">
            标记已查看
          </button>
        </div>
      </div>

      <div class="card p-4">
        <h3 class="font-semibold text-gray-900 mb-4">基本信息</h3>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-gray-500">门店：</span>
            <span class="font-medium">{{ record.storeName }} ({{ record.storeId }})</span>
          </div>
          <div>
            <span class="text-gray-500">账期：</span>
            <span class="font-medium">{{ record.accountingPeriod }}</span>
          </div>
          <div>
            <span class="text-gray-500">金额：</span>
            <span class="font-semibold text-primary-600">¥{{ record.amount.toFixed(2) }}</span>
          </div>
          <div>
            <span class="text-gray-500">来源：</span>
            <span class="font-medium">{{ SOURCE_ICONS[record.source] }} {{ SOURCE_LABELS[record.source] }}</span>
          </div>
          <div>
            <span class="text-gray-500">来源参考：</span>
            <span class="font-mono font-medium">{{ record.sourceRef }}</span>
          </div>
          <div>
            <span class="text-gray-500">问题分类：</span>
            <span class="font-medium">{{ CATEGORY_LABELS[record.issueCategory] }}</span>
          </div>
          <div>
            <span class="text-gray-500">当前状态：</span>
            <span :class="[
              'inline-flex px-2 py-0.5 text-xs font-medium rounded-full border',
              STATUS_COLORS[record.status]
            ]">
              {{ STATUS_LABELS[record.status] }}
            </span>
          </div>
          <div>
            <span class="text-gray-500">当前版本：</span>
            <span class="font-mono font-medium">v{{ record.currentVersion }}</span>
          </div>
        </div>
      </div>

      <div v-if="record.pendingReason" class="card p-4">
        <h3 class="font-semibold text-gray-900 mb-2">待处理原因</h3>
        <p class="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{{ record.pendingReason }}</p>
      </div>

      <div v-if="record.conclusion" class="card p-4">
        <h3 class="font-semibold text-gray-900 mb-2">当前结论</h3>
        <p class="text-sm text-gray-700 bg-green-50 p-3 rounded-lg border border-green-200">{{ record.conclusion }}</p>
      </div>

      <div class="card p-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-gray-900">附件清单</h3>
          <button @click="$emit('add-attachment')" class="btn-primary text-sm py-1 px-3">
            + 上传附件
          </button>
        </div>
        <div class="space-y-3">
          <div
            v-for="att in record.attachments"
            :key="att.id"
            :class="[
              'p-3 rounded-lg border',
              att.note?.includes('旧版本') || att.note?.includes('警告')
                ? 'bg-orange-50 border-orange-200'
                : 'bg-gray-50 border-gray-200'
            ]"
          >
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-2">
                <span class="text-lg">{{ SOURCE_ICONS[att.type] }}</span>
                <div>
                  <p class="text-sm font-medium">{{ att.name }}</p>
                  <p class="text-xs text-gray-500">
                    v{{ att.version }} · {{ att.uploadedBy }} · {{ formatDate(att.uploadedAt) }}
                  </p>
                </div>
              </div>
              <span class="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600">
                {{ SOURCE_LABELS[att.type] }}
              </span>
            </div>
            <p v-if="att.note" class="text-xs mt-2 text-orange-700 font-medium">
              {{ att.note }}
            </p>
          </div>
          <div v-if="record.attachments.length === 0" class="text-center py-6 text-gray-400 text-sm">
            暂无附件
          </div>
        </div>
      </div>

      <div class="card p-4">
        <h3 class="font-semibold text-gray-900 mb-4">版本历史</h3>
        <div class="space-y-4">
          <div
            v-for="(version, idx) in sortedHistory"
            :key="version.id"
            class="relative pl-6 pb-4 border-l-2 border-gray-200 last:border-l-0 last:pb-0"
          >
            <div class="absolute left-0 top-0 w-3 h-3 -translate-x-[7px] rounded-full"
              :class="getVersionDotColor(version.changes)"></div>
            
            <div class="bg-gray-50 rounded-lg p-3 -ml-2">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span class="font-mono font-semibold">v{{ version.version }}</span>
                  <span v-if="idx === 0" class="text-xs px-2 py-0.5 bg-primary-100 text-primary-700 rounded">当前</span>
                  <span
                    v-if="hasConclusionChanges(version.changes)"
                    class="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded"
                  >
                    结论变更 ⚠️
                  </span>
                  <span
                    v-else-if="hasMaterialOnlyChanges(version.changes)"
                    class="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded"
                  >
                    仅补材料
                  </span>
                </div>
                <span class="text-xs text-gray-500">{{ formatDate(version.timestamp) }}</span>
              </div>
              
              <p class="text-sm text-gray-600 mb-2">
                <span class="font-medium">{{ version.modifiedBy }}</span>
                <span class="text-gray-400"> · </span>
                {{ version.changeReason }}
              </p>
              
              <div class="space-y-1">
                <div
                  v-for="(change, cidx) in version.changes"
                  :key="cidx"
                  class="text-xs flex items-start gap-2"
                >
                  <span :class="change.changeType === 'conclusion_changed' ? 'text-red-600' : 'text-purple-600'">
                    {{ change.changeType === 'conclusion_changed' ? '⚠️' : '•' }}
                  </span>
                  <span class="text-gray-700">
                    <span class="font-medium">{{ formatFieldName(change.field) }}</span>:
                    <span class="text-red-600 line-through">{{ change.oldValue }}</span>
                    <span class="text-gray-400 mx-1">→</span>
                    <span class="text-green-600 font-medium">{{ change.newValue }}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="border-t border-gray-200 p-4 flex gap-3">
      <button @click="$emit('edit')" class="btn-primary flex-1">
        ✏️ 编辑记录
      </button>
      <button @click="handleExport" class="btn-secondary flex-1">
        📄 导出对账说明
      </button>
    </div>
  </div>

  <div v-else class="h-full flex items-center justify-center text-gray-400">
    <div class="text-center">
      <p class="text-4xl mb-2">📋</p>
      <p>选择一条记录查看详情</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { format } from 'date-fns';
import type { ShortageRecord, ChangeDetail } from '../types';
import { STATUS_LABELS, STATUS_COLORS, SOURCE_LABELS, SOURCE_ICONS, CATEGORY_LABELS, formatFieldName } from '../constants/labels';
import { hasConclusionChanges, hasMaterialOnlyChanges } from '../utils/compare';
import { generateAuditNote, downloadTextFile, generateExportFilename } from '../utils/export';
import { useShortageStore } from '../composables/useShortageStore';

const props = defineProps<{
  record: ShortageRecord | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'edit'): void;
  (e: 'add-attachment'): void;
}>();

const { resolveAlert } = useShortageStore();

const sortedHistory = computed(() => {
  if (!props.record) return [];
  return [...props.record.versionHistory].reverse();
});

function formatDate(dateStr: string): string {
  return format(new Date(dateStr), 'MM-dd HH:mm');
}

function getVersionDotColor(changes: ChangeDetail[]): string {
  if (changes.some(c => c.changeType === 'conclusion_changed')) {
    return 'bg-red-500';
  }
  return 'bg-purple-400';
}

function handleResolveAlert() {
  if (props.record) {
    resolveAlert(props.record.id);
  }
}

function handleExport() {
  if (!props.record) return;
  const content = generateAuditNote(props.record);
  const filename = generateExportFilename(props.record);
  downloadTextFile(content, filename);
}
</script>
