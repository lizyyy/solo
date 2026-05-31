<script setup lang="ts">
import { computed } from 'vue';
import {
  BookOpen,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Award,
  User
} from 'lucide-vue-next';
import type { GateSession, GateStepResult } from '@/types/gate';
import { GATE_STEP_STATUS_LABELS, JUDGMENT_RESULT_LABELS } from '@/types/gate';
import { formatTimestamp, formatDuration } from '@/utils/time';
import StatusBadge from '@/components/common/StatusBadge.vue';

interface Props {
  session: GateSession;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'selectStep', stepId: string): void;
  (e: 'exportReport'): void;
}>();

const overallResult = computed(() => {
  const percent = props.session.maxScore > 0
    ? (props.session.totalScore / props.session.maxScore * 100)
    : 0;
  return {
    percent: percent.toFixed(1),
    passed: percent >= 60,
    label: percent >= 60 ? '通过' : '未通过'
  };
});

const problematicSteps = computed(() => {
  return props.session.steps.filter(s =>
    s.judgment?.result === 'fail' || s.status === 'error' || s.status === 'skipped'
  );
});

const pendingSteps = computed(() => {
  return props.session.steps.filter(s => s.judgment?.result === 'pending');
});
</script>

<template>
  <div class="bg-gradient-to-br from-primary-50 to-white rounded-xl border border-primary-100 p-6 animate-fade-in">
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
          <BookOpen class="w-6 h-6 text-primary-600" />
        </div>
        <div>
          <h2 class="text-xl font-semibold text-primary-900">教研视图</h2>
          <p class="text-sm text-primary-600">清晰易懂的评估结果，无需技术背景</p>
        </div>
      </div>
      <button
        class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium flex items-center gap-2"
        @click="emit('exportReport')"
      >
        <Award class="w-4 h-4" />
        导出评估报告
      </button>
    </div>

    <div class="bg-white rounded-xl border border-gray-100 p-6 mb-6">
      <div class="grid grid-cols-4 gap-6">
        <div class="text-center">
          <div class="text-sm text-gray-500 mb-1 flex items-center justify-center gap-1">
            <User class="w-4 h-4" />
            学员姓名
          </div>
          <div class="text-2xl font-bold text-gray-900">{{ session.studentName }}</div>
        </div>
        <div class="text-center">
          <div class="text-sm text-gray-500 mb-1 flex items-center justify-center gap-1">
            <Clock class="w-4 h-4" />
            考核时间
          </div>
          <div class="text-lg font-semibold text-gray-900">
            {{ formatTimestamp(session.startTime, 'YYYY-MM-DD') }}
          </div>
        </div>
        <div class="text-center">
          <div class="text-sm text-gray-500 mb-1">总得分</div>
          <div class="text-4xl font-bold text-primary-600">
            {{ session.totalScore }}
            <span class="text-lg text-gray-400">/{{ session.maxScore }}</span>
          </div>
        </div>
        <div class="text-center">
          <div class="text-sm text-gray-500 mb-1">综合结果</div>
          <div
            class="text-2xl font-bold"
            :class="overallResult.passed ? 'text-success' : 'text-danger'"
          >
            {{ overallResult.label }}
          </div>
          <div class="text-sm text-gray-500">得分率 {{ overallResult.percent }}%</div>
        </div>
      </div>

      <div class="mt-6 pt-6 border-t border-gray-100">
        <div class="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-1000"
            :class="overallResult.passed ? 'bg-success' : 'bg-danger'"
            :style="{ width: `${overallResult.percent}%` }"
          />
        </div>
      </div>
    </div>

    <div v-if="problematicSteps.length > 0" class="mb-6">
      <div class="flex items-center gap-2 mb-3">
        <AlertTriangle class="w-5 h-5 text-warning" />
        <h3 class="text-lg font-semibold text-gray-900">需要关注的问题</h3>
        <span class="px-2 py-0.5 bg-warning-100 text-warning text-xs font-medium rounded-full">
          {{ problematicSteps.length }} 项
        </span>
      </div>
      <div class="space-y-3">
        <div
          v-for="step in problematicSteps"
          :key="step.step.id"
          class="bg-white rounded-lg border border-warning-200 p-4 cursor-pointer hover:shadow-md transition-all"
          @click="emit('selectStep', step.step.id)"
        >
          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="text-sm font-medium text-primary-600">步骤{{ step.step.order }}</span>
                <StatusBadge type="step-status" :value="step.status" size="sm" />
                <StatusBadge
                  v-if="step.judgment"
                  type="judgment-result"
                  :value="step.judgment.result"
                  size="sm"
                />
              </div>
              <h4 class="font-semibold text-gray-900">{{ step.step.name }}</h4>
            </div>
            <ArrowRight class="w-5 h-5 text-gray-400" />
          </div>

          <div v-if="step.judgment" class="mt-3 space-y-2">
            <div class="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div class="text-sm font-medium text-amber-800 mb-1 flex items-center gap-1">
                <AlertTriangle class="w-4 h-4" />
                原因分析
              </div>
              <p class="text-sm text-amber-900">{{ step.judgment.teachingReason }}</p>
            </div>
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div class="text-sm font-medium text-blue-800 mb-1 flex items-center gap-1">
                <ArrowRight class="w-4 h-4" />
                下一步建议
              </div>
              <p class="text-sm text-blue-900">{{ step.judgment.nextStep }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="pendingSteps.length > 0" class="mb-6">
      <div class="flex items-center gap-2 mb-3">
        <Clock class="w-5 h-5 text-warning animate-pulse" />
        <h3 class="text-lg font-semibold text-gray-900">待人工确认</h3>
        <span class="px-2 py-0.5 bg-warning-100 text-warning text-xs font-medium rounded-full animate-pulse">
          {{ pendingSteps.length }} 项
        </span>
      </div>
      <div class="bg-warning-50 border border-warning-200 rounded-lg p-4">
        <p class="text-sm text-warning-800">
          以下步骤的自动判断结果需要人工确认，请培训老师仔细核对操作记录和视频证据后给出最终结论。
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            v-for="step in pendingSteps"
            :key="step.step.id"
            class="px-3 py-1.5 bg-white border border-warning-300 rounded-lg text-sm text-warning-800 hover:bg-warning-100 transition-colors"
            @click="emit('selectStep', step.step.id)"
          >
            步骤{{ step.step.order }}: {{ step.step.name }}
          </button>
        </div>
      </div>
    </div>

    <div>
      <div class="flex items-center gap-2 mb-3">
        <CheckCircle2 class="w-5 h-5 text-success" />
        <h3 class="text-lg font-semibold text-gray-900">各步骤评估详情</h3>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div
          v-for="step in session.steps"
          :key="step.step.id"
          class="bg-white rounded-lg border p-4 cursor-pointer hover:shadow-md transition-all"
          :class="{
            'border-success-200': step.judgment?.result === 'pass',
            'border-danger-200': step.judgment?.result === 'fail',
            'border-warning-200': step.judgment?.result === 'pending' || step.status === 'error' || step.status === 'skipped',
            'border-gray-200': step.status === 'pending'
          }"
          @click="emit('selectStep', step.step.id)"
        >
          <div class="flex items-start justify-between mb-2">
            <div>
              <span class="text-xs font-medium text-primary-600">步骤{{ step.step.order }}</span>
              <h4 class="font-medium text-gray-900">{{ step.step.name }}</h4>
            </div>
            <div v-if="step.judgment" class="text-right">
              <div class="text-xl font-bold" :class="{
                'text-success': step.judgment.result === 'pass',
                'text-danger': step.judgment.result === 'fail',
                'text-warning': step.judgment.result === 'pending'
              }">
                {{ step.judgment.score }}
                <span class="text-sm text-gray-400">/{{ step.judgment.maxScore }}</span>
              </div>
              <StatusBadge type="judgment-result" :value="step.judgment.result" size="sm" />
            </div>
            <div v-else>
              <StatusBadge type="step-status" :value="step.status" size="sm" />
            </div>
          </div>
          <p class="text-xs text-gray-500 line-clamp-2">{{ step.step.description }}</p>
          <div class="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              v-if="step.judgment"
              class="h-full rounded-full"
              :class="{
                'bg-success': step.judgment.result === 'pass',
                'bg-danger': step.judgment.result === 'fail',
                'bg-warning': step.judgment.result === 'pending'
              }"
              :style="{ width: `${(step.judgment.score / step.judgment.maxScore) * 100}%` }"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-if="session.endTime" class="mt-6 pt-4 border-t border-gray-100 text-center text-sm text-gray-500">
      考核用时：{{ formatDuration(session.endTime - session.startTime) }}
    </div>
  </div>
</template>
