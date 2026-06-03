<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, Download, RotateCcw } from 'lucide-vue-next';
import { useWorkflowStore } from '@/stores/workflow';
import { useNotificationStore } from '@/stores/notification';
import ResultComparison from '@/components/report/ResultComparison.vue';

const router = useRouter();
const workflowStore = useWorkflowStore();
const notificationStore = useNotificationStore();

const records = computed(() => workflowStore.state.records);
const allCompleted = computed(() => records.value.every(r => r.status === 'report-generated'));

const goBack = () => {
  router.push('/');
};

const resetAll = () => {
  workflowStore.resetAllRecords();
  notificationStore.addNotification('info', '所有记录已重置');
};

const exportResults = () => {
  notificationStore.addNotification('info', '结果导出功能演示中...');
};
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
    <header class="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div class="max-w-7xl mx-auto px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <button
              class="p-2 hover:bg-slate-100 rounded-lg mr-4 transition-colors"
              @click="goBack"
            >
              <ArrowLeft class="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 class="text-xl font-bold text-[#1e3a5f]" style="font-family: 'JetBrains Mono', monospace;">
                处理结果对比
              </h1>
              <p class="text-sm text-slate-500">三条记录处理流程和结果对比分析</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <button
              class="flex items-center px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
              @click="resetAll"
            >
              <RotateCcw class="w-5 h-5 mr-2" />
              重置全部
            </button>
            <button
              class="flex items-center px-4 py-2 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#2a4a72] transition-colors"
              @click="exportResults"
            >
              <Download class="w-5 h-5 mr-2" />
              导出结果
            </button>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-6 py-8">
      <div v-if="!allCompleted" class="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <p class="text-amber-800">
          <strong>提示：</strong>部分记录尚未完成全部处理流程，对比结果可能不完整。
          建议完成所有三条记录的处理后再进行对比。
        </p>
      </div>

      <ResultComparison :records="records" />

      <div class="mt-8 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <h3 class="text-lg font-semibold text-[#1e3a5f] mb-4">安全距离计算说明</h3>
        <div class="grid md:grid-cols-3 gap-6 text-sm">
          <div>
            <h4 class="font-medium text-slate-700 mb-2">计算公式</h4>
            <div class="p-4 bg-slate-50 rounded-lg font-mono text-slate-600">
              安全距离 = min(测距值)<br/>
              判定：距离 ≥ 10m 为安全
            </div>
          </div>
          <div>
            <h4 class="font-medium text-slate-700 mb-2">参数说明</h4>
            <ul class="space-y-1 text-slate-600">
              <li>• 安全标准：10 米</li>
              <li>• 声程长度：距离 × 2</li>
              <li>• 反射点数：记录数 × 3</li>
            </ul>
          </div>
          <div>
            <h4 class="font-medium text-slate-700 mb-2">单位换算</h4>
            <ul class="space-y-1 text-slate-600">
              <li>• 1 英尺 = 0.3048 米</li>
              <li>• 旧口径：英制 (ft)</li>
              <li>• 新口径：公制 (m)</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
