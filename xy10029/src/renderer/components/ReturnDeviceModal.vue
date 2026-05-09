<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">归还设备 - {{ device.deviceCode }}</h3>
        <button class="modal-close" @click="$emit('close')">&times;</button>
      </div>
      <div class="modal-body">
        <div class="alert alert-info">
          <strong>当前持有人：</strong> {{ device.currentHolderName || '-' }}
        </div>

        <div class="form-item">
          <label class="form-label">归还备注</label>
          <textarea v-model="notes" class="form-textarea" placeholder="设备状态、归还情况等"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-default" @click="$emit('close')">取消</button>
        <button class="btn btn-warning" :disabled="loading" @click="handleSubmit">
          {{ loading ? '归还中...' : '确认归还' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useToastStore } from '../stores/toast'

const props = defineProps<{
  device: any
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'returned'): void
}>()

const authStore = useAuthStore()
const toastStore = useToastStore()

const loading = ref(false)
const notes = ref('')

async function handleSubmit() {
  loading.value = true
  try {
    const result = await window.api.devices.return(
      props.device.id,
      authStore.currentUser!,
      notes.value
    )

    if (result.success) {
      emit('returned')
    } else {
      toastStore.error(result.error || '归还失败')
    }
  } catch (e) {
    toastStore.error('归还失败')
  } finally {
    loading.value = false
  }
}
</script>
