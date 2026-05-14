<template>
  <div class="new-session">
    <h2>新建调试会话</h2>
    
    <el-card>
      <el-form :model="form" label-width="120px" @submit.prevent="submit">
        <el-form-item label="State参数">
          <el-input v-model="form.state" placeholder="留空将自动生成">
            <template #append>
              <el-button @click="generateState">生成</el-button>
            </template>
          </el-input>
        </el-form-item>
        
        <el-form-item label="Client ID">
          <el-input v-model="form.client_id" placeholder="可选" />
        </el-form-item>
        
        <el-form-item label="Redirect URI">
          <el-input v-model="form.redirect_uri" placeholder="可选" />
        </el-form-item>
        
        <el-form-item label="Scope">
          <el-input v-model="form.scope" placeholder="可选" />
        </el-form-item>
        
        <el-form-item label="回调URL">
          <div class="callback-url">
            <code>{{ callbackUrl }}</code>
            <el-button size="small" @click="copyUrl">复制</el-button>
          </div>
          <div class="tip">将此URL配置到OAuth应用的回调地址中</div>
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="submit" :loading="loading">
            创建会话
          </el-button>
          <el-button @click="$router.back()">返回</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'

const loading = ref(false)
const form = ref({
  state: '',
  client_id: '',
  redirect_uri: '',
  scope: ''
})

const callbackUrl = computed(() => {
  return `${window.location.origin}/api/v1/callback`
})

const generateState = () => {
  form.value.state = `oauth_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

const copyUrl = async () => {
  try {
    await navigator.clipboard.writeText(callbackUrl.value)
    ElMessage.success('已复制到剪贴板')
  } catch (e) {
    ElMessage.error('复制失败')
  }
}

const submit = async () => {
  if (!form.value.state) {
    generateState()
  }
  
  loading.value = true
  try {
    const res = await api.createSession(form.value)
    ElMessage.success('会话创建成功')
    ElMessage.info(`回调URL: ${callbackUrl.value}?state=${form.value.state}`)
    setTimeout(() => {
      window.location.href = `/session/${res.data.id}`
    }, 1000)
  } catch (e) {
    ElMessage.error('创建失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.new-session h2 {
  margin: 0 0 20px 0;
  color: #303133;
}

.callback-url {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
  font-family: monospace;
  word-break: break-all;
}

.tip {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}
</style>
