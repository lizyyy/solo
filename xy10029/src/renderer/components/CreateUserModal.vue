<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">新增用户</h3>
        <button class="modal-close" @click="$emit('close')">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-item">
          <label class="form-label">用户名 *</label>
          <input v-model="form.username" class="form-input" placeholder="登录用户名" />
        </div>
        <div class="form-item">
          <label class="form-label">密码 *</label>
          <input v-model="form.password" type="password" class="form-input" placeholder="至少6位" />
        </div>
        <div class="form-item">
          <label class="form-label">确认密码 *</label>
          <input v-model="form.confirmPassword" type="password" class="form-input" placeholder="再次输入密码" />
        </div>
        <div class="form-item">
          <label class="form-label">显示名称 *</label>
          <input v-model="form.displayName" class="form-input" placeholder="用户显示名称" />
        </div>
        <div class="form-item">
          <label class="form-label">角色 *</label>
          <select v-model="form.role" class="form-select">
            <option value="">请选择角色</option>
            <option value="admin">管理员</option>
            <option value="operator">操作员</option>
            <option value="user">普通用户</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-default" @click="$emit('close')">取消</button>
        <button class="btn btn-primary" :disabled="loading" @click="handleSubmit">
          {{ loading ? '创建中...' : '创建' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useToastStore } from '../stores/toast'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'created'): void
}>()

const toastStore = useToastStore()

const loading = ref(false)
const form = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  displayName: '',
  role: ''
})

async function handleSubmit() {
  if (!form.username || !form.password || !form.displayName || !form.role) {
    toastStore.warning('请填写所有必填字段')
    return
  }

  if (form.password.length < 6) {
    toastStore.warning('密码至少6位')
    return
  }

  if (form.password !== form.confirmPassword) {
    toastStore.warning('两次输入的密码不一致')
    return
  }

  loading.value = true
  try {
    const result = await window.api.users.create({
      username: form.username,
      password: form.password,
      displayName: form.displayName,
      role: form.role
    })

    if (result.success) {
      emit('created')
    } else {
      toastStore.error(result.error || '创建失败')
    }
  } catch (e) {
    toastStore.error('创建失败')
  } finally {
    loading.value = false
  }
}
</script>
