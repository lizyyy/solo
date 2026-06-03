<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Save, X, Calculator, ArrowRight } from 'lucide-vue-next';
import type { RangefinderRecord } from '@/types';
import { feetToMeters } from '@/utils/validation';

interface Props {
  record: RangefinderRecord;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  submit: [correction: {
    oldDistance: number;
    newDistance: number;
    oldCaliber: string;
    newCaliber: string;
    reason: string;
  }];
  cancel: [];
}>();

const form = ref({
  newDistance: 0,
  newCaliber: 'metric-v2',
  reason: '',
});

watch(() => props.record, (r) => {
  if (r.unit === 'ft') {
    form.value.newDistance = feetToMeters(r.distance);
  } else {
    form.value.newDistance = r.distance;
  }
  form.value.reason = r.needsCorrection ? '旧口径数据，从英尺转换为米' : '';
}, { immediate: true });

const canSubmit = computed(() => form.value.newDistance > 0 && form.value.reason.trim().length > 0);

const handleSubmit = () => {
  if (!canSubmit.value) return;
  emit('submit', {
    oldDistance: props.record.distance,
    newDistance: form.value.newDistance,
    oldCaliber: props.record.caliber,
    newCaliber: form.value.newCaliber,
    reason: form.value.reason,
  });
};

const autoConvert = () => {
  if (props.record.unit === 'ft') {
    form.value.newDistance = feetToMeters(props.record.distance);
    form.value.reason = '根据 1 英尺 = 0.3048 米自动转换';
  }
};
</script>

<template>
  <div class="bg-purple-50 border border-purple-200 rounded-xl p-6">
    <h4 class="text-lg font-semibold text-purple-800 mb-4">人工修正数据</h4>
    
    <div class="bg-white rounded-lg p-4 mb-4 border border-purple-100">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-slate-500">原始数据（旧口径）</p>
          <p class="text-2xl font-bold text-slate-800">
            {{ record.distance }} 英尺
          </p>
          <p class="text-xs text-slate-500 mt-1">口径：{{ record.caliber }}</p>
        </div>
        <ArrowRight class="w-8 h-8 text-purple-400" />
        <div class="text-right">
          <p class="text-sm text-slate-500">修正后数据（新口径）</p>
          <p class="text-2xl font-bold text-purple-600">
            {{ form.newDistance }} 米
          </p>
          <p class="text-xs text-slate-500 mt-1">口径：{{ form.newCaliber }}</p>
        </div>
      </div>
    </div>

    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">
          修正后的距离值（米）
        </label>
        <div class="relative">
          <Calculator class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            v-model.number="form.newDistance"
            type="number"
            step="0.01"
            min="0"
            class="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            placeholder="输入修正后的距离值"
          />
          <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">米</span>
        </div>
        <button
          class="mt-2 text-sm text-purple-600 hover:text-purple-800 font-medium"
          @click="autoConvert"
        >
          自动转换（1 英尺 = 0.3048 米）
        </button>
      </div>

      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">
          新口径标准
        </label>
        <select
          v-model="form.newCaliber"
          class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
        >
          <option value="metric-v2">公制 V2（当前标准）</option>
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">
          修正原因
        </label>
        <textarea
          v-model="form.reason"
          rows="3"
          class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none"
          placeholder="请说明修正原因..."
        ></textarea>
      </div>
    </div>

    <div class="flex gap-3 mt-6">
      <button
        class="flex-1 flex items-center justify-center px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-sm font-medium"
        @click="emit('cancel')"
      >
        <X class="w-4 h-4 mr-2" />
        取消
      </button>
      <button
        class="flex-1 flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="!canSubmit"
        @click="handleSubmit"
      >
        <Save class="w-4 h-4 mr-2" />
        保存修正
      </button>
    </div>
  </div>
</template>
