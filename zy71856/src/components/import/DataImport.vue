<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Upload,
  FileJson,
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock,
  Users,
  FileText,
  Trash2
} from 'lucide-vue-next';
import type { ImportPackage, ImportItem } from '@/types/import';
import { RECORD_TYPE_LABELS, IMPORT_STATUS_LABELS } from '@/types/import';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { formatTimestamp } from '@/utils/time';

interface Props {
  packages: ImportPackage[];
  isProcessing: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'fileSelected', file: File): void;
  (e: 'process', packageId: string): void;
  (e: 'select', packageId: string): void;
  (e: 'loadDemo'): void;
}>();

const isDragging = ref(false);
const selectedFile = ref<File | null>(null);

const stats = computed(() => {
  return {
    total: props.packages.length,
    done: props.packages.filter(p => p.status === 'done').length,
    processing: props.packages.filter(p => p.status === 'processing').length,
    error: props.packages.filter(p => p.status === 'error').length
  };
});

function handleDragOver(e: DragEvent) {
  e.preventDefault();
  isDragging.value = true;
}

function handleDragLeave() {
  isDragging.value = false;
}

function handleDrop(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;

  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    const file = files[0];
    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      selectedFile.value = file;
      emit('fileSelected', file);
    }
  }
}

function handleFileInput(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (files && files.length > 0) {
    selectedFile.value = files[0];
    emit('fileSelected', files[0]);
  }
}

function getItemTypeClass(item: ImportItem) {
  switch (item.type) {
    case 'normal': return 'bg-success-50 border-success-200';
    case 'late': return 'bg-warning-50 border-warning-200';
    case 'duplicate': return 'bg-gray-50 border-gray-200';
    case 'corrected': return 'bg-amber-50 border-amber-200';
    default: return 'bg-gray-50 border-gray-200';
  }
}
</script>

