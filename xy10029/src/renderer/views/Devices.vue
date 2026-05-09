<template>
  <div class="card">
    <div class="card-header">
      <h2 class="card-title">设备管理</h2>
      <div class="toolbar">
        <button
          v-if="canManage"
          class="btn btn-primary"
          @click="showCreateModal = true"
        >
          ➕ 新增设备
        </button>
        <button
          v-if="canLend && selectedDevices.length > 0"
          class="btn btn-success"
          @click="showBatchLendModal = true"
        >
          📤 批量借出 ({{ selectedDevices.length }})
        </button>
        <button
          v-if="canReturn && selectedDevices.length > 0"
          class="btn btn-warning"
          @click="handleBatchReturn"
        >
          📥 批量归还 ({{ selectedDevices.length }})
        </button>
        <button
          v-if="canExport"
          class="btn btn-default"
          @click="showExportModal = true"
        >
          📤 导出
        </button>
        <button
          v-if="canImport"
          class="btn btn-default"
          @click="handleImport"
        >
          📥 导入
        </button>
      </div>
    </div>

    <div class="search-bar">
      <input
        v-model="searchText"
        class="search-input"
        placeholder="搜索设备编号、名称或序列号..."
        @input="handleSearch"
      />
      <div class="filters">
        <div class="filter-item">
          <span class="filter-label">状态:</span>
          <select v-model="filterStatus" class="form-select" style="width: 150px;" @change="loadDevices">
            <option value="">全部</option>
            <option value="available">可借出</option>
            <option value="borrowed">已借出</option>
            <option value="maintenance">维护中</option>
            <option value="reserved">已预留</option>
            <option value="lost">已丢失</option>
          </select>
        </div>
        <div class="filter-item">
          <span class="filter-label">类别:</span>
          <select v-model="filterCategory" class="form-select" style="width: 150px;" @change="loadDevices">
            <option value="">全部</option>
            <option value="laptop">笔记本电脑</option>
            <option value="phone">手机</option>
            <option value="tablet">平板</option>
            <option value="camera">相机</option>
            <option value="audio">音频设备</option>
            <option value="other">其他</option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>
    <div v-else-if="devices.length === 0" class="empty-state">
      <div class="empty-icon">📦</div>
      <p>暂无设备数据</p>
    </div>
    <div v-else class="table-container">
      <table>
        <thead>
          <tr>
            <th style="width: 40px;">
              <input
                type="checkbox"
                class="checkbox"
                :checked="isAllSelected"
                @change="toggleSelectAll"
              />
            </th>
            <th>设备编号</th>
            <th>设备名称</th>
            <th>类别</th>
            <th>型号</th>
            <th>序列号</th>
            <th>状态</th>
            <th>位置</th>
            <th>当前持有人</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="device in devices"
            :key="device.id"
            :class="{ selected: selectedDevices.includes(device.id) }"
          >
            <td>
              <input
                type="checkbox"
                class="checkbox"
                :checked="selectedDevices.includes(device.id)"
                @change="toggleSelect(device.id)"
              />
            </td>
            <td>{{ device.deviceCode }}</td>
            <td>{{ device.name }}</td>
            <td>{{ getCategoryLabel(device.category) }}</td>
            <td>{{ device.model }}</td>
            <td>{{ device.serialNumber }}</td>
            <td>
              <span
                class="status-badge"
                :class="'status-' + device.status"
              >
                {{ getStatusLabel(device.status) }}
              </span>
            </td>
            <td>{{ device.location }}</td>
            <td>{{ device.currentHolderName || '-' }}</td>
            <td>
              <div class="action-buttons">
                <button
                  class="btn btn-default btn-sm"
                  @click="viewDevice(device)"
                >
                  详情
                </button>
                <button
                  v-if="canLend && device.status === 'available'"
                  class="btn btn-success btn-sm"
                  @click="openLendModal(device)"
                >
                  借出
                </button>
                <button
                  v-if="canReturn && device.status === 'borrowed'"
                  class="btn btn-warning btn-sm"
                  @click="openReturnModal(device)"
                >
                  归还
                </button>
                <button
                  v-if="canManage"
                  class="btn btn-default btn-sm"
                  @click="openEditModal(device)"
                >
                  编辑
                </button>
                <button
                  v-if="canManage"
                  class="btn btn-danger btn-sm"
                  @click="confirmDelete(device)"
                >
                  删除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="totalPages > 1" class="pagination">
      <button
        class="page-btn"
        :disabled="currentPage === 1"
        @click="changePage(currentPage - 1)"
      >
        上一页
      </button>
      <template v-for="page in visiblePages" :key="page">
        <button
          v-if="page !== '...'"
          class="page-btn"
          :class="{ active: page === currentPage }"
          @click="changePage(page as number)"
        >
          {{ page }}
        </button>
        <span v-else style="padding: 0 8px;">...</span>
      </template>
      <button
        class="page-btn"
        :disabled="currentPage === totalPages"
        @click="changePage(currentPage + 1)"
      >
        下一页
      </button>
    </div>
  </div>

  <CreateDeviceModal
    v-if="showCreateModal"
    @close="showCreateModal = false"
    @created="handleDeviceCreated"
  />

  <EditDeviceModal
    v-if="showEditModal && editingDevice"
    :device="editingDevice"
    @close="showEditModal = false"
    @updated="handleDeviceUpdated"
  />

  <DeviceDetailModal
    v-if="showDetailModal && viewingDevice"
    :device="viewingDevice"
    @close="showDetailModal = false"
  />

  <LendDeviceModal
    v-if="showLendModal && lendingDevice"
    :device="lendingDevice"
    @close="showLendModal = false"
    @lent="handleDeviceLent"
  />

  <ReturnDeviceModal
    v-if="showReturnModal && returningDevice"
    :device="returningDevice"
    @close="showReturnModal = false"
    @returned="handleDeviceReturned"
  />

  <BatchLendModal
    v-if="showBatchLendModal"
    :deviceIds="selectedDevices"
    @close="showBatchLendModal = false"
    @lent="handleBatchLent"
  />

  <ExportModal
    v-if="showExportModal"
    :dataType="'devices'"
    @close="showExportModal = false"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useToastStore } from '../stores/toast'
