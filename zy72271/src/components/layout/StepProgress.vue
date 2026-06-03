<script setup lang="ts">
import { CheckCircle2, Circle } from 'lucide-vue-next';
import { STEP_NAMES } from '@/types';

interface Props {
  currentStep: number;
  completedSteps?: number[];
}

const props = withDefaults(defineProps<Props>(), {
  completedSteps: () => [],
});

const isCompleted = (index: number) => props.completedSteps.includes(index) || index < props.currentStep;
const isCurrent = (index: number) => index === props.currentStep;
</script>

<template>
  <div class="w-full py-6">
    <div class="flex items-center justify-between">
      <template v-for="(step, index) in STEP_NAMES" :key="index">
        <div class="flex flex-col items-center flex-1">
          <div
            class="relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300"
            :class="{
              'bg-green-500 border-green-500 text-white': isCompleted(index),
              'bg-white border-[#1e3a5f] text-[#1e3a5f]': isCurrent(index),
              'bg-white border-slate-300 text-slate-400': !isCompleted(index) && !isCurrent(index),
            }"
          >
            <CheckCircle2 v-if="isCompleted(index)" class="w-5 h-5" />
            <Circle v-else class="w-5 h-5" />
          </div>
          <span
            class="mt-2 text-sm font-medium transition-colors duration-300"
            :class="{
              'text-green-600': isCompleted(index),
              'text-[#1e3a5f]': isCurrent(index),
              'text-slate-400': !isCompleted(index) && !isCurrent(index),
            }"
          >
            {{ step }}
          </span>
        </div>
        <div
          v-if="index < STEP_NAMES.length - 1"
          class="flex-1 h-0.5 mx-2 transition-colors duration-300"
          :class="isCompleted(index) ? 'bg-green-500' : 'bg-slate-200'"
        ></div>
      </template>
    </div>
  </div>
</template>
