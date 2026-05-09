<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">批量借出设备</h3>
        <button class="modal-close" @click="$emit('close')">&times;</button>
      </div>
      <div class="modal-body">
        <div class="alert alert-info">
          <strong>已选择 {{ deviceIds.length }} 台设备</strong>，将统一借出给同一借出人。
        </div>

        <div class="form-item">
          <label class="form-label">借出人姓名 *</label>
          <input v-model="form.borrowerName" class="form-input" placeholder="请输入借出人姓名" />
        </div>
        <div class="form-item">
          <label class="form-label">借出人工号/ID</label>
          <input v-model="form.borrowerId" class="form-input" placeholder="可选" />
        </div>
        <div class="form-item">
          <label class="form-label">预计归还时间</label>
          <input v-model="form.expectedReturnAt" type="datetime-local" class="form-input" />
        </div>
        <div class="form-item">
          <label class="form-label">用途说明</label>
          <textarea v-model="form.purpose" class="form-textarea" placeholder="借出用途"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-default" @click="$emit('close')">取消</button>
        <button class="btn btn-success" :disabled="loading" @click="handleSubmit">
          {{ loading ? '借出中...' : `确认借出 (${deviceIds.length}台)` }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useToastStore } from '../stores/toast'

const props = defineProps<{
  deviceIds: string[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'lent'): void
}>()

const authStore = useAuthStore()
const toastStore = useToastStore()

const loading = ref(false)
const form = reactive({
  borrowerName: '',
  borrowerId: '',
  expectedReturnAt: '',
  purpose: ''
})

async function handleSubmit() {
  if (!form.borrowerName) {
    toastStore.warning('请输入借出人姓名')
    return
  }

  if (props.deviceIds.length === 0) {
    toastStore.warning('请选择设备')
    return
  }

  loading.value = true
  try {
    const borrowerId = form.borrowerId || `TEMP-${Date.now()}`
    const expectedReturnAt = form.expectedReturnAt
      ? new Date(form.expectedReturnAt).toISOString()
      : undefined

    const result = await window.api.batch.lend(
      props.deviceIds,
      borrowerId,
      form.borrowerName,
      authStore.currentUser!,
      expectedReturnAt,
      form.purpose
    )

    if (result.success) {
      emit('lent')
    } else {
      toastStore.error(result.error || '批量借出失败')
    }
  } catch (e) {
    toastStore.error('批量借出失败')
  } finally {
    loading.value = false
  }
}
</script>
