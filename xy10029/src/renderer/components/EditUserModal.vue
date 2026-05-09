<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">编辑用户</h3>
        <button class="modal-close" @click="$emit('close')">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-item">
          <label class="form-label">用户名</label>
          <input :value="user.username" class="form-input" disabled />
        </div>
        <div class="form-item">
          <label class="form-label">显示名称 *</label>
          <input v-model="form.displayName" class="form-input" />
        </div>
        <div class="form-item">
          <label class="form-label">角色 *</label>
          <select v-model="form.role" class="form-select">
            <option value="admin">管理员</option>
            <option value="operator">操作员</option>
            <option value="user">普通用户</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-default" @click="$emit('close')">取消</button>
        <button class="btn btn-primary" :disabled="loading" @click="handleSubmit">
          {{ loading ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { useToastStore } from '../stores/toast'

const props = defineProps<{
  user: any
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'updated'): void
}>()

const toastStore = useToastStore()

const loading = ref(false)
const form = reactive({
  displayName: '',
  role: ''
})

watch(
  () => props.user,
  (user) => {
    if (user) {
      form.displayName = user.displayName
      form.role = user.role
    }
  },
  { immediate: true }
)

async function handleSubmit() {
  if (!form.displayName || !form.role) {
    toastStore.warning('请填写必填字段')
    return
  }

  loading.value = true
  try {
    const result = await window.api.users.update(props.user.id, {
      displayName: form.displayName,
      role: form.role
    })

    if (result.success) {
      emit('updated')
    } else {
      toastStore.error(result.error || '更新失败')
    }
  } catch (e) {
    toastStore.error('更新失败')
  } finally {
    loading.value = false
  }
}
</script>
