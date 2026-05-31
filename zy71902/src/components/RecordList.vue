<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../store'
import type { ScoreRecord, RecordStatus } from '../types'

const store = useStore()

const emit = defineEmits<{
  (e: 'open-history', record: ScoreRecord): void
  (e: 'open-status', record: ScoreRecord): void
}>()

const validRecords = computed(() => {
  return store.filteredRecords.value.filter((r: ScoreRecord) => r && r.id)
})

const allSelected = computed(() => {
  return validRecords.value.length > 0 && 
    validRecords.value.every((r: ScoreRecord) => store.state.selectedIds.includes(r.id))
})

function toggleSelectAll() {
  if (allSelected.value) {
    store.clearSelection()
  } else {
    store.selectAll()
  }
}

function getStatusClass(status: RecordStatus): string {
  const map: Record<RecordStatus, string> = {
    pending: 'status-pending',
    confirmed: 'status-confirmed',
    duplicate: 'status-duplicate',
    rejected: 'status-rejected'
  }
  return map[status]
}

function getStatusText(status: RecordStatus): string {
  const map: Record<RecordStatus, string> = {
    pending: '待处理',
    confirmed: '已确认',
    duplicate: '重复',
    rejected: '已驳回'
  }
  return map[status]
}

function getSourceText(source: string): string {
  const map: Record<string, string> = {
    selection_list: '选曲表',
    section_leader_note: '声部长备注',
    accompaniment_teacher: '伴奏老师',
    manual: '手工录入'
  }
  return map[source] || source
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getRowClass(record: ScoreRecord): string {
  if (record.status === 'duplicate') return 'duplicate'
  if (record.status === 'pending') return 'pending'
  return ''
}
</script>

<template>
  <div class="card">
    <div class="card-title">📋 记录列表</div>
    
    <div class="filter-bar">
      <div class="filter-item">
        <label>状态:</label>
        <select v-model="store.state.filter.status">
          <option value="">全部</option>
          <option value="pending">待处理</option>
          <option value="confirmed">已确认</option>
          <option value="duplicate">重复</option>
          <option value="rejected">已驳回</option>
        </select>
      </div>
      <div class="filter-item">
        <label>来源:</label>
        <select v-model="store.state.filter.source">
          <option value="">全部</option>
          <option value="selection_list">选曲表</option>
          <option value="section_leader_note">声部长备注</option>
          <option value="accompaniment_teacher">伴奏老师</option>
          <option value="manual">手工录入</option>
        </select>
      </div>
      <div class="filter-item">
        <label>学生:</label>
        <input 
          type="text" 
          v-model="store.state.filter.studentName" 
          placeholder="搜索姓名"
        />
      </div>
      <div class="filter-item">
        <label>曲目:</label>
        <input 
          type="text" 
          v-model="store.state.filter.songTitle" 
          placeholder="搜索曲目"
        />
      </div>
      <div class="filter-item">
        <label>乐器:</label>
        <input 
          type="text" 
          v-model="store.state.filter.instrument" 
          placeholder="搜索乐器"
        />
      </div>
    </div>

    <div v-if="store.filteredRecords.length === 0" class="empty-state">
      <div class="empty-state-icon">📭</div>
      <p>暂无记录，请先导入数据</p>
    </div>

    <div v-else class="table-container">
      <table>
        <thead>
          <tr>
            <th style="width: 40px;">
              <input 
                type="checkbox" 
                :checked="allSelected"
                @change="toggleSelectAll"
              />
            </th>
            <th>学生姓名</th>
            <th>乐器</th>
            <th>声部</th>
            <th>曲目</th>
            <th>状态</th>
            <th>来源</th>
            <th>待处理原因</th>
            <th>更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="record in validRecords" 
            :key="record.id"
            :class="getRowClass(record)"
          >
            <td>
              <input 
                type="checkbox" 
                :checked="store.state.selectedIds.includes(record.id)"
                @change="store.toggleSelect(record.id)"
              />
            </td>
            <td>
              <strong>{{ record.studentName }}</strong>
              <div v-if="record.duplicateIds && record.duplicateIds.length > 0" class="reason-text" style="color: #e67700;">
                ⚠️ 与 {{ record.duplicateIds.length }} 条记录重复
              </div>
            </td>
            <td>{{ record.instrument }}</td>
            <td>{{ record.part }}</td>
            <td>{{ record.songTitle }}</td>
            <td>
              <span class="status-badge" :class="getStatusClass(record.status)">
                {{ getStatusText(record.status) }}
              </span>
            </td>
            <td>
              <span class="source-tag">{{ getSourceText(record.source) }}</span>
              <div class="reason-text">{{ record.sourceName }}</div>
            </td>
            <td>
              <span class="reason-text" :title="record.pendingReason">
                {{ record.pendingReason || '-' }}
              </span>
            </td>
            <td>{{ formatDate(record.updatedAt) }}</td>
            <td>
              <div class="btn-group">
                <button 
                  class="btn btn-secondary btn-sm" 
                  title="查看历史"
                  @click="emit('open-history', record)"
                >
                  📜
                </button>
                <button 
                  class="btn btn-primary btn-sm" 
                  title="修改状态"
                  @click="emit('open-status', record)"
                >
                  ✏️
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
