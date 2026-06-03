<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ArrowLeft, Home, FileText, Download, CheckCircle2, History } from 'lucide-vue-next';
import { useWorkflowStore } from '@/stores/workflow';
import { useNotificationStore } from '@/stores/notification';
import StepProgress from '@/components/layout/StepProgress.vue';
import SafetyReportCard from '@/components/report/SafetyReportCard.vue';
import HistoryTimeline from '@/components/common/HistoryTimeline.vue';

const router = useRouter();
const route = useRoute();
const workflowStore = useWorkflowStore();
const notificationStore = useNotificationStore();

const recordId = computed(() => route.params.recordId as string);
const record = computed(() => workflowStore.getRecordById(recordId.value));
const isGenerating = ref(false);

onMounted(() => {
  if (!record.value) {
    notificationStore.addNotification('error', '未找到该记录');
    router.push('/');
    return;
  }
  if (!record.value.safetyReport) {
    generateReport();
  }
});

const generateReport = async () => {
  isGenerating.value = true;
  await new Promise(resolve => setTimeout(resolve, 1000));
  workflowStore.generateSafetyReport(recordId.value);
  notificationStore.addNotification('success', '安全距离报告已生成');
  isGenerating.value = false;
};

const goBack = () => {
  router.push(`/rangefinder/${recordId.value}`);
};

const goHome = () => {
  router.push('/');
};

const goToComparison = () => {
  router.push('/result-comparison');
};

const regenerate = () => {
  generateReport();
};
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" v-if="record">
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
                步骤 3 / 3：安全距离报告
              </h1>
              <p class="text-sm text-slate-500">{{ record.code }} - {{ record.typeLabel }}</p>
            </div>
          </div>
          <div class="w-64">
            <StepProgress :current-step="2" :completed-steps="[0, 1]" />
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-6 py-8">
      <div v-if="isGenerating" class="flex flex-col items-center justify-center py-20">
        <div class="w-16 h-16 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mb-6"></div>
        <h3 class="text-xl font-semibold text-[#1e3a5f] mb-2">正在生成安全距离报告...</h3>
        <p class="text-slate-500">正在计算反射点安全距离，请稍候</p>
      </div>

      <div v-else-if="record.safetyReport" class="grid lg:grid-cols-3 gap-8">
        <div class="lg:col-span-2 space-y-6">
          <SafetyReportCard :record="record" />

          <div class="flex flex-wrap justify-end gap-4">
            <button
              class="flex items-center px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-colors font-medium"
              @click="goBack"
            >
              <ArrowLeft class="w-5 h-5 mr-2" />
              返回上一步
            </button>
            <button
              class="flex items-center px-6 py-3 bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100 transition-colors font-medium border border-amber-200"
              @click="regenerate"
            >
              <Download class="w-5 h-5 mr-2" />
              重新生成
            </button>
            <button
              class="flex items-center px-6 py-3 bg-[#1e3a5f] text-white rounded-xl hover:bg-[#2a4a72] transition-colors font-medium"
              @click="goToComparison"
            >
              <FileText class="w-5 h-5 mr-2" />
              查看对比结果
              <CheckCircle2 class="w-5 h-5 ml-2" />
            </button>
            <button
              class="flex items-center px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium"
              @click="goHome"
            >
              <Home class="w-5 h-5 mr-2" />
              返回首页
            </button>
          </div>
        </div>

        <div class="space-y-6">
          <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 class="text-lg font-semibold text-[#1e3a5f] mb-4">完成情况</h3>
            <div class="space-y-4">
              <div class="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div class="flex items-center">
                  <CheckCircle2 class="w-5 h-5 text-green-500 mr-3" />
                  <span class="text-sm font-medium text-green-800">CAD 图层导入</span>
                </div>
                <span class="text-xs text-green-600">已完成</span>
              </div>
              <div class="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div class="flex items-center">
                  <CheckCircle2 class="w-5 h-5 text-green-500 mr-3" />
                  <span class="text-sm font-medium text-green-800">测距仪记录审核</span>
                </div>
                <span class="text-xs text-green-600">已完成</span>
              </div>
              <div class="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div class="flex items-center">
                  <CheckCircle2 class="w-5 h-5 text-green-500 mr-3" />
                  <span class="text-sm font-medium text-green-800">安全距离报告</span>
                </div>
                <span class="text-xs text-green-600">已完成</span>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 class="text-lg font-semibold text-[#1e3a5f] mb-4 flex items-center">
              <History class="w-5 h-5 mr-2" />
              完整处理历史
            </h3>
            <div class="max-h-96 overflow-auto">
              <HistoryTimeline :logs="record.historyLogs" />
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
