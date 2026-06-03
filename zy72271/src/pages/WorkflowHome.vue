<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { Play, RotateCcw, History, GitCompare, Bell, CheckCircle, AlertTriangle, Edit3 } from 'lucide-vue-next';
import { useWorkflowStore } from '@/stores/workflow';
import { useNotificationStore } from '@/stores/notification';
import StatusBadge from '@/components/common/StatusBadge.vue';
import HistoryTimeline from '@/components/common/HistoryTimeline.vue';
import type { RecordType } from '@/types';

const router = useRouter();
const workflowStore = useWorkflowStore();
const notificationStore = useNotificationStore();

const records = computed(() => workflowStore.state.records);
const pendingReviewCount = computed(() => workflowStore.pendingManagerReview.value.length);

const typeIcons: Record<RecordType, any> = {
  normal: CheckCircle,
  'blocked-warning': AlertTriangle,
  'old-caliber': Edit3,
};

const typeColors: Record<RecordType, string> = {
  normal: 'from-green-50 to-emerald-50 border-green-200 hover:border-green-400',
  'blocked-warning': 'from-orange-50 to-amber-50 border-orange-200 hover:border-orange-400',
  'old-caliber': 'from-purple-50 to-pink-50 border-purple-200 hover:border-purple-400',
};

const typeAccent: Record<RecordType, string> = {
  normal: 'bg-green-500',
  'blocked-warning': 'bg-orange-500',
  'old-caliber': 'bg-purple-500',
};

const startWorkflow = (recordId: string) => {
  const record = workflowStore.getRecordById(recordId);
  if (record) {
    if (record.status === 'pending-manager') {
      notificationStore.addNotification('warning', '此记录正在等待施工经理复核，请先完成复核');
      router.push('/manager-review');
    } else {
      router.push(`/cad-import/${recordId}`);
    }
  }
};

const resetRecord = (recordId: string) => {
  workflowStore.resetRecord(recordId);
  notificationStore.addNotification('info', '记录已重置');
};

const resetAll = () => {
  workflowStore.resetAllRecords();
  notificationStore.addNotification('info', '所有记录已重置');
};

const goToComparison = () => {
  router.push('/result-comparison');
};

