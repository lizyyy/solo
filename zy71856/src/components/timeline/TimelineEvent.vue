<script setup lang="ts">
import { computed } from 'vue';
import {
  Video,
  Settings,
  Award,
  AlertTriangle,
  UserCheck,
  ChevronRight,
  Clock,
  User
} from 'lucide-vue-next';
import type { TimelineEvent } from '@/types/timeline';
import StatusBadge from '@/components/common/StatusBadge.vue';
import EvidenceLink from '@/components/common/EvidenceLink.vue';
import { formatTimeOnly } from '@/utils/time';

interface Props {
  event: TimelineEvent;
  isSelected: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'select'): void;
  (e: 'confirm'): void;
  (e: 'reject'): void;
}>();

const iconComponent = computed(() => {
  switch (props.event.type) {
    case 'video':
      return Video;
    case 'operation':
      return Settings;
    case 'score':
      return Award;
    case 'abnormal':
      return AlertTriangle;
    case 'manual':
      return UserCheck;
    default:
      return Settings;
  }
});

const iconColorClass = computed(() => {
  if (props.event.status === 'pending') return 'text-warning';
  if (props.event.status === 'rejected') return 'text-danger';
  if (props.event.abnormalMark) return 'text-warning';

  switch (props.event.type) {
    case 'video':
      return 'text-blue-500';
    case 'operation':
      return 'text-indigo-500';
    case 'score':
      return 'text-purple-500';
    case 'abnormal':
      return 'text-danger';
    case 'manual':
      return 'text-amber-500';
    default:
      return 'text-gray-500';
  }
});

const iconBgClass = computed(() => {
  if (props.event.status === 'pending') return 'bg-warning-50 border-warning-200';
  if (props.event.status === 'rejected') return 'bg-danger-50 border-danger-200';

  switch (props.event.type) {
    case 'video':
      return 'bg-blue-50 border-blue-200';
    case 'operation':
      return 'bg-indigo-50 border-indigo-200';
    case 'score':
      return 'bg-purple-50 border-purple-200';
    case 'abnormal':
      return 'bg-danger-50 border-danger-200';
    case 'manual':
      return 'bg-amber-50 border-amber-200';
    default:
      return 'bg-gray-50 border-gray-200';
  }
});

const timelineDotClass = computed(() => {
  if (props.event.status === 'pending') return 'bg-warning border-warning-300 animate-pulse-slow';
  if (props.event.status === 'rejected') return 'bg-danger border-danger-300';
  if (props.event.abnormalMark) return 'bg-warning border-warning-300';

  switch (props.event.type) {
    case 'video':
      return 'bg-blue-500 border-blue-300';
    case 'operation':
      return 'bg-indigo-500 border-indigo-300';
    case 'score':
      return 'bg-purple-500 border-purple-300';
    case 'abnormal':
      return 'bg-danger border-danger-300';
    case 'manual':
      return 'bg-amber-500 border-amber-300';
    default:
      return 'bg-gray-400 border-gray-200';
  }
});
</script>

<template>
  <div
    class="relative pl-8 pb-6 last:pb-0 cursor-pointer group"
    :class="{ 'opacity-60': event.status === 'rejected' }"
    @click="emit('select')"
  >
    <div class="absolute left-2 top-1 bottom-0 w-px bg-gray-200" />

    <div
      class="absolute left-0 top-1 w-5 h-5 rounded-full border-2 shadow-sm z-10"
      :class="timelineDotClass"
    />

    <div
      class="rounded-lg border transition-all duration-200 overflow-hidden"
      :class="[
        isSelected
          ? 'border-primary-300 bg-primary-50/50 shadow-md'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      ]"
    >
      <div class="p-3">
        <div class="flex items-start gap-3">
          <div
            class="w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0"
            :class="iconBgClass"
          >
            <component :is="iconComponent" :class="['w-5 h-5', iconColorClass]" />
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <h4 class="font-medium text-gray-900 text-sm truncate">{{ event.title }}</h4>
              <ChevronRight class="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </div>

            <div class="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <span class="flex items-center gap-1">
                <Clock class="w-3 h-3" />
                {{ formatTimeOnly(event.timestamp) }}
              </span>
              <span v-if="event.operator" class="flex items-center gap-1">
                <User class="w-3 h-3" />
                {{ event.operator }}
              </span>
            </div>

            <p v-if="event.description" class="text-sm text-gray-600 line-clamp-2 mb-2">
              {{ event.description }}
            </p>

            <div class="flex items-center gap-2 flex-wrap">
              <StatusBadge type="event-type" :value="event.type" size="sm" />
              <StatusBadge type="event-status" :value="event.status" size="sm" />
              <StatusBadge
                v-if="event.abnormalMark"
                type="abnormal-type"
                :value="event.abnormalMark.type"
                size="sm"
              />
            </div>

            <div v-if="event.scoreItem" class="mt-2 p-2 bg-purple-50 rounded border border-purple-100">
              <div class="flex items-center justify-between text-sm">
                <span class="text-purple-700 font-medium">{{ event.scoreItem.name }}</span>
                <span class="text-purple-600 font-bold">
                  {{ event.scoreItem.score }}/{{ event.scoreItem.maxScore }}
                </span>
              </div>
              <div class="mt-1 h-1.5 bg-purple-100 rounded-full overflow-hidden">
                <div
                  class="h-full bg-purple-500 rounded-full"
                  :style="{ width: `${(event.scoreItem.score / event.scoreItem.maxScore) * 100}%` }"
                />
              </div>
            </div>

            <div v-if="event.abnormalMark && !event.abnormalMark.confirmed" class="mt-2 flex gap-2">
              <button
                class="flex-1 px-3 py-1.5 text-xs font-medium text-success bg-success-50 border border-success-200 rounded hover:bg-success-100 transition-colors"
                @click.stop="emit('confirm')"
              >
                确认有效
              </button>
              <button
                class="flex-1 px-3 py-1.5 text-xs font-medium text-danger bg-danger-50 border border-danger-200 rounded hover:bg-danger-100 transition-colors"
                @click.stop="emit('reject')"
              >
                标记无效
              </button>
            </div>

            <div v-if="event.evidenceLinks.length > 0" class="mt-3 space-y-1.5">
              <div class="text-xs font-medium text-gray-500 mb-1">关联证据 ({{ event.evidenceLinks.length }})</div>
              <EvidenceLink
                v-for="link in event.evidenceLinks"
                :key="link.id"
                :type="link.type"
                :description="link.description"
                :timestamp="link.timestamp"
                :url="link.url"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
