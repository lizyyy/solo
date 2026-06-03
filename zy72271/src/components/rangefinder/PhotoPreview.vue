<script setup lang="ts">
import { ref } from 'vue';
import { Eye, ZoomIn, ZoomOut, X, AlertTriangle } from 'lucide-vue-next';
import type { RangefinderRecord } from '@/types';

interface Props {
  record: RangefinderRecord;
}

const props = defineProps<Props>();

const showModal = ref(false);
const zoom = ref(1);

const openModal = () => {
  showModal.value = true;
  zoom.value = 1;
};

const closeModal = () => {
  showModal.value = false;
};

const zoomIn = () => {
  zoom.value = Math.min(zoom.value + 0.25, 3);
};

const zoomOut = () => {
  zoom.value = Math.max(zoom.value - 0.25, 0.5);
};
</script>

<template>
  <div class="space-y-3">
    <div
      class="relative group cursor-pointer overflow-hidden rounded-lg border-2 transition-all"
      :class="record.hasBlockedWarning ? 'border-orange-300' : 'border-slate-200'"
      @click="openModal"
    >
      <img
        :src="record.photoUrl"
        alt="测距仪照片"
        class="w-full h-48 object-cover transition-transform group-hover:scale-105"
      />
      <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
        <div class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center text-white">
          <Eye class="w-5 h-5 mr-2" />
          <span class="text-sm font-medium">点击放大查看</span>
        </div>
      </div>
      <div
        v-if="record.hasBlockedWarning"
        class="absolute top-2 right-2 bg-orange-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center"
      >
        <AlertTriangle class="w-3 h-3 mr-1" />
        告警标签被遮挡
      </div>
    </div>

    <div
      v-if="record.hasBlockedWarning || !record.warningLabelVisible"
      class="p-3 bg-orange-50 border border-orange-200 rounded-lg"
    >
      <div class="flex items-start">
        <AlertTriangle class="w-5 h-5 text-orange-500 mr-2 mt-0.5 flex-shrink-0" />
        <div>
          <p class="text-sm font-medium text-orange-800">红色告警标签不可见</p>
          <p class="text-xs text-orange-700 mt-1">照片中测距仪屏幕的红色告警标签被移动端截图遮挡，请标记后提交施工经理复核，不要直接判定为正常。</p>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
        @click.self="closeModal"
      >
        <div class="relative bg-white rounded-xl shadow-2xl max-w-4xl max-h-[90vh] overflow-hidden">
          <div class="flex items-center justify-between p-4 border-b border-slate-200">
            <h3 class="text-lg font-semibold text-[#1e3a5f]">测距仪照片详情</h3>
            <div class="flex items-center space-x-2">
              <button
                class="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                @click="zoomOut"
              >
                <ZoomOut class="w-5 h-5 text-slate-600" />
              </button>
              <span class="text-sm text-slate-600 min-w-[60px] text-center">{{ Math.round(zoom * 100) }}%</span>
              <button
                class="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                @click="zoomIn"
              >
                <ZoomIn class="w-5 h-5 text-slate-600" />
              </button>
              <button
                class="p-2 hover:bg-slate-100 rounded-lg transition-colors ml-2"
                @click="closeModal"
              >
                <X class="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>
          <div class="p-4 overflow-auto max-h-[calc(90vh-80px)]">
            <div
              class="transition-transform duration-200"
              :style="{ transform: `scale(${zoom})`, transformOrigin: 'center top' }"
            >
              <img
                :src="record.photoUrl"
                alt="测距仪照片详情"
                class="max-w-full rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
