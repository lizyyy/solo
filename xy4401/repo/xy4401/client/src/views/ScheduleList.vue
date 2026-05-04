<template>
  <div class="container mt-4">
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">📋 历史排程</h3>
        <button class="btn btn-secondary" @click="loadSchedules">
          刷新
        </button>
      </div>

      <div v-if="loading" class="text-center py-8">
        <p class="text-muted">加载中...</p>
      </div>

      <div v-else-if="schedules.length === 0" class="text-center py-8">
        <h2 class="text-xl mb-2">暂无历史排程</h2>
        <p class="text-muted mb-4">
          您还没有保存任何排程方案
        </p>
        <router-link to="/scheduling" class="btn btn-primary">
          创建排程
        </router-link>
      </div>

      <table v-else class="table">
        <thead>
          <tr>
            <th>排程名称</th>
            <th>创建时间</th>
            <th>更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="schedule in schedules" :key="schedule.id">
            <td class="font-semibold">{{ schedule.name }}</td>
            <td>{{ formatTime(schedule.createdAt) }}</td>
            <td>{{ formatTime(schedule.updatedAt) }}</td>
            <td>
              <div class="flex gap-2">
                <button 
                  class="btn btn-sm btn-primary"
                  @click="loadSchedule(schedule.id)"
                >
                  加载
                </button>
                <button 
                  class="btn btn-sm btn-secondary"
                  @click="exportMarkdown(schedule.id)"
                >
                  导出MD
                </button>
                <button 
                  class="btn btn-sm btn-secondary"
                  @click="exportJson(schedule.id)"
                >
                  导出JSON
                </button>
                <button 
                  class="btn btn-sm btn-danger"
                  @click="confirmDelete(schedule)"
                >
                  删除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showDeleteModal" class="modal-overlay" @click.self="showDeleteModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">确认删除</h3>
          <button class="modal-close" @click="showDeleteModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <p>确定要删除排程 "<strong>{{ scheduleToDelete?.name }}</strong>" 吗？</p>
          <p class="text-muted text-sm mt-2">此操作无法撤销。</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showDeleteModal = false">取消</button>
          <button 
            class="btn btn-danger"
            :disabled="deleting"
            @click="handleDelete"
          >
            {{ deleting ? '删除中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="message" class="alert fixed" :class="messageType" style="
      position: fixed;
      top: 70px;
      right: 20px;
      z-index: 2000;
      min-width: 300px;
    ">
      {{ message }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useScheduleStore } from '@/stores/scheduleStore'
import { storeToRefs } from 'pinia'
import dayjs from 'dayjs'

const router = useRouter()
const store = useScheduleStore()
const { schedules } = storeToRefs(store)

const loading = ref(false)
const deleting = ref(false)
const showDeleteModal = ref(false)
const scheduleToDelete = ref(null)
const message = ref('')
const messageType = ref('')

onMounted(() => {
  loadSchedules()
})

async function loadSchedules() {
  loading.value = true
  try {
    await store.loadSchedules()
  } catch (error) {
    showMessage('加载失败: ' + error.message, 'alert-error')
  } finally {
    loading.value = false
  }
}

async function loadSchedule(id) {
  try {
    const result = await store.loadSchedule(id)
    if (result.success) {
      showMessage('排程已加载', 'alert-success')
      router.push('/scheduling')
    } else {
      showMessage(result.error || '加载失败', 'alert-error')
    }
  } catch (error) {
    showMessage('加载失败: ' + error.message, 'alert-error')
  }
}

function confirmDelete(schedule) {
  scheduleToDelete.value = schedule
  showDeleteModal.value = true
}

async function handleDelete() {
  if (!scheduleToDelete.value) return
  
  deleting.value = true
  try {
    const result = await store.deleteSchedule(scheduleToDelete.value.id)
    if (result.success) {
      showMessage('排程已删除', 'alert-success')
      showDeleteModal.value = false
    } else {
      showMessage(result.error || '删除失败', 'alert-error')
    }
  } catch (error) {
    showMessage('删除失败: ' + error.message, 'alert-error')
  } finally {
    deleting.value = false
    scheduleToDelete.value = null
  }
}

async function exportMarkdown(id) {
  try {
    const result = await store.exportMarkdown()
    if (result.success) {
      showMessage('Markdown 已导出', 'alert-success')
    } else {
      showMessage(result.error || '导出失败', 'alert-error')
    }
  } catch (error) {
    showMessage('导出失败: ' + error.message, 'alert-error')
  }
}

async function exportJson(id) {
  try {
    const result = await store.exportJson()
    if (result.success) {
      showMessage('JSON 已导出', 'alert-success')
    } else {
      showMessage(result.error || '导出失败', 'alert-error')
    }
  } catch (error) {
    showMessage('导出失败: ' + error.message, 'alert-error')
  }
}

function formatTime(time) {
  return time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'
}

function showMessage(msg, type) {
  message.value = msg
  messageType.value = type
  setTimeout(() => {
    message.value = ''
  }, 5000)
}
</script>
