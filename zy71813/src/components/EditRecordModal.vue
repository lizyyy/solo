<template>
  <div v-if="visible" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
      <div class="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold">{{ isNew ? '新增记录' : '编辑记录' }}</h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <div v-if="hasAlert" class="p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <p class="text-sm text-orange-700">
            ⚠️ 本次修改包含结论变更，将被标记为需确认
          </p>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="label">门店编号</label>
            <input v-model="form.storeId" type="text" class="input w-full" placeholder="如 ST001" />
          </div>
          <div>
            <label class="label">门店名称</label>
            <input v-model="form.storeName" type="text" class="input w-full" placeholder="如 朝阳大悦城店" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="label">账期</label>
            <input v-model="form.accountingPeriod" type="text" class="input w-full" placeholder="如 2024-05" />
          </div>
          <div>
            <label class="label">金额</label>
            <input v-model.number="form.amount" type="number" step="0.01" class="input w-full" placeholder="0.00" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="label">来源</label>
            <select v-model="form.source" class="input w-full">
              <option v-for="(label, key) in SOURCE_LABELS" :key="key" :value="key">
                {{ label }}
              </option>
            </select>
          </div>
          <div>
            <label class="label">来源参考</label>
            <input v-model="form.sourceRef" type="text" class="input w-full" placeholder="单据编号" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="label">问题分类</label>
            <select v-model="form.issueCategory" class="input w-full">
              <option v-for="(label, key) in CATEGORY_LABELS" :key="key" :value="key">
                {{ label }}
              </option>
            </select>
          </div>
          <div>
            <label class="label">状态</label>
            <select v-model="form.status" class="input w-full">
              <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">
                {{ label }}
              </option>
            </select>
          </div>
        </div>

        <div>
          <label class="label">待处理原因</label>
          <textarea v-model="form.pendingReason" class="input w-full" rows="2" placeholder="说明为什么进待处理"></textarea>
        </div>

        <div>
          <label class="label">结论</label>
          <textarea v-model="form.conclusion" class="input w-full" rows="2" placeholder="最终处理结论"></textarea>
        </div>

        <div v-if="!isNew">
          <label class="label">变更原因 <span class="text-red-500">*</span></label>
          <textarea v-model="changeReason" class="input w-full" rows="2" placeholder="说明本次修改的原因，便于后续追溯"></textarea>
        </div>

        <div v-if="previewChanges.length > 0">
          <label class="label">变更预览</label>
          <div class="bg-gray-50 rounded-lg p-3 space-y-2">
            <div v-for="(change, idx) in previewChanges" :key="idx" class="text-xs flex items-start gap-2">
              <span :class="change.changeType === 'conclusion_changed' ? 'text-red-600' : 'text-purple-600'">
                {{ change.changeType === 'conclusion_changed' ? '⚠️' : '•' }}
              </span>
              <span>
                <span class="font-medium">{{ formatFieldName(change.field) }}</span>:
                <span class="text-red-600 line-through">{{ change.oldValue || '(空)' }}</span>
                <span class="text-gray-400 mx-1">→</span>
                <span class="text-green-600 font-medium">{{ change.newValue || '(空)' }}</span>
                <span class="ml-2 text-xs px-1.5 py-0.5 rounded" :class="change.changeType === 'conclusion_changed' ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700'">
                  {{ change.changeType === 'conclusion_changed' ? '结论变更' : '仅补材料' }}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="border-t border-gray-200 p-4 flex gap-3 justify-end">
        <button @click="$emit('close')" class="btn-secondary">取消</button>
        <button @click="handleSubmit" :disabled="!canSubmit" class="btn-primary">
          {{ isNew ? '创建记录' : '保存修改' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import type { ShortageRecord, RecordStatus, SourceType, IssueCategory } from '../types';
import { STATUS_LABELS, SOURCE_LABELS, CATEGORY_LABELS, formatFieldName } from '../constants/labels';
import { compareVersions, hasConclusionChanges } from '../utils/compare';

const props = defineProps<{
  visible: boolean;
  record: ShortageRecord | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', data: Partial<ShortageRecord>, reason: string): void;
}>();

const isNew = computed(() => !props.record);

const form = reactive({
  storeId: '',
  storeName: '',
  accountingPeriod: '',
  amount: 0,
  status: 'pending' as RecordStatus,
  issueCategory: 'other' as IssueCategory,
  source: 'manual_adjustment' as SourceType,
  sourceRef: '',
  conclusion: '',
  pendingReason: ''
});

const changeReason = ref('');

watch(() => props.visible, (val) => {
  if (val && props.record) {
    form.storeId = props.record.storeId;
    form.storeName = props.record.storeName;
    form.accountingPeriod = props.record.accountingPeriod;
    form.amount = props.record.amount;
    form.status = props.record.status;
    form.issueCategory = props.record.issueCategory;
    form.source = props.record.source;
    form.sourceRef = props.record.sourceRef;
    form.conclusion = props.record.conclusion;
    form.pendingReason = props.record.pendingReason;
    changeReason.value = '';
  } else if (val) {
    Object.assign(form, {
      storeId: '',
      storeName: '',
      accountingPeriod: '2024-05',
      amount: 0,
      status: 'pending',
      issueCategory: 'other',
      source: 'manual_adjustment',
      sourceRef: '',
      conclusion: '',
      pendingReason: ''
    });
    changeReason.value = '';
  }
}, { immediate: true });

const previewChanges = computed(() => {
  if (!props.record) return [];
  return compareVersions(props.record, form);
});

const hasAlert = computed(() => hasConclusionChanges(previewChanges.value));

const canSubmit = computed(() => {
  if (!form.storeId || !form.storeName || !form.accountingPeriod || form.amount <= 0) return false;
  if (!isNew.value && !changeReason.value.trim()) return false;
  return true;
});

function handleSubmit() {
  if (!canSubmit.value) return;
  
  const data = isNew.value
    ? { ...form, attachments: [] }
    : { ...form };
  
  emit('submit', data, isNew.value ? '创建记录' : changeReason.value);
}
</script>
