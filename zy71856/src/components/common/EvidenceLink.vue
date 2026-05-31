<script setup lang="ts">
import { Video, FileText, UserCheck, Paperclip } from 'lucide-vue-next';
import type { EvidenceType } from '@/types/timeline';
import { EVIDENCE_TYPE_LABELS } from '@/types/timeline';
import { formatTimeOnly } from '@/utils/time';

interface Props {
  type: EvidenceType;
  description: string;
  timestamp: number;
  url?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'click'): void;
}>();

const iconComponent = () => {
  switch (props.type) {
    case 'video':
      return Video;
    case 'classroom':
      return FileText;
    case 'manual':
      return UserCheck;
    case 'attachment':
      return Paperclip;
    default:
      return FileText;
  }
};

const iconClass = () => {
  switch (props.type) {
    case 'video':
      return 'text-blue-500';
    case 'classroom':
      return 'text-indigo-500';
    case 'manual':
      return 'text-amber-500';
    case 'attachment':
      return 'text-gray-500';
    default:
      return 'text-gray-500';
  }
};
</script>

<template>
  <div
    class="flex items-center gap-2 p-2 rounded bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors text-sm"
    @click="emit('click')"
  >
    <component :is="iconComponent()" :class="['w-4 h-4 flex-shrink-0', iconClass()]" />
    <div class="flex-1 min-w-0">
      <div class="text-gray-700 truncate">{{ description || EVIDENCE_TYPE_LABELS[type] }}</div>
      <div class="text-xs text-gray-400">{{ formatTimeOnly(timestamp) }}</div>
    </div>
    <span class="text-xs text-gray-400 flex-shrink-0">{{ EVIDENCE_TYPE_LABELS[type] }}</span>
  </div>
</template>
