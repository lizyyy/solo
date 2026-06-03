<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ArrowLeft, ArrowRight, RefreshCw, CheckCircle2, Eye } from 'lucide-vue-next';
import { useWorkflowStore } from '@/stores/workflow';
import { useNotificationStore } from '@/stores/notification';
import StepProgress from '@/components/layout/StepProgress.vue';
import RecordCard from '@/components/rangefinder/RecordCard.vue';
import CorrectionForm from '@/components/rangefinder/CorrectionForm.vue';
import HistoryTimeline from '@/components/common/HistoryTimeline.vue';
import { validateRangefinderRecord } from '@/utils/validation';

const router = useRouter();
const route = useRoute();
const workflowStore = useWorkflowStore();
const notificationStore = useNotificationStore();

const recordId = computed(() => route.params.recordId as string);
const record = computed(() => workflowStore.getRecordById(recordId.value));
const rangefinderRecord = computed(() => record.value?.rangefinderRecords[0]);
const showCorrectionForm = ref(false);

const errors = computed(() => rangefinderRecord.value ? validateRangefinderRecord(rangefinderRecord.value) : []);
const hasErrors = computed(() => errors.value.length > 0);
const hasBlockedWarning = computed(() => rangefinderRecord.value?.hasBlockedWarning || false);
const needsCorrection = computed(() => rangefinderRecord.value?.needsCorrection || false);

const canProceed = computed(() => {
  if (!record.value) return false;
  if (record.value.status === 'pending-manager') return false;
  if (record.value.status === 'corrected') return true;
  if (hasBlockedWarning.value && record.value.status !== 'under-review') return false;
  if (needsCorrection.value) return false;
  return true;
});

onMounted(() => {
  if (!record.value) {
    notificationStore.addNotification('error', '未找到该记录');
    router.push('/');
    return;
  }
  if (record.value.status === 'pending') {
    notificationStore.addNotification('warning', '请先完成 CAD 图层导入步骤');
    router.push(`/cad-import/${recordId.value}`);
  }
  if (record.value.status === 'pending-manager') {
    notificationStore.addNotification('warning', '此记录正在等待施工经理复核');
  }
});

const goBack = () => {
  router.push(`/cad-import/${recordId.value}`);
};

const handleMarkBlocked = () => {
  workflowStore.markForManagerReview(recordId.value);
  notificationStore.addNotification('warning', '已提交施工经理复核，请等待处理');
  router.push('/manager-review');
};

const handleStartCorrection = () => {
  showCorrectionForm.value = true;
};

const handleSubmitCorrection = (correction: any) => {
  if (rangefinderRecord.value) {
    workflowStore.applyCorrection(recordId.value, rangefinderRecord.value.id, correction);
    notificationStore.addNotification('success', '数据修正成功');
    showCorrectionForm.value = false;
  }
};

const handleRerun = () => {
  workflowStore.rerunCalculation(recordId.value);
  notificationStore.addNotification('info', '已重跑计算');
  router.push(`/safety-report/${recordId.value}`);
};

const handleNext = () => {
  if (record.value?.status === 'corrected') {
    handleRerun();
  } else {
    router.push(`/safety-report/${recordId.value}`);
  }
};
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" v-if="record && rangefinderRecord">
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
                步骤 2 / 3：测距仪记录审核
              </h1>
              <p class="text-sm text-slate-500">{{ record.code }} - {{ record.typeLabel }}</p>
            </div>
          </div>
          <div class="w-64">
            <StepProgress :current-step="1" :completed-steps="[0]" />
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-6 py-8">
      <div class="grid lg:grid-cols-3 gap-8">
        <div class="lg:col-span-2 space-y-6">
          <div v-if="record.status === 'pending-manager'" class="p-6 bg-orange-50 border-2 border-orange-300 rounded-2xl">
            <div class="flex items-start">
              <div class="p-3 bg-orange-100 rounded-xl mr-4">
                <Eye class="w-8 h-8 text-orange-600" />
              </div>
              <div>
                <h3 class="text-lg font-bold text-orange-800 mb-2">等待施工经理复核</h3>
                <p class="text-orange-700 mb-4">
                  此记录的测距照片中告警标签被移动端截图遮挡，已提交施工经理复核。
                  请等待复核完成后再继续处理。
                </p>
                <button
                  class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  @click="router.push('/manager-review')"
                >
                  前往复核页面
                </button>
              </div>
            </div>
          </div>

          <RecordCard
            :record="rangefinderRecord"
            :show-actions="record.status !== 'pending-manager' && !showCorrectionForm"
            @mark-blocked="handleMarkBlocked"
            @start-correction="handleStartCorrection"
          />

          <CorrectionForm
            v-if="showCorrectionForm && needsCorrection"
            :record="rangefinderRecord"
            @submit="handleSubmitCorrection"
            @cancel="showCorrectionForm = false"
          />

          <div class="flex justify-end gap-4">
            <button
              class="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-colors font-medium"
              @click="goBack"
            >
              返回上一步
            </button>
            <button
              v-if="record.status === 'corrected'"
              class="flex items-center px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium"
              @click="handleRerun"
            >
              <RefreshCw class="w-5 h-5 mr-2" />
              重跑计算
              <ArrowRight class="w-5 h-5 ml-2" />
            </button>
            <button
              v-else
              class="flex items-center px-6 py-3 bg-[#1e3a5f] text-white rounded-xl hover:bg-[#2a4a72] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!canProceed"
              @click="handleNext"
            >
              <CheckCircle2 class="w-5 h-5 mr-2" />
              进入下一步
              <ArrowRight class="w-5 h-5 ml-2" />
            </button>
          </div>
        </div>

        <div class="space-y-6">
          <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 class="text-lg font-semibold text-[#1e3a5f] mb-4">操作说明</h3>
            <div class="space-y-3 text-sm text-slate-600">
              <div class="flex items-start">
                <span class="w-6 h-6 bg-[#1e3a5f] text-white rounded-full flex items-center justify-center text-xs mr-3 flex-shrink-0">1</span>
                <p>检查测距仪记录的照片中红色告警标签是否清晰可见</p>
              </div>
              <div class="flex items-start">
                <span class="w-6 h-6 bg-[#1e3a5f] text-white rounded-full flex items-center justify-center text-xs mr-3 flex-shrink-0">2</span>
                <p>确认数据口径是否为当前标准（公制/米），如为旧口径需人工修正</p>
              </div>
              <div class="flex items-start">
                <span class="w-6 h-6 bg-[#1e3a5f] text-white rounded-full flex items-center justify-center text-xs mr-3 flex-shrink-0">3</span>
                <p>如告警标签被遮挡，点击"提交经理复核"，不要直接判定为正常</p>
              </div>
              <div class="flex items-start">
                <span class="w-6 h-6 bg-[#1e3a5f] text-white rounded-full flex items-center justify-center text-xs mr-3 flex-shrink-0">4</span>
                <p>所有问题处理完成后，进入安全距离报告生成步骤</p>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 class="text-lg font-semibold text-[#1e3a5f] mb-4">处理历史</h3>
            <div class="max-h-80 overflow-auto">
              <HistoryTimeline :logs="record.historyLogs" />
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
