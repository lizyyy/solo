<template>
  <div v-if="visible" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-xl shadow-xl max-w-md w-full">
      <div class="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold">上传附件</h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
      </div>

      <div class="p-4 space-y-4">
        <div v-if="versionWarning" class="p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <p class="text-sm text-orange-700">
            ⚠️ {{ versionWarning }}
          </p>
        </div>

        <div>
          <label class="label">附件名称</label>
          <input v-model="form.name" type="text" class="input w-full" placeholder="如 5月银行对账单.pdf" />
        </div>

        <div>
          <label class="label">附件类型</label>
          <select v-model="form.type" class="input w-full">
            <option v-for="(label, key) in SOURCE_LABELS" :key="key" :value="key">
              {{ label }}
            </option>
          </select>
        </div>

        <div>
          <label class="label">版本号</label>
          <input v-model.number="form.version" type="number" min="1" class="input w-full" placeholder="1" />
          <p class="text-xs text-gray-500 mt-1">
            同名附件的新版本将覆盖旧版本，版本号不应低于现有版本
          </p>
        </div>

        <div>
          <label class="label">文件内容标识（模拟）</label>
          <input v-model="form.fileHash" type="text" class="input w-full" placeholder="用于检测内容变更" />
          <p class="text-xs text-gray-500 mt-1">实际系统中应为文件哈希值，用于检测相同版本号下的内容变化</p>
        </div>

        <div>
          <label class="label">备注</label>
          <textarea v-model="form.note" class="input w-full" rows="2" placeholder="可选说明"></textarea>
        </div>

        <div>
          <label class="label">变更原因</label>
          <input v-model="changeReason" type="text" class="input w-full" placeholder="如 门店补传结算附件" />
        </div>

        <div v-if="existingVersions.length > 0" class="bg-gray-50 rounded-lg p-3">
          <p class="text-sm font-medium text-gray-700 mb-2">已有同名附件：</p>
          <div v-for="att in existingVersions" :key="att.id" class="text-xs text-gray-600">
            • v{{ att.version }} · {{ att.uploadedBy }} · hash: {{ att.fileHash }}
          </div>
        </div>
      </div>

      <div class="border-t border-gray-200 p-4 flex gap-3 justify-end">
        <button @click="$emit('close')" class="btn-secondary">取消</button>
        <button @click="handleSubmit" :disabled="!canSubmit" class="btn-primary">
          上传
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import type { ShortageRecord, SourceType, Attachment } from '../types';
import { SOURCE_LABELS } from '../constants/labels';
import { detectOldVersionAttachment } from '../utils/compare';

const props = defineProps<{
  visible: boolean;
  record: ShortageRecord | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', attachment: Omit<Attachment, 'id' | 'uploadedAt' | 'uploadedBy'>, reason: string): void;
}>();

const form = reactive({
  name: '',
  type: 'settlement_attachment' as SourceType,
  version: 1,
  fileHash: '',
  note: ''
});

const changeReason = ref('');

watch(() => props.visible, (val) => {
  if (val) {
    Object.assign(form, {
      name: '',
      type: 'settlement_attachment',
      version: 1,
      fileHash: 'hash-' + Date.now(),
      note: ''
    });
    changeReason.value = '';
  }
});

const existingVersions = computed(() => {
  if (!props.record || !form.name) return [];
  return props.record.attachments.filter(a => a.name === form.name);
});

const versionWarning = computed(() => {
  if (!props.record || !form.name) return '';
  const testAtt: Attachment = {
    id: 'test',
    ...form,
    uploadedAt: new Date().toISOString(),
    uploadedBy: 'test'
  };
  const detection = detectOldVersionAttachment(props.record.attachments, testAtt);
  return detection.isOld ? detection.message : '';
});

const canSubmit = computed(() => {
  return form.name.trim() && form.version >= 1 && changeReason.value.trim();
});

function handleSubmit() {
  if (!canSubmit.value) return;
  emit('submit', { ...form }, changeReason.value);
}
</script>
