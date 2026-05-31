<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Edit3,
  Save
} from 'lucide-vue-next';
import type { GateStepResult, GateJudgment } from '@/types/gate';
import { JUDGMENT_RESULT_LABELS } from '@/types/gate';
import StatusBadge from '@/components/common/StatusBadge.vue';
import ReasonCard from './ReasonCard.vue';
import { formatDuration } from '@/utils/time';

interface Props {
  stepResult: GateStepResult;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'updateJudgment', updates: Partial<GateJudgment>): void;
}>();

const expanded = ref(true);
const isEditing = ref(false);
const editReason = ref('');
const editNextStep = ref('');

const judgment = computed(() => props.stepResult.judgment);
const operation = computed(() => props.stepResult.operation);

const resultColor = computed(() => {
  if (!judgment.value) return 'text-gray-500';
  switch (judgment.value.result) {
    case 'pass': return 'text-success';
    case 'fail': return 'text-danger';
    case 'pending': return 'text-warning';
    default: return 'text-gray-500';
  }
});

const resultBgColor = computed(() => {
  if (!judgment.value) return 'bg-gray-50 border-gray-200';
  switch (judgment.value.result) {
    case 'pass': return 'bg-success-50 border-success-200';
    case 'fail': return 'bg-danger-50 border-danger-200';
    case 'pending': return 'bg-warning-50 border-warning-200';
    default: return 'bg-gray-50 border-gray-200';
  }
});

function startEdit() {
  if (judgment.value) {
    editReason.value = judgment.value.teachingReason;
    editNextStep.value = judgment.value.nextStep;
    isEditing.value = true;
  }
}

function saveEdit() {
  emit('updateJudgment', {
    teachingReason: editReason.value,
    nextStep: editNextStep.value,
    isFinal: true
  });
  isEditing.value = false;
}

function setResult(result: 'pass' | 'fail' | 'pending') {
  emit('updateJudgment', { result, isFinal: true });
}
</script>

<template>
  <div class="bg-white rounded-xl border border-gray-200 overflow-hidden transition-all hover:shadow-md">
    <div
      class="p-4 cursor-pointer"
      :class="resultBgColor()"
      @click="expanded = !expanded"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-white/80 flex items-center justify-center">
            <CheckCircle v-if="judgment?.result === 'pass'" class="w-5 h-5 text-success" />
            <XCircle v-else-if="judgment?.result === 'fail'" class="w-5 h-5 text-danger" />
            <Clock v-else-if="judgment?.result === 'pending'" class="w-5 h-5 text-warning animate-pulse" />
            <AlertTriangle v-else class="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-primary-600">步骤{{ stepResult.step.order }}</span>
              <StatusBadge type="step-status" :value="stepResult.status" size="sm" />
            </div>
            <h3 class="font-semibold text-gray-900">{{ stepResult.step.name }}</h3>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <div v-if="judgment" class="text-right">
            <div class="text-2xl font-bold" :class="resultColor()">
              {{ judgment.score }}
              <span class="text-sm text-gray-400">/{{ judgment.maxScore }}</span>
            </div>
            <StatusBadge type="judgment-result" :value="judgment.result" size="sm" />
          </div>
          <component :is="expanded ? ChevronUp : ChevronDown" class="w-5 h-5 text-gray-400" />
        </div>
      </div>
    </div>

    <div v-show="expanded" class="p-4 border-t border-gray-100 animate-slide-in">
      <div v-if="operation" class="mb-4 p-3 bg-gray-50 rounded-lg">
        <div class="text-sm font-medium text-gray-700 mb-2">操作记录</div>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span class="text-gray-500">操作时长:</span>
            <span class="ml-2 font-medium text-gray-900">{{ formatDuration(operation.duration * 1000) }}</span>
          </div>
          <div v-for="(value, key) in operation.parameters" :key="key">
            <span class="text-gray-500">{{ key }}:</span>
            <span class="ml-2 font-medium text-gray-900">{{ value }}</span>
          </div>
        </div>
      </div>

      <div v-if="judgment" class="space-y-4">
        <div v-if="judgment.reasons.length > 0">
          <div class="text-sm font-medium text-gray-700 mb-2">判断依据</div>
          <div class="space-y-2">
            <ReasonCard
              v-for="reason in judgment.reasons"
              :key="reason.id"
              :reason="reason"
            />
          </div>
        </div>

        <div class="border-t border-gray-100 pt-4">
          <div class="flex items-center justify-between mb-2">
            <div class="text-sm font-medium text-gray-700">教研说明</div>
            <button
              v-if="!isEditing"
              class="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
              @click.stop="startEdit"
            >
              <Edit3 class="w-3 h-3" />
              编辑
            </button>
          </div>

          <div v-if="isEditing" class="space-y-3">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">原因分析</label>
              <textarea
                v-model="editReason"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                rows="3"
                placeholder="请输入原因分析..."
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">下一步建议</label>
              <textarea
                v-model="editNextStep"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                rows="2"
                placeholder="请输入下一步建议..."
              />
            </div>
            <div class="flex gap-2">
              <button
                class="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors flex items-center gap-1"
                @click.stop="saveEdit"
              >
                <Save class="w-4 h-4" />
                保存
              </button>
              <button
                class="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                @click.stop="isEditing = false"
              >
                取消
              </button>
            </div>
          </div>

          <div v-else class="space-y-3">
            <div class="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div class="text-sm font-medium text-amber-800 mb-1">原因分析</div>
              <p class="text-sm text-amber-900">{{ judgment.teachingReason }}</p>
            </div>
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div class="text-sm font-medium text-blue-800 mb-1">下一步建议</div>
              <p class="text-sm text-blue-900">{{ judgment.nextStep }}</p>
            </div>
          </div>
        </div>

        <div v-if="judgment.result === 'pending'" class="border-t border-gray-100 pt-4">
          <div class="text-sm font-medium text-gray-700 mb-2">人工确认结果</div>
          <div class="flex gap-2">
            <button
              class="flex-1 py-2 bg-success-50 border border-success-200 text-success rounded-lg font-medium hover:bg-success-100 transition-colors flex items-center justify-center gap-2"
              @click.stop="setResult('pass')"
            >
              <CheckCircle class="w-4 h-4" />
              通过
            </button>
            <button
              class="flex-1 py-2 bg-danger-50 border border-danger-200 text-danger rounded-lg font-medium hover:bg-danger-100 transition-colors flex items-center justify-center gap-2"
              @click.stop="setResult('fail')"
            >
              <XCircle class="w-4 h-4" />
              不通过
            </button>
          </div>
        </div>

        <div class="text-xs text-gray-400 font-mono bg-gray-50 p-2 rounded">
          <div class="font-medium text-gray-500 mb-1">原始判断数据（仅技术人员查看）</div>
          {{ judgment.rawReason }}
        </div>
      </div>

      <div v-else class="text-center py-8 text-gray-500">
        <Clock class="w-12 h-12 mx-auto mb-2 text-gray-300" />
        <p>暂无判断结果</p>
      </div>
    </div>
  </div>
</template>
