<script setup lang="ts">
import { computed } from 'vue';
import { Shield, AlertTriangle, CheckCircle, XCircle, Target, Waves, TrendingDown, FileText, Clock } from 'lucide-vue-next';
import type { SafetyReport, WorkflowRecord } from '@/types';
import { formatDateTime } from '@/utils/formatters';

interface Props {
  record: WorkflowRecord;
}

const props = defineProps<Props>();

const report = computed(() => props.record.safetyReport as SafetyReport);
</script>

<template>
  <div class="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
    <div
      class="p-6"
      :class="report.isSafe ? 'bg-gradient-to-r from-green-50 to-emerald-50' : 'bg-gradient-to-r from-red-50 to-orange-50'"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <div
            class="p-3 rounded-xl mr-4"
            :class="report.isSafe ? 'bg-green-100' : 'bg-red-100'"
          >
            <Shield
              class="w-8 h-8"
              :class="report.isSafe ? 'text-green-600' : 'text-red-600'"
            />
          </div>
          <div>
            <h3 class="text-xl font-bold text-[#1e3a5f]">安全距离报告</h3>
            <p class="text-sm text-slate-500">记录编号：{{ record.code }}</p>
          </div>
        </div>
        <div
          class="px-4 py-2 rounded-lg font-semibold text-lg"
          :class="report.isSafe ? 'bg-green-500 text-white' : 'bg-red-500 text-white'"
        >
          <span class="flex items-center">
            <CheckCircle v-if="report.isSafe" class="w-5 h-5 mr-2" />
            <XCircle v-else class="w-5 h-5 mr-2" />
            {{ report.isSafe ? '安全' : '不安全' }}
          </span>
        </div>
      </div>
    </div>

    <div class="p-6 space-y-6">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="p-4 bg-slate-50 rounded-lg">
          <div class="flex items-center text-sm text-slate-500 mb-2">
            <Target class="w-4 h-4 mr-1" />
            最小距离
          </div>
          <div
            class="text-2xl font-bold"
            :class="report.isSafe ? 'text-green-600' : 'text-red-600'"
          >
            {{ report.minDistance }} <span class="text-sm font-normal">米</span>
          </div>
        </div>
        <div class="p-4 bg-slate-50 rounded-lg">
          <div class="flex items-center text-sm text-slate-500 mb-2">
            <Shield class="w-4 h-4 mr-1" />
            安全标准
          </div>
          <div class="text-2xl font-bold text-[#1e3a5f]">
            {{ report.requiredDistance }} <span class="text-sm font-normal">米</span>
          </div>
        </div>
        <div class="p-4 bg-slate-50 rounded-lg">
          <div class="flex items-center text-sm text-slate-500 mb-2">
            <Waves class="w-4 h-4 mr-1" />
            声程长度
          </div>
          <div class="text-2xl font-bold text-blue-600">
            {{ report.calculationDetails.soundPathLength }} <span class="text-sm font-normal">米</span>
          </div>
        </div>
        <div class="p-4 bg-slate-50 rounded-lg">
          <div class="flex items-center text-sm text-slate-500 mb-2">
            <TrendingDown class="w-4 h-4 mr-1" />
            衰减率
          </div>
          <div class="text-2xl font-bold text-purple-600">
            {{ report.calculationDetails.decayRate }}
          </div>
        </div>
      </div>

      <div class="p-4 bg-slate-50 rounded-lg">
        <h4 class="text-sm font-medium text-slate-700 mb-3 flex items-center">
          <FileText class="w-4 h-4 mr-2" />
          计算详情
        </h4>
        <div class="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span class="text-slate-500">反射点数：</span>
            <span class="font-medium text-[#1e3a5f]">{{ report.calculationDetails.reflectionPoints }}</span>
          </div>
          <div>
            <span class="text-slate-500">报告版本：</span>
            <span class="font-medium text-[#1e3a5f] font-mono">{{ report.version }}</span>
          </div>
          <div class="flex items-center">
            <Clock class="w-4 h-4 mr-1 text-slate-400" />
            <span class="text-slate-500">生成时间：</span>
            <span class="font-medium text-[#1e3a5f] ml-1">{{ formatDateTime(report.generatedAt) }}</span>
          </div>
        </div>
      </div>

      <div v-if="report.warnings.length > 0" class="space-y-2">
        <h4 class="text-sm font-medium text-slate-700 flex items-center">
          <AlertTriangle class="w-4 h-4 mr-2 text-amber-500" />
          警告信息 ({{ report.warnings.length }})
        </h4>
        <div
          v-for="(warning, index) in report.warnings"
          :key="index"
          class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800"
        >
          {{ warning }}
        </div>
      </div>

      <div v-if="record.corrections.length > 0" class="p-4 bg-purple-50 rounded-lg border border-purple-200">
        <h4 class="text-sm font-medium text-purple-800 mb-2">数据修正记录</h4>
        <div
          v-for="correction in record.corrections"
          :key="correction.id"
          class="text-sm text-purple-700"
        >
          <p>
            <span class="font-medium">修正人：</span>{{ correction.operator }}
          </p>
          <p>
            <span class="font-medium">数据变化：</span>
            {{ correction.oldDistance }} {{ correction.oldCaliber }} → {{ correction.newDistance }} {{ correction.newCaliber }}
          </p>
          <p>
            <span class="font-medium">原因：</span>{{ correction.reason }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