import { Permission, DeviceStatus, DeviceCategory } from '@shared/types'
import CreateDeviceModal from '../components/CreateDeviceModal.vue'
import EditDeviceModal from '../components/EditDeviceModal.vue'
import DeviceDetailModal from '../components/DeviceDetailModal.vue'
import LendDeviceModal from '../components/LendDeviceModal.vue'
import ReturnDeviceModal from '../components/ReturnDeviceModal.vue'
import BatchLendModal from '../components/BatchLendModal.vue'
import ExportModal from '../components/ExportModal.vue'

const authStore = useAuthStore()
const toastStore = useToastStore()

const devices = ref<any[]>([])
const loading = ref(false)
const searchText = ref('')
const filterStatus = ref('')
const filterCategory = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const selectedDevices = ref<string[]>([])

const showCreateModal = ref(false)
const showEditModal = ref(false)
const showDetailModal = ref(false)
const showLendModal = ref(false)
const showReturnModal = ref(false)
const showBatchLendModal = ref(false)
const showExportModal = ref(false)

const editingDevice = ref<any>(null)
const viewingDevice = ref<any>(null)
const lendingDevice = ref<any>(null)
const returningDevice = ref<any>(null)

const canManage = computed(() => authStore.hasPermission(Permission.MANAGE_DEVICES))
const canLend = computed(() => authStore.hasPermission(Permission.LEND_DEVICE))
const canReturn = computed(() => authStore.hasPermission(Permission.RETURN_DEVICE))
const canExport = computed(() => authStore.hasPermission(Permission.EXPORT_DATA))
const canImport = computed(() => authStore.hasPermission(Permission.IMPORT_DATA))

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

const visiblePages = computed(() => {
  const pages: (number | string)[] = []
  const total = totalPages.value
  const current = currentPage.value

  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i)
      pages.push('...')
      pages.push(total)
    } else if (current >= total - 3) {
      pages.push(1)
      pages.push('...')
      for (let i = total - 4; i <= total; i++) pages.push(i)
    } else {
      pages.push(1)
      pages.push('...')
      for (let i = current - 1; i <= current + 1; i++) pages.push(i)
      pages.push('...')
      pages.push(total)
    }
  }

  return pages
})

const isAllSelected = computed(() => {
  if (devices.value.length === 0) return false
  return devices.value.every(d => selectedDevices.value.includes(d.id))
})

