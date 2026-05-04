<template>
  <div class="timeline-view">
    <div class="timeline-header">
      <h3>📅 时间轴视图</h3>
      <div class="timeline-controls">
        <span v-if="events.length > 0" class="time-range">
          {{ formatTime(firstTime) }} - {{ formatTime(lastTime) }}
        </span>
      </div>
    </div>
    
    <div v-if="events.length === 0" class="empty-state">
      <p>暂无事件数据，请先导入观测数据</p>
    </div>
    
    <div v-else class="timeline-container">
      <!-- 时间轴标尺 -->
      <div class="timeline-ruler">
        <div 
          v-for="(timeLabel, index) in timeLabels" 
          :key="index" 
          class="time-mark"
          :style="{ left: getTimePosition(timeLabel.value) + '%' }"
        >
          <span class="time-text">{{ timeLabel.label }}</span>
        </div>
      </div>
      
      <!-- 事件轨道 -->
      <div class="timeline-tracks">
        <div 
          v-for="(track, trackIndex) in tracks" 
          :key="trackIndex" 
          class="timeline-track"
        >
          <div 
            v-for="event in track" 
            :key="event.id" 
            class="timeline-event"
            :class="{ 
              'selected': event.id === selectedEventId,
              [event.status]: true
            }"
            :style="{
              left: getEventStartPosition(event) + '%',
              width: getEventWidth(event) + '%'
            }"
            @click="selectEvent(event)"
          >
            <div class="event-tooltip">
              <div class="tooltip-title">事件 {{ event.id.substring(0, 8) }}</div>
              <div class="tooltip-time">{{ formatTime(event.startTime) }}</div>
              <div class="tooltip-status">{{ getStatusText(event.status) }}</div>
              <div class="tooltip-confidence">置信度: {{ event.confidence }}%</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 状态图例 -->
      <div class="timeline-legend">
        <span class="legend-item" v-for="(item, index) in legendItems" :key="index">
          <span class="legend-color" :class="item.class"></span>
          <span class="legend-label">{{ item.label }}</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import dayjs from 'dayjs'

export default {
  name: 'TimelineView',
  props: {
    events: {
      type: Array,
      default: () => []
    },
    selectedEventId: {
      type: String,
      default: null
    }
  },
  emits: ['select-event'],
  setup(props, { emit }) {
    // 计算属性：按时间排序的事件
    const sortedEvents = computed(() => {
      return [...props.events].sort((a, b) => 
        new Date(a.startTime) - new Date(b.startTime)
      )
    })

    // 计算属性：最早和最晚时间
    const firstTime = computed(() => {
      if (sortedEvents.value.length === 0) return null
      return new Date(sortedEvents.value[0].startTime).getTime()
    })

    const lastTime = computed(() => {
      if (sortedEvents.value.length === 0) return null
      // 找到最晚的结束时间
      let maxEndTime = firstTime.value
      for (const event of sortedEvents.value) {
        const endTime = new Date(event.endTime).getTime()
        if (endTime > maxEndTime) maxEndTime = endTime
      }
      return maxEndTime
    })

    // 时间范围（添加一些边距）
    const timeRange = computed(() => {
      if (!firstTime.value || !lastTime.value) return 0
      const range = lastTime.value - firstTime.value
      // 添加 10% 的边距
      return range * 1.2
    })

    const adjustedFirstTime = computed(() => {
      if (!firstTime.value || !timeRange.value) return 0
      return firstTime.value - timeRange.value * 0.1
    })

    // 时间标签
    const timeLabels = computed(() => {
      if (!adjustedFirstTime.value || !timeRange.value) return []
      
      const labels = []
      const numLabels = 6
      
      for (let i = 0; i <= numLabels; i++) {
        const timeValue = adjustedFirstTime.value + (timeRange.value * i / numLabels)
        labels.push({
          value: timeValue,
          label: dayjs(timeValue).format('HH:mm:ss')
        })
      }
      
      return labels
    })

    // 将事件分配到轨道，避免重叠
    const tracks = computed(() => {
      const tracks = []
      
      for (const event of sortedEvents.value) {
        let placed = false
        const eventStart = new Date(event.startTime).getTime()
        const eventEnd = new Date(event.endTime).getTime()
        
        // 尝试放入现有轨道
        for (const track of tracks) {
          // 检查是否与轨道中最后一个事件重叠
          const lastEvent = track[track.length - 1]
          const lastEnd = new Date(lastEvent.endTime).getTime()
          
          if (eventStart >= lastEnd) {
            track.push(event)
            placed = true
            break
          }
        }
        
        // 如果没有找到合适的轨道，创建新轨道
        if (!placed) {
          tracks.push([event])
        }
      }
      
      return tracks
    })

    // 图例项
    const legendItems = [
      { class: 'pending', label: '待处理' },
      { class: 'confirmed', label: '已确认' },
      { class: 'rejected', label: '已驳回' },
      { class: 'needs_review', label: '需复核' },
      { class: 'duplicate', label: '重复' },
      { class: 'cloud_obscured', label: '云遮' },
      { class: 'power_loss', label: '掉电' }
    ]

    // 方法：格式化时间
    const formatTime = (timestamp) => {
      if (!timestamp) return ''
      return dayjs(timestamp).format('HH:mm:ss')
    }

    // 方法：获取时间位置百分比
    const getTimePosition = (timeValue) => {
      if (!timeRange.value || timeRange.value === 0) return 0
      const position = ((timeValue - adjustedFirstTime.value) / timeRange.value) * 100
      return Math.max(0, Math.min(100, position))
    }

    // 方法：获取事件起始位置
    const getEventStartPosition = (event) => {
      const eventStart = new Date(event.startTime).getTime()
      return getTimePosition(eventStart)
    }

    // 方法：获取事件宽度
    const getEventWidth = (event) => {
      if (!timeRange.value || timeRange.value === 0) return 2
      
      const eventStart = new Date(event.startTime).getTime()
      const eventEnd = new Date(event.endTime).getTime()
      const duration = eventEnd - eventStart
      
      let width = (duration / timeRange.value) * 100
      // 最小宽度
      width = Math.max(1.5, width)
      
      return width
    }

    // 方法：获取状态文本
    const getStatusText = (status) => {
      const statusMap = {
        pending: '待处理',
        confirmed: '已确认',
        rejected: '已驳回',
        needs_review: '需要复核',
        duplicate: '重复观测',
        cloud_obscured: '云层遮挡',
        power_loss: '设备掉电'
      }
      return statusMap[status] || status
    }

    // 方法：选择事件
    const selectEvent = (event) => {
      emit('select-event', event)
    }

    return {
      sortedEvents,
      firstTime,
      lastTime,
      timeLabels,
      tracks,
      legendItems,
      formatTime,
      getTimePosition,
      getEventStartPosition,
      getEventWidth,
      getStatusText,
      selectEvent
    }
  }
}
</script>

