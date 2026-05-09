<template>
  <div class="card">
    <div class="card-header">
      <h2 class="card-title">用户管理</h2>
      <div class="toolbar">
        <button
          class="btn btn-primary"
          @click="showCreateModal = true"
        >
          ➕ 新增用户
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>
    <div v-else-if="users.length === 0" class="empty-state">
      <div class="empty-icon">👥</div>
      <p>暂无用户</p>
    </div>
    <div v-else class="table-container">
      <table>
        <thead>
          <tr>
            <th>用户名</th>
            <th>显示名称</th>
            <th>角色</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>{{ user.username }}</td>
            <td>{{ user.displayName }}</td>
            <td>
              <span
                class="role-badge"
                :class="'role-' + user.role"
              >
                {{ getRoleLabel(user.role) }}
              </span>
            </td>
            <td>
              <span
                class="status-badge"
                :class="user.isActive ? 'status-available' : 'status-lost'"
              >
                {{ user.isActive ? '启用' : '禁用' }}
              </span>
            </td>
            <td>{{ formatDate(user.createdAt) }}</td>
            <td>
              <div class="action-buttons">
                <button
                  class="btn btn-default btn-sm"
                  @click="openEditModal(user)"
                >
                  编辑
                </button>
                <button
                  class="btn btn-default btn-sm"
                  @click="openResetModal(user)"
                >
                  重置密码
                </button>
                <button
                  v-if="user.isActive"
                  class="btn btn-warning btn-sm"
                  @click="toggleActive(user)"
                >
                  禁用
                </button>
                <button
                  v-else
                  class="btn btn-success btn-sm"
                  @click="toggleActive(user)"
                >
                  启用
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
      <button
        class="page-btn"
        :class="{ active: currentPage === p }"
        v-for="p in visiblePages"
        :key="p"
        @click="changePage(p)"
      >
        {{ p }}
      </button>
      <button
        class="page-btn"
        :disabled="currentPage === totalPages"
        @click="changePage(currentPage + 1)"
      >
        下一页
      </button>
    </div>
  </div>

  <CreateUserModal
    v-if="showCreateModal"
    @close="showCreateModal = false"
    @created="handleUserCreated"
  />

  <EditUserModal
    v-if="showEditModal && editingUser"
    :user="editingUser"
    @close="showEditModal = false"
    @updated="handleUserUpdated"
  />

  <ResetPasswordModal
    v-if="showResetModal && resettingUser"
    :user="resettingUser"
    @close="showResetModal = false"
    @reset="handlePasswordReset"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useToastStore } from '../stores/toast'
import { UserRole } from '@shared/types'
import CreateUserModal from '../components/CreateUserModal.vue'
import EditUserModal from '../components/EditUserModal.vue'
import ResetPasswordModal from '../components/ResetPasswordModal.vue'

const toastStore = useToastStore()

const users = ref<any[]>([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

const showCreateModal = ref(false)
const showEditModal = ref(false)
const showResetModal = ref(false)

const editingUser = ref<any>(null)
const resettingUser = ref<any>(null)

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))
const visiblePages = computed(() => {
  const pages: number[] = []
  for (let i = 1; i <= totalPages.value; i++) {
    if (i <= 5 || i >= totalPages.value - 2 || Math.abs(i - currentPage.value) <= 2) {
      pages.push(i)
    }
  }
  return pages.filter((p, i, arr) => i === 0 || p !== arr[i - 1])
})

async function loadUsers() {
  loading.value = true
  try {
    const result = await window.api.users.list({
      page: currentPage.value,
      pageSize: pageSize.value,
      sortBy: 'created_at',
      sortOrder: 'desc'
    })
    if (result.success && result.data) {
      users.value = result.data.items || []
      total.value = result.data.total || 0
    }
  } catch (e) {
    toastStore.error('加载用户列表失败')
  } finally {
    loading.value = false
  }
}

function changePage(page: number) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
}

function openEditModal(user: any) {
  editingUser.value = { ...user }
  showEditModal.value = true
}

function openResetModal(user: any) {
  resettingUser.value = user
  showResetModal.value = true
}

async function toggleActive(user: any) {
  const action = user.isActive ? '禁用' : '启用'
  if (!confirm(`确认${action}用户 ${user.username}？`)) return

  try {
    const result = await window.api.users.update(user.id, { isActive: !user.isActive })
    if (result.success) {
      toastStore.success(`用户已${action}`)
      loadUsers()
    } else {
      toastStore.error(result.error || '操作失败')
    }
  } catch (e) {
    toastStore.error('操作失败')
  }
}

function handleUserCreated() {
  showCreateModal.value = false
  toastStore.success('用户创建成功')
  loadUsers()
}

function handleUserUpdated() {
  showEditModal.value = false
  editingUser.value = null
  toastStore.success('用户更新成功')
  loadUsers()
}

function handlePasswordReset() {
  showResetModal.value = false
  resettingUser.value = null
  toastStore.success('密码重置成功')
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN')
}

function getRoleLabel(role: string): string {
  switch (role) {
    case UserRole.ADMIN:
      return '管理员'
    case UserRole.OPERATOR:
      return '操作员'
    case UserRole.USER:
      return '普通用户'
    default:
      return role
  }
}

onMounted(() => {
  loadUsers()
})

watch(currentPage, () => {
  loadUsers()
})
</script>
