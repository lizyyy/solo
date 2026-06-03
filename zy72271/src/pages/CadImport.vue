<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ArrowLeft, ArrowRight, Upload, CheckCircle2 } from 'lucide-vue-next';
import { useWorkflowStore } from '@/stores/workflow';
import { useNotificationStore } from '@/stores/notification';
import StepProgress from '@/components/layout/StepProgress.vue';
import LayerTable from '@/components/cad/LayerTable.vue';
import ValidationPanel from '@/components/cad/ValidationPanel.vue';
import { validateAllCadLayers } from '@/utils/validation';

const router = useRouter();
const route = useRoute();
const workflowStore = useWorkflowStore();
const notificationStore = useNotificationStore();

const recordId = computed(() => route.params.recordId as string);
const record = computed(() => workflowStore.getRecordById(recordId.value));
const cadLayers = computed(() => record.value?.cadLayers || []);
const errors = computed(() => validateAllCadLayers(cadLayers.value));
const allValid = computed(() => errors.value.length === 0);

onMounted(() => {
  if (!record.value) {
    notificationStore.addNotification('error', '未找到该记录');
    router.push('/');
  }
});

const goBack = () => {
  router.push('/');
};

const handleImport = () => {
  if (!allValid.value) {
    notificationStore.addNotification('error', '存在验证错误，请先修复图层问题');
    return;
  }
  workflowStore.completeCadImport(recordId.value);
  notificationStore.addNotification('success', `CAD图层导入成功，共 ${cadLayers.value.length} 个图层`);
  router.push(`/rangefinder/${recordId.value}`);
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
                步骤 1 / 3：CAD 图层导入
              </h1>
              <p class="text-sm text-slate-500">{{ record.code }} - {{ record.typeLabel }}</p>
            </div>
          </div>
          <div class="w-64">
            <StepProgress :current-step="0" />
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-6 py-8">
      <div class="grid lg:grid-cols-3 gap-8">
        <div class="lg:col-span-2 space-y-6">
          <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-lg font-semibold text-[#1e3a5f] flex items-center">
                <Upload class="w-5 h-5 mr-2 text-blue-500" />
                导入 CAD 图层文件
              </h2>
              <button
                class="flex items-center px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
                @click="notificationStore.addNotification('info', 'CAD图层文件已自动加载')"
              >
                <Upload class="w-4 h-4 mr-2" />
                模拟导入文件
              </button>
            </div>
            <LayerTable :layers="cadLayers" />
          </div>

          <div class="flex justify-end gap-4">
            <button
              class="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-colors font-medium"
              @click="goBack"
            >
              返回首页
            </button>
            <button
              class="flex items-center px-6 py-3 bg-[#1e3a5f] text-white rounded-xl hover:bg-[#2a4a72] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!allValid"
              @click="handleImport"
            >
              <CheckCircle2 class="w-5 h-5 mr-2" />
              验证通过，进入下一步
              <ArrowRight class="w-5 h-5 ml-2" />
            </button>
          </div>
        </div>

        <div class="space-y-6">
          <ValidationPanel :layers="cadLayers" />
          
          <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 class="text-lg font-semibold text-[#1e3a5f] mb-4">操作说明</h3>
            <div class="space-y-3 text-sm text-slate-600">
              <div class="flex items-start">
                <span class="w-6 h-6 bg-[#1e3a5f] text-white rounded-full flex items-center justify-center text-xs mr-3 flex-shrink-0">1</span>
                <p>系统自动加载预置的 CAD 图层数据，包含反射点、座位区、舞台边界等图层</p>
              </div>
              <div class="flex items-start">
                <span class="w-6 h-6 bg-[#1e3a5f] text-white rounded-full flex items-center justify-center text-xs mr-3 flex-shrink-0">2</span>
                <p>验证每个图层的命名规范是否符合要求（大写字母、数字、下划线）</p>
              </div>
              <div class="flex items-start">
                <span class="w-6 h-6 bg-[#1e3a5f] text-white rounded-full flex items-center justify-center text-xs mr-3 flex-shrink-0">3</span>
                <p>全部验证通过后，点击"验证通过，进入下一步"按钮</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
