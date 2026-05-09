<template>
  <div class="modal-overlay modal-lg" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">设备详情 - {{ device.deviceCode }}</h3>
        <button class="modal-close" @click="$emit('close')">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-item">
          <label class="form-label">设备名称</label>
          <div>{{ device.name }}</div>
        </div>
        <div class="form-item">
          <label class="form-label">设备类别</label>
          <div>{{ getCategoryLabel(device.category) }}</div>
        </div>
        <div class="form-item">
          <label class="form-label">型号</label>
          <div>{{ device.model || '-' }}</div>
        </div>
        <div class="form-item">
          <label class="form-label">序列号</label>
          <div>{{ device.serialNumber || '-' }}</div>
        </div>
        <div class="form-item">
          <label class="form-label">状态</label>
          <div>
            <span
              class="status-badge"
              :class="'status-' + device.status"
            >
              {{ getStatusLabel(device.status) }}
            </span>
          </div>
        </div>
        <div class="form-item">
          <label class="form-label">位置</label>
          <div>{{ device.location || '-' }}</div>
        </div>
        <div class="form-item">
          <label class="form-label">当前持有人</label>
          <div>{{ device.currentHolderName || '-' }}</div>
        </div>
        <div class="form-item">
          <label class="form-label">描述</label>
          <div>{{ device.description || '-' }}</div>
        </div>

        <div class="divider"></div>

        <h4 style="margin-bottom: 16px;">历史记录</h4>
        <div v-if="historyLoading" class="loading">
          <div class="spinner"></div>
        </div>
        <div v-else-if="history.length === 0" class="empty-state" style="padding: 20px;">
          <p>暂无历史记录</p>
        </div>
        <div v-else class="history-list">
          <div v-for="item in history" :key="item.id" class="history-item">
            <div class="history-time">
              {{ formatDate(item.changedAt) }} - {{ item.changedByName }}
            </div>
            <div class="history-user">版本 {{ item.version }} - {{ getChangeTypeLabel(item.changeType) }}</div>
            <div class="history-desc">{{ item.description }}</div>
            <button
              v-if="canRestore"
              class="btn btn-default btn-sm"
              style="margin-top: 8px;"
              @click="handleRestore(item)"
            >
              恢复此版本
            </button>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-default" @click="$emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useToastStore } from '../stores/toast'
import { ChangeType, DeviceStatus, DeviceCategory, Permission } from '@shared/types'

const props = defineProps<{
  device: any
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const authStore = useAuthStore()
const toastStore = useToastStore()

const history = ref<any[]>([])
const historyLoading = ref(false)

const canRestore = computed(() => authStore.hasPermission(Permission.RESTORE_VERSION))

async function loadHistory() {
  historyLoading.value = true
  try {
    const result = await window.api.devices.history(props.device.id)
    if (result.success && result.data) {
      history.value = result.data
    }
  } catch (e) {
    toastStore.error('加载历史记录失败')
  } finally {
    historyLoading.value = false
  }
}

async function handleRestore(item: any) {
  if (!confirm(`确认恢复到版本 ${item.version}？`)) return

  try {
    const result = await window.api.devices.restore(item.id, authStore.currentUser!)
    if (result.success) {
      toastStore.success('恢复成功')
      emit('close')
    } else {
      toastStore.error(result.error || '恢复失败')
    }
  } catch (e) {
    toastStore.error('恢复失败')
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case DeviceStatus.AVAILABLE:
      return '可借出'
    case DeviceStatus.BORROWED:
      return '已借出'
    case DeviceStatus.MAINTENANCE:
      return '维护中'
    case DeviceStatus.RESERVED:
      return '已预留'
    case DeviceStatus.LOST:
      return '已丢失'
    default:
      return status
  }
}

function getCategoryLabel(category: string): string {
  switch (category) {
    case DeviceCategory.LAPTOP:
      return '笔记本电脑'
    case DeviceCategory.PHONE:
      return '手机'
    case DeviceCategory.TABLET:
      return '平板'
    case DeviceCategory.CAMERA:
      return '相机'
    case DeviceCategory.AUDIO:
      return '音频设备'
    case DeviceCategory.OTHER:
      return '其他'
    default:
      return category
  }
}

function getChangeTypeLabel(type: string): string {
  switch (type) {
    case ChangeType.CREATE:
      return '创建'
    case ChangeType.UPDATE:
      return '更新'
    case ChangeType.BORROW:
      return '借出'
    case ChangeType.RETURN:
      return '归还'
    case ChangeType.MAINTENANCE:
      return '维护'
    case ChangeType.DELETE:
      return '删除'
    case ChangeType.RESTORE:
      return '恢复'
    default:
      return type
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

onMounted(() => {
  loadHistory()
})
</script>
