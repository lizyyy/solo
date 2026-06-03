<script setup lang="ts">
import { CheckCircle, XCircle, Layers } from 'lucide-vue-next';
import type { CadLayer } from '@/types';
import { validateAllCadLayers } from '@/utils/validation';
import { computed } from 'vue';

interface Props {
  layers: CadLayer[];
}

const props = defineProps<Props>();

const errors = computed(() => validateAllCadLayers(props.layers));
const allValid = computed(() => errors.value.length === 0);
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold text-[#1e3a5f] flex items-center">
        <Layers class="w-5 h-5 mr-2" />
        CAD 图层列表
      </h3>
      <span
        class="px-3 py-1 text-sm font-medium rounded"
        :class="allValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
      >
        {{ allValid ? '全部验证通过' : `存在 ${errors.length} 个问题` }}
      </span>
    </div>

    <div class="overflow-x-auto border border-slate-200 rounded-lg">
      <table class="w-full text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-4 py-3 text-left font-medium text-slate-600 border-b">图层名称</th>
            <th class="px-4 py-3 text-left font-medium text-slate-600 border-b">颜色标识</th>
            <th class="px-4 py-3 text-left font-medium text-slate-600 border-b">对象数量</th>
            <th class="px-4 py-3 text-left font-medium text-slate-600 border-b">验证状态</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="layer in layers"
            :key="layer.id"
            class="border-b border-slate-100 hover:bg-slate-50 transition-colors"
          >
            <td class="px-4 py-3 font-mono text-slate-800">{{ layer.name }}</td>
            <td class="px-4 py-3">
              <div class="flex items-center">
                <div
                  class="w-5 h-5 rounded border border-slate-300 mr-2"
                  :style="{ backgroundColor: layer.color }"
                ></div>
                <span class="text-slate-600 font-mono text-xs">{{ layer.color }}</span>
              </div>
            </td>
            <td class="px-4 py-3 text-slate-600">{{ layer.objectCount }}</td>
            <td class="px-4 py-3">
              <div class="flex items-center">
                <CheckCircle
                  v-if="layer.isValid"
                  class="w-5 h-5 text-green-500 mr-1"
                />
                <XCircle
                  v-else
                  class="w-5 h-5 text-red-500 mr-1"
                />
                <span
                  class="text-sm"
                  :class="layer.isValid ? 'text-green-600' : 'text-red-600'"
                >
                  {{ layer.isValid ? '通过' : '失败' }}
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="errors.length > 0" class="space-y-2">
      <h4 class="text-sm font-medium text-red-700">验证错误：</h4>
      <div
        v-for="(error, index) in errors"
        :key="index"
        class="p-3 bg-red-50 border border-red-200 rounded-lg"
      >
        <p class="text-sm text-red-700 font-medium">{{ error.message }}</p>
        <p class="text-xs text-red-600 mt-1">建议：{{ error.suggestion }}</p>
      </div>
    </div>
  </div>
</template>
