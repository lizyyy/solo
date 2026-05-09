<template>
  <div class="login-container">
    <div class="login-box">
      <h2>仓库盘点系统</h2>
      <el-form
        ref="loginFormRef"
        :model="loginForm"
        :rules="loginRules"
        class="login-form"
        label-position="top"
      >
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="loginForm.username"
            placeholder="请输入用户名"
            :disabled="isLoading"
            @keyup.enter="handleLogin"
          >
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            placeholder="请输入密码"
            :disabled="isLoading"
            show-password
            @keyup.enter="handleLogin"
          >
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            class="login-btn"
            :loading="isLoading"
            @click="handleLogin"
          >
            登录
          </el-button>
        </el-form-item>
      </el-form>
      
      <div class="login-tips">
        <p>管理员账号: admin / admin123</p>
        <p>普通用户: user1 / user123</p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import syncService from '@/services/syncService'

export default {
  name: 'Login',
  setup() {
    const router = useRouter()
    const store = useStore()
    
    const loginFormRef = ref(null)
    const isLoading = ref(false)
    
    const loginForm = reactive({
      username: '',
      password: ''
    })
    
    const loginRules = {
      username: [
        { required: true, message: '请输入用户名', trigger: 'blur' }
      ],
      password: [
        { required: true, message: '请输入密码', trigger: 'blur' }
      ]
    }
    
    const handleLogin = async () => {
      try {
        await loginFormRef.value.validate()
        isLoading.value = true
        
        await store.dispatch('login', loginForm)
        syncService.start()
        
        ElMessage.success('登录成功')
        router.push('/dashboard')
      } catch (error) {
        console.error('登录失败:', error)
      } finally {
        isLoading.value = false
      }
    }
    
    return {
      loginFormRef,
      isLoading,
      loginForm,
      loginRules,
      handleLogin,
      User,
      Lock
    }
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-box {
  width: 400px;
  padding: 40px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.login-box h2 {
  text-align: center;
  margin-bottom: 30px;
  color: #333;
}

.login-form {
  margin-top: 20px;
}

.login-btn {
  width: 100%;
}

.login-tips {
  margin-top: 20px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 12px;
  color: #909399;
}

.login-tips p {
  margin: 5px 0;
}
</style>
