<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ScoreRecord, RecordStatus } from '../types'

const props = defineProps<{
  record: ScoreRecord
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', recordId: string, status: RecordStatus, reason: string): void
}>()

const selectedStatus = ref<RecordStatus>(props.record.status)
const reason = ref(props.record.pendingReason)

watch(() => props.record, (newRecord) => {
  selectedStatus.value = newRecord.status
  reason.value = newRecord.pendingReason
})

function handleConfirm() {
  if (selectedStatus.value === 'pending' && !reason.value.trim()) {
    alert('请填写待处理原因')
    return
  }
  emit('confirm', props.record.id, selectedStatus.value, reason.value)
  emit('close')
}

const statusOptions = [
  { value: 'pending', label: '待处理' },
  { value: 'confirmed', label: '已确认' },
  { value: 'duplicate', label: '重复' },
  { value: 'rejected', label: '已驳回' }
]
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">✏️ 修改状态</div>
        <button class="modal-close" @click="emit('close')">&times;</button>
      </div>
      
      <div style="margin-bottom: 20px; padding: 12px; background: #f8f9fa; border-radius: 8px;">
        <div style="font-weight: 600; margin-bottom: 4px;">
          {{ record.studentName }} - {{ record.songTitle }}
        </div>
        <div style="font-size: 12px; color: #666;">
          当前状态: 
          <span class="status-badge" :class="'status-' + record.status">
            {{ statusOptions.find(o => o.value === record.status)?.label }}
          </span>
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500;">目标状态:</label>
        <div class="btn-group">
          <button 
            v-for="opt in statusOptions" 
            :key="opt.value"
            class="btn btn-sm"
            :class="selectedStatus === opt.value ? 'btn-primary' : 'btn-secondary'"
            @click="selectedStatus = opt.value as RecordStatus"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500;">
          {{ selectedStatus === 'pending' ? '待处理原因 *' : '备注（可选）' }}
        </label>
        <textarea 
          v-model="reason"
          placeholder="请输入原因说明..."
          style="width: 100%; min-height: 100px;"
        ></textarea>
      </div>

      <div style="text-align: right;">
        <button class="btn btn-secondary" style="margin-right: 8px;" @click="emit('close')">
          取消
        </button>
        <button class="btn btn-primary" @click="handleConfirm">
          确认修改
        </button>
      </div>
    </div>
  </div>
</template>
