<script setup lang="ts">
import { Clock, User } from 'lucide-vue-next';
import type { HistoryLog } from '@/types';
import { formatDateTime } from '@/utils/formatters';

interface Props {
  logs: HistoryLog[];
}

defineProps<Props>();
</script>

<template>
  <div class="space-y-1">
    <div
      v-for="(log, index) in logs"
      :key="log.id"
      class="relative pl-6 pb-4 last:pb-0"
    >
      <div
        v-if="index < logs.length - 1"
        class="absolute left-[7px] top-4 w-0.5 h-full bg-slate-200"
      ></div>
      <div
        class="absolute left-0 top-1 w-4 h-4 rounded-full border-2 bg-white"
        :class="{
          'border-green-500': log.action.includes('通过') || log.action.includes('生成'),
          'border-amber-500': log.action.includes('提交') || log.action.includes('审核'),
          'border-orange-500': log.action.includes('复核'),
          'border-purple-500': log.action.includes('修正') || log.action.includes('重跑'),
          'border-slate-400': true,
        }"
      ></div>
      <div class="ml-2">
        <div class="flex items-center justify-between mb-1">
          <span class="text-sm font-semibold text-[#1e3a5f]">{{ log.action }}</span>
          <div class="flex items-center text-xs text-slate-500">
            <Clock class="w-3 h-3 mr-1" />
            {{ formatDateTime(log.timestamp) }}
          </div>
        </div>
        <div class="flex items-center text-xs text-slate-600 mb-1">
          <User class="w-3 h-3 mr-1" />
          {{ log.operator }}
          <span class="mx-2 text-slate-300">|</span>
          {{ log.step }}
        </div>
        <p class="text-sm text-slate-700">{{ log.details }}</p>
      </div>
    </div>
  </div>
</template>