<style scoped>
.timeline-view {
  background: white;
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.timeline-header h3 {
  font-size: 1rem;
  color: #333;
  margin: 0;
}

.time-range {
  font-size: 0.8rem;
  color: #666;
  background: #f3f4f6;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #9ca3af;
  font-size: 0.9rem;
}

.timeline-container {
  position: relative;
}

.timeline-ruler {
  position: relative;
  height: 30px;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 0.5rem;
}

.time-mark {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
}

.time-text {
  font-size: 0.7rem;
  color: #6b7280;
  white-space: nowrap;
}

.timeline-tracks {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.timeline-track {
  position: relative;
  height: 24px;
}

.timeline-event {
  position: absolute;
  top: 2px;
  bottom: 2px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  min-width: 12px;
}

.timeline-event:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  z-index: 10;
}

.timeline-event.selected {
  outline: 2px solid #3b82f6;
  outline-offset: 1px;
  z-index: 20;
}

/* 状态颜色 */
.timeline-event.pending {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
}

.timeline-event.confirmed {
  background: linear-gradient(135deg, #34d399, #10b981);
}

.timeline-event.rejected {
  background: linear-gradient(135deg, #f87171, #ef4444);
}

.timeline-event.needs_review {
  background: linear-gradient(135deg, #fb923c, #f97316);
}

.timeline-event.duplicate {
  background: linear-gradient(135deg, #a78bfa, #8b5cf6);
}

.timeline-event.cloud_obscured {
  background: linear-gradient(135deg, #94a3b8, #64748b);
}

.timeline-event.power_loss {
  background: linear-gradient(135deg, #f87171, #dc2626);
}

/* 工具提示 */
.event-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #1f2937;
  color: white;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s ease;
  z-index: 100;
  margin-bottom: 4px;
}

.timeline-event:hover .event-tooltip {
  opacity: 1;
  visibility: visible;
}

.event-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: #1f2937;
}

.tooltip-title {
  font-weight: 600;
  margin-bottom: 2px;
}

.tooltip-time,
.tooltip-status,
.tooltip-confidence {
  color: #9ca3af;
  font-size: 0.7rem;
}

/* 图例 */
.timeline-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e5e7eb;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.legend-color.pending { background: #f59e0b; }
.legend-color.confirmed { background: #10b981; }
.legend-color.rejected { background: #ef4444; }
.legend-color.needs_review { background: #f97316; }
.legend-color.duplicate { background: #8b5cf6; }
.legend-color.cloud_obscured { background: #64748b; }
.legend-color.power_loss { background: #dc2626; }
</style>
