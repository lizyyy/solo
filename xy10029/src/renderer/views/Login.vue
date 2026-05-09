<template>
  <div class="login-container">
    <div class="login-card">
      <h1 class="login-title">共享设备管理系统</h1>
      <p class="login-subtitle">请登录您的账户</p>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-item">
          <label class="form-label">用户名</label>
          <input
            v-model="username"
            type="text"
            class="form-input"
            placeholder="请输入用户名"
            required
          />
        </div>

        <div class="form-item">
          <label class="form-label">密码</label>
          <input
            v-model="password"
            type="password"
            class="form-input"
            placeholder="请输入密码"
            required
          />
        </div>

        <button
          type="submit"
          class="btn btn-primary btn-lg login-btn"
          :disabled="loading"
        >
          <span v-if="loading">登录中...</span>
          <span v-else>登录</span>
        </button>
      </form>

      <div v-if="error" class="alert alert-error" style="margin-top: 16px;">
        {{ error }}
      </div>

      <div class="divider"></div>

      <div style="font-size: 12px; color: #909399; text-align: center;">
        <p>默认账户：</p>
        <p>管理员：admin / admin123</p>
        <p>操作员：operator / operator123</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useToastStore } from '../stores/toast'

const router = useRouter()
const authStore = useAuthStore()
const toastStore = useToastStore()

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  if (!username.value || !password.value) return

  loading.value = true
  error.value = ''

  try {
    const result = await window.api.auth.login(username.value, password.value)

    if (result.success && result.data) {
      authStore.login(result.data)
      toastStore.success('登录成功')
      router.push('/dashboard')
    } else {
      error.value = result.error || '登录失败'
    }
  } catch (e: any) {
    error.value = e.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>
