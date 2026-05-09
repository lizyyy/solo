<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">新增设备</h3>
        <button class="modal-close" @click="$emit('close')">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-item">
          <label class="form-label">设备编号 *</label>
          <input v-model="form.deviceCode" class="form-input" placeholder="例如：LAP-001" />
        </div>
        <div class="form-item">
          <label class="form-label">设备名称 *</label>
          <input v-model="form.name" class="form-input" placeholder="例如：MacBook Pro 14" />
        </div>
        <div class="form-item">
          <label class="form-label">设备类别 *</label>
          <select v-model="form.category" class="form-select">
            <option value="">请选择类别</option>
            <option value="laptop">笔记本电脑</option>
            <option value="phone">手机</option>
            <option value="tablet">平板</option>
            <option value="camera">相机</option>
            <option value="audio">音频设备</option>
            <option value="other">其他</option>
          </select>
        </div>
        <div class="form-item">
          <label class="form-label">型号</label>
          <input v-model="form.model" class="form-input" placeholder="例如：A2442" />
        </div>
        <div class="form-item">
          <label class="form-label">序列号</label>
          <input v-model="form.serialNumber" class="form-input" placeholder="例如：C02FQXXXXXXX" />
        </div>
        <div class="form-item">
          <label class="form-label">存放位置</label>
          <input v-model="form.location" class="form-input" placeholder="例如：3楼设备柜" />
        </div>
        <div class="form-item">
          <label class="form-label">描述</label>
          <textarea v-model="form.description" class="form-textarea" placeholder="设备描述信息"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-default" @click="$emit('close')">取消</button>
        <button class="btn btn-primary" :disabled="loading" @click="handleSubmit">
          {{ loading ? '提交中...' : '提交' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useToastStore } from '../stores/toast'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'created'): void
}>()

const authStore = useAuthStore()
const toastStore = useToastStore()

const loading = ref(false)
const form = reactive({
  deviceCode: '',
  name: '',
  category: '',
  model: '',
  serialNumber: '',
  location: '',
  description: ''
})

async function handleSubmit() {
  if (!form.deviceCode || !form.name || !form.category) {
    toastStore.warning('请填写必填字段')
    return
  }

  loading.value = true
  try {
    const result = await window.api.devices.create(form, authStore.currentUser!)
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
