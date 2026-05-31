<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useGateStore } from '@/stores/gate';
import { useTimelineStore } from '@/stores/timeline';
import { useRouter } from 'vue-router';
import {
  Layers,
  BookOpen,
  ArrowLeft,
  Play,
  CheckCircle2
} from 'lucide-vue-next';
import TeachingResearchView from '@/components/gate/TeachingResearchView.vue';
import GateJudgment from '@/components/gate/GateJudgment.vue';
import type { GateJudgment as GateJudgmentType } from '@/types/gate';
import { exportTeachingReport } from '@/utils/export';

const router = useRouter();
const gateStore = useGateStore();
const timelineStore = useTimelineStore();

const { currentSession, isProcessing } = storeToRefs(gateStore);

const viewMode = ref<'detail' | 'teaching'>('teaching');
const selectedStepId = ref<string | null>(null);

onMounted(async () => {
  if (!currentSession.value) {
    await gateStore.loadLatestOrCreate();
  }
  if (currentSession.value) {
    selectedStepId.value = currentSession.value.steps[0]?.step.id || null;
  }
});

async function runAutoJudge() {
  await gateStore.runAutoJudgment();
}

function selectStep(stepId: string) {
  selectedStepId.value = stepId;
  viewMode.value = 'detail';
}

function updateJudgment(stepId: string, updates: Partial<GateJudgmentType>) {
  gateStore.updateJudgment(stepId, updates);
}

function handleExportReport() {
  if (currentSession.value) {
    const events = timelineStore.events;
    exportTeachingReport(currentSession.value, events);
  }
}

function goToTimeline() {
  if (currentSession.value) {
    router.push({
      path: '/timeline',
      query: { sessionId: currentSession.value.id }
    });
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div class="max-w-[1920px] mx-auto px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <button
              class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              @click="router.push('/import')"
            >
              <ArrowLeft class="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 class="text-xl font-bold text-gray-900">水利闸门操作评估</h1>
              <p class="text-sm text-gray-500">自动判断 + 人工确认，确保评估准确</p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <div class="flex bg-gray-100 rounded-lg p-1">
              <button
                class="px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2"
                :class="viewMode === 'teaching' ? 'bg-white shadow text-primary-600' : 'text-gray-600 hover:text-gray-900'"
                @click="viewMode = 'teaching'"
              >
                <BookOpen class="w-4 h-4" />
                教研视图
              </button>
              <button
                class="px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2"
                :class="viewMode === 'detail' ? 'bg-white shadow text-primary-600' : 'text-gray-600 hover:text-gray-900'"
                @click="viewMode = 'detail'"
              >
                <Layers class="w-4 h-4" />
                步骤详情
              </button>
            </div>

            <button
              class="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              :disabled="isProcessing"
              @click="runAutoJudge"
            >
              <Play v-if="!isProcessing" class="w-4 h-4" />
              <div v-else class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {{ isProcessing ? '判断中...' : '运行自动判断' }}
            </button>

            <button
              class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-2"
              @click="goToTimeline"
            >
              <Layers class="w-4 h-4" />
              查看时间线
            </button>
          </div>
        </div>
      </div>
    </header>

    <main v-if="currentSession" class="max-w-[1920px] mx-auto p-6">
      <div v-if="viewMode === 'teaching'" class="animate-fade-in">
        <TeachingResearchView
          :session="currentSession"
          @select-step="selectStep"
          @export-report="handleExportReport"
        />
      </div>

      <div v-else class="flex gap-6 animate-fade-in">
        <div class="flex-1 space-y-4">
          <GateJudgment
            v-for="step in currentSession.steps"
            :key="step.step.id"
            :step-result="step"
            :class="{ 'ring-2 ring-primary-500': selectedStepId === step.step.id }"
            @update-judgment="(updates) => updateJudgment(step.step.id, updates)"
          />
        </div>

        <div class="w-80 flex-shrink-0">
          <div class="bg-white rounded-xl border border-gray-200 p-4 sticky top-24">
            <h3 class="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle2 class="w-5 h-5 text-primary-600" />
              操作提示
            </h3>
            <div class="space-y-3 text-sm text-gray-600">
              <div class="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div class="font-medium text-blue-800 mb-1">1. 运行自动判断</div>
                <p class="text-blue-700">点击右上角按钮，系统将自动分析所有操作步骤</p>
              </div>
              <div class="p-3 bg-amber-50 rounded-lg border border-amber-100">
                <div class="font-medium text-amber-800 mb-1">2. 人工确认待办</div>
                <p class="text-amber-700">橙色标记的步骤需要人工复核，点击通过或不通过</p>
              </div>
              <div class="p-3 bg-green-50 rounded-lg border border-green-100">
                <div class="font-medium text-green-800 mb-1">3. 编辑评估说明</div>
                <p class="text-green-700">可编辑原因分析和下一步建议，供教研使用</p>
              </div>
              <div class="p-3 bg-purple-50 rounded-lg border border-purple-100">
                <div class="font-medium text-purple-800 mb-1">4. 导出报告</div>
                <p class="text-purple-700">切换到教研视图，可导出完整的评估报告</p>
              </div>
            </div>

            <div class="mt-6 pt-4 border-t border-gray-100">
              <div class="text-xs text-gray-500 mb-2">快捷导航</div>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="step in currentSession.steps"
                  :key="step.step.id"
                  class="w-8 h-8 rounded-lg text-xs font-medium transition-all"
                  :class="[
                    selectedStepId === step.step.id
                      ? 'bg-primary-600 text-white'
                      : step.judgment?.result === 'pass'
                        ? 'bg-success-100 text-success-700 hover:bg-success-200'
                        : step.judgment?.result === 'fail'
                          ? 'bg-danger-100 text-danger-700 hover:bg-danger-200'
                          : step.judgment?.result === 'pending'
                            ? 'bg-warning-100 text-warning-700 hover:bg-warning-200 animate-pulse'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  ]"
                  @click="selectStep(step.step.id)"
                >
                  {{ step.step.order }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <div v-else class="flex items-center justify-center min-h-[60vh]">
      <div class="text-center">
        <div class="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
        <p class="text-gray-500">加载中...</p>
      </div>
    </div>
  </div>
</template>
