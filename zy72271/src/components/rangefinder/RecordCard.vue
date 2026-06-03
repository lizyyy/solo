<script setup lang="ts">
import { computed } from 'vue';
import { Ruler, Calendar, Tag, AlertTriangle, CheckCircle, Edit3 } from 'lucide-vue-next';
import type { RangefinderRecord } from '@/types';
import { validateRangefinderRecord } from '@/utils/validation';
import { formatDateTime, getCaliberLabel, getUnitLabel } from '@/utils/formatters';
import PhotoPreview from './PhotoPreview.vue';

interface Props {
  record: RangefinderRecord;
  showActions?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showActions: true,
});

const emit = defineEmits<{
  markBlocked: [];
  startCorrection: [];
}>();

const errors = computed(() => validateRangefinderRecord(props.record));
const hasErrors = computed(() => errors.value.length > 0);
const needsCorrection = computed(() => props.record.needsCorrection);
const hasBlockedWarning = computed(() => props.record.hasBlockedWarning);
</script>

<template>
  <div class="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
    <div class="grid md:grid-cols-2 gap-6 p-6">
      <div>
        <PhotoPreview :record="record" />
      </div>
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h4 class="text-lg font-semibold text-[#1e3a5f]">测距仪记录</h4>
          <span
            class="px-2 py-1 text-xs font-medium rounded"
            :class="{
              'bg-green-100 text-green-700': !hasErrors,
              'bg-orange-100 text-orange-700': hasBlockedWarning && !needsCorrection,
              'bg-purple-100 text-purple-700': needsCorrection,
            }"
          >
            {{ !hasErrors ? '数据正常' : needsCorrection ? '需要修正' : '待复核' }}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="p-3 bg-slate-50 rounded-lg">
            <div class="flex items-center text-sm text-slate-500 mb-1">
              <Ruler class="w-4 h-4 mr-1" />
              测距值
            </div>
            <div class="text-2xl font-bold text-[#1e3a5f]">
              {{ record.distance }}
              <span class="text-sm font-normal text-slate-500">{{ getUnitLabel(record.unit) }}</span>
            </div>
          </div>
          <div class="p-3 bg-slate-50 rounded-lg">
            <div class="flex items-center text-sm text-slate-500 mb-1">
              <Calendar class="w-4 h-4 mr-1" />
              采集时间
            </div>
            <div class="text-sm font-medium text-slate-700">{{ formatDateTime(record.measuredAt) }}</div>
          </div>
        </div>

        <div class="space-y-2">
          <div class="flex items-center text-sm">
            <Tag class="w-4 h-4 text-slate-400 mr-2" />
            <span class="text-slate-500 mr-2">设备编号：</span>
            <span class="font-mono text-[#1e3a5f]">{{ record.deviceId }}</span>
          </div>
          <div class="flex items-center text-sm">
            <Tag class="w-4 h-4 text-slate-400 mr-2" />
            <span class="text-slate-500 mr-2">数据口径：</span>
            <span
              class="font-medium"
              :class="record.caliber === 'imperial-v1' ? 'text-orange-600' : 'text-green-600'"
            >
              {{ getCaliberLabel(record.caliber) }}
            </span>
          </div>
          <div class="flex items-center text-sm">
            <span
              class="w-4 h-4 rounded-full mr-2 flex items-center justify-center"
              :class="record.warningLabelVisible ? 'bg-green-500' : 'bg-red-500'"
            >
              <CheckCircle v-if="record.warningLabelVisible" class="w-3 h-3 text-white" />
              <AlertTriangle v-else class="w-3 h-3 text-white" />
            </span>
            <span class="text-slate-500 mr-2">告警标签：</span>
            <span :class="record.warningLabelVisible ? 'text-green-600' : 'text-red-600'" class="font-medium">
              {{ record.warningLabelVisible ? '可见' : '被遮挡' }}
            </span>
          </div>
        </div>

        <div v-if="hasErrors" class="space-y-2">
          <div
            v-for="(error, index) in errors"
            :key="index"
            class="p-3 rounded-lg"
            :class="{
              'bg-orange-50 border border-orange-200': error.field === 'photo',
              'bg-purple-50 border border-purple-200': error.field === 'caliber',
              'bg-red-50 border border-red-200': error.field === 'distance' || error.field === 'unit',
            }"
          >
            <p
              class="text-sm font-medium"
              :class="{
                'text-orange-800': error.field === 'photo',
                'text-purple-800': error.field === 'caliber',
                'text-red-800': error.field === 'distance' || error.field === 'unit',
              }"
            >
              {{ error.message }}
            </p>
            <p
              class="text-xs mt-1"
              :class="{
                'text-orange-700': error.field === 'photo',
                'text-purple-700': error.field === 'caliber',
                'text-red-700': error.field === 'distance' || error.field === 'unit',
              }"
            >
              建议：{{ error.suggestion }}
            </p>
          </div>
        </div>

        <div v-if="showActions && hasErrors" class="flex gap-3 pt-2">
          <button
            v-if="hasBlockedWarning"
            class="flex-1 flex items-center justify-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
            @click="emit('markBlocked')"
          >
            <AlertTriangle class="w-4 h-4 mr-2" />
            提交经理复核
          </button>
          <button
            v-if="needsCorrection"
            class="flex-1 flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            @click="emit('startCorrection')"
          >
            <Edit3 class="w-4 h-4 mr-2" />
            人工修正数据
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
