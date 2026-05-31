<script setup lang="ts">
import type { ScoreRecord } from '../types'

const props = defineProps<{
  record: ScoreRecord
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN')
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">📜 历史记录</div>
        <button class="modal-close" @click="emit('close')">&times;</button>
      </div>
      
      <div style="margin-bottom: 16px; padding: 12px; background: #f8f9fa; border-radius: 8px;">
        <div style="font-weight: 600; margin-bottom: 4px;">
          {{ record.studentName }} - {{ record.songTitle }}
        </div>
        <div style="font-size: 12px; color: #666;">
          {{ record.instrument }} | {{ record.part }}
        </div>
      </div>

      <div class="history-list">
        <div 
          v-for="entry in [...record.history].reverse()" 
          :key="entry.id" 
          class="history-item"
        >
          <div class="history-time">{{ formatDate(entry.timestamp) }}</div>
          <div class="history-action">{{ entry.action }}</div>
          <div class="history-detail">
            操作人: {{ entry.operator }}<br/>
            详情: {{ entry.detail }}
            <span v-if="entry.oldStatus && entry.newStatus">
              <br/>状态变更: {{ entry.oldStatus }} → {{ entry.newStatus }}
            </span>
          </div>
        </div>
      </div>

      <div style="margin-top: 20px; text-align: right;">
        <button class="btn btn-secondary" @click="emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>
