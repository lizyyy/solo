<script setup lang="ts">
import { computed } from 'vue';
import type { EventStatus, EventType, AbnormalType } from '@/types/timeline';
import { EVENT_STATUS_LABELS, EVENT_TYPE_LABELS, ABNORMAL_TYPE_LABELS } from '@/types/timeline';
import type { JudgmentResult, GateStepStatus } from '@/types/gate';
import { JUDGMENT_RESULT_LABELS, GATE_STEP_STATUS_LABELS } from '@/types/gate';
import type { RecordType } from '@/types/import';
import { RECORD_TYPE_LABELS } from '@/types/import';

type BadgeType = 'event-status' | 'event-type' | 'abnormal-type' | 'judgment-result' | 'step-status' | 'record-type';

interface Props {
  type: BadgeType;
  value: string;
  size?: 'sm' | 'md';
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md'
});

const label = computed(() => {
  switch (props.type) {
    case 'event-status':
      return EVENT_STATUS_LABELS[props.value as EventStatus] || props.value;
    case 'event-type':
      return EVENT_TYPE_LABELS[props.value as EventType] || props.value;
    case 'abnormal-type':
      return ABNORMAL_TYPE_LABELS[props.value as AbnormalType] || props.value;
    case 'judgment-result':
      return JUDGMENT_RESULT_LABELS[props.value as JudgmentResult] || props.value;
    case 'step-status':
      return GATE_STEP_STATUS_LABELS[props.value as GateStepStatus] || props.value;
    case 'record-type':
      return RECORD_TYPE_LABELS[props.value as RecordType] || props.value;
    default:
      return props.value;
  }
});

const badgeClass = computed(() => {
  const baseClass = props.size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';
  let colorClass = '';

  switch (props.type) {
    case 'event-status':
      switch (props.value) {
        case 'normal':
          colorClass = 'bg-success-50 text-success border-success-200';
          break;
        case 'pending':
          colorClass = 'bg-warning-50 text-warning border-warning-200 animate-pulse-slow';
          break;
        case 'confirmed':
          colorClass = 'bg-primary-50 text-primary-700 border-primary-200';
          break;
        case 'rejected':
          colorClass = 'bg-danger-50 text-danger border-danger-200';
          break;
        default:
          colorClass = 'bg-gray-100 text-gray-600 border-gray-200';
      }
      break;
    case 'event-type':
      switch (props.value) {
        case 'video':
          colorClass = 'bg-blue-50 text-blue-700 border-blue-200';
          break;
        case 'operation':
          colorClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
          break;
        case 'score':
          colorClass = 'bg-purple-50 text-purple-700 border-purple-200';
          break;
        case 'abnormal':
          colorClass = 'bg-danger-50 text-danger border-danger-200';
          break;
        case 'manual':
          colorClass = 'bg-amber-50 text-amber-700 border-amber-200';
          break;
        default:
          colorClass = 'bg-gray-100 text-gray-600 border-gray-200';
      }
      break;
    case 'abnormal-type':
      colorClass = 'bg-warning-50 text-warning border-warning-200';
      break;
    case 'judgment-result':
      switch (props.value) {
        case 'pass':
          colorClass = 'bg-success-50 text-success border-success-200';
          break;
        case 'fail':
          colorClass = 'bg-danger-50 text-danger border-danger-200';
          break;
        case 'pending':
          colorClass = 'bg-warning-50 text-warning border-warning-200 animate-pulse-slow';
          break;
        default:
          colorClass = 'bg-gray-100 text-gray-600 border-gray-200';
      }
      break;
    case 'step-status':
      switch (props.value) {
        case 'completed':
          colorClass = 'bg-success-50 text-success border-success-200';
          break;
        case 'in_progress':
          colorClass = 'bg-blue-50 text-blue-700 border-blue-200';
          break;
        case 'pending':
          colorClass = 'bg-gray-100 text-gray-500 border-gray-200';
          break;
        case 'skipped':
          colorClass = 'bg-warning-50 text-warning border-warning-200';
          break;
        case 'error':
          colorClass = 'bg-danger-50 text-danger border-danger-200';
          break;
        default:
          colorClass = 'bg-gray-100 text-gray-600 border-gray-200';
      }
      break;
    case 'record-type':
      switch (props.value) {
        case 'normal':
          colorClass = 'bg-success-50 text-success border-success-200';
          break;
        case 'late':
          colorClass = 'bg-warning-50 text-warning border-warning-200';
          break;
        case 'duplicate':
          colorClass = 'bg-gray-100 text-gray-600 border-gray-200';
          break;
        case 'corrected':
          colorClass = 'bg-amber-50 text-amber-700 border-amber-200';
          break;
        default:
          colorClass = 'bg-gray-100 text-gray-600 border-gray-200';
      }
      break;
  }

  return `${baseClass} ${colorClass} inline-flex items-center font-medium rounded border`;
});
</script>

<template>
  <span :class="badgeClass">
    {{ label }}
  </span>
</template>
