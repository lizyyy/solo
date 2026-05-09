<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">重置密码 - {{ user.username }}</h3>
        <button class="modal-close" @click="$emit('close')">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-item">
          <label class="form-label">新密码 *</label>
          <input v-model="newPassword" type="password" class="form-input" placeholder="至少6位" />
        </div>
        <div class="form-item">
          <label class="form-label">确认密码 *</label>
          <input v-model="confirmPassword" type="password" class="form-input" placeholder="再次输入新密码" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-default" @click="$emit('close')">取消</button>
        <button class="btn btn-warning" :disabled="loading" @click="handleSubmit">
          {{ loading ? '重置中...' : '重置密码' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useToastStore } from '../stores/toast'

const props = defineProps<{
  user: any
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'reset'): void
}>()

const toastStore = useToastStore()

const loading = ref(false)
const newPassword = ref('')
const confirmPassword = ref('')

async function handleSubmit() {
  if (!newPassword.value || !confirmPassword.value) {
    toastStore.warning('请输入新密码')
    return
  }

  if (newPassword.value.length < 6) {
    toastStore.warning('密码至少6位')
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    toastStore.warning('两次输入的密码不一致')
    return
  }

  loading.value = true
  try {
    const result = await window.api.users.resetPassword(props.user.id, newPassword.value)

    if (result.success) {
      emit('reset')
    } else {
      toastStore.error(result.error || '重置失败')
    }
  } catch (e) {
    toastStore.error('重置失败')
  } finally {
    loading.value = false
  }
}
</script>
