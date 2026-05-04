<template>
  <div class="card">
    <div class="card-header">
      <h3 class="card-title">📅 时间轴视图</h3>
      <div class="flex gap-2">
        <span class="badge badge-success" style="background: #4caf50; color: white;">正常</span>
        <span class="badge" style="background: #ff9800; color: white;">有警告</span>
        <span class="badge" style="background: #f44336; color: white;">冲突</span>
      </div>
    </div>

    <div class="timeline">
      <div class="timeline-header">
        <div class="timeline-row-labels">泊位</div>
        <div class="timeline-content">
          <div class="timeline-grid">
            <div 
              v-for="(hour, idx) in timelineHours" 
              :key="idx"
              class="timeline-hour-marker"
              :class="{
                'working-hour': hour >= workStartHour && hour < workEndHour,
                'night-hour': hour < workStartHour || hour >= workEndHour
              }"
            >
              {{ String(hour).padStart(2, '0') }}:00
            </div>
          </div>
        </div>
      </div>

      <div v-for="berth in berths" :key="berth.id">
        <div class="timeline-row">
          <div class="timeline-row-labels">
            <div class="font-semibold">{{ berth.name }}</div>
            <div class="text-xs text-muted">最大吃水: {{ berth.maxDraft || '-' }}m</div>
          </div>
          <div class="timeline-events">
            <template v-for="event in getEventsForBerth(berth.id)" :key="event.id">
              <div 
                class="timeline-event"
                :class="{
                  selected: selectedEventId === event.id,
                  conflict: hasConflict(event),
                  warning: hasWarning(event)
                }"
                :style="{
                  left: getEventLeft(event) + 'px',
                  width: getEventWidth(event) + 'px',
                  backgroundColor: getEventColor(event)
                }"
                @mousedown="handleMouseDown($event, event)"
                @click="$emit('select-barge', event.barge)"
              >
                <div class="font-semibold" style="color: white;">{{ event.barge.name }}</div>
                <div class="timeline-event-draft">
                  {{ formatTime(event.startTime) }} - {{ formatTime(event.endTime) }}
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div v-if="isDragging" class="mt-4 p-3 alert alert-info">
      <strong>拖动中:</strong> {{ draggingEvent?.barge.name }}
      <span class="ml-4">目标泊位: {{ targetBerth?.name || '-' }}</span>
      <span class="ml-4">目标时间: {{ targetTime ? formatTime(targetTime) : '-' }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import dayjs from 'dayjs'

const props = defineProps({
  schedule: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update-barge', 'select-barge'])

const workStartHour = ref(8)
const workEndHour = ref(18)
const isDragging = ref(false)
const draggingEvent = ref(null)
const selectedEventId = ref(null)
const targetBerth = ref(null)
const targetTime = ref(null)

const timelineHours = computed(() => {
  const hours = []
  for (let i = 0; i < 48; i++) {
    hours.push(i)
  }
  return hours
})

const berths = computed(() => {
  const uniqueBerths = new Map()
  
  if (props.schedule?.barges) {
    for (const barge of props.schedule.barges) {
      if (barge.assignedBerth) {
        uniqueBerths.set(barge.assignedBerth.id, barge.assignedBerth)
      }
    }
  }
  
  return Array.from(uniqueBerths.values()).sort((a, b) => a.name.localeCompare(b.name))
})

const HOUR_WIDTH = 100
const MINUTE_WIDTH = HOUR_WIDTH / 60

const timeRange = computed(() => {
  if (!props.schedule?.barges?.length) {
    const now = dayjs().startOf('day')
    return { start: now, end: now.add(48, 'hours') }
  }

  let earliest = null
  let latest = null

  for (const barge of props.schedule.barges) {
    if (barge.assignedTime) {
      const start = dayjs(barge.assignedTime.startTime)
      const end = dayjs(barge.assignedTime.endTime)
      
      if (!earliest || start.isBefore(earliest)) {
        earliest = start
      }
      if (!latest || end.isAfter(latest)) {
        latest = end
      }
    }
  }

  if (earliest && latest) {
    earliest = earliest.startOf('day')
    latest = latest.endOf('day').add(1, 'day')
    
    const diff = latest.diff(earliest, 'hours')
    if (diff < 48) {
      latest = earliest.add(48, 'hours')
    }
  } else {
    const now = dayjs().startOf('day')
    earliest = now
    latest = now.add(48, 'hours')
  }

  return { start: earliest, end: latest }
})

function getEventsForBerth(berthId) {
  if (!props.schedule?.barges) return []
  
  return props.schedule.barges
    .filter(barge => barge.assignedTime && barge.assignedBerth?.id === berthId)
    .map(barge => ({
      id: barge.id || barge.name,
      barge: barge,
      startTime: dayjs(barge.assignedTime.startTime),
      endTime: dayjs(barge.assignedTime.endTime),
      assignedTime: barge.assignedTime,
      assignedBerth: barge.assignedBerth
    }))
}

function getEventLeft(event) {
  const diff = event.startTime.diff(timeRange.value.start, 'minutes')
  return diff * MINUTE_WIDTH
}

function getEventWidth(event) {
  const diff = event.endTime.diff(event.startTime, 'minutes')
  return Math.max(diff * MINUTE_WIDTH, 60)
}

function getEventColor(event) {
  if (hasConflict(event)) {
    return '#f44336'
  }
  if (hasWarning(event)) {
    return '#ff9800'
  }
  return '#2196f3'
}

function hasConflict(event) {
  if (!props.schedule?.conflicts) return false
  
  return props.schedule.conflicts.some(conflict => {
    if (conflict.type === 'berth_conflict' && conflict.barges) {
      return conflict.barges.includes(event.barge.name)
    }
    return false
  })
}

function hasWarning(event) {
  if (event.barge.assignedTime?.issues?.length > 0) {
    return true
  }
  
  if (props.schedule?.warnings) {
    return props.schedule.warnings.some(warning => 
      warning.barge === event.barge.name
    )
  }
  
  return false
}

function formatTime(time) {
  if (!time) return '-'
  const d = dayjs(time)
  if (d.isSame(dayjs(), 'day')) {
    return d.format('HH:mm')
  }
  return d.format('MM-DD HH:mm')
}

function handleMouseDown(e, event) {
  e.preventDefault()
  e.stopPropagation()
  
  isDragging.value = true
  draggingEvent.value = event
  selectedEventId.value = event.id
  
  const startX = e.clientX
  const startY = e.clientY
  const originalStartTime = event.startTime
  const originalBerthId = event.assignedBerth.id

  function handleMouseMove(moveEvent) {
    if (!isDragging.value) return

    const timelineEl = document.querySelector('.timeline-content')
    if (!timelineEl) return

    const rect = timelineEl.getBoundingClientRect()
    const relativeX = moveEvent.clientX - rect.left
    const relativeY = moveEvent.clientY - rect.top

    const minuteOffset = relativeX / MINUTE_WIDTH
    targetTime.value = timeRange.value.start.add(minuteOffset, 'minutes').startOf('minute')

    targetBerth.value = findBerthAtPosition(moveEvent.clientY)
  }

  function handleMouseUp(upEvent) {
    if (isDragging.value && draggingEvent.value) {
      if (targetTime.value && targetBerth.value) {
        const duration = draggingEvent.value.endTime.diff(draggingEvent.value.startTime, 'minutes')
        const newEndTime = targetTime.value.add(duration, 'minutes')
        
        const newTime = {
          startTime: targetTime.value.toISOString(),
          endTime: newEndTime.toISOString(),
          minHeight: draggingEvent.value.assignedTime.minHeight,
          maxCurrent: draggingEvent.value.assignedTime.maxCurrent,
          issues: draggingEvent.value.assignedTime.issues || []
        }

        emit('update-barge', {
          bargeId: draggingEvent.value.id,
          newTime: newTime,
          newBerth: targetBerth.value
        })
      }
    }

    isDragging.value = false
    draggingEvent.value = null
    targetBerth.value = null
    targetTime.value = null

    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

function findBerthAtPosition(clientY) {
  const rows = document.querySelectorAll('.timeline-row')
  
  for (const row of rows) {
    const rect = row.getBoundingClientRect()
    if (clientY >= rect.top && clientY <= rect.bottom) {
      const labelEl = row.querySelector('.timeline-row-labels')
      if (labelEl) {
        const berthName = labelEl.querySelector('.font-semibold')?.textContent
        if (berthName) {
          return berths.value.find(b => b.name === berthName)
        }
      }
    }
  }
  
  return null
}
</script>
