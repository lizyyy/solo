<script setup lang="ts">
import { Shield, FileCheck, AlertTriangle } from 'lucide-vue-next';
import type { CadLayer } from '@/types';
import { validateAllCadLayers } from '@/utils/validation';
import { computed } from 'vue';

interface Props {
  layers: CadLayer[];
}

const props = defineProps<Props>();

const errors = computed(() => validateAllCadLayers(props.layers));
const allValid = computed(() => errors.value.length === 0);
const totalObjects = computed(() => props.layers.reduce((sum, l) => sum + l.objectCount, 0));
</script>

<template>
  <div class="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-6">
    <div class="flex items-center mb-6">
      <div class="p-3 bg-white rounded-lg shadow-sm border border-slate-200 mr-4">
        <Shield class="w-8 h-8 text-[#1e3a5f]" />
      </div>
      <div>
        <h3 class="text-xl font-bold text-[#1e3a5f]">图层验证面板</h3>
        <p class="text-sm text-slate-500">检查 CAD 图层命名规范和数据完整性</p>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="bg-white rounded-lg p-4 border border-slate-200">
        <div class="text-3xl font-bold text-[#1e3a5f]">{{ layers.length }}</div>
        <div class="text-sm text-slate-500 mt-1">图层总数</div>
      </div>
      <div class="bg-white rounded-lg p-4 border border-slate-200">
        <div class="text-3xl font-bold text-blue-600">{{ totalObjects }}</div>
        <div class="text-sm text-slate-500 mt-1">对象总数</div>
      </div>
      <div class="bg-white rounded-lg p-4 border border-slate-200">
        <div
          class="text-3xl font-bold"
          :class="allValid ? 'text-green-600' : 'text-red-600'"
        >
          {{ allValid ? '通过' : '失败' }}
        </div>
        <div class="text-sm text-slate-500 mt-1">验证结果</div>
      </div>
    </div>

    <div class="space-y-3">
      <div
        class="flex items-start p-3 rounded-lg"
        :class="allValid ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'"
      >
        <FileCheck
          v-if="allValid"
          class="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0"
        />
        <AlertTriangle
          v-else
          class="w-5 h-5 text-amber-600 mr-3 mt-0.5 flex-shrink-0"
        />
        <div>
          <p
            class="font-medium text-sm"
            :class="allValid ? 'text-green-800' : 'text-amber-800'"
          >
            {{ allValid ? '图层验证通过' : '需要注意以下问题' }}
          </p>
          <p
            class="text-sm mt-1"
            :class="allValid ? 'text-green-700' : 'text-amber-700'"
          >
            {{ allValid
              ? `所有 ${layers.length} 个图层名称符合规范，可以继续下一步`
              : `检测到 ${errors.length} 个问题，请检查图层名称格式`
            }}
          </p>
        </div>
      </div>
    </div>

    <div class="mt-4 p-4 bg-white rounded-lg border border-slate-200">
      <h4 class="text-sm font-medium text-slate-700 mb-2">命名规范说明</h4>
      <ul class="text-xs text-slate-600 space-y-1">
        <li class="flex items-center">
          <span class="w-1.5 h-1.5 bg-[#1e3a5f] rounded-full mr-2"></span>
          必须以大写字母或下划线开头
        </li>
        <li class="flex items-center">
          <span class="w-1.5 h-1.5 bg-[#1e3a5f] rounded-full mr-2"></span>
          只能包含大写字母、数字和下划线
        </li>
        <li class="flex items-center">
          <span class="w-1.5 h-1.5 bg-[#1e3a5f] rounded-full mr-2"></span>
          建议使用有意义的英文名称，便于理解
        </li>
      </ul>
    </div>
  </div>
</template>
