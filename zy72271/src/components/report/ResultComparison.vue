<script setup lang="ts">
import { computed } from 'vue';
import { CheckCircle, AlertTriangle, Edit3, FileText, ArrowRight } from 'lucide-vue-next';
import type { WorkflowRecord } from '@/types';

interface Props {
  records: WorkflowRecord[];
}

const props = defineProps<Props>();

const typeIcons = {
  normal: CheckCircle,
  'blocked-warning': AlertTriangle,
  'old-caliber': Edit3,
};

const typeColors = {
  normal: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    accent: 'bg-green-500',
  },
  'blocked-warning': {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    accent: 'bg-orange-500',
  },
  'old-caliber': {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    accent: 'bg-purple-500',
  },
};

const getCompletedSteps = (record: WorkflowRecord) => {
  const steps = [];
  if (record.status !== 'pending') steps.push(0);
  if (record.status === 'under-review' || record.status === 'corrected' || record.status === 'report-generated' || record.status === 'pending-manager') steps.push(1);
  if (record.status === 'report-generated') steps.push(2);
  return steps;
};

const getStatusSummary = (record: WorkflowRecord) => {
  if (record.status === 'report-generated' && record.safetyReport) {
    return record.safetyReport.isSafe ? '安全' : '不安全';
  }
  return record.statusLabel;
};
</script>

<template>
  <div class="space-y-6">
    <div class="text-center mb-8">
      <h2 class="text-2xl font-bold text-[#1e3a5f] mb-2">三条记录处理结果对比</h2>
      <p class="text-slate-500">展示不同数据情况的处理流程和结果差异</p>
    </div>

    <div class="grid md:grid-cols-3 gap-6">
      <div
        v-for="record in records"
        :key="record.id"
        class="rounded-xl border-2 overflow-hidden transition-all hover:shadow-lg"
        :class="[typeColors[record.type].bg, typeColors[record.type].border]"
      >
        <div class="p-6 border-b" :class="typeColors[record.type].border">
          <div class="flex items-center mb-4">
            <div
              class="p-3 rounded-xl mr-4"
              :class="typeColors[record.type].accent + ' text-white'"
            >
              <component :is="typeIcons[record.type]" class="w-6 h-6" />
            </div>
            <div>
              <h3 class="font-bold text-lg text-[#1e3a5f]">{{ record.typeLabel }}</h3>
              <p class="text-sm text-slate-500 font-mono">{{ record.code }}</p>
            </div>
          </div>
          <p class="text-sm" :class="typeColors[record.type].text">{{ record.description }}</p>
        </div>

        <div class="p-6 space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-sm text-slate-500">处理状态</span>
            <span
              class="px-3 py-1 rounded-full text-sm font-medium"
              :class="record.safetyReport?.isSafe ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'"
            >
              {{ getStatusSummary(record) }}
            </span>
          </div>

          <div class="space-y-2">
            <div class="flex items-center text-sm">
              <div
                class="w-6 h-6 rounded-full flex items-center justify-center mr-2"
                :class="getCompletedSteps(record).includes(0) ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'"
              >
                <CheckCircle v-if="getCompletedSteps(record).includes(0)" class="w-4 h-4" />
                <span v-else class="text-xs">1</span>
              </div>
              <span :class="getCompletedSteps(record).includes(0) ? 'text-green-700' : 'text-slate-400'">
                CAD 图层导入
              </span>
            </div>
            <div class="flex items-center text-sm">
              <div
                class="w-6 h-6 rounded-full flex items-center justify-center mr-2"
                :class="getCompletedSteps(record).includes(1) ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'"
              >
                <CheckCircle v-if="getCompletedSteps(record).includes(1)" class="w-4 h-4" />
                <span v-else class="text-xs">2</span>
              </div>
              <span :class="getCompletedSteps(record).includes(1) ? 'text-green-700' : 'text-slate-400'">
                测距仪记录审核
              </span>
            </div>
            <div class="flex items-center text-sm">
              <div
                class="w-6 h-6 rounded-full flex items-center justify-center mr-2"
                :class="getCompletedSteps(record).includes(2) ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'"
              >
                <CheckCircle v-if="getCompletedSteps(record).includes(2)" class="w-4 h-4" />
                <span v-else class="text-xs">3</span>
              </div>
              <span :class="getCompletedSteps(record).includes(2) ? 'text-green-700' : 'text-slate-400'">
                安全距离报告
              </span>
            </div>
          </div>

          <div v-if="record.safetyReport" class="mt-4 p-4 bg-white rounded-lg border border-slate-200">
            <div class="flex items-center mb-2">
              <FileText class="w-4 h-4 mr-2 text-slate-400" />
              <span class="text-sm font-medium text-slate-700">报告结果</span>
            </div>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span class="text-slate-500">最小距离</span>
                <p class="font-bold text-[#1e3a5f]">{{ record.safetyReport.minDistance }} m</p>
              </div>
              <div>
                <span class="text-slate-500">安全标准</span>
                <p class="font-bold text-[#1e3a5f]">{{ record.safetyReport.requiredDistance }} m</p>
              </div>
            </div>
          </div>

          <div v-if="record.historyLogs.length > 1" class="text-sm text-slate-500">
            <p class="font-medium text-slate-600 mb-1">处理步骤数：{{ record.historyLogs.length }}</p>
            <ul class="space-y-1">
              <li
                v-for="log in record.historyLogs.slice(1)"
                :key="log.id"
                class="flex items-center"
              >
                <ArrowRight class="w-3 h-3 mr-1 text-slate-400" />
                {{ log.action }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div class="p-6 bg-slate-50 rounded-xl border border-slate-200">
      <h4 class="font-semibold text-[#1e3a5f] mb-4">三种处理路径对比说明</h4>
      <div class="grid md:grid-cols-3 gap-4 text-sm">
        <div class="p-4 bg-white rounded-lg border border-green-200">
          <h5 class="font-medium text-green-700 mb-2">顺利记录（绿色）</h5>
          <p class="text-slate-600">
            数据完整无误，三步流程直接走完，无需额外操作。安全距离 8.5 米，小于标准 10 米，结果为不安全。
          </p>
        </div>
        <div class="p-4 bg-white rounded-lg border border-orange-200">
          <h5 class="font-medium text-orange-700 mb-2">告警标签被遮挡（橙色）</h5>
          <p class="text-slate-600">
            照片中告警标签被移动端截图遮挡，需要标记异常后提交施工经理复核，复核通过后才能继续流程。
          </p>
        </div>
        <div class="p-4 bg-white rounded-lg border border-purple-200">
          <h5 class="font-medium text-purple-700 mb-2">旧口径补录（紫色）</h5>
          <p class="text-slate-600">
            数据使用旧的英制口径（英尺），需要人工转换为公制（米），修正后重跑计算，生成更新版本的报告。
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
