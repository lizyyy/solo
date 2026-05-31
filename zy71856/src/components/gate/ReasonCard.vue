<script setup lang="ts">
import { AlertCircle, CheckCircle, Clock, Target } from 'lucide-vue-next';
import type { JudgmentReason } from '@/types/gate';

interface Props {
  reason: JudgmentReason;
}

const props = defineProps<Props>();

const confidenceColor = () => {
  if (props.reason.confidence >= 80) return 'text-success';
  if (props.reason.confidence >= 60) return 'text-warning';
  return 'text-danger';
};

const confidenceBgColor = () => {
  if (props.reason.confidence >= 80) return 'bg-success-50 border-success-200';
  if (props.reason.confidence >= 60) return 'bg-warning-50 border-warning-200';
  return 'bg-danger-50 border-danger-200';
};
</script>

<template>
  <div
    class="p-3 rounded-lg border transition-all hover:shadow-sm"
    :class="confidenceBgColor()"
  >
    <div class="flex items-start gap-3">
      <div class="mt-0.5">
        <CheckCircle v-if="reason.confidence >= 80" class="w-4 h-4 text-success" />
        <AlertCircle v-else-if="reason.confidence >= 60" class="w-4 h-4 text-warning" />
        <AlertCircle v-else class="w-4 h-4 text-danger" />
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm text-gray-700">{{ reason.description }}</p>

        <div v-if="reason.parameterName" class="mt-2 flex items-center gap-4 text-xs">
          <div class="flex items-center gap-1">
            <Target class="w-3 h-3 text-gray-400" />
            <span class="text-gray-500">参数:</span>
            <span class="font-medium text-gray-700">{{ reason.parameterName }}</span>
          </div>
          <div v-if="reason.expectedValue !== undefined" class="flex items-center gap-1">
            <Clock class="w-3 h-3 text-gray-400" />
            <span class="text-gray-500">预期:</span>
            <span class="font-medium text-success">{{ reason.expectedValue }}</span>
          </div>
          <div v-if="reason.actualValue !== undefined" class="flex items-center gap-1">
            <span class="text-gray-500">实际:</span>
            <span :class="['font-medium', confidenceColor()]">{{ reason.actualValue }}</span>
          </div>
        </div>

        <div class="mt-2 flex items-center gap-2">
          <div class="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all"
              :class="[
                reason.confidence >= 80 ? 'bg-success' :
                reason.confidence >= 60 ? 'bg-warning' : 'bg-danger'
              ]"
              :style="{ width: `${reason.confidence}%` }"
            />
          </div>
          <span :class="['text-xs font-medium', confidenceColor()]">
            {{ reason.confidence }}%
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