const goToManagerReview = () => {
  router.push('/manager-review');
};
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
    <header class="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div class="max-w-7xl mx-auto px-6 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-[#1e3a5f]" style="font-family: 'JetBrains Mono', monospace;">
              剧场声场反射点演示
            </h1>
            <p class="text-sm text-slate-500 mt-1">航测内业工作流程演示系统</p>
          </div>
          <div class="flex items-center gap-3">
            <button
              class="relative flex items-center px-4 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors border border-amber-200"
              @click="goToManagerReview"
            >
              <Bell class="w-5 h-5 mr-2" />
              施工经理复核
              <span
                v-if="pendingReviewCount > 0"
                class="absolute -top-2 -right-2 min-w-[20px] h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center px-1"
              >
                {{ pendingReviewCount }}
              </span>
            </button>
            <button
              class="flex items-center px-4 py-2 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#2a4a72] transition-colors"
              @click="goToComparison"
            >
              <GitCompare class="w-5 h-5 mr-2" />
              结果对比
            </button>
            <button
              class="flex items-center px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
              @click="resetAll"
            >
              <RotateCcw class="w-5 h-5 mr-2" />
              重置全部
            </button>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-6 py-8">
      <div class="mb-8 p-6 bg-gradient-to-r from-[#1e3a5f] to-[#2a4a72] rounded-2xl text-white">
        <h2 class="text-xl font-bold mb-2">演示说明</h2>
        <p class="text-blue-100 mb-4">
          本系统演示剧场声场反射点测量的完整处理流程，包含三种典型场景：
        </p>
        <div class="grid md:grid-cols-3 gap-4">
          <div class="p-4 bg-white/10 rounded-xl backdrop-blur-sm">
            <div class="flex items-center mb-2">
              <div class="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                <CheckCircle class="w-5 h-5" />
              </div>
              <span class="font-semibold">顺利记录</span>
            </div>
            <p class="text-sm text-blue-100">数据完整无误，直接走完三步流程</p>
          </div>
          <div class="p-4 bg-white/10 rounded-xl backdrop-blur-sm">
            <div class="flex items-center mb-2">
              <div class="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center mr-3">
                <AlertTriangle class="w-5 h-5" />
              </div>
              <span class="font-semibold">告警标签被遮挡</span>
            </div>
            <p class="text-sm text-blue-100">照片中告警标签被移动端截图遮挡，需施工经理复核</p>
          </div>
          <div class="p-4 bg-white/10 rounded-xl backdrop-blur-sm">
            <div class="flex items-center mb-2">
              <div class="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center mr-3">
                <Edit3 class="w-5 h-5" />
              </div>
              <span class="font-semibold">旧口径补录</span>
            </div>
            <p class="text-sm text-blue-100">使用旧口径标准（英尺），需人工修正为公制单位</p>
          </div>
        </div>
      </div>

      <div class="grid lg:grid-cols-3 gap-6">
        <div
          v-for="record in records"
          :key="record.id"
          class="bg-gradient-to-br border-2 rounded-2xl overflow-hidden transition-all hover:shadow-xl group"
          :class="typeColors[record.type]"
        >
          <div class="p-6">
            <div class="flex items-start justify-between mb-4">
              <div class="flex items-center">
                <div
                  class="w-12 h-12 rounded-xl flex items-center justify-center text-white mr-4 shadow-lg"
                  :class="typeAccent[record.type]"
                >
                  <component :is="typeIcons[record.type]" class="w-6 h-6" />
                </div>
                <div>
                  <h3 class="text-lg font-bold text-[#1e3a5f]">{{ record.typeLabel }}</h3>
                  <p class="text-sm font-mono text-slate-500">{{ record.code }}</p>
                </div>
              </div>
              <StatusBadge :status="record.status" size="sm" />
            </div>

            <p class="text-sm text-slate-600 mb-4">{{ record.description }}</p>

            <div class="p-4 bg-white/50 rounded-xl mb-4">
              <h4 class="text-sm font-medium text-slate-700 mb-2 flex items-center">
                <History class="w-4 h-4 mr-2" />
                处理历史
              </h4>
              <div class="max-h-40 overflow-auto">
                <HistoryTimeline :logs="record.historyLogs" />
              </div>
            </div>

            <div v-if="record.safetyReport" class="p-4 bg-white rounded-xl mb-4 border border-slate-200">
              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-500">安全距离结果</span>
                <span
                  class="px-3 py-1 rounded-full text-sm font-medium"
                  :class="record.safetyReport.isSafe ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
                >
                  {{ record.safetyReport.isSafe ? '安全' : '不安全' }}
                </span>
              </div>
              <div class="mt-2 flex items-end gap-1">
                <span class="text-2xl font-bold text-[#1e3a5f]">{{ record.safetyReport.minDistance }}</span>
                <span class="text-sm text-slate-500 mb-1">米</span>
                <span class="text-sm text-slate-400 mx-2">/</span>
                <span class="text-lg font-semibold text-slate-600">{{ record.safetyReport.requiredDistance }}</span>
                <span class="text-sm text-slate-500 mb-1">米标准</span>
              </div>
            </div>

            <div class="flex gap-3">
              <button
                class="flex-1 flex items-center justify-center px-4 py-2.5 bg-[#1e3a5f] text-white rounded-xl hover:bg-[#2a4a72] transition-colors font-medium group-hover:shadow-lg"
                @click="startWorkflow(record.id)"
              >
                <Play class="w-5 h-5 mr-2" />
                {{ record.status === 'pending' ? '开始处理' : record.status === 'pending-manager' ? '查看复核' : '继续处理' }}
              </button>
              <button
                class="px-4 py-2.5 bg-white text-slate-600 rounded-xl hover:bg-slate-100 transition-colors border border-slate-200"
                @click="resetRecord(record.id)"
                title="重置此记录"
              >
                <RotateCcw class="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
