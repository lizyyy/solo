<script setup lang="ts">
import type { RecordStatus } from '@/types';

interface Props {
  status: RecordStatus;
  size?: 'sm' | 'md';
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
});

const statusConfig: Record<RecordStatus, { label: string; class: string }> = {
  'pending': {
    label: '待处理',
    class: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  'cad-imported': {
    label: 'CAD已导入',
    class: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  'under-review': {
    label: '审核中',
    class: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  'pending-manager': {
    label: '待经理复核',
    class: 'bg-orange-50 text-orange-700 border-orange-200 animate-pulse',
  },
  'corrected': {
    label: '已修正',
    class: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  'report-generated': {
    label: '报告已生成',
    class: 'bg-green-50 text-green-700 border-green-200',
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
};

const config = statusConfig[props.status] || statusConfig['pending'];
</script>

<template>
  <span
    class="inline-flex items-center font-medium border rounded"
    :class="[config.class, sizeClasses[size]]"
  >
    <span
      class="w-1.5 h-1.5 rounded-full mr-1.5"
      :class="{
        'bg-slate-400': status === 'pending',
        'bg-blue-500': status === 'cad-imported',
        'bg-amber-500': status === 'under-review',
        'bg-orange-500': status === 'pending-manager',
        'bg-purple-500': status === 'corrected',
        'bg-green-500': status === 'report-generated',
      }"
    ></span>
    {{ config.label }}
  </span>
</template>
