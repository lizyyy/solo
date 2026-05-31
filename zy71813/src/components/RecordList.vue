<template>
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">记录编号</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">门店</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">账期</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">来源</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">金额</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">问题分类</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">版本</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">更新时间</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">告警</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr
            v-for="record in records"
            :key="record.id"
            @click="$emit('select', record.id)"
            :class="[
              'cursor-pointer transition-colors hover:bg-gray-50',
              selectedId === record.id ? 'bg-primary-50' : ''
            ]"
          >
            <td class="px-4 py-3">
              <span class="font-mono text-sm text-gray-900">{{ record.id }}</span>
            </td>
            <td class="px-4 py-3">
              <div class="text-sm">
                <div class="font-medium text-gray-900">{{ record.storeName }}</div>
                <div class="text-gray-500">{{ record.storeId }}</div>
              </div>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">{{ record.accountingPeriod }}</td>
            <td class="px-4 py-3">
              <span class="inline-flex items-center gap-1 text-sm text-gray-600">
                <span>{{ SOURCE_ICONS[record.source] }}</span>
                {{ SOURCE_LABELS[record.source] }}
              </span>
            </td>
            <td class="px-4 py-3">
              <span class="text-sm font-semibold text-gray-900">¥{{ record.amount.toFixed(2) }}</span>
            </td>
            <td class="px-4 py-3">
              <span class="text-sm text-gray-600">{{ CATEGORY_LABELS[record.issueCategory] }}</span>
            </td>
            <td class="px-4 py-3">
              <span :class="[
                'inline-flex px-2 py-1 text-xs font-medium rounded-full border',
                STATUS_COLORS[record.status]
              ]">
                {{ STATUS_LABELS[record.status] }}
              </span>
            </td>
            <td class="px-4 py-3">
              <span class="text-sm text-gray-500">v{{ record.currentVersion }}</span>
            </td>
            <td class="px-4 py-3">
              <span class="text-sm text-gray-500">{{ formatDate(record.updatedAt) }}</span>
            </td>
            <td class="px-4 py-3">
              <div v-if="record.latestAlert || record.hasUnresolvedChanges">
                <span
                  v-if="record.hasUnresolvedChanges"
                  class="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700"
                >
                  ⚠️ 结论变更
                </span>
                <span
                  v-if="record.latestAlert"
                  class="block mt-1 text-xs text-orange-600"
                  title="record.latestAlert"
                >
                  版本异常
                </span>
              </div>
              <span v-else class="text-sm text-gray-400">-</span>
            </td>
          </tr>
          <tr v-if="records.length === 0">
            <td colspan="10" class="px-4 py-12 text-center text-gray-500">
              暂无匹配的记录
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { format } from 'date-fns';
import type { ShortageRecord } from '../types';
import { STATUS_LABELS, STATUS_COLORS, SOURCE_LABELS, SOURCE_ICONS, CATEGORY_LABELS } from '../constants/labels';

defineProps<{
  records: ShortageRecord[];
  selectedId: string | null;
}>();

defineEmits<{
  (e: 'select', id: string): void;
}>();

function formatDate(dateStr: string): string {
  return format(new Date(dateStr), 'MM-dd HH:mm');
}
</script>
