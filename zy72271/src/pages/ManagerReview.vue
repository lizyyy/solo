<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, Check, X, AlertTriangle, Eye, User } from 'lucide-vue-next';
import { useWorkflowStore } from '@/stores/workflow';
import { useNotificationStore } from '@/stores/notification';
import PhotoPreview from '@/components/rangefinder/PhotoPreview.vue';
import HistoryTimeline from '@/components/common/HistoryTimeline.vue';
import type { ReviewResult } from '@/types';

const router = useRouter();
const workflowStore = useWorkflowStore();
const notificationStore = useNotificationStore();

const pendingRecords = computed(() => workflowStore.getPendingReviewRecords());
const selectedRecordId = ref<string | null>(pendingRecords.value[0]?.id || null);
const selectedRecord = computed(() => pendingRecords.value.find(r => r.id === selectedRecordId.value));
const reviewComment = ref('');
const isProcessing = ref(false);

const goBack = () => {
  router.push('/');
};

const selectRecord = (id: string) => {
  selectedRecordId.value = id;
  reviewComment.value = '';
};

const processReview = async (result: ReviewResult) => {
  if (!selectedRecordId.value || isProcessing.value) return;
  
  isProcessing.value = true;
  await new Promise(resolve => setTimeout(resolve, 500));
  
  workflowStore.processManagerReview(selectedRecordId.value, result, reviewComment.value);
  
  if (result === 'approved') {
    notificationStore.addNotification('success', '复核通过，记录已返回处理流程');
  } else {
    notificationStore.addNotification('warning', '复核驳回，请重新处理');
  }
  
  reviewComment.value = '';
  isProcessing.value = false;
  
  if (pendingRecords.value.length > 0) {
    selectedRecordId.value = pendingRecords.value[0].id;
  } else {
    selectedRecordId.value = null;
  }
};

const continueProcessing = (recordId: string) => {
  router.push(`/rangefinder/${recordId}`);
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
                施工经理复核
              </h1>
              <p class="text-sm text-slate-500">审核告警标签被遮挡的测距记录</p>
            </div>
          </div>
          <div class="flex items-center px-4 py-2 bg-amber-50 text-amber-700 rounded-lg border border-amber-200">
            <User class="w-5 h-5 mr-2" />
            当前角色：施工经理
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-6 py-8">
      <div class="grid lg:grid-cols-3 gap-8">
        <div class="lg:col-span-1">
          <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div class="p-4 bg-amber-50 border-b border-amber-200">
              <h3 class="font-semibold text-amber-800 flex items-center">
                <AlertTriangle class="w-5 h-5 mr-2" />
                待复核记录 ({{ pendingRecords.length }})
              </h3>
            </div>
            <div class="divide-y divide-slate-100">
              <div
                v-for="record in pendingRecords"
                :key="record.id"
                class="p-4 cursor-pointer transition-colors hover:bg-slate-50"
                :class="selectedRecordId === record.id ? 'bg-blue-50' : ''"
                @click="selectRecord(record.id)"
              >
                <div class="flex items-center justify-between mb-1">
                  <span class="font-mono text-sm font-medium text-[#1e3a5f]">{{ record.code }}</span>
                  <span class="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded">待复核</span>
                </div>
                <p class="text-sm text-slate-600">{{ record.description }}</p>
              </div>
              <div v-if="pendingRecords.length === 0" class="p-8 text-center text-slate-500">
                <Check class="w-12 h-12 mx-auto mb-2 text-green-400" />
                <p>暂无待复核记录</p>
              </div>
            </div>
          </div>
        </div>

        <div class="lg:col-span-2" v-if="selectedRecord">
          <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-lg font-semibold text-[#1e3a5f]">{{ selectedRecord.code }}</h2>
                <p class="text-sm text-slate-500">{{ selectedRecord.typeLabel }}</p>
              </div>
              <span class="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium">
                等待复核
              </span>
            </div>

            <div class="p-4 bg-orange-50 border border-orange-200 rounded-xl">
              <div class="flex items-start">
                <AlertTriangle class="w-6 h-6 text-orange-500 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 class="font-semibold text-orange-800 mb-1">复核说明</h4>
                  <p class="text-sm text-orange-700">
                    此记录的测距照片中红色告警标签被移动端截图遮挡，请仔细检查照片内容，
                    确认是否为有效测量记录。如确认无误请点击"复核通过"，如有问题请"驳回"。
                  </p>
                </div>
              </div>
            </div>

            <div class="grid md:grid-cols-2 gap-6">
              <div>
                <h4 class="text-sm font-medium text-slate-700 mb-3">遮挡照片（待复核）</h4>
                <PhotoPreview :record="selectedRecord.rangefinderRecords[0]" />
              </div>
              <div>
                <h4 class="text-sm font-medium text-slate-700 mb-3">处理历史</h4>
                <div class="bg-slate-50 rounded-xl p-4 max-h-80 overflow-auto">
                  <HistoryTimeline :logs="selectedRecord.historyLogs" />
                </div>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">
                复核意见
              </label>
              <textarea
                v-model="reviewComment"
                rows="3"
                class="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#1e3a5f] focus:border-[#1e3a5f] outline-none resize-none"
                placeholder="请输入复核意见（选填）..."
              ></textarea>
            </div>

            <div class="flex gap-4">
              <button
                class="flex-1 flex items-center justify-center px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
                :disabled="isProcessing"
                @click="processReview('rejected')"
              >
                <X class="w-5 h-5 mr-2" />
                驳回复核
              </button>
              <button
                class="flex-1 flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
                :disabled="isProcessing"
                @click="processReview('approved')"
              >
                <Check class="w-5 h-5 mr-2" />
                复核通过
              </button>
              <button
                class="flex items-center justify-center px-6 py-3 bg-[#1e3a5f] text-white rounded-xl hover:bg-[#2a4a72] transition-colors font-medium"
                @click="continueProcessing(selectedRecord.id)"
              >
                <Eye class="w-5 h-5 mr-2" />
                查看详情
              </button>
            </div>
          </div>
        </div>

        <div class="lg:col-span-2" v-else>
          <div class="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
            <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check class="w-10 h-10 text-green-600" />
            </div>
            <h3 class="text-xl font-semibold text-[#1e3a5f] mb-2">所有复核已完成</h3>
            <p class="text-slate-500 mb-6">当前没有需要复核的记录</p>
            <button
              class="px-6 py-3 bg-[#1e3a5f] text-white rounded-xl hover:bg-[#2a4a72] transition-colors font-medium"
              @click="goBack"
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
