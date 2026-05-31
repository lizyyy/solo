<script setup lang="ts">
import { computed } from 'vue';
import { Award, CheckCircle, XCircle, Clock, ChevronRight } from 'lucide-vue-next';
import type { GateSession, GateStepResult } from '@/types/gate';
import StatusBadge from '@/components/common/StatusBadge.vue';

interface Props {
  session: GateSession;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'selectStep', stepId: string): void;
}>();

const overallStats = computed(() => {
  const total = props.session.maxScore;
  const score = props.session.totalScore;
  const percent = total > 0 ? (score / total * 100) : 0;
  return {
    score,
    total,
    percent: percent.toFixed(1),
    passed: percent >= 60,
    grade: percent >= 90 ? '优秀' : percent >= 80 ? '良好' : percent >= 60 ? '及格' : '不及格'
  };
});

const getStepScoreClass = (step: GateStepResult) => {
  if (!step.judgment) return 'bg-gray-100 text-gray-400';
  const percent = step.judgment.score / step.judgment.maxScore * 100;
  if (percent >= 80) return 'bg-success text-white';
  if (percent >= 60) return 'bg-warning text-white';
  return 'bg-danger text-white';
};
</script>

<template>
  <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
    <div class="p-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            <Award class="w-6 h-6" />
          </div>
          <div>
            <h3 class="text-lg font-semibold">评分表</h3>
            <p class="text-sm text-white/80">{{ session.studentName }} 的考核评分</p>
          </div>
        </div>
        <div class="text-right">
          <div class="text-4xl font-bold">
            {{ overallStats.score }}
            <span class="text-xl text-white/60">/{{ overallStats.total }}</span>
          </div>
          <div class="text-sm text-white/80">
            得分率 {{ overallStats.percent }}% · {{ overallStats.grade }}
          </div>
        </div>
      </div>

      <div class="mt-4 h-2 bg-white/20 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-1000"
          :class="overallStats.passed ? 'bg-success' : 'bg-danger'"
          :style="{ width: `${overallStats.percent}%` }"
        />
      </div>
    </div>

    <div class="divide-y divide-gray-100">
      <div
        v-for="step in session.steps"
        :key="step.step.id"
        class="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
        @click="emit('selectStep', step.step.id)"
      >
        <div class="flex items-center gap-4">
          <div
            class="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
            :class="getStepScoreClass(step)"
          >
            <span v-if="step.judgment">{{ step.judgment.score }}</span>
            <Clock v-else class="w-4 h-4" />
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs font-medium text-primary-600">步骤{{ step.step.order }}</span>
              <StatusBadge
                v-if="step.judgment"
                type="judgment-result"
                :value="step.judgment.result"
                size="sm"
              />
              <StatusBadge
                v-else
                type="step-status"
                :value="step.status"
                size="sm"
              />
            </div>
            <h4 class="font-medium text-gray-900 truncate">{{ step.step.name }}</h4>
            <p class="text-xs text-gray-500 line-clamp-1">{{ step.step.description }}</p>
          </div>

          <div class="text-right">
            <div v-if="step.judgment" class="text-sm">
              <span class="font-bold text-gray-900">{{ step.judgment.score }}</span>
              <span class="text-gray-400">/{{ step.judgment.maxScore }}</span>
            </div>
            <div v-else class="text-sm text-gray-400">
              -/{{ step.step.maxScore }}
            </div>
          </div>

          <ChevronRight class="w-5 h-5 text-gray-400" />
        </div>

        <div v-if="step.judgment" class="mt-2">
          <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
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

    <div class="p-4 bg-gray-50 border-t border-gray-100">
      <div class="flex items-center justify-between text-sm">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-1.5">
            <CheckCircle class="w-4 h-4 text-success" />
            <span class="text-gray-600">
              通过 {{ session.steps.filter(s => s.judgment?.result === 'pass').length }}
            </span>
          </div>
          <div class="flex items-center gap-1.5">
            <XCircle class="w-4 h-4 text-danger" />
            <span class="text-gray-600">
              未通过 {{ session.steps.filter(s => s.judgment?.result === 'fail').length }}
            </span>
          </div>
          <div class="flex items-center gap-1.5">
            <Clock class="w-4 h-4 text-warning" />
            <span class="text-gray-600">
              待确认 {{ session.steps.filter(s => s.judgment?.result === 'pending' || !s.judgment).length }}
            </span>
          </div>
        </div>
        <div class="text-gray-500">
          异常 {{ session.abnormalCount }} 项
        </div>
      </div>
    </div>
  </div>
</template>