let searchTimeout: number | null = null

async function loadDevices() {
  loading.value = true
  try {
    const params: any = {
      page: currentPage.value,
      pageSize: pageSize.value,
      sortBy: 'created_at',
      sortOrder: 'desc'
    }

    if (searchText.value) {
      params.search = searchText.value
    }
    if (filterStatus.value) {
      params.status = filterStatus.value
    }
    if (filterCategory.value) {
      params.category = filterCategory.value
    }

    const result = await window.api.devices.list(params)
    if (result.success && result.data) {
      devices.value = result.data.items || []
      total.value = result.data.total || 0
    }
  } catch (e) {
    toastStore.error('加载设备列表失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  searchTimeout = window.setTimeout(() => {
    currentPage.value = 1
    loadDevices()
  }, 300)
}

function changePage(page: number) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
  loadDevices()
}

function toggleSelect(deviceId: string) {
  const index = selectedDevices.value.indexOf(deviceId)
  if (index > -1) {
    selectedDevices.value.splice(index, 1)
  } else {
    selectedDevices.value.push(deviceId)
  }
}

function toggleSelectAll(event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  if (checked) {
    selectedDevices.value = devices.value.map(d => d.id)
  } else {
    selectedDevices.value = []
  }
}

function viewDevice(device: any) {
  viewingDevice.value = device
  showDetailModal.value = true
}

function openEditModal(device: any) {
  editingDevice.value = { ...device }
  showEditModal.value = true
}

function openLendModal(device: any) {
  lendingDevice.value = device
  showLendModal.value = true
}

function openReturnModal(device: any) {
  returningDevice.value = device
  showReturnModal.value = true
}

async function handleDeviceCreated() {
  showCreateModal.value = false
  toastStore.success('设备创建成功')
  loadDevices()
}

function handleDeviceUpdated() {
  showEditModal.value = false
  editingDevice.value = null
  toastStore.success('设备更新成功')
  loadDevices()
}

function handleDeviceLent() {
  showLendModal.value = false
  lendingDevice.value = null
  toastStore.success('设备借出成功')
  loadDevices()
}

function handleDeviceReturned() {
  showReturnModal.value = false
  returningDevice.value = null
  toastStore.success('设备归还成功')
  loadDevices()
}

function handleBatchLent() {
  showBatchLendModal.value = false
  selectedDevices.value = []
  toastStore.success('批量借出完成')
  loadDevices()
}

async function handleBatchReturn() {
  if (selectedDevices.value.length === 0) return

  const confirmMsg = `确认归还选中的 ${selectedDevices.value.length} 台设备？`
  if (!confirm(confirmMsg)) return

  try {
    const result = await window.api.batch.return(selectedDevices.value, authStore.currentUser!)
    if (result.success) {
      const batch = result.data
      toastStore.success(
        `批量归还完成: 成功 ${batch.successCount}, 失败 ${batch.failedCount}`
      )
      selectedDevices.value = []
      loadDevices()
    } else {
      toastStore.error(result.error || '批量归还失败')
    }
  } catch (e) {
    toastStore.error('批量归还失败')
  }
}

async function confirmDelete(device: any) {
  if (!confirm(`确认删除设备 ${device.deviceCode}？此操作不可撤销。`)) return

  try {
    const result = await window.api.devices.delete(device.id, authStore.currentUser!)
    if (result.success && result.data) {
      toastStore.success('设备删除成功')
      loadDevices()
    } else {
      toastStore.error(result.error || '删除失败')
    }
  } catch (e: any) {
    toastStore.error(e.message || '删除失败')
  }
}

async function handleImport() {
  try {
    const result = await window.api.import.devices(authStore.currentUser!)
    if (result.success) {
      const data = result.data
      if (data.validationErrors.length > 0) {
        toastStore.warning(`有 ${data.validationErrors.length} 条数据验证失败`)
      }
      if (data.batchOperation) {
        toastStore.success(
          `导入完成: 成功 ${data.batchOperation.successCount}, 失败 ${data.batchOperation.failedCount}`
        )
      }
      loadDevices()
    } else {
      toastStore.error(result.error || '导入失败')
    }
  } catch (e) {
    toastStore.error('导入失败')
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

onMounted(() => {
  loadDevices()
})

watch(currentPage, () => {
  loadDevices()
})
</script>