<template>
  <div class="space-y-6">
    <div
      class="border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer"
      :class="[
        isDragging
          ? 'border-primary-500 bg-primary-50'
          : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
      ]"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
      @click="($refs.fileInput as HTMLInputElement)?.click()"
    >
      <input
        ref="fileInput"
        type="file"
        accept=".json,application/json"
        class="hidden"
        @change="handleFileInput"
      />

      <Upload
        :class="['w-12 h-12 mx-auto mb-4 transition-colors', isDragging ? 'text-primary-500' : 'text-gray-400']"
      />
      <h3 class="text-lg font-medium text-gray-900 mb-2">上传数据文件</h3>
      <p class="text-sm text-gray-500 mb-4">拖拽 JSON 文件到此处，或点击选择文件</p>
      <div class="flex items-center justify-center gap-3">
        <button
          class="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors flex items-center gap-2"
          @click.stop="($refs.fileInput as HTMLInputElement)?.click()"
        >
          <FileJson class="w-4 h-4" />
          选择 JSON 文件
        </button>
        <button
          class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-2"
          @click.stop="emit('loadDemo')"
        >
          <FileText class="w-4 h-4" />
          加载演示数据
        </button>
      </div>

      <div v-if="selectedFile" class="mt-4 p-3 bg-success-50 rounded-lg border border-success-200 inline-flex items-center gap-2">
        <CheckCircle class="w-4 h-4 text-success" />
        <span class="text-sm text-success-800">已选择: {{ selectedFile.name }}</span>
      </div>
    </div>

    <div class="flex items-center gap-6 text-sm">
      <div class="flex items-center gap-2">
        <FileText class="w-4 h-4 text-gray-400" />
        <span class="text-gray-500">总计</span>
        <span class="font-semibold text-gray-900">{{ stats.total }}</span>
        <span class="text-gray-400">个</span>
      </div>
      <div class="flex items-center gap-2">
        <CheckCircle class="w-4 h-4 text-success" />
        <span class="text-success font-medium">{{ stats.done }}</span>
        <span class="text-gray-400">已完成</span>
      </div>
      <div class="flex items-center gap-2">
        <Clock class="w-4 h-4 text-warning animate-pulse" />
        <span class="text-warning font-medium">{{ stats.processing }}</span>
        <span class="text-gray-400">处理中</span>
      </div>
      <div class="flex items-center gap-2">
        <XCircle class="w-4 h-4 text-danger" />
        <span class="text-danger font-medium">{{ stats.error }}</span>
        <span class="text-gray-400">失败</span>
      </div>
    </div>

    <div v-if="packages.length === 0" class="text-center py-12">
      <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <FileJson class="w-8 h-8 text-gray-400" />
      </div>
      <p class="text-gray-500 mb-2">暂无导入记录</p>
      <p class="text-gray-400 text-sm">上传数据文件或加载演示数据开始使用</p>
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="pkg in packages"
        :key="pkg.id"
        class="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-all cursor-pointer"
        @click="emit('select', pkg.id)"
      >
        <div class="p-4">
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-lg flex items-center justify-center"
                :class="{
                  'bg-success-100': pkg.status === 'done',
                  'bg-warning-100': pkg.status === 'processing',
                  'bg-danger-100': pkg.status === 'error'
                }"
              >
                <FileJson
                  :class="[
                    'w-5 h-5',
                    pkg.status === 'done' ? 'text-success' :
                    pkg.status === 'processing' ? 'text-warning' : 'text-danger'
                  ]"
                />
              </div>
              <div>
                <h4 class="font-medium text-gray-900">{{ pkg.name }}</h4>
                <div class="text-xs text-gray-500">{{ formatTimestamp(pkg.uploadTime) }}</div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <StatusBadge
                v-if="pkg.status !== 'processing'"
                type="record-type"
                :value="pkg.status === 'done' ? 'normal' : 'late'"
                size="sm"
              />
              <span
                v-if="pkg.status === 'processing'"
                class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-warning bg-warning-50 border border-warning-200 rounded"
              >
                <Clock class="w-3 h-3 animate-spin" />
                处理中 {{ pkg.progress }}%
              </span>

              <button
                v-if="pkg.status === 'done'"
                class="p-1.5 text-gray-400 hover:text-danger hover:bg-danger-50 rounded transition-colors"
                @click.stop
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>

          <div v-if="pkg.status === 'processing'" class="mb-3">
            <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                class="h-full bg-warning rounded-full transition-all duration-300"
                :style="{ width: `${pkg.progress}%` }"
              />
            </div>
          </div>

          <div v-if="pkg.status === 'done'" class="grid grid-cols-4 gap-3">
            <div class="p-2 bg-success-50 rounded-lg border border-success-100 text-center">
              <div class="text-lg font-bold text-success">{{ pkg.stats.normal }}</div>
              <div class="text-xs text-success-700">正常记录</div>
            </div>
            <div class="p-2 bg-warning-50 rounded-lg border border-warning-100 text-center">
              <div class="text-lg font-bold text-warning">{{ pkg.stats.late }}</div>
              <div class="text-xs text-warning-700">晚到附件</div>
            </div>
            <div class="p-2 bg-gray-50 rounded-lg border border-gray-200 text-center">
              <div class="text-lg font-bold text-gray-600">{{ pkg.stats.duplicate }}</div>
              <div class="text-xs text-gray-500">重复项</div>
            </div>
            <div class="p-2 bg-amber-50 rounded-lg border border-amber-100 text-center">
              <div class="text-lg font-bold text-amber-600">{{ pkg.stats.corrected }}</div>
              <div class="text-xs text-amber-700">人工更正</div>
            </div>
          </div>

          <div v-if="pkg.status === 'error'" class="p-3 bg-danger-50 rounded-lg border border-danger-200">
            <div class="flex items-center gap-2 text-danger">
              <AlertCircle class="w-4 h-4" />
              <span class="text-sm font-medium">处理失败</span>
            </div>
            <p class="text-sm text-danger-800 mt-1">{{ pkg.errorMessage }}</p>
          </div>

          <div v-if="pkg.status === 'done' && pkg.items.length > 0" class="mt-3">
            <div class="text-xs font-medium text-gray-500 mb-2">记录详情</div>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="item in pkg.items.slice(0, 8)"
                :key="item.id"
                class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border"
                :class="getItemTypeClass(item)"
              >
                <Users class="w-3 h-3" />
                {{ item.originalData.operator || '未知' }}
              </span>
              <span
                v-if="pkg.items.length > 8"
                class="inline-flex items-center px-2 py-0.5 text-xs text-gray-500"
              >
                +{{ pkg.items.length - 8 }} 更多
              </span>
            </div>
          </div>
        </div>

        <div
          v-if="pkg.status === 'done'"
          class="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between"
        >
          <span class="text-sm text-gray-500">
            共 {{ pkg.totalItems }} 条记录，已生成 {{ pkg.stats.normal + pkg.stats.late + pkg.stats.corrected }} 条时间线事件
          </span>
          <button
            class="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
            @click.stop="emit('process', pkg.id)"
          >
            查看时间线
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
