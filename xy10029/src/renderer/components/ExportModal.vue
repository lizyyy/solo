<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">导出数据</h3>
        <button class="modal-close" @click="$emit('close')">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-item">
          <label class="form-label">导出格式</label>
          <div style="display: flex; gap: 16px;">
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
              <input type="radio" v-model="format" value="excel" />
              Excel (.xlsx)
            </label>
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
              <input type="radio" v-model="format" value="csv" />
              CSV (.csv)
            </label>
          </div>
        </div>

        <div v-if="dataType === 'devices'" class="form-item">
          <label class="form-label">状态筛选（可选）</label>
          <select v-model="filterStatus" class="form-select">
            <option value="">全部状态</option>
            <option value="available">可借出</option>
            <option value="borrowed">已借出</option>
            <option value="maintenance">维护中</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-default" @click="$emit('close')">取消</button>
        <button class="btn btn-primary" :disabled="loading" @click="handleExport">
          {{ loading ? '导出中...' : '导出' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useToastStore } from '../stores/toast'

const props = defineProps<{
  dataType: 'devices' | 'borrows'
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const toastStore = useToastStore()

const loading = ref(false)
const format = ref<'excel' | 'csv'>('excel')
const filterStatus = ref('')

async function handleExport() {
  loading.value = true
  try {
    const options: any = {
      format: format.value,
      dataType: props.dataType
    }

    if (filterStatus.value) {
      options.filters = { status: filterStatus.value }
    }

    let result
    if (props.dataType === 'devices') {
      result = await window.api.export.devices(options)
    } else {
      result = await window.api.export.borrows(options)
    }

    if (result.success) {
      toastStore.success(`已导出到: ${result.data}`)
      emit('close')
    } else {
      if (result.error !== '用户取消导出') {
        toastStore.error(result.error || '导出失败')
      }
    }
  } catch (e) {
    toastStore.error('导出失败')
  } finally {
    loading.value = false
  }
}
</script>
